#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import { program } from 'commander'
import pack from '../../package.json' with { type: 'json' }
import build from '../index.js'
import { createBuildWatcher } from '../common/watch-runner.js'
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
	.action(async (options) => {
		const workPath = options.workPath ? path.resolve(options.workPath) : process.cwd()
		const targetPath = options.targetPath ? path.resolve(options.targetPath) : process.cwd()
		const useAppIdDir = options.appIdDir !== false
		const sourcemap = !!options.sourcemap
		const minify = typeof options.minify === 'boolean' ? options.minify : undefined
		const buildOptions = {
			mode: 'build',
			sourcemap,
			...(minify === undefined ? {} : { minify }),
		}

		if (!options.watch) {
			try {
				await build(targetPath, workPath, useAppIdDir, buildOptions)
			}
			catch (error) {
				throw new Error(`${workPath} 编译出错: ${error.message}`, { cause: error })
			}
			return
		}

		const watcher = createBuildWatcher({
			targetPath,
			workPath,
			useAppIdDir,
			options: buildOptions,
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
	.name('dmcc')
	.version(pack.version)

program.parseAsync(process.argv).catch((error) => {
	console.error(error.stack || error.message)
	process.exitCode = 1
})
