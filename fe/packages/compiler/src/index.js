import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { Listr, PRESET_TIMER } from 'listr2'
import { formatCompileProgress } from './common/compile-progress.js'
import { DependencyGraph } from './common/dependency-graph.js'
import { createLifecycle, LIFECYCLE_EVENTS } from './common/lifecycle.js'
import { createDist, publishToDist } from './common/publish.js'
import { artCode, resetAssetCache } from './common/utils.js'
import { workerPool } from './common/worker-pool.js'
import { NpmBuilder } from './common/npm-builder.js'
import { compileConfig } from './core/index.js'
import { getAppConfigInfo, getAppId, getAppName, getAppStyleScopeId, getPages, getTargetPath, getWorkPath, isMiniGame, runWithCompilerContext, storeInfo } from './env.js'

let isPrinted = false
const previousCompatibilityWarnings = new Map()
const COMPILE_STAGE_ORDER = ['view', 'logic', 'style']
const MAX_WARNING_PROJECTS = 32

/**
 * 构建命令入口
 * @param {string} targetPath 编译产物目标路径
 * @param {string} workPath 编译工作目录
 * @param {boolean} useAppIdDir 产物根目录是否包含 appId
 * @param {object} [options] 构建选项
 * @param {boolean} [options.sourcemap] 是否生成 sourcemap
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
		sourcemap = false,
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
	const lifecycle = options.lifecycle || createLifecycle()
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
							compileTasks.push(createStageTask('view', '编译视图', lifecycle, { sourcemap }))
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
							compileTasks.push(createStageTask('style', '编译样式', lifecycle, { sourcemap, pages: stylePages }))
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
function createStageTask(stage, title, lifecycle, workerOptions = {}) {
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
			try {
				await runCompileInWorker(stage, ctx, task, workerOptions, lifecycle)
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

function runCompileInWorker(script, ctx, task, options = {}, lifecycle = null) {
	return workerPool.runWorker(() => new Promise((resolve, reject) => {
		const worker = new Worker(
			path.join(path.dirname(fileURLToPath(import.meta.url)), `core/${script}-compiler.js`),
			workerPool.getWorkerOptions(),
		)
		const pages = options.pages || ctx.pages
		const totalTasks = Object.keys(pages.mainPages).length
			+ Object.values(pages.subPages).reduce((sum, item) => sum + item.info.length, 0)

		let isResolved = false
		let workerError = null
		let terminationPromise

		const terminateWorker = () => {
			terminationPromise ||= worker.terminate().catch(() => undefined)
			return terminationPromise
		}

		// 统一的错误处理函数，防止重复 reject
		const handleError = async (error) => {
			if (isResolved) return
			isResolved = true
			// WorkerPool 只有在 isolate 确实退出后才能释放槽位；否则排队的
			// 阶段会与仍在回收中的 Worker 重叠，突破 CPU/RSS 限制。
			await terminateWorker()
			reject(error)
		}

			worker.postMessage({
				pages,
				storeInfo: ctx.storeInfo,
				sourcemap: !!options.sourcemap,
				sourcemapTargetPath: options.sourcemapTargetPath,
			})
		// 接收 Worker 完成后的消息
		worker.on('message', async (message) => {
			try {
				for (const warning of message.compatibilityWarnings || []) {
					ctx.compatibilityWarnings.add(warning)
					if (lifecycle) {
						await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_WARNING, { message: warning })
					}
				}

				if (process.stdout.isTTY && message.completedTasks !== undefined) {
					task.output = formatCompileProgress(message.completedTasks, totalTasks)
				}

				if (message.success) {
					if (isResolved) return
					if (process.stdout.isTTY && totalTasks > 0) {
						task.output = formatCompileProgress(totalTasks, totalTasks)
					}
					ctx.dependencyGraph.merge(message.dependencyGraph)
					isResolved = true
					await terminateWorker()
					resolve()
				}
				else if (message.error) {
					const error = new Error(message.error.message || message.error)
					if (message.error.name)
						error.name = message.error.name
					if (message.error.stack)
						error.stack = message.error.stack
					if (message.error.file)
						error.file = message.error.file
					if (message.error.line != null)
						error.line = message.error.line
					if (message.error.column != null)
						error.column = message.error.column
					if (message.error.stage)
						error.stage = message.error.stage
					await handleError(error)
				}
			}
			catch (err) {
				await handleError(new Error(`Error processing worker message: ${err.message}\n${err.stack}`))
			}
		})

		worker.on('error', (err) => {
			// 保存错误信息，可能在 exit 事件中使用
			workerError = err
			void handleError(err)
		})
		worker.on('exit', (code) => {
			if (code !== 0 && !isResolved) {
				// 如果已经有 workerError，使用它；否则创建新的错误
				// 退出码 1 通常表示内存溢出或其他致命错误
				const error = workerError || new Error(
					code === 1
						? 'Worker terminated due to reaching memory limit: JS heap out of memory'
						: `Worker stopped with exit code ${code}`,
				)
				void handleError(error)
			}
		})
	}))
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
