import chokidar from 'chokidar'
import build from '../index.ts'
import { createProjectStore } from '../model/project-store.ts'
import {
	createIgnoredPathMatcher,
	createWatchBuildPlan,
	createWatchRebuildScheduler,
	getPublishedOutputPath,
} from './watch-plan.ts'

/**
 * 可编程 watch API（CF-4 / watch-api 冻结契约 v1）。
 *
 * @param {object} params
 * @param {string} params.targetPath
 * @param {string} params.workPath
 * @param {boolean} params.useAppIdDir
 * @param {object} [params.options]
 * @param {boolean} [params.autoListen=true]
 * @param {(change: { event: string, filePath: string, count: number }) => void} [params.onRebuild]
 * @param {(ctx: { event: string, filePath: string, count: number, plan: object, appId: string }) => void | Promise<void>} [params.beforeBuild]
 * @param {(error: Error, change: { event: string, filePath: string, count: number }) => void} [params.onError]
 */
export function createBuildWatcher({
	targetPath,
	workPath,
	useAppIdDir,
	store,
	options = {},
	autoListen = true,
	onRebuild = () => {},
	beforeBuild,
	onError = () => {},
}: {
	targetPath: string
	workPath: string
	useAppIdDir: boolean
	store: ReturnType<typeof createProjectStore> | undefined
	options: Record<string, unknown>
	autoListen?: boolean
	onRebuild?: (change: { event: string; filePath: string; count: number }) => void
	beforeBuild?: (ctx: Record<string, unknown>) => void | Promise<void>
	onError?: (e: Error, change: { event: string; filePath: string; count: number }) => void
}) {
	let buildResult: { appId: string; [key: string]: unknown } | undefined
	let scheduler: ReturnType<typeof createWatchRebuildScheduler> | undefined
	let fsWatcher: { on: (ev: string, cb: (event: string, filePath: string) => void) => void; close: () => Promise<void> } | undefined
	let started = false
	let listening = false
	const ignoredOutputPaths = new Set<string>()

	const publishedPathFor = (appId: string) => getPublishedOutputPath(targetPath, useAppIdDir, appId)

	const ensureStarted = () => {
		if (!started) {
			throw new Error('createBuildWatcher: call start() before listen()')
		}
	}

	async function listen() {
		ensureStarted()
		if (listening) {
			throw new Error('createBuildWatcher: already listening')
		}

		fsWatcher = chokidar.watch(workPath, {
			persistent: true,
			ignoreInitial: true,
			ignored: createIgnoredPathMatcher([...ignoredOutputPaths]),
		})
		fsWatcher.on('all', (event, filePath) => {
			// M2：事件只做触发器，不推导
			scheduler!.schedule(event, filePath)
		})
		listening = true
	}

	async function start() {
		if (started) {
			throw new Error('createBuildWatcher: already started')
		}

		// PS2：活图唯一权威为 ProjectStore——无注入时临时 create 并持有（W2），
		// 不再维护闭包 dependencyGraph 镜像（W3 删除）。
		const activeStore = store ?? createProjectStore()
		buildResult = await build(targetPath, workPath, useAppIdDir, { ...options, store: activeStore }) as { appId: string; [key: string]: unknown }
		ignoredOutputPaths.add(publishedPathFor(buildResult!.appId))

		scheduler = createWatchRebuildScheduler({
			onRebuild,
			onError,
			rebuild: async (change) => {
				const publishedPath = publishedPathFor(buildResult!.appId)
				// PS2：plan 从 Store 活图读取（同一引用，M-A），不再读闭包镜像
				const plan = createWatchBuildPlan({
					changedFiles: change.changedFiles,
					dependencyGraph: activeStore.getDependencyGraph(),
					workPath,
					publishedPath,
				})
				if (plan.skip) {
					return
				}
				if (beforeBuild) {
					await beforeBuild({
						...change,
						plan,
						appId: buildResult!.appId,
					})
				}
				const result = await build(targetPath, workPath, useAppIdDir, {
					...options,
					store: activeStore,
					...plan.options,
				})
				buildResult = result as { appId: string; [key: string]: unknown }
				ignoredOutputPaths.add(publishedPathFor((result as { appId: string }).appId))
			},
		})

		started = true
		if (autoListen) {
			await listen()
		}
		return buildResult
	}

	async function stop() {
		if (fsWatcher) {
			await fsWatcher.close()
			fsWatcher = undefined
		}
		listening = false
		if (scheduler) {
			await scheduler.waitForIdle()
		}
	}

	return {
		start,
		listen,
		stop,
		/** @internal 测试用 */
		waitForIdle() {
			return scheduler?.waitForIdle() ?? Promise.resolve()
		},
	}
}

export default createBuildWatcher
