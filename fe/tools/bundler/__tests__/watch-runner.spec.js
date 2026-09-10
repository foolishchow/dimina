import { EventEmitter } from 'node:events'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const build = vi.fn()
const chokidarWatch = vi.fn()

vi.mock('../src/index.js', () => ({
	default: (...args) => build(...args),
}))

vi.mock('chokidar', () => ({
	default: {
		watch: (...args) => chokidarWatch(...args),
	},
}))

const { createBuildWatcher } = await import('../src/common/watch-runner.js')

function createFakeWatcher() {
	const emitter = new EventEmitter()
	emitter.close = vi.fn().mockResolvedValue(undefined)
	return emitter
}

function emptyGraph() {
	return { nodes: [], edges: [], fileEdges: [] }
}

describe('createBuildWatcher', () => {
	beforeEach(() => {
		build.mockReset()
		chokidarWatch.mockReset()
		build.mockResolvedValue({
			appId: 'app-1',
			dependencyGraph: emptyGraph(),
		})
	})

	it('start() runs initial build, resolves buildResult, and auto-listens by default', async () => {
		const fsWatcher = createFakeWatcher()
		chokidarWatch.mockReturnValue(fsWatcher)

		const watcher = createBuildWatcher({
			targetPath: '/dist',
			workPath: '/project',
			useAppIdDir: true,
			options: { sourcemap: true },
		})

		const result = await watcher.start()
		expect(result.appId).toBe('app-1')
		expect(build).toHaveBeenCalledWith('/dist', '/project', true, { sourcemap: true })
		expect(chokidarWatch).toHaveBeenCalledWith('/project', expect.objectContaining({
			persistent: true,
			ignoreInitial: true,
		}))
	})

	it('autoListen:false defers chokidar until listen()', async () => {
		const fsWatcher = createFakeWatcher()
		chokidarWatch.mockReturnValue(fsWatcher)

		const watcher = createBuildWatcher({
			targetPath: '/dist',
			workPath: '/project',
			useAppIdDir: true,
			autoListen: false,
		})

		await watcher.start()
		expect(chokidarWatch).not.toHaveBeenCalled()

		await watcher.listen()
		expect(chokidarWatch).toHaveBeenCalledTimes(1)

		await expect(watcher.listen()).rejects.toThrow(/already listening/)
	})

	it('invokes beforeBuild before rebuild build() and keeps listening after errors', async () => {
		const fsWatcher = createFakeWatcher()
		chokidarWatch.mockReturnValue(fsWatcher)

		const beforeBuild = vi.fn()
		const onRebuild = vi.fn()
		const onError = vi.fn()
		const rebuildError = new Error('compile failed')

		build
			.mockResolvedValueOnce({
				appId: 'app-1',
				dependencyGraph: emptyGraph(),
			})
			.mockRejectedValueOnce(rebuildError)
			.mockResolvedValueOnce({
				appId: 'app-1',
				dependencyGraph: emptyGraph(),
			})

		const watcher = createBuildWatcher({
			targetPath: '/dist',
			workPath: '/project',
			useAppIdDir: true,
			beforeBuild,
			onRebuild,
			onError,
		})
		await watcher.start()

		// add 不走 skip（非 change），可触发全量 rebuild
		fsWatcher.emit('all', 'add', path.resolve('/project/pages/index/index.js'))
		await watcher.waitForIdle()

		expect(onRebuild).toHaveBeenCalledWith(expect.objectContaining({
			event: 'add',
			filePath: path.resolve('/project/pages/index/index.js'),
		}))
		expect(beforeBuild).toHaveBeenCalledWith(expect.objectContaining({
			event: 'add',
			appId: 'app-1',
			plan: expect.objectContaining({ skip: false, incremental: false }),
		}))
		expect(onError).toHaveBeenCalledWith(rebuildError, expect.objectContaining({
			filePath: path.resolve('/project/pages/index/index.js'),
		}))

		fsWatcher.emit('all', 'add', path.resolve('/project/pages/about/about.js'))
		await watcher.waitForIdle()
		expect(build).toHaveBeenCalledTimes(3)
	})

	it('stop() closes the filesystem watcher', async () => {
		const fsWatcher = createFakeWatcher()
		chokidarWatch.mockReturnValue(fsWatcher)

		const watcher = createBuildWatcher({
			targetPath: '/dist',
			workPath: '/project',
			useAppIdDir: false,
		})
		await watcher.start()
		await watcher.stop()
		expect(fsWatcher.close).toHaveBeenCalled()
	})
})
