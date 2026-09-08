import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import chokidar from 'chokidar'
import build from '../index.js'
import { createLifecycle, LIFECYCLE_EVENTS } from '../common/lifecycle.js'
import { DependencyGraph } from '../common/dependency-graph.js'
import { createDevServer } from '../common/dev-server.js'
import { synthesizeReloadLevel } from '../common/dev-reload.js'
import { createIgnoredPathMatcher, createWatchBuildPlan, createWatchRebuildScheduler, getPublishedOutputPath } from './watch.js'

const DEFAULT_PORT = 8080

/**
 * 注册 `dmcc dev` 子命令（挂载到 program）。
 * 编排：初始 build（注入 lifecycle）→ devServer → attach lifecycle 监听 →
 * 启动服务 → chokidar watch（复用 createWatchBuildPlan/Scheduler）。
 */
export function registerDevCommand(program) {
	program
		.command('dev')
		.description('启动 dev server：编译 + 静态服务 + 内置宿主页 + ws 热更新 + 代理')
		.option('-c, --work-path <path>', '小程序工程根（app.json 所在目录），缺省为当前目录')
		.option('-s, --target-path <path>', '产物快照目录（仅暴露最后一次成功发布），缺省使用系统临时目录')
		.option('-p, --port <number>', `端口（缺省 ${DEFAULT_PORT}）`)
		.option('--no-app-id-dir', '产物根目录不包含appId')
		.option('--sourcemap', '生成 sourcemap 文件用于调试')
		.action(async (options) => {
			const workPath = options.workPath ? path.resolve(options.workPath) : process.cwd()
			const targetPath = options.targetPath
				? path.resolve(options.targetPath)
				: fs.mkdtempSync(path.join(os.tmpdir(), 'dmcc-dev-'))
			const useAppIdDir = options.appIdDir !== false
			const sourcemap = !!options.sourcemap
			const port = options.port ? Number.parseInt(options.port, 10) : DEFAULT_PORT

			// ① 初始 build：注入 lifecycle（尚无监听器，事件为 no-op；失败则非零退出不起服务）
			const lifecycle = createLifecycle()
			let buildResult
			try {
				buildResult = await build(targetPath, workPath, useAppIdDir, { sourcemap, lifecycle })
			}
			catch (error) {
				throw new Error(`${workPath} 编译出错: ${error.message}`, { cause: error })
			}

			// ② devServer（appId 来自初始构建结果）
			const devServer = createDevServer({
				serveRoot: targetPath,
				sdkRoot: resolveSdkRoot(),
				appId: buildResult.appId,
				wsPath: '/ws',
			})

			// ③ attach lifecycle：快照就绪 / 失败信号驱动 ws 推送（F-002）
			lifecycle.on(LIFECYCLE_EVENTS.BUNDLE_PUBLISHED, () => {
				devServer.notifyBuildPublished()
			})
			lifecycle.on(LIFECYCLE_EVENTS.BUILD_ERROR, (payload) => {
				devServer.notifyBuildError(payload.error?.message || 'build failed')
			})

			// ④ 启动服务
			const { port: actualPort, host } = await devServer.listen(port, '127.0.0.1')
			console.log(`[dmcc-dev] preview at http://${host}:${actualPort}?appId=${buildResult.appId}`)
			console.log(`[dmcc-dev] watching ${workPath}`)

			// ⑤ watch（对齐 dmcc build -w 语义）
			let dependencyGraph = new DependencyGraph(buildResult.dependencyGraph)
			let buildIdCounter = 0
			const ignoredOutputPaths = new Set([
				getPublishedOutputPath(targetPath, useAppIdDir, buildResult.appId),
			])
			const eventLabels = {
				add: '新增',
				change: '改动',
				unlink: '删除',
			}
			const scheduler = createWatchRebuildScheduler({
				rebuild: async (change) => {
					const publishedPath = getPublishedOutputPath(targetPath, useAppIdDir, buildResult.appId)
					const plan = createWatchBuildPlan({
						...change,
						dependencyGraph,
						publishedPath,
					})
					if (plan.skip) return

					// F-002：build 前合成 reload 级别并注入 pendingReload（buildId 自增）
					const payload = synthesizeReloadLevel({
						...change,
						plan,
						appId: buildResult.appId,
						buildId: ++buildIdCounter,
					})
					devServer.setPendingReload(payload)

					const result = await build(targetPath, workPath, useAppIdDir, {
						sourcemap,
						lifecycle,
						...plan.options,
					})
					buildResult = result
					dependencyGraph = new DependencyGraph(result.dependencyGraph)
					ignoredOutputPaths.add(getPublishedOutputPath(targetPath, useAppIdDir, result.appId))
				},
				onRebuild: ({ event, filePath, count }) => {
					const merged = count > 1 ? `（合并 ${count} 个文件事件）` : ''
					console.log(`${filePath} ${eventLabels[event]}，重新编译${merged}`)
				},
				onError: (error) => {
					// build:error 已由 lifecycle 监听推送；此处仅记录诊断（R-006：服务不退出）
					console.error(`${workPath} 编译出错: ${error.message}`)
				},
			})
			chokidar
				.watch(workPath, {
					persistent: true,
					ignoreInitial: true,
					ignored: createIgnoredPathMatcher(ignoredOutputPaths),
				})
				.on('all', (event, filePath) => {
					const plan = createWatchBuildPlan({
						event,
						filePath,
						dependencyGraph,
						publishedPath: getPublishedOutputPath(targetPath, useAppIdDir, buildResult.appId),
					})
					if (plan.skip) return
					scheduler.schedule(event, filePath)
				})
		})
	return program
}

/**
 * 定位 container-sdk 预构建资产（A2.0 随包分发）。
 * 发布形态：compiler/dist/sdk（copy-sdk-assets 复制产物，P-002.5）；
 * 源码形态：显式 TARGET_SDK_DIR 可用。
 */
export function resolveSdkRoot() {
	if (process.env.DIMINA_DEV_SDK_DIR) {
		return path.resolve(process.env.DIMINA_DEV_SDK_DIR)
	}
	return path.resolve(path.dirname(new URL('../../package.json', import.meta.url).pathname), 'dist', 'sdk')
}