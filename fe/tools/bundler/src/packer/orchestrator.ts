/**
 * PackerOrchestrator — 主编排（fe-tools-packer-orchestrator · D-OR-0..8）。
 *
 * 迁入原 build-pipeline 过程体（init → concurrent compile → publish）。
 * 公开 build / watch 经入口适配器调 orchestrate；返回今日 buildResult（D-OR-7）。
 * 不写 implements PackerOrchestrator（返回值与形状 EmitEntry[] 张力，D-OR-7）。
 */

import path from 'node:path'
import process from 'node:process'
import { Listr, PRESET_TIMER } from 'listr2'
import type { ListrTask, ListrBaseClassOptions } from 'listr2'
import { createLifecycle, LIFECYCLE_EVENTS } from '../shared/lifecycle.ts'
import { getRenderer, registerRenderer } from '../compiler/core/renderers.ts'
import { createCompileTarget } from '../compiler/pipeline/compile-target.ts'
import type { PagesInfo, LoadBindings } from '../compiler/pipeline/compile-target.types.ts'
import { createDispatchRegistry, computeStagePlan, readLoadBindings, LoaderRegistryImpl, CompileRegistryImpl, EmitRegistryImpl } from './registry.ts'
import type { PackerDispatchRegistry } from './registry.ts'
import { logicLoader } from '../compiler/logic/registry-impl.ts'
import { createDist, publishToDist } from '../compiler/pipeline/publish.ts'
import { PackerSessionState } from './session-state.ts'
import type { OrchestrateOptions, LoaderRegistry, StageChannelContext } from './types.ts'
import { artCode, resetAssetCache } from '../shared/utils.ts'
import { NpmBuilder } from '../compiler/core/npm-builder.ts'
import compileConfig from '../compiler/pipeline/config-compiler.ts'
import { getAppConfigInfo, getAppName, getPages, getTargetPath, getWorkPath, isMiniGame, runWithCompilerContext } from '../compiler/core/env.ts'
import { executeTask } from '../compiler/worker-runtime/executor.ts'
import { emitEngine } from '../compiler/pipeline/emit-engine.ts'
import { runCompileStage } from '../compiler/pipeline/stage-channel.ts'
import type { RunCompileStageParams } from '../compiler/pipeline/stage-channel.ts'
import { BuildModel, materialize } from '../model/build-model.ts'
import { createProjectStore } from '../model/project-store.ts'
import { deriveLogicBuckets } from '../model/convergence.ts'

interface RendererAdapter {
	runViewStage?: (ctx: Record<string, unknown>, task: unknown, wo: Record<string, unknown>, lc: { emit: (e: string, p: unknown) => Promise<void> }) => Promise<void>
	runStyleStage?: (ctx: Record<string, unknown>, task: unknown, wo: Record<string, unknown>, lc: { emit: (e: string, p: unknown) => Promise<void> }) => Promise<void>
}

/** orch 内部调用面（D-OR-8）：非 OrchestrateOptions 的装配参数。 */
export interface OrchestrateRequest extends OrchestrateOptions {
	targetPath: string
	workPath: string
	useAppIdDir?: boolean
	state: PackerSessionState
	store?: unknown
	lifecycle?: { emit: (e: string, p: unknown) => Promise<void>; isolatedListenerErrors: unknown[] }
	fileTypes?: unknown
	/** C1 / createCompileTarget 其余字段（mode/platform/minify/…） */
	compileOptions?: Record<string, unknown>
}

type Lifecycle = { emit: (e: string, p: unknown) => Promise<void>; isolatedListenerErrors: unknown[] }

let isPrinted = false
const previousCompatibilityWarnings = new Map<string, Set<string>>()
const MAX_WARNING_PROJECTS = 32

/**
 * webview renderer 阶段级薄适配（A4 P-002）。
 */
const webviewRenderer = {
	name: 'webview',
	runViewStage: async (ctx: Record<string, unknown>, task: unknown, workerOptions: Record<string, unknown>, lifecycle: { emit: (e: string, p: unknown) => Promise<void> }): Promise<void> =>
		runCompileStage({ script: 'view', ctx, task: task as { output: string }, options: workerOptions, lifecycle, onOutput: (entry: unknown) => ((ctx as unknown as StageChannelContext).buildModel as { add: (e: unknown) => void }).add(entry) }),
	runStyleStage: async (ctx: Record<string, unknown>, task: unknown, workerOptions: Record<string, unknown>, lifecycle: { emit: (e: string, p: unknown) => Promise<void> }): Promise<void> =>
		runCompileStage({ script: 'style', ctx, task: task as { output: string }, options: workerOptions, lifecycle, onOutput: (entry: unknown) => ((ctx as unknown as StageChannelContext).buildModel as { add: (e: unknown) => void }).add(entry) }),
}
if (!getRenderer('webview')) {
	registerRenderer(webviewRenderer)
}

export function createPackerOrchestrator({
	store: providedStore,
	lifecycle: pipelineLifecycle,
}: {
	store?: unknown
	lifecycle?: Lifecycle
} = {}) {
	const dispatchRegistry = createDispatchRegistry()
	// H2 Phase 2a（D-REG-2）：loaderRegistry 实体化——logic Loader 已注册（F-H2-1 logic 可直接包装）。
	// view/style Loader 待 F-H2-1 拆分后注册。compile/emit registry 仍是 stub（Phase 2b/2c）。
	// D-HR-1（fe-tools-hmr-chain-residuals）：compile/emit registry 实体化（CompileRegistryImpl/EmitRegistryImpl）
	// ——阶段函数形状适配（需 page/继承上下文）是后续门，dispatch 不接线（locked B：compile/emit 维持 worker）。
	const loaderRegistry = new LoaderRegistryImpl()
	loaderRegistry.register('logic', logicLoader)
	const compileRegistry = new CompileRegistryImpl()
	const emitRegistry = new EmitRegistryImpl()

	async function orchestrate(request: OrchestrateRequest): Promise<Record<string, unknown>> {
		return runWithCompilerContext(() => _orchestrate(request, providedStore, pipelineLifecycle, dispatchRegistry, loaderRegistry))
	}

	return {
		loaderRegistry,
		compileRegistry,
		emitRegistry,
		dispatchRegistry,
		orchestrate,
	}
}

async function _orchestrate(
	request: OrchestrateRequest,
	providedStore: unknown,
	pipelineLifecycle: Lifecycle | undefined,
	dispatchRegistry: PackerDispatchRegistry,
	loaderRegistry: LoaderRegistry,
): Promise<Record<string, unknown>> {
	const {
		targetPath,
		workPath,
		useAppIdDir = true,
		state,
		store: runStore,
		lifecycle: runLifecycle,
		fileTypes,
		affectedEntries,
		stages,
		seedPath,
		prepareConfig = true,
		prepareNpm = true,
		invalidatedModules,
		skipMaterialize,
		parallel = true,
		compileOptions = {},
	} = request

	const store = (runStore ?? providedStore ?? createProjectStore()) as {
		load: (w: string, o: unknown) => Record<string, unknown>
		getDependencyGraph: () => { addFile: (n: string, f: string, k: string) => void; toJSON: () => unknown }
	}

	const runOptions: Record<string, unknown> = {
		...compileOptions,
		targetPath,
		workPath,
		useAppIdDir,
		fileTypes,
		stages,
		affectedEntries,
		seedPath,
	}
	const compileTarget = createCompileTarget(runOptions)
	const lifecycle = runLifecycle || pipelineLifecycle || createLifecycle()
	let loadBindings: { pages?: unknown; appId?: string } | null = null

	const serializableOptions = {
		...compileOptions,
		fileTypes,
		stages,
		affectedEntries,
		seedPath,
		prepareConfig,
		prepareNpm,
		skipMaterialize,
		parallel: request.parallel,
		incremental: request.incremental,
		configChanged: request.configChanged,
		invalidatedModules,
	}

	try {
		await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_START, {
			workPath,
			targetPath,
			useAppIdDir,
			options: serializableOptions,
		})

		const shouldPrepareConfig = !seedPath || prepareConfig
		const shouldPrepareNpm = !seedPath || prepareNpm
		resetAssetCache()

		if (!isPrinted) {
			artCode()
			isPrinted = true
		}

		const cache = state.moduleCache
		// G5 D-G5-2: view/style cache plumbing（optional——one-shot undefined→ctx undefined→stage-channel 写 no-op；watch-runner init 实例）
		const viewCache = state.viewCache
		const viewOrderList = state.viewOrderList
		const styleCache = state.styleCache

		const initPhases = [
			{
				title: '收集配置信息',
				task: async (ctx: Record<string, unknown>) => {
					const sctx = ctx as unknown as StageChannelContext
					sctx.buildModel = new BuildModel()
					const _store = store as { load: (w: string, o: unknown) => Record<string, unknown>; getDependencyGraph: () => unknown }
					sctx.storeInfo = _store.load(workPath, { fileTypes, graph: state.graph });
					sctx.dependencyGraph = _store.getDependencyGraph()
					sctx.cache = cache
					// D-HR-1（fe-tools-hmr-chain-residuals）：loaderRegistry 生产消费点——
					// kinds() 派发配置查询（grep 非零）。阶段函数形状适配是后续门，
					// dispatch 不接线（locked B：compile/emit 维持 worker）。loadedModules 供后续门消费。
					sctx.loadedModules = new Map()
					for (const kind of loaderRegistry.kinds()) {
						void loaderRegistry.get(kind as 'logic' | 'view' | 'style' | 'config')
					}
				// G5 D-G5-2: plumbing view/style cache（镜像 logic cache 模式）
				sctx.viewCache = viewCache
				sctx.viewOrderList = viewOrderList
				sctx.styleCache = styleCache
					if (invalidatedModules) sctx.invalidatedModules = invalidatedModules
					const allPages = getPages()
					await lifecycle.emit(LIFECYCLE_EVENTS.CONFIG_COLLECTED, {
						fileTypes: ((ctx.storeInfo as { compilerOptions?: unknown }).compilerOptions),
						pagesCount: allPages.mainPages.length
							+ Object.values(allPages.subPages).reduce((sum: number, item: { info: unknown[] }) => sum + item.info.length, 0),
						miniGame: isMiniGame(),
					})
				},
			},
			{
				title: '准备产物目录',
				task: async () => {
					createDist(seedPath)
					await lifecycle.emit(LIFECYCLE_EVENTS.DIST_PREPARED, { seedPath })
				},
			},
			...(shouldPrepareConfig ? [{
				title: '编译配置信息',
				task: async () => {
					compileConfig()
					await lifecycle.emit(LIFECYCLE_EVENTS.CONFIG_COMPILED, {})
				},
			}] : []),
			...(shouldPrepareNpm ? [{
				title: '构建 npm 包',
				task: async (ctx: Record<string, unknown>) => {
					const sctx = ctx as unknown as StageChannelContext
					const npmBuilder = new NpmBuilder(getWorkPath(), getTargetPath(), (sctx.dependencyGraph as { addFile: (n: string, f: string, k: string) => void } | undefined) ?? null)
					await npmBuilder.buildNpmPackages()
					await lifecycle.emit(LIFECYCLE_EVENTS.NPM_BUILT, {})
				},
			}] : []),
		]

		const tasks = new Listr(([
			{
				title: '初始化项目',
				task: (_: unknown, task: { newListr: (p: unknown[], o: unknown) => unknown }) => task.newListr(initPhases, { concurrent: false }),
			},
			{
				title: `编译项目 · ${path.basename(path.resolve(workPath))}`,
				task: (ctx: Record<string, unknown>, task: unknown): unknown => {
					const sctx = ctx as unknown as StageChannelContext
					loadBindings = readLoadBindings() as { pages: unknown; appId: string } | null
					sctx.allPages = (loadBindings as { pages?: unknown } | null)?.pages as unknown
					sctx.compatibilityWarnings = new Set<string>()

					const plan = computeStagePlan(dispatchRegistry, compileTarget, loadBindings as LoadBindings, {
						cwd: process.cwd(),
						affectedEntries,
					})
					sctx.pages = (plan as { filteredPages: PagesInfo }).filteredPages
					const logicOpts = (plan as { stageSpecs: Record<string, { workerOptions: Record<string, unknown> }> }).stageSpecs.logic?.workerOptions
					if (logicOpts) {
						sctx.compileConfig = logicOpts.compileConfig as unknown
						sctx.sourcemap = logicOpts.sourcemap as boolean | undefined
						sctx.sourcemapTargetPath = logicOpts.sourcemapTargetPath as string | undefined
					}
					const compileTasks = (plan as { stages: string[]; stageSpecs: Record<string, { workerOptions: Record<string, unknown>; renderer?: unknown }> }).stageSpecs
						? (plan as { stages: string[]; stageSpecs: Record<string, { workerOptions: Record<string, unknown>; renderer?: unknown }> }).stages.map((stage) => {
						const spec = (plan as { stageSpecs: Record<string, { workerOptions: Record<string, unknown>; renderer?: unknown }> }).stageSpecs[stage]!
						const dispatch = dispatchRegistry.get(stage)
						return createStageTask(
							stage,
							dispatch?.title ?? stage,
							dispatch?.engine ?? null,
							lifecycle,
							spec.workerOptions,
							spec.renderer as RendererAdapter | null,
						)
					})
						: []

					if (compileTasks.length > 0) {
						return ((task as { newListr: (p: unknown[], o: unknown) => unknown }).newListr)(compileTasks, { concurrent: parallel !== false })
					}
					return undefined
				},
			},
			{
				title: 'Logic emit',
				task: async (ctx: Record<string, unknown>) => {
					const sctx = ctx as unknown as StageChannelContext
					// H1 (D-ED-1 B2+E): deriveFromGraph 接线 — graph + cache 派生 logic emit buckets (非 ctx.emitBuckets)
					const pages = sctx.pages as PagesInfo | undefined
					const compileConfigOpts = sctx.compileConfig as { minify: boolean; esTarget: { logic: string } } | undefined
					if (!pages || !compileConfigOpts) return  // logic stage 未跑（partial-stage）→ skip emit
					const buildModel = ctx.buildModel as BuildModel
					const storeInfo = ctx.storeInfo
					const sourcemap = !!sctx.sourcemap
					const sourcemapTargetPath = sctx.sourcemapTargetPath as string | undefined
					const transform = { strategy: 'perModule', minify: compileConfigOpts.minify, target: compileConfigOpts.esTarget.logic, platform: 'neutral' }
					// B2+E: graph closure union → cache 插入序迭代 → cross-bucket dedup
					const innerGraph = state.graph.getInnerGraph()
					const mainEntryIds = pages.mainPages.map(p => p.path)
					const subBuckets = (Object.entries(pages.subPages ?? {}) as [string, { info: { path: string }[]; independent?: boolean }][])
						.map(([root, sub]) => ({ root, entryIds: sub.info.map(p => p.path), independent: sub.independent }))
					const { main, subs } = deriveLogicBuckets(innerGraph, state.moduleCache, mainEntryIds, subBuckets)
					try {
						for (const { root, modules } of subs) {
							const { entry } = await executeTask({ engine: emitEngine, input: {
								entryId: 'logic:' + root, kind: 'logic' as const, modules,
								transform, sourcemap, sourcemapTargetPath, filename: 'logic', relPrefix: root, storeInfo,
							} }) as { entry: Parameters<typeof buildModel.add>[0] }
							buildModel.add(entry)
						}
						const { entry } = await executeTask({ engine: emitEngine, input: {
							entryId: 'logic', kind: 'logic' as const, modules: main,
							transform, sourcemap, sourcemapTargetPath, filename: 'logic', relPrefix: 'main', storeInfo,
						} }) as { entry: Parameters<typeof buildModel.add>[0] }
						buildModel.add(entry)
					} catch (error) {
						await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_ERROR, { stage: 'logic', error })
						throw error
					}
				},
			},
			{
				title: '写入编译产物',
				task: async (ctx: Record<string, unknown>) => {
					if (!skipMaterialize) {
						materialize(ctx.buildModel as BuildModel, getTargetPath())
					}
					// H4 Phase 2 (F-H4-2): seedPath（watch/compile-cache 增量）→ 增量 sync publish
					// （content-diff，无 rm 窗口）；否则全量（one-shot，行为不变，F8 guard）
					publishToDist(targetPath, useAppIdDir, !!seedPath)
					await lifecycle.emit(LIFECYCLE_EVENTS.BUNDLE_PUBLISHED, { targetPath, useAppIdDir })
				},
			},
		] as ListrTask<Record<string, unknown>>[]),
		{
			concurrent: false,
			rendererOptions: {
				collapseSubtasks: true,
				formatOutput: 'truncate',
				timer: PRESET_TIMER,
			},
			fallbackRendererOptions: { timer: PRESET_TIMER },
		} as ListrBaseClassOptions,
		)

		const context = await tasks.run()
		printCompatibilityWarnings(workPath, (context as { compatibilityWarnings?: Set<string> }).compatibilityWarnings)
		const result = {
			appId: (loadBindings as { appId?: string } | null)?.appId,
			name: getAppName(),
			path: getAppConfigInfo().entryPagePath || ((context as { allPages?: { mainPages?: { path: string }[] } }).allPages?.mainPages?.[0]?.path),
			dependencyGraph: ((context as { dependencyGraph?: { toJSON: () => unknown } }).dependencyGraph?.toJSON()),
			buildModel: (context as { buildModel?: BuildModel }).buildModel,
		}
		await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_END, {
			result,
			isolatedListenerErrors: lifecycle.isolatedListenerErrors.length,
		})
		return result
	}
	catch (error) {
		await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_ERROR, { error, stage: (error as { stage?: string | null })?.stage ?? null })
		throw error
	}
}

function createStageTask(stage: string, title: string, engine: unknown, lifecycle: { emit: (e: string, p: unknown) => Promise<void> }, workerOptions: Record<string, unknown> = {}, rendererAdapter: RendererAdapter | null = null) {
	return {
		title,
		rendererOptions: { outputBar: true, persistentOutput: false },
		task: async (ctx: Record<string, unknown>, task: unknown) => {
			const sctx = ctx as unknown as StageChannelContext
			const pages = workerOptions.pages || sctx.pages
			await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_BEFORE, {
				stage,
				pages,
				sourcemap: !!workerOptions.sourcemap,
			})
			const warningsBefore = new Set(sctx.compatibilityWarnings ?? new Set())
			const startedAt = Date.now()
			const runStage = stage === 'view' || stage === 'style'
				? (rendererAdapter as { runViewStage?: (ctx: unknown, task: unknown, opts: unknown, lifecycle: unknown) => Promise<void>; runStyleStage?: (ctx: unknown, task: unknown, opts: unknown, lifecycle: unknown) => Promise<void> })?.[stage === 'view' ? 'runViewStage' : 'runStyleStage']
				: null
			try {
				if (runStage) {
					await runStage(ctx, task, workerOptions, lifecycle)
				}
				else {
					await runCompileStage({ script: stage, engine: engine as RunCompileStageParams['engine'], ctx, task: task as { output: string }, options: workerOptions, lifecycle, onOutput: (entry: unknown) => ((sctx.buildModel) as { add: (e: unknown) => void }).add(entry) })
				}
				await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_AFTER, {
					stage,
					compatibilityWarnings: [...(sctx.compatibilityWarnings ?? new Set())].filter(warning =>
						!warningsBefore.has(warning)),
					durationMs: Date.now() - startedAt,
				})
			}
			catch (error) {
				await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_ERROR, { stage, error })
				throw error
			}
		},
	}
}

function printCompatibilityWarnings(workPath: string, warnings: Set<string> = new Set()): void {
	const projectPath = path.resolve(workPath)
	const hasPreviousResult = previousCompatibilityWarnings.has(projectPath)
	const previousWarnings = previousCompatibilityWarnings.get(projectPath) || new Set()

	const newWarnings = [...warnings].filter(warning => !previousWarnings.has(warning))
	if (newWarnings.length === 0 && hasPreviousResult) {
		return
	}

	console.log(`\n[compat] ${newWarnings.length} compatibility warnings`)
	for (const warning of newWarnings.slice(0, MAX_WARNING_PROJECTS)) {
		console.log(`  - ${warning}`)
	}
	if (newWarnings.length > MAX_WARNING_PROJECTS) {
		console.log(`  - …and ${newWarnings.length - MAX_WARNING_PROJECTS} more`)
	}

	previousCompatibilityWarnings.set(projectPath, new Set(warnings))
}
