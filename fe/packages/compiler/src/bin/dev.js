import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createLifecycle, LIFECYCLE_EVENTS } from '../common/lifecycle.js'
import { createDevServer } from '../common/dev-server.js'
import { synthesizeReloadLevel } from '../common/dev-reload.js'
import { createBuildWatcher } from '../common/watch-runner.js'

const DEFAULT_PORT = 8080

const EVENT_LABELS = {
	add: '新增',
	change: '改动',
	unlink: '删除',
}

/**
 * 注册 `dmcc dev` 子命令（挂载到 program）。
 * 编排：createBuildWatcher(autoListen:false) 初始 build → devServer → attach lifecycle →
 * listen server → watcher.listen()（D1a）。
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

			const lifecycle = createLifecycle()
			let buildIdCounter = 0
			/** @type {ReturnType<typeof createDevServer> | undefined} */
			let devServer

			const watcher = createBuildWatcher({
				targetPath,
				workPath,
				useAppIdDir,
				autoListen: false,
				options: { sourcemap, lifecycle },
				beforeBuild: ({ event, filePath, count, plan, appId }) => {
					// F-002：build 前合成 reload 级别并注入 pendingReload（buildId 自增）
					const payload = synthesizeReloadLevel({
						event,
						filePath,
						count,
						plan,
						appId,
						buildId: ++buildIdCounter,
					})
					devServer.setPendingReload(payload)
				},
				onRebuild: ({ event, filePath, count }) => {
					const merged = count > 1 ? `（合并 ${count} 个文件事件）` : ''
					console.log(`${filePath} ${EVENT_LABELS[event]}，重新编译${merged}`)
				},
				onError: (error) => {
					// build:error 已由 lifecycle 监听推送；此处仅记录诊断（R-006：服务不退出）
					console.error(`${workPath} 编译出错: ${error.message}`)
				},
			})

			let buildResult
			try {
				buildResult = await watcher.start()
			}
			catch (error) {
				throw new Error(`${workPath} 编译出错: ${error.message}`, { cause: error })
			}

			devServer = createDevServer({
				serveRoot: targetPath,
				sdkRoot: resolveSdkRoot(),
				appId: buildResult.appId,
				wsPath: '/ws',
			})

			lifecycle.on(LIFECYCLE_EVENTS.BUNDLE_PUBLISHED, () => {
				devServer.notifyBuildPublished()
			})
			lifecycle.on(LIFECYCLE_EVENTS.BUILD_ERROR, (payload) => {
				devServer.notifyBuildError(payload.error?.message || 'build failed')
			})

			const { port: actualPort, host } = await devServer.listen(port, '127.0.0.1')
			console.log(`[dmcc-dev] preview at http://${host}:${actualPort}?appId=${buildResult.appId}`)
			console.log(`[dmcc-dev] watching ${workPath}`)

			await watcher.listen()
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
