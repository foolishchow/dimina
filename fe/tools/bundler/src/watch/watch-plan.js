/**
 * watch-plan — watch 循环计划生产（build-model M2 重写版）。
 *
 * M2（D-BM-3）：事件降级为触发器——chokidar 事件只标记"该文件脏了"，
 * drain 时做 scan+closure 状态对比，事件合并（count>1）歧义自然消失。
 * 旧版"count>1 保守退全量"不再存在（R-BM4 行为改进点）。
 *
 * scan/closure 调用 fingerprint.js + invalidation.js 单实现。
 */

import path from 'node:path'
import { computeAffectedEntries, computeStagesForFiles } from '../model/invalidation.js'
import { scanFingerprints } from '../model/fingerprint.js'

const WATCH_FILE_EVENTS = new Set(['add', 'change', 'unlink'])

function isNpmPackageFile(filePath) {
	return path.normalize(filePath).split(path.sep).includes('miniprogram_npm')
}

function createWatchRebuildScheduler({ rebuild, onRebuild = () => {}, onError = () => {} }) {
	/** 脏文件集（事件降级为触发器：只标记，不推导） */
	const dirtyFiles = new Set()
	/** 每个脏文件的最近事件类型（drain 回调保留原始 event shape） */
	const lastEvent = new Map()
	let running = false
	let idlePromise = Promise.resolve()
	let resolveIdle

	const drain = async () => {
		while (dirtyFiles.size > 0) {
			const changed = [...dirtyFiles]
			dirtyFiles.clear()
			try {
				// 保留旧回调 shape（{event,filePath,count}）以兼容 onRebuild/onError/beforeBuild
				const first = changed[0]
				onRebuild({ event: lastEvent.get(first) || 'change', filePath: first, count: changed.length })
				await rebuild({ changedFiles: changed, event: lastEvent.get(first) || 'change', filePath: first, count: changed.length })
			}
			catch (error) {
				const first = changed[0]
				onError(error, { event: lastEvent.get(first) || 'change', filePath: first, count: changed.length })
			}
		}

		running = false
		resolveIdle?.()
		resolveIdle = undefined
	}

	return {
		schedule(event, filePath) {
			if (!WATCH_FILE_EVENTS.has(event)) {
				return false
			}

			// M2：事件只做触发器——标记文件脏 + 记录事件类型（drain 回调用）
			// 同一文件多事件只保留最后一个事件类型
			if (dirtyFiles.has(filePath)) {
				dirtyFiles.delete(filePath)
			}
			dirtyFiles.add(filePath)
			lastEvent.set(filePath, event)
			if (!running) {
				running = true
				idlePromise = new Promise((resolve) => {
					resolveIdle = resolve
				})
				void drain()
			}
			return true
		},
		waitForIdle() {
			return idlePromise
		},
	}
}

function getPublishedOutputPath(targetPath, useAppIdDir, appId) {
	return path.resolve(targetPath, useAppIdDir ? appId : '.')
}

/**
 * M2 版计划生成：scan + closure（状态对比，事件无关）。
 *
 * @param {object} params
 * @param {string[]} params.changedFiles 本次变化的文件绝对路径列表
 * @param {DependencyGraph} params.dependencyGraph
 * @param {string} params.workPath
 * @param {string} params.publishedPath
 * @param {Map<string, {mtime,size,hash}>} params.prevFingerprints 上次指纹表（可选）
 * @returns {{ skip: boolean, incremental: boolean, options: object, fingerprints: Map }}
 */
function createWatchBuildPlan({ changedFiles, dependencyGraph, workPath, publishedPath }) {
	if (!changedFiles || changedFiles.length === 0) {
		return { skip: true, incremental: false, options: {}, fingerprints: new Map() }
	}

	// json 变化 → 全量（配置重扫，保守正确）——用绝对路径检查
	if (changedFiles.some((abs) => path.extname(abs).toLowerCase() === '.json')) {
		return { skip: false, incremental: false, options: {}, fingerprints: new Map() }
	}

	// 被图追踪的文件 → 增量；未被追踪 → 全量（新文件/未知文件不应 skip）
	const tracked = changedFiles.filter((abs) => dependencyGraph.hasFile(abs))
	const untracked = changedFiles.filter((abs) => !dependencyGraph.hasFile(abs))
	if (untracked.length > 0) {
		// add 事件（新文件）或未知文件 → 全量 rebuild
		return { skip: false, incremental: false, options: {}, fingerprints: new Map() }
	}
	if (tracked.length === 0) {
		return { skip: true, incremental: false, options: {}, fingerprints: new Map() }
	}

	// closure：变更文件 → 受影响 entry 集
	const affectedSet = computeAffectedEntries(dependencyGraph, tracked)
	const affectedEntries = [...affectedSet]
	if (affectedEntries.length === 0) {
		return { skip: true, incremental: false, options: {}, fingerprints: new Map() }
	}

	// stages：变更文件的 kind → 需要跑的编译阶段
	const stages = computeStagesForFiles(dependencyGraph, tracked)
	if (stages.size === 0) {
		return { skip: false, incremental: false, options: {}, fingerprints: new Map() }
	}

	return {
		skip: false,
		incremental: true,
		options: {
			affectedEntries,
			stages: [...stages],
			seedPath: publishedPath,
			dependencyGraph: dependencyGraph.toJSON(),
			prepareConfig: false,
			prepareNpm: changedFiles.some((abs) => isNpmPackageFile(abs)),
		},
		fingerprints: new Map(), // M2 后续接入（watch 场景暂不持久化指纹表）
	}
}

function isSameOrDescendantPath(candidatePath, directoryPath) {
	const relativePath = path.relative(directoryPath, candidatePath)
	return relativePath === ''
		|| (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath))
}

function createIgnoredPathMatcher(ignoredPaths) {
	return (watchedPath) => {
		const absolutePath = path.resolve(watchedPath)
		for (const ignoredPath of ignoredPaths) {
			if (isSameOrDescendantPath(absolutePath, ignoredPath)) {
				return true
			}
		}
		return false
	}
}

export {
	createWatchBuildPlan,
	createIgnoredPathMatcher,
	createWatchRebuildScheduler,
	getPublishedOutputPath,
}
