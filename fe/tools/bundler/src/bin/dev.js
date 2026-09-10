import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createBundler } from '../session/index.js'
import { resolveBundlerConfig } from '../session/resolve.js'

// M-F3 兼容：resolveSdkRoot 已迁 common/sdk-root.js；此处 re-export 保持向后兼容
export { resolveSdkRoot } from '../common/sdk-root.js'

const DEFAULT_PORT = 8080

const EVENT_LABELS = {
	add: '新增',
	change: '改动',
	unlink: '删除',
}

/**
 * 注册 `dmcc dev` 子命令（挂载到 program）。
 * 编排经 session.dev()：resolve → createBundler → .dev()（session.watch +
 * preview adapter，D1a；R7 回滚）。argv 解析与日志文案留在 bin（R-BC2）。
 * SIGINT 行为与今日一致：bin 无 signal handler，Ctrl+C 默认终止
 * （graceful shutdown 非本门交付；编程关闭走 devHandle.close()）。
 */
export function registerDevCommand(program) {
	program
		.command('dev')
		.description('启动 dev server：编译 + 静态服务 + 内置宿主页 + ws 热更新 + 代理')
		.option('-c, --work-path <path>', '小程序工程根（app.json 所在目录），缺省为当前目录')
		.option('-s, --target-path <path>', '产物快照目录（仅暴露最后一次成功发布），缺省使用系统临时目录')
		.option('-p, --port <number>', `端口（缺省 ${DEFAULT_PORT}）`)
		.option('--host <addr>', '监听地址（缺省 127.0.0.1；局域网访问用 0.0.0.0）')
		.option('--no-app-id-dir', '产物根目录不包含appId')
		.option('--sourcemap', '生成 sourcemap 文件用于调试')
		.option('--minify', '压缩产物（覆盖 mode=dev 缺省；可用 --no-minify 关闭）')
		.action(async (options) => {
			const workPath = options.workPath ? path.resolve(options.workPath) : process.cwd()
			// argv 缺省留 bin（M-G1）：dev 缺省 targetPath 用 mkdtempSync（等价今日）
			const targetPath = options.targetPath
				? path.resolve(options.targetPath)
				: fs.mkdtempSync(path.join(os.tmpdir(), 'dmcc-dev-'))

			const cli = {
				workPath,
				targetPath,
				useAppIdDir: options.appIdDir !== false,
				sourcemap: !!options.sourcemap,
				...(typeof options.minify === 'boolean' ? { minify: options.minify } : {}),
				...(options.port ? { port: Number.parseInt(options.port, 10) } : {}),
				...(typeof options.host === 'string' && options.host ? { host: options.host } : {}),
			}

			const resolved = resolveBundlerConfig({ command: 'dev', cli })
			let handle
			try {
				handle = await createBundler(resolved).dev({
					onRebuild: ({ event, filePath, count }) => {
						const merged = count > 1 ? `（合并 ${count} 个文件事件）` : ''
						console.log(`${filePath} ${EVENT_LABELS[event]}，重新编译${merged}`)
					},
					onError: (error) => {
						// build:error 已由 lifecycle 监听推送；此处仅记录诊断（R-006：服务不退出）
						console.error(`${workPath} 编译出错: ${error.message}`)
					},
				})
			}
			catch (error) {
				throw new Error(`${workPath} 编译出错: ${error.message}`, { cause: error })
			}

			// 文案留 bin：preview URL / LAN 提示 / watching（数据来自 devHandle）
			const boundHost = handle.server.host
			const previewHost = boundHost === '0.0.0.0' ? '127.0.0.1' : boundHost
			console.log(`[dmcc-dev] preview at http://${previewHost}:${handle.server.port}?appId=${handle.appId}`)
			if (boundHost === '0.0.0.0') {
				console.log(`[dmcc-dev] listening on 0.0.0.0:${handle.server.port} (LAN: http://<your-lan-ip>:${handle.server.port}?appId=${handle.appId})`)
			}
			console.log(`[dmcc-dev] watching ${workPath}`)
		})
	return program
}