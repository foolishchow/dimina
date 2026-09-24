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

const { createBuildWatcher } = await import('../src/watch/watch-runner.ts')
const { PackerSessionState } = await import('../src/packer/session-state.ts')

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
		// PS2：watch 恒注入 store（无 store 时临时 create 并持有）——活图唯一权威
		expect(build).toHaveBeenCalledTimes(1)
		const [, , , buildOptions] = build.mock.calls[0]
		expect(buildOptions).toMatchObject({ sourcemap: true })
		expect(buildOptions.store).toBeTruthy()
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

	it('PS2: injected store is passed to build (same reference, live-graph authority)', async () => {
		const fsWatcher = createFakeWatcher()
		chokidarWatch.mockReturnValue(fsWatcher)

		const store = {
			load: vi.fn().mockReturnValue({ compilerOptions: {} }),
			getDependencyGraph: vi.fn().mockReturnValue({ hasFile: () => false, toJSON: () => emptyGraph() }),
		}
		const watcher = createBuildWatcher({
			targetPath: '/dist',
			workPath: '/project',
			useAppIdDir: true,
			store,
			options: { sourcemap: true },
		})

		await watcher.start()

		expect(build).toHaveBeenCalledTimes(1)
		const [, , , buildOptions] = build.mock.calls[0]
		expect(buildOptions.store).toBe(store)
	})

	it('PS2: no injected store → temp store created and reused (W2)', async () => {
		const fsWatcher = createFakeWatcher()
		chokidarWatch.mockReturnValue(fsWatcher)

		const watcher = createBuildWatcher({
			targetPath: '/dist',
			workPath: '/project',
			useAppIdDir: true,
		})

		await watcher.start()

		expect(build).toHaveBeenCalledTimes(1)
		const [, , , buildOptions] = build.mock.calls[0]
		expect(buildOptions.store).toBeTruthy()
		expect(typeof buildOptions.store.getDependencyGraph).toBe('function')
	})

	it('PS2: rebuild plan reads the live graph from sessionState.graph (D-OS-3)', async () => {
		const fsWatcher = createFakeWatcher()
		chokidarWatch.mockReturnValue(fsWatcher)

		const mockGraph = {
			hasFile: () => true,
			getAffectedEntries: () => ['pages/index/index'],
			getFileKinds: () => ['logic'],
			getInvalidatedModules: () => ['pages/index/index'],
			toJSON: () => ({ nodes: [], edges: [], fileEdges: [] }),
		}
		const state = {
			graph: mockGraph,
			moduleCache: { toJSON: () => [] },
			invalidatedModules: new Set(),
		}
		const store = {
			load: vi.fn().mockReturnValue({ compilerOptions: {} }),
			getDependencyGraph: vi.fn(),
		}
		const beforeBuild = vi.fn()
		const watcher = createBuildWatcher({
			targetPath: '/dist',
			workPath: '/project',
			useAppIdDir: true,
			store,
			state,
			beforeBuild,
		})

		await watcher.start()

		// change 事件：tracked（hasFile=true）→ 增量路径 → plan 读 state.graph
		fsWatcher.emit('all', 'change', path.resolve('/project/pages/index/index.js'))
		await watcher.waitForIdle()

		// D-OS-3: plan 从 sessionState.graph 读活图，不再调 activeStore.getDependencyGraph()
		expect(store.getDependencyGraph).not.toHaveBeenCalled()
		const plan = beforeBuild.mock.calls[0][0].plan
		expect(plan.skip).toBe(false)
	})

	it('IRC D-IRC-5: R1 接线——注入 state（viewCache 未设）→ watch-runner R1 接线赋值 viewCache/styleCache（不手建 Map）', async () => {
		const fsWatcher = createFakeWatcher()
		chokidarWatch.mockReturnValue(fsWatcher)

		// 注入 state（viewCache/styleCache 未设——不手建 Map）
		const state = new PackerSessionState()
		expect(state.viewCache).toBeUndefined()
		expect(state.styleCache).toBeUndefined()

		const watcher = createBuildWatcher({
			targetPath: '/dist',
			workPath: '/project',
			useAppIdDir: true,
			store: { load: vi.fn().mockReturnValue({ compilerOptions: {} }), getDependencyGraph: vi.fn().mockReturnValue({ hasFile: () => false, toJSON: () => emptyGraph() }) },
			state,
			options: { sourcemap: true },
		})

		await watcher.start()

		// R1 接线：watch-runner :91 赋值 viewCache/styleCache（非测试手设）
		expect(state.viewCache).toBeInstanceOf(Map)
		expect(state.styleCache).toBeInstanceOf(Map)
	})
})
