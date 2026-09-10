#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import { program } from 'commander'
import pack from '../../package.json' with { type: 'json' }
import { createBundler } from '../session/index.js'
import { resolveBundlerConfig } from '../session/resolve.js'
import { registerDevCommand } from './dev.js'

const EVENT_LABELS = {
	add: '新增',
	change: '改动',
	unlink: '删除',
}

program
	.command('build')
	.option('-c, --work-path <path>', '编译工作目录')
	.option('-s, --target-path <path>', '编译产物存放路径')
	.option('-w, --watch', '启用监听文件改动')
	.option('--no-app-id-dir', '产物根目录不包含appId')
	.option('--sourcemap', '生成 sourcemap 文件用于调试')
	.option('--minify', '压缩产物（覆盖 mode 缺省；可用 --no-minify 关闭）')
	.option('--platform <name>', '运行时宿主平台：native | web（缺省 native）')
	.action(async (options) => {
		const workPath = options.workPath ? path.resolve(options.workPath) : process.cwd()
		// argv defaults stay in bin (M-G1): resolve receives explicit values only
		const targetPath = options.targetPath ? path.resolve(options.targetPath) : process.cwd()
		const cli = {
			workPath,
			targetPath,
			useAppIdDir: options.appIdDir !== false,
			sourcemap: !!options.sourcemap,
			...(typeof options.minify === 'boolean' ? { minify: options.minify } : {}),
			...(typeof options.platform === 'string' ? { platform: options.platform } : {}),
		}
		const resolved = resolveBundlerConfig({ command: 'build', cli })

		if (!options.watch) {
			try {
				await createBundler(resolved).build()
			}
			catch (error) {
				throw new Error(`${workPath} 编译出错: ${error.message}`, { cause: error })
			}
			return
		}

		// -w ⊆ session（R-BC2）：经 session.watch 编排，bin 不再直接引用底层 watcher
		const watcher = createBundler(resolved).watch({
			onRebuild: ({ event, filePath, count }) => {
				const merged = count > 1 ? `（合并 ${count} 个文件事件）` : ''
				console.log(`${filePath} ${EVENT_LABELS[event]}，重新编译${merged}`)
			},
			onError: (error) => {
				console.error(`${workPath} 编译出错: ${error.message}`)
			},
		})

		try {
			await watcher.start()
		}
		catch (error) {
			throw new Error(`${workPath} 编译出错: ${error.message}`, { cause: error })
		}
	})

registerDevCommand(program)

program
	.name('dimina-cli')
	.version(pack.version)

program.parseAsync(process.argv).catch((error) => {
	console.error(error.stack || error.message)
	process.exitCode = 1
})
