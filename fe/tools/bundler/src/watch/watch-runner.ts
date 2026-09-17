import chokidar from 'chokidar'
import build from '../index.js'
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
	store: unknown
	options: Record<string, unknown>
	autoListen?: boolean
	onRebuild?: () => void
	beforeBuild?: () => void | Promise<void>
	onError?: (e: Error) => void
}) {
	// @ts-expect-error P-TM04: type narrowing needed
	let buildResult
	// @ts-expect-error P-TM04: type narrowing needed
	let scheduler
	// @ts-expect-error P-TM04: type narrowing needed
	let fsWatcher
	let started = false
	let listening = false
	const ignoredOutputPaths = new Set()

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
			// @ts-expect-error P-TM04: type narrowing needed
			ignored: createIgnoredPathMatcher(ignoredOutputPaths),
		})
		fsWatcher.on('all', (event, filePath) => {
			// M2：事件只做触发器，不推导
			// @ts-expect-error P-TM04: type narrowing needed
			scheduler.schedule(event, filePath)
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
		buildResult = await build(targetPath, workPath, useAppIdDir, { ...options, store: activeStore })
		// @ts-expect-error P-TM04: type narrowing needed
		ignoredOutputPaths.add(publishedPathFor(buildResult.appId))

		scheduler = createWatchRebuildScheduler({
			onRebuild,
			onError,
			// @ts-expect-error P-TM04: type narrowing needed
			rebuild: async (change) => {
				// @ts-expect-error P-TM04: type narrowing needed
				const publishedPath = publishedPathFor(buildResult.appId)
				// PS2：plan 从 Store 活图读取（同一引用，M-A），不再读闭包镜像
				const plan = createWatchBuildPlan({
					changedFiles: change.changedFiles,
					// @ts-expect-error P-TM04: type narrowing needed
					dependencyGraph: activeStore.getDependencyGraph(),
					workPath,
					publishedPath,
				})
				if (plan.skip) {
					return
				}
				if (beforeBuild) {
					// @ts-expect-error P-TM04: type narrowing needed
					await beforeBuild({
						...change,
						plan,
						// @ts-expect-error P-TM04: type narrowing needed
						appId: buildResult.appId,
					})
				}
				const result = await build(targetPath, workPath, useAppIdDir, {
					...options,
					store: activeStore,
					...plan.options,
				})
				buildResult = result
				// @ts-expect-error P-TM04: type narrowing needed
				ignoredOutputPaths.add(publishedPathFor(result.appId))
			},
		})

		started = true
		if (autoListen) {
			await listen()
		}
		return buildResult
	}

	async function stop() {
		// @ts-expect-error P-TM04: type narrowing needed
		if (fsWatcher) {
			await fsWatcher.close()
			fsWatcher = undefined
		}
		listening = false
		// @ts-expect-error P-TM04: type narrowing needed
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
			// @ts-expect-error P-TM04: type narrowing needed
			return scheduler?.waitForIdle() ?? Promise.resolve()
		},
	}
}

export default createBuildWatcher
