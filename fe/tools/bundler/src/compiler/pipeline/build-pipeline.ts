/**
 * BuildPipeline — 编译承载面（build-pipeline BP1）。
 *
 * 把今日 runBuild 的过程体（init → concurrent compile → publish）
 * 抽为可指认的 Pipeline 对象：阶段可注入 ProjectStore、行为 0 变化。
 *
 * 不是 session、不做跨 watch 活图、不做 chokidar/dev-server/插件总线/会话管理。
 *
 * Session（唯一会话管理者）按次调用 Pipeline.run；Pipeline 不长活挂 session。
 */

import path from 'node:path'
import process from 'node:process'
import { Listr, PRESET_TIMER } from 'listr2'
import type { ListrTask, ListrBaseClassOptions } from 'listr2'
import { createLifecycle, LIFECYCLE_EVENTS } from '../../shared/lifecycle.ts'
import { getRenderer, registerRenderer } from '../core/renderers.ts'
import { createCompileTarget, deriveStagePlan, readLoadBindings, STAGE_TITLES } from './compile-target.ts'
import type { PagesInfo, LoadBindings } from './compile-target.types.ts'
import { createDist, publishToDist } from './publish.ts'
import { artCode, resetAssetCache } from '../../shared/utils.ts'
import { NpmBuilder } from '../core/npm-builder.ts'
import compileConfig from './config-compiler.ts'
import { getAppConfigInfo, getAppName, getPages, getTargetPath, getWorkPath, isMiniGame, runWithCompilerContext } from '../core/env.ts'
import { runCompileStage } from './stage-channel.ts'
import { BuildModel, materialize } from '../../model/build-model.ts'
import { createProjectStore } from '../../model/project-store.ts'

interface RendererAdapter {
	runViewStage?: (ctx: Record<string, unknown>, task: unknown, wo: Record<string, unknown>, lc: { emit: (e: string, p: unknown) => Promise<void> }) => Promise<void>
	runStyleStage?: (ctx: Record<string, unknown>, task: unknown, wo: Record<string, unknown>, lc: { emit: (e: string, p: unknown) => Promise<void> }) => Promise<void>
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
		runCompileStage({ script: 'view', ctx, task: task as { output: string }, options: workerOptions, lifecycle, onOutput: (entry: unknown) => (ctx as { buildModel: { add: (e: unknown) => void } }).buildModel.add(entry) }),
	runStyleStage: async (ctx: Record<string, unknown>, task: unknown, workerOptions: Record<string, unknown>, lifecycle: { emit: (e: string, p: unknown) => Promise<void> }): Promise<void> =>
		runCompileStage({ script: 'style', ctx, task: task as { output: string }, options: workerOptions, lifecycle, onOutput: (entry: unknown) => (ctx as { buildModel: { add: (e: unknown) => void } }).buildModel.add(entry) }),
}
if (!getRenderer('webview')) {
	registerRenderer(webviewRenderer)
}

export function createBuildPipeline({ store: providedStore, lifecycle: pipelineLifecycle }: { store?: unknown; lifecycle?: { emit: (e: string, p: unknown) => Promise<void>; isolatedListenerErrors: unknown[] } } = {}): { run: (options: Record<string, unknown>) => Promise<Record<string, unknown>> } {
	/**
	 * @param {object} runOptions
	 * @param {string} runOptions.targetPath
	 * @param {string} runOptions.workPath
	 * @param {boolean} runOptions.useAppIdDir
	 * @param {object} [runOptions] 其余编译选项（fileTypes/stages/seedPath/...）
	 * @returns {Promise<object>} buildResult
	 */
	async function run(runOptions: Record<string, unknown>): Promise<Record<string, unknown>> {
		return runWithCompilerContext(() => _runBuild(runOptions))
	}

	async function _runBuild(runOptions: Record<string, unknown>): Promise<Record<string, unknown>> {
		const {
			targetPath,
			workPath,
			useAppIdDir = true,
			fileTypes,
			affectedEntries,
			seedPath,
			dependencyGraph,
			prepareConfig = true,
			prepareNpm = true,
			store: runStore,
			lifecycle: runLifecycle,
		} = runOptions as {
			targetPath: string
			workPath: string
			useAppIdDir?: boolean
			fileTypes?: unknown
			affectedEntries?: string[]
			seedPath?: string
			dependencyGraph?: unknown
			prepareConfig?: boolean
			prepareNpm?: boolean
			store?: unknown
			lifecycle?: { emit: (e: string, p: unknown) => Promise<void>; isolatedListenerErrors: unknown[] }
		}
		const store = (runStore ?? providedStore ?? createProjectStore()) as { load: (w: string, o: unknown) => Record<string, unknown>; getDependencyGraph: () => { addFile: (n: string, f: string, k: string) => void; toJSON: () => unknown } }
		// T1：C1 / renderer 校验 / stages 白名单改道 createCompileTarget（消息不变）
		const compileTarget = createCompileTarget(runOptions)
		const lifecycle = runLifecycle || pipelineLifecycle || createLifecycle()
		// T2：阶段组装侧 bindings；BUILD_END appId 复用（避免二次 env 读取）
		let loadBindings: { pages?: unknown; appId?: string } | null = null

		const { dependencyGraph: _graphPayload, lifecycle: _lifecyclePayload, store: _storeRef, targetPath: _t, workPath: _w, useAppIdDir: _u, ...serializableOptions } = runOptions
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
						(ctx as { buildModel: unknown }).buildModel = new BuildModel()
						const _store = store as { load: (w: string, o: unknown) => Record<string, unknown>; getDependencyGraph: () => unknown }
						(ctx as { storeInfo: unknown }).storeInfo = _store.load(workPath, { fileTypes, dependencyGraph });
						(ctx as { dependencyGraph: unknown }).dependencyGraph = _store.getDependencyGraph()
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
						const npmBuilder = new NpmBuilder(getWorkPath(), getTargetPath(), (ctx as { dependencyGraph?: { addFile: (n: string, f: string, k: string) => void } }).dependencyGraph ?? null)
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
							// T2：阶段组装侧唯一读取 + 纯派生；闭包内不再散算形态条件
							loadBindings = readLoadBindings() as { pages: unknown; appId: string } | null
							(ctx as { allPages: unknown }).allPages = (loadBindings as { pages?: unknown } | null)?.pages as unknown
							(ctx as { pages: unknown }).pages = filterPagesByEntries((loadBindings as { pages: { mainPages: { path: string }[]; subPages: Record<string, { info: { path: string }[] }> } | null })?.pages as { mainPages: { path: string }[]; subPages: Record<string, { info: { path: string }[] }> }, affectedEntries);
							(ctx as { compatibilityWarnings?: Set<string> }).compatibilityWarnings = new Set<string>()

							const plan = deriveStagePlan(compileTarget, loadBindings as LoadBindings, {
								cwd: process.cwd(),
								filteredPages: ctx.pages as PagesInfo,
							})
							const compileTasks = (plan as { stages: string[]; stageSpecs: Record<string, { workerOptions: Record<string, unknown>; renderer?: unknown }> }).stages.map((stage) => {
								const spec = (plan as { stageSpecs: Record<string, { workerOptions: Record<string, unknown>; renderer?: unknown }> }).stageSpecs[stage]!
								return createStageTask(
									stage,
									STAGE_TITLES[stage]!,
									lifecycle,
									spec.workerOptions,
									spec.renderer as RendererAdapter | null,
								)
							})

							if (compileTasks.length > 0) {
								return ((task as { newListr: (p: unknown[], o: unknown) => unknown }).newListr)(compileTasks, { concurrent: true })
							}
							return undefined
						},
					},
					{
						title: '写入编译产物',
						task: async (ctx: Record<string, unknown>) => {
							materialize(ctx.buildModel as BuildModel, getTargetPath())
							publishToDist(targetPath, useAppIdDir)
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

	return { run }
}

// --- 以下为 pipeline 内部 helper（从 index.js 搬入） ---

function createStageTask(stage: string, title: string, lifecycle: { emit: (e: string, p: unknown) => Promise<void> }, workerOptions: Record<string, unknown> = {}, rendererAdapter: RendererAdapter | null = null) {
	return {
		title,
		rendererOptions: { outputBar: true, persistentOutput: false },
		task: async (ctx: Record<string, unknown>, task: unknown) => {
			const pages = workerOptions.pages || ctx.pages
			await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_BEFORE, {
				stage,
				pages,
				sourcemap: !!workerOptions.sourcemap,
			})
			const warningsBefore = new Set((ctx as { compatibilityWarnings?: Set<string> }).compatibilityWarnings ?? new Set())
			const startedAt = Date.now()
			// T1：renderer 对象已由 createCompileTarget 校验；此处不再字符串反查
			const runStage = stage === 'view' || stage === 'style'
				? (rendererAdapter as { runViewStage?: (ctx: unknown, task: unknown, opts: unknown, lifecycle: unknown) => Promise<void>; runStyleStage?: (ctx: unknown, task: unknown, opts: unknown, lifecycle: unknown) => Promise<void> })?.[stage === 'view' ? 'runViewStage' : 'runStyleStage']
				: null
			try {
				if (runStage) {
					await runStage(ctx, task, workerOptions, lifecycle)
				}
				else {
					await runCompileStage({ script: stage, ctx, task: task as { output: string }, options: workerOptions, lifecycle, onOutput: (entry: unknown) => (ctx as { buildModel: { add: (e: unknown) => void } }).buildModel.add(entry) })
				}
				await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_AFTER, {
					stage,
					compatibilityWarnings: [...(ctx as { compatibilityWarnings?: Set<string> }).compatibilityWarnings ?? new Set()].filter(warning =>
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

function filterPagesByEntries(pages: { mainPages: { path: string }[]; subPages: Record<string, { info: { path: string }[] }> }, affectedEntries: string[] | undefined): { mainPages: unknown[]; subPages: Record<string, unknown> } {
	if (!Array.isArray(affectedEntries)) {
		return pages as { mainPages: unknown[]; subPages: Record<string, unknown> }
	}
	const selected = new Set(affectedEntries)
	return {
		mainPages: pages.mainPages.filter(page => selected.has(page.path)),
		subPages: Object.fromEntries(
			Object.entries(pages.subPages)
				.map(([root, subPackage]) => [root, {
					...subPackage,
					info: ((subPackage as { info: { path: string }[] }).info.filter(page => selected.has(page.path))),
				}]).filter(([, subPackage]) => ((subPackage as { info: unknown[] }).info.length > 0)),
		),
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
