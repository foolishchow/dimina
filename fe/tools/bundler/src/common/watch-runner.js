import chokidar from 'chokidar'
import build from '../index.js'
import { DependencyGraph } from './dependency-graph.js'
import {
	createIgnoredPathMatcher,
	createWatchBuildPlan,
	createWatchRebuildScheduler,
	getPublishedOutputPath,
} from './watch-plan.js'

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
	options = {},
	autoListen = true,
	onRebuild = () => {},
	beforeBuild,
	onError = () => {},
}) {
	let buildResult
	let dependencyGraph
	let scheduler
	let fsWatcher
	let started = false
	let listening = false
	const ignoredOutputPaths = new Set()

	const publishedPathFor = (appId) => getPublishedOutputPath(targetPath, useAppIdDir, appId)

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
			ignored: createIgnoredPathMatcher(ignoredOutputPaths),
		})
		fsWatcher.on('all', (event, filePath) => {
			// M2：事件只做触发器，不推导
			scheduler.schedule(event, filePath)
		})
		listening = true
	}

	async function start() {
		if (started) {
			throw new Error('createBuildWatcher: already started')
		}

		buildResult = await build(targetPath, workPath, useAppIdDir, { ...options })
		dependencyGraph = new DependencyGraph(buildResult.dependencyGraph)
		ignoredOutputPaths.add(publishedPathFor(buildResult.appId))

		scheduler = createWatchRebuildScheduler({
			onRebuild,
			onError,
			rebuild: async (change) => {
				const publishedPath = publishedPathFor(buildResult.appId)
				const plan = createWatchBuildPlan({
					changedFiles: change.changedFiles,
					dependencyGraph,
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
						appId: buildResult.appId,
					})
				}
				const result = await build(targetPath, workPath, useAppIdDir, {
					...options,
					...plan.options,
				})
				buildResult = result
				dependencyGraph = new DependencyGraph(result.dependencyGraph)
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
