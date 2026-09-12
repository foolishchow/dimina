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
import { resolveCompileConfig } from '../shared/compile-config.js'
import { createLifecycle, LIFECYCLE_EVENTS } from '../shared/lifecycle.js'
import { assertRendererSupportsPlatform } from '../shared/platforms.js'
import { getRenderer, registerRenderer, resolveProjectRenderers } from './renderers.js'
import { createDist, publishToDist } from './publish.js'
import { artCode, resetAssetCache } from '../shared/utils.js'
import { NpmBuilder } from './npm-builder.js'
import { compileConfig } from './index.js'
import { getAppConfigInfo, getAppId, getAppName, getAppStyleScopeId, getPages, getTargetPath, getWorkPath, isMiniGame, runWithCompilerContext, storeInfo } from './env.js'
import { runCompileStage } from './stage-channel.js'
import { BuildModel, materialize } from '../model/build-model.js'
import { createProjectStore } from '../model/project-store.js'

let isPrinted = false
const previousCompatibilityWarnings = new Map()
const COMPILE_STAGE_ORDER = ['view', 'logic', 'style']
const MAX_WARNING_PROJECTS = 32

/**
 * webview renderer 阶段级薄适配（A4 P-002）。
 */
const webviewRenderer = {
	name: 'webview',
	runViewStage: (ctx, task, workerOptions, lifecycle) =>
		runCompileStage({ script: 'view', ctx, task, options: workerOptions, lifecycle, onOutput: (entry) => ctx.buildModel.add(entry) }),
	runStyleStage: (ctx, task, workerOptions, lifecycle) =>
		runCompileStage({ script: 'style', ctx, task, options: workerOptions, lifecycle, onOutput: (entry) => ctx.buildModel.add(entry) }),
}
if (!getRenderer('webview')) {
	registerRenderer(webviewRenderer)
}

/**
 * @param {object} params
 * @param {object} [params.store] ProjectStore（可选；缺省临时 create L3）
 * @param {object} [params.lifecycle] 外部传入 lifecycle（测试/dev server）
 * @returns {{ run: (options: object) => Promise<object> }}
 */
export function createBuildPipeline({ store: providedStore, lifecycle: pipelineLifecycle } = {}) {
	/**
	 * @param {object} runOptions
	 * @param {string} runOptions.targetPath
	 * @param {string} runOptions.workPath
	 * @param {boolean} runOptions.useAppIdDir
	 * @param {object} [runOptions] 其余编译选项（fileTypes/stages/seedPath/...）
	 * @returns {Promise<object>} buildResult
	 */
	async function run(runOptions) {
		return runWithCompilerContext(() => _runBuild(runOptions))
	}

	async function _runBuild(runOptions) {
		const {
			targetPath,
			workPath,
			useAppIdDir = true,
			fileTypes,
			affectedEntries,
			seedPath,
			dependencyGraph,
			stages,
			prepareConfig = true,
			prepareNpm = true,
			store: runStore,
			lifecycle: runLifecycle,
		} = runOptions
		const store = runStore ?? providedStore ?? createProjectStore()
		if (stages !== undefined
			&& (!Array.isArray(stages) || stages.some(stage => !COMPILE_STAGE_ORDER.includes(stage)))) {
			throw new TypeError(`Invalid compiler stages: ${JSON.stringify(stages)}`)
		}
		const compileConfiguration = resolveCompileConfig({ apiOptions: runOptions })
		const { sourcemap } = compileConfiguration
		const lifecycle = runLifecycle || pipelineLifecycle || createLifecycle()

		const { appRenderer } = resolveProjectRenderers(workPath)
		const activeRenderer = getRenderer(appRenderer)
		if (!activeRenderer) {
			throw new Error(`Renderer adapter not registered: ${appRenderer}`)
		}
		assertRendererSupportsPlatform(activeRenderer, compileConfiguration.platform)

		const { dependencyGraph: _graphPayload, lifecycle: _lifecyclePayload, store: _storeRef, targetPath: _t, workPath: _w, useAppIdDir: _u, ...serializableOptions } = runOptions
		try {
			await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_START, {
				workPath,
				targetPath,
				useAppIdDir,
				options: serializableOptions,
			})

			const enabledStages = new Set(stages === undefined
				? COMPILE_STAGE_ORDER
				: COMPILE_STAGE_ORDER.filter(stage => stages.includes(stage)))
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
					task: async (ctx) => {
						ctx.buildModel = new BuildModel()
						ctx.storeInfo = store.load(workPath, { fileTypes, dependencyGraph })
						ctx.dependencyGraph = store.getDependencyGraph()
						const allPages = getPages()
						await lifecycle.emit(LIFECYCLE_EVENTS.CONFIG_COLLECTED, {
							fileTypes: ctx.storeInfo.compilerOptions,
							pagesCount: allPages.mainPages.length
								+ Object.values(allPages.subPages).reduce((sum, item) => sum + item.info.length, 0),
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
					task: async (ctx) => {
						const npmBuilder = new NpmBuilder(getWorkPath(), getTargetPath(), ctx.dependencyGraph)
						await npmBuilder.buildNpmPackages()
						await lifecycle.emit(LIFECYCLE_EVENTS.NPM_BUILT, {})
					},
				}] : []),
			]

			const tasks = new Listr(
				[
					{
						title: '初始化项目',
						task: (_, task) => task.newListr(initPhases, { concurrent: false }),
					},
					{
						title: `编译项目 · ${path.basename(path.resolve(workPath))}`,
						task: (ctx, task) => {
							const allPages = getPages()
							const miniGame = isMiniGame()
							ctx.allPages = allPages
							ctx.pages = filterPagesByEntries(allPages, affectedEntries)
							ctx.compatibilityWarnings = new Set()
							const compileTasks = []

							if (enabledStages.has('view') && !miniGame) {
								compileTasks.push(createStageTask('view', '编译视图', lifecycle, {
									sourcemap,
									compileConfig: compileConfiguration,
								}, activeRenderer.name))
							}
							if (enabledStages.has('logic')) {
								const sourcemapTargetPath = path.resolve(
									process.cwd(),
									targetPath,
									useAppIdDir ? getAppId() : '',
								)
								compileTasks.push(createStageTask('logic', '编译逻辑', lifecycle, {
									sourcemap,
									pages: ctx.allPages,
									sourcemapTargetPath,
									compileConfig: compileConfiguration,
								}))
							}
							if (enabledStages.has('style') && !miniGame) {
								const stylePages = {
									...ctx.pages,
									mainPages: [
										{ path: 'app', id: getAppStyleScopeId() },
										...ctx.pages.mainPages,
									],
								}
								compileTasks.push(createStageTask('style', '编译样式', lifecycle, {
									sourcemap,
									pages: stylePages,
									compileConfig: compileConfiguration,
								}, activeRenderer.name))
							}

							if (compileTasks.length > 0) {
								return task.newListr(compileTasks, { concurrent: true })
							}
						},
					},
					{
						title: '写入编译产物',
						task: async (ctx) => {
							materialize(ctx.buildModel, getTargetPath())
							publishToDist(targetPath, useAppIdDir)
							await lifecycle.emit(LIFECYCLE_EVENTS.BUNDLE_PUBLISHED, { targetPath, useAppIdDir })
						},
					},
				],
				{
					concurrent: false,
					rendererOptions: {
						collapseSubtasks: true,
						formatOutput: 'truncate',
						timer: PRESET_TIMER,
					},
					fallbackRendererOptions: { timer: PRESET_TIMER },
				},
			)

			const context = await tasks.run()
			printCompatibilityWarnings(workPath, context.compatibilityWarnings)
			const result = {
				appId: getAppId(),
				name: getAppName(),
				path: getAppConfigInfo().entryPagePath || context.allPages.mainPages[0].path,
				dependencyGraph: context.dependencyGraph.toJSON(),
			}
			await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_END, {
				result,
				isolatedListenerErrors: lifecycle.isolatedListenerErrors.length,
			})
			return result
		}
		catch (error) {
			await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_ERROR, { error, stage: error?.stage ?? null })
			throw error
		}
	}

	return { run }
}

// --- 以下为 pipeline 内部 helper（从 index.js 搬入） ---

function createStageTask(stage, title, lifecycle, workerOptions = {}, renderer = 'webview') {
	return {
		title,
		rendererOptions: { outputBar: true, persistentOutput: false },
		task: async (ctx, task) => {
			const pages = workerOptions.pages || ctx.pages
			await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_BEFORE, {
				stage,
				pages,
				sourcemap: !!workerOptions.sourcemap,
			})
			const warningsBefore = new Set(ctx.compatibilityWarnings)
			const startedAt = Date.now()
			const runStage = stage === 'view' || stage === 'style'
				? getRenderer(renderer)?.[stage === 'view' ? 'runViewStage' : 'runStyleStage']
				: null
			try {
				if (runStage) {
					await runStage(ctx, task, workerOptions, lifecycle)
				}
				else {
					await runCompileStage({ script: stage, ctx, task, options: workerOptions, lifecycle, onOutput: (entry) => ctx.buildModel.add(entry) })
				}
				await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_AFTER, {
					stage,
					compatibilityWarnings: [...ctx.compatibilityWarnings].filter(warning =>
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

function filterPagesByEntries(pages, affectedEntries) {
	if (!Array.isArray(affectedEntries)) {
		return pages
	}
	const selected = new Set(affectedEntries)
	return {
		mainPages: pages.mainPages.filter(page => selected.has(page.path)),
		subPages: Object.fromEntries(
			Object.entries(pages.subPages)
				.map(([root, subPackage]) => [root, {
					...subPackage,
					info: subPackage.info.filter(page => selected.has(page.path)),
				}]).filter(([, subPackage]) => subPackage.info.length > 0),
		),
	}
}

function printCompatibilityWarnings(workPath, warnings = new Set()) {
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
