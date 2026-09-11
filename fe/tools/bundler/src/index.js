import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { Listr, PRESET_TIMER } from 'listr2'
import { resolveCompileConfig } from './common/compile-config.js'
import { DependencyGraph } from './common/dependency-graph.js'
import { createLifecycle, LIFECYCLE_EVENTS } from './common/lifecycle.js'
import { assertRendererSupportsPlatform } from './common/platforms.js'
import { getRenderer, registerRenderer, resolveProjectRenderers } from './common/renderers.js'
import { createDist, publishToDist } from './common/publish.js'
import { runCompileStage } from './common/stage-channel.js'
import { artCode, resetAssetCache } from './common/utils.js'
import { NpmBuilder } from './common/npm-builder.js'
import { compileConfig } from './core/index.js'
import { getAppConfigInfo, getAppId, getAppName, getAppStyleScopeId, getPages, getTargetPath, getWorkPath, isMiniGame, runWithCompilerContext, storeInfo } from './env.js'

let isPrinted = false
const previousCompatibilityWarnings = new Map()
const COMPILE_STAGE_ORDER = ['view', 'logic', 'style']
const MAX_WARNING_PROJECTS = 32

/**
 * webview renderer 阶段级薄适配（A4 P-002）。
 * 只包装既有 view/style worker 调用；logic 保持 renderer-neutral。
 * runCompileStage 内部协议不变（A1 冻结契约）。
 */
const webviewRenderer = {
	name: 'webview',
	runViewStage: (ctx, task, workerOptions, lifecycle) =>
		runCompileStage({ script: 'view', ctx, task, options: workerOptions, lifecycle }),
	runStyleStage: (ctx, task, workerOptions, lifecycle) =>
		runCompileStage({ script: 'style', ctx, task, options: workerOptions, lifecycle }),
}
registerRenderer(webviewRenderer)

/**
 * 构建命令入口
 * @param {string} targetPath 编译产物目标路径
 * @param {string} workPath 编译工作目录
 * @param {boolean} useAppIdDir 产物根目录是否包含 appId
 * @param {object} [options] 构建选项
 * @param {'build'|'dev'} [options.mode] 编译 mode preset（CF-1；缺省 build）
 * @param {boolean} [options.minify] 是否压缩（覆盖 mode 缺省）
 * @param {boolean} [options.sourcemap] 是否生成 sourcemap
 * @param {{ logic?: string, view?: string }} [options.esTarget] 双线程 ES target（CF-1）
 * @param {'native'|'web'} [options.platform] 运行时宿主（CF-2；缺省 native）
 * @param {{ template?: string[], style?: string[], viewScript?: string[] }} [options.fileTypes]
 *   自定义文件类型，在内置 wx/dd 类型基础上追加；template 为模板扩展名，style 为样式扩展名，
 *   viewScript 为视图脚本扩展名和内联标签名
 * @param {string[]} [options.affectedEntries] 仅重编这些页面的视图和样式；逻辑仍按包重建
 * @param {string} [options.seedPath] 增量构建前用于保留未受影响产物的已发布目录
 * @param {object} [options.dependencyGraph] 上一次构建的依赖图快照
 * @param {Array<'view'|'logic'|'style'>} [options.stages] 仅运行指定编译阶段
 * @param {boolean} [options.prepareConfig] 是否重新生成配置产物
 * @param {boolean} [options.prepareNpm] 是否重新复制 miniprogram_npm 产物
 * @param {object} [options.lifecycle] 内部选项：外部传入的生命周期实例
 *   （createLifecycle() 创建，供测试与后续 dev server 挂监听）；不属于公开稳定契约
 */
export default function build(targetPath, workPath, useAppIdDir = true, options = {}) {
	return runWithCompilerContext(() => runBuild(targetPath, workPath, useAppIdDir, options))
}

async function runBuild(targetPath, workPath, useAppIdDir = true, options = {}) {
	const {
		fileTypes,
		affectedEntries,
		seedPath,
		dependencyGraph,
		stages,
		prepareConfig = true,
		prepareNpm = true,
	} = options
	if (stages !== undefined
		&& (!Array.isArray(stages) || stages.some(stage => !COMPILE_STAGE_ORDER.includes(stage)))) {
		throw new TypeError(`Invalid compiler stages: ${JSON.stringify(stages)}`)
	}
	// CF-1/CF-2：在任何构建副作用前解析配置（非法 esTarget/mode/platform 硬失败，不触发 build:start）
	const compileConfiguration = resolveCompileConfig({ apiOptions: options })
	const { sourcemap } = compileConfiguration
	const lifecycle = options.lifecycle || createLifecycle()
	// renderer 抽象（A4 P-001 修订）：校验项目声明的 renderer（app.json.renderer +
	// 各 page.json.renderer），无 CLI/API 覆盖；当前仅 webview。在 lifecycle 前、
	// 任何构建副作用之前失败（未知 renderer 不触发 build:start）。
	const { appRenderer } = resolveProjectRenderers(workPath)
	const activeRenderer = getRenderer(appRenderer)
	if (!activeRenderer) {
		throw new Error(`Renderer adapter not registered: ${appRenderer}`)
	}
	// CF-2：renderer × platform 约束（webview 双平台可用；预留 unsupportedPlatforms）
	assertRendererSupportsPlatform(activeRenderer, compileConfiguration.platform)
	// build:start 载荷需可序列化（R-006）：剥离可能为实例的 dependencyGraph 与 lifecycle
	const { dependencyGraph: _graphPayload, lifecycle: _lifecyclePayload, ...serializableOptions } = options
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

		// 生命周期阶段函数：每个阶段完成自身工作后触发对应事件。
		// Listr 仅承担进度 UI；阶段顺序与并发由以下声明数组表达。
		const initPhases = [
			{
				title: '收集配置信息',
				task: async (ctx) => {
					ctx.storeInfo = storeInfo(workPath, { fileTypes, dependencyGraph })
					ctx.dependencyGraph = new DependencyGraph(ctx.storeInfo.dependencyGraph)
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
							// ddss, wxss
							// 主包添加 app 样式
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
					task: async () => {
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

/**
 * 包装单个编译阶段：触发 stage:before / stage:after / stage:error 事件。
 * 并发语义与进度 UI 与原实现一致（rendererOptions、worker 池均不变）。
 */
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
					await runCompileStage({ script: stage, ctx, task, options: workerOptions, lifecycle })
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
				}])
				.filter(([, subPackage]) => subPackage.info.length > 0),
		),
	}
}

function printCompatibilityWarnings(workPath, warnings = new Set()) {
	const projectPath = path.resolve(workPath)
	const hasPreviousResult = previousCompatibilityWarnings.has(projectPath)
	const previousWarnings = previousCompatibilityWarnings.get(projectPath) || new Set()
	const currentWarnings = new Set(warnings)
	const newWarnings = [...currentWarnings].filter(warning => !previousWarnings.has(warning))
	previousCompatibilityWarnings.delete(projectPath)
	previousCompatibilityWarnings.set(projectPath, currentWarnings)
	if (previousCompatibilityWarnings.size > MAX_WARNING_PROJECTS) {
		previousCompatibilityWarnings.delete(previousCompatibilityWarnings.keys().next().value)
	}

	if (newWarnings.length === 0) {
		return
	}

	const qualifier = hasPreviousResult ? ' new' : ''
	const suffix = newWarnings.length === 1 ? '' : 's'
	console.warn(`\n[compat] ${newWarnings.length}${qualifier} compatibility warning${suffix}`)
	for (const warning of newWarnings) {
		console.warn(`  - ${warning.replace(/^\[compat\]\s*/, '')}`)
	}
}
