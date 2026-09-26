/**
 * PackerOrchestrator — 主编排（fe-tools-packer-orchestrator · D-OR-0..8）。
 *
 * 迁入原 build-pipeline 过程体（init → concurrent compile → publish）。
 * 公开 build / watch 经入口适配器调 orchestrate。
 * B 切法（PC-B10a）：orchestrate 北星签名 (ctx, state, options) 落地。
 */

import path from 'node:path'
import { Listr, PRESET_TIMER } from 'listr2'
import type { ListrTask, ListrBaseClassOptions } from 'listr2'
import { createLifecycle, LIFECYCLE_EVENTS } from '../shared/lifecycle.ts'
import type { Lifecycle } from '../shared/lifecycle.ts'
import { getRenderer, registerRenderer } from './registry/renderers.ts'
import { createCompileTarget } from './pipeline/compile-target.ts'
import { createDispatchRegistry } from './registry/dispatch.ts'
import type { PackerDispatchRegistry } from './registry/dispatch.ts'
import { LoaderRegistryImpl } from './registry/lce.ts'
import { logicLoader } from '../compiler/logic/registry-impl.ts'
import { PackerSessionState } from './state/session-state.ts'
import type { CompileOptions, WatchOptions, CompileRequest, WatchRequest, PackerContext, LoaderRegistry, StageChannelContext, BuildResult, PackerOrchestrator } from './types.ts'
import { artCode, resetAssetCache } from '../shared/utils.ts'

import { runCompileStage } from './state/stage-channel.ts'
import { MemOutput, DiskOutput } from './emit/output.ts'
import type { Output } from './types.ts'
import { createProjectStore } from './store/project-store.ts'
import type { ProjectStore } from './store/project-store.ts'
import { createDistPreparer } from './emit/dist-preparer.ts'
import type { DistPreparerDeps } from './emit/dist-preparer.ts'
import { createConfigCompiler } from './pipeline/config-compiler-collab.ts'
import type { ConfigCompilerDeps } from './pipeline/config-compiler-collab.ts'
import { createNpmBuilderCollaborator } from './pipeline/npm-builder.ts'
import type { NpmBuilderDeps } from './pipeline/npm-builder.ts'
import { createConfigCollector } from './store/config-collector.ts'
import type { ConfigCollectorDeps } from './store/config-collector.ts'
import { createStageDispatcher } from './pipeline/stage-dispatcher.ts'
import type { StageDispatcherDeps } from './pipeline/stage-dispatcher.ts'
import { createLogicEmitter } from './emit/logic-emitter.ts'
import type { LogicEmitterDeps } from './emit/logic-emitter.ts'
import { createPublisher } from './emit/publisher.ts'
import type { PublisherDeps } from './emit/publisher.ts'
import type { BuildCollaborator } from './types.ts'


/** D-FC-1 collaborator 装配 bag（orchestrator 内部接线，非 collaborator deps bag）。渐进填充。 */
interface PackerCollaborators {
	configCollector: BuildCollaborator<ConfigCollectorDeps>
	distPreparer: BuildCollaborator<DistPreparerDeps>
	configCompiler: BuildCollaborator<ConfigCompilerDeps>
	npmBuilder: BuildCollaborator<NpmBuilderDeps>
	stageDispatcher: BuildCollaborator<StageDispatcherDeps>
	logicEmitter: BuildCollaborator<LogicEmitterDeps>
	publisher: BuildCollaborator<PublisherDeps>
}

/**
 * INTERNAL unified _orchestrate param（D-NS-5，F-AB2-1：extends CompileOptions & WatchOptions）。
 * compile + watch 字段全 superset（targetPath/workPath/state + useAppIdDir/store/lifecycle/fileTypes/compileOptions）。
 * store?/lifecycle? 是 per-request OVERRIDE（F-AB1-1：_orchestrate L170 runStore ?? providedStore）。
 */
export interface OrchestrateRequest extends CompileOptions, WatchOptions {
	targetPath: string
	workPath: string
	useAppIdDir?: boolean
	state: PackerSessionState
	/** D-SC2: PackerContext 注入 sctx.ctx（orchestrate 入参）。 */
	ctx: PackerContext
	store?: unknown
	lifecycle?: Lifecycle
	fileTypes?: unknown
	/** C1 / createCompileTarget 其余字段（mode/platform/minify/…） */
	compileOptions?: Record<string, unknown>
}

let isPrinted = false
const previousCompatibilityWarnings = new Map<string, Set<string>>()
const MAX_WARNING_PROJECTS = 32

/**
 * webview renderer 阶段级薄适配（A4 P-002）。
 */
const webviewRenderer = {
	name: 'webview',
	runViewStage: async (ctx: Record<string, unknown>, task: unknown, workerOptions: Record<string, unknown>, lifecycle: { emit: (e: string, p: unknown) => Promise<void> }): Promise<void> =>
		runCompileStage({ script: 'view', ctx, task: task as { output: string }, options: workerOptions, lifecycle, onOutput: (entry: unknown) => { ((ctx as unknown as StageChannelContext).output as { add: (e: unknown) => void } | undefined)?.add(entry) } }),
	runStyleStage: async (ctx: Record<string, unknown>, task: unknown, workerOptions: Record<string, unknown>, lifecycle: { emit: (e: string, p: unknown) => Promise<void> }): Promise<void> =>
		runCompileStage({ script: 'style', ctx, task: task as { output: string }, options: workerOptions, lifecycle, onOutput: (entry: unknown) => { ((ctx as unknown as StageChannelContext).output as { add: (e: unknown) => void } | undefined)?.add(entry) } }),
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
} = {}): PackerOrchestrator {
	const dispatchRegistry = createDispatchRegistry()
	// H2 Phase 2a（D-REG-2）：loaderRegistry 实体化——logic Loader 已注册（F-H2-1 logic 可直接包装）。
	// view/style Loader 待 F-H2-1 拆分后注册。compile/emit registry 仍是 stub（Phase 2b/2c）。
	// D-HR-1（fe-tools-hmr-chain-residuals）：compile/emit registry 实体化（CompileRegistryImpl/EmitRegistryImpl）
	// ——阶段函数形状适配（需 page/继承上下文）是后续门，dispatch 不接线（locked B：compile/emit 维持 worker）。
	const loaderRegistry = new LoaderRegistryImpl()
	loaderRegistry.register('logic', logicLoader)
	// D-FC-2b: compile/emit registry 私有化（不公开返回）+ 未 wired（D-HR-1 locked B）→ 不实体化

	// D-FC-1: 无状态 collaborator 在闭包内一次构造复用（共享闭包 registry）
	const collaborators = {
		configCollector: createConfigCollector(),
		distPreparer: createDistPreparer(),
		configCompiler: createConfigCompiler(),
		npmBuilder: createNpmBuilderCollaborator(),
		stageDispatcher: createStageDispatcher(),
		logicEmitter: createLogicEmitter(),
		publisher: createPublisher(),
	}

	async function orchestrate(ctx: PackerContext, state: PackerSessionState, options: CompileRequest | WatchRequest): Promise<BuildResult> {
		// B 切法（PC-B10a）：北星签名 (ctx, state, options) 落地——ctx 显式 PackerContext（非 ALS 派生）。
		// D-OR-7 已消解（P-NS4/5）：: PackerOrchestrator 注解 + BuildResult composite + CompileRequest|WatchRequest 收敛。
		const request: OrchestrateRequest = { ...options, workPath: ctx.workPath, targetPath: ctx.targetPath, state, ctx }
		return _orchestrate(request, providedStore, pipelineLifecycle, dispatchRegistry, loaderRegistry, collaborators)
	}

	// D-FC-2b: registry 私有化（facade 内部，不公开返回）——仅返 { orchestrate }
	// D-NS-4（P-NS4）：return type annotation : PackerOrchestrator——structural conformance
	// + method bivariance（state: PackerSessionState narrower 经 bivariance 放行；
	// options: CompileRequest | WatchRequest，bivariance 放行 state: PackerSessionState。D-OR-7 消解。
	return {
		orchestrate,
	}
}

async function _orchestrate(
	request: OrchestrateRequest,
	providedStore: unknown,
	pipelineLifecycle: Lifecycle | undefined,
	dispatchRegistry: PackerDispatchRegistry,
	loaderRegistry: LoaderRegistry,
	collaborators: PackerCollaborators,
): Promise<BuildResult> {
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
		outputMode,
		parallel = true,
		compileOptions = {},
	} = request

	// D-OL1（方案 B——orchestrator 入口 mode-aware 创建 + listr2 ctx 注入）：
	// F-R30-1/F-R34-1：outputMode 'dev'|'disk'（缺省 'disk'）；dev → MemOutput / disk → DiskOutput
	// D-SI-2（fe-tools-scratch-internalize）：output 创建后预设 state.scratch = output.scratch（投影——
	// mkdtemp 内化入 BaseOutput 构造，orchestrator 预设 state.scratch 供 7 consumer 读，consumer 不改读源）。
	const output: Output = request.outputMode === 'dev' ? new MemOutput() : new DiskOutput()
	state.scratch = output.scratch

	const store = (runStore ?? providedStore ?? createProjectStore()) as ProjectStore

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

	const serializableOptions = {
		...compileOptions,
		fileTypes,
		stages,
		affectedEntries,
		seedPath,
		prepareConfig,
		prepareNpm,
		outputMode,
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

		const initPhases = [
			{
				title: '收集配置信息',
				task: async (ctx: Record<string, unknown>) => {
					await collaborators.configCollector.run(ctx as unknown as StageChannelContext, {
						store: store as ProjectStore,
						lifecycle,
						loaderRegistry,
						invalidatedModules,
					})
				},
			},
			{
				title: '准备产物目录',
				task: async (ctx: Record<string, unknown>) => {
					await collaborators.distPreparer.run(ctx as unknown as StageChannelContext, { seedPath, lifecycle })
				},
			},
			...(shouldPrepareConfig ? [{
				title: '编译配置信息',
				task: async (ctx: Record<string, unknown>) => {
					await collaborators.configCompiler.run(ctx as unknown as StageChannelContext, { state, lifecycle })
				},
			}] : []),
			...(shouldPrepareNpm ? [{
				title: '构建 npm 包',
				task: async (ctx: Record<string, unknown>) => {
					await collaborators.npmBuilder.run(ctx as unknown as StageChannelContext, { lifecycle })
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
				task: async (ctx: Record<string, unknown>, task: unknown): Promise<unknown> => {
					const compileTasks = await collaborators.stageDispatcher.run(ctx as unknown as StageChannelContext, {
						dispatchRegistry,
						compileTarget,
						affectedEntries,
						state,
						lifecycle,
						parallel,
					}) as unknown[]
					if (compileTasks.length > 0) {
						return ((task as { newListr: (p: unknown[], o: unknown) => unknown }).newListr)(compileTasks, { concurrent: parallel !== false })
					}
					return undefined
				},
			},
			{
				title: 'Logic emit',
				task: async (ctx: Record<string, unknown>) => {
					await collaborators.logicEmitter.run(ctx as unknown as StageChannelContext, { state, lifecycle })
				},
			},
			{
				title: '写入编译产物',
				task: async (ctx: Record<string, unknown>) => {
					await collaborators.publisher.run(ctx as unknown as StageChannelContext, { targetPath, useAppIdDir, seedPath, appId: state.graph.getAppId(), lifecycle, output })
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

		const context = await tasks.run({ output, ctx: request.ctx, state: request.state } as Record<string, unknown>)
		printCompatibilityWarnings(workPath, (context as { compatibilityWarnings?: Set<string> }).compatibilityWarnings)
	const outputFromCtx = (context as { output?: Output }).output
	const result: BuildResult = {
		entries: outputFromCtx ? outputFromCtx.getEntries() : [],
		appId: ((context as { loadBindings?: { appId?: string } | null }).loadBindings)?.appId,
		name: state.graph.getAppName(),
		path: (state.graph.getAppConfigInfo().entryPagePath as string | undefined) || ((context as { allPages?: { mainPages?: { path: string }[] } }).allPages?.mainPages?.[0]?.path),
		dependencyGraph: state.graph.toJSON(),
		output: outputFromCtx,
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
