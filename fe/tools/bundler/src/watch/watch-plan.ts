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
import { computeAffectedEntries, computeStagesForFiles, computeInvalidatedModules } from '../packer/cache/invalidation.ts'
import { fingerprintFile } from '../packer/cache/fingerprint.ts'
import type { FileFP } from '../packer/cache/fingerprint.ts'

const WATCH_FILE_EVENTS = new Set(['add', 'change', 'unlink'])

function isNpmPackageFile(filePath: string) {
	return path.normalize(filePath).split(path.sep).includes('miniprogram_npm')
}

interface RebuildChange { changedFiles: string[]; event: string; filePath: string; count: number }
interface RebuildNotify { event: string; filePath: string; count: number }
function createWatchRebuildScheduler({ rebuild, onRebuild = () => {}, onError = () => {} }: { rebuild: (change: RebuildChange) => void | Promise<void>; onRebuild?: (change: RebuildNotify) => void; onError?: (e: Error, change: RebuildNotify) => void }) {
	/** 脏文件集（事件降级为触发器：只标记，不推导） */
	const dirtyFiles = new Set<string>()
	/** 每个脏文件的最近事件类型（drain 回调保留原始 event shape） */
	const lastEvent = new Map<string, string>()
	let running = false
	let idlePromise = Promise.resolve()
	let resolveIdle: (() => void) | undefined

	const drain = async () => {
		while (dirtyFiles.size > 0) {
			const changed = [...dirtyFiles]
			dirtyFiles.clear()
			try {
				// 保留旧回调 shape（{event,filePath,count}）以兼容 onRebuild/onError/beforeBuild
				const first = changed[0]!
				onRebuild({ event: lastEvent.get(first) || 'change', filePath: first, count: changed.length })
				await rebuild({ changedFiles: changed, event: lastEvent.get(first) || 'change', filePath: first, count: changed.length })
			}
			catch (error) {
				const first = changed[0]!
				onError(error instanceof Error ? error : new Error(String(error)), { event: lastEvent.get(first) || 'change', filePath: first, count: changed.length })
			}
		}

		running = false
		resolveIdle?.()
		resolveIdle = undefined
	}

	return {
		schedule(event: string, filePath: string): boolean {
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

function getPublishedOutputPath(targetPath: string, useAppIdDir: boolean, appId: string) {
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
function createWatchBuildPlan({ changedFiles, dependencyGraph, workPath, publishedPath, prevFingerprints }: { changedFiles: string[]; dependencyGraph: { hasFile: (f: string) => boolean; getAffectedEntries: (f: string) => string[]; getFileKinds: (f: string) => string[]; getInvalidatedModules: (f: string) => string[]; toJSON: () => unknown }; workPath: string; publishedPath: string; prevFingerprints?: Map<string, FileFP> }) {
	// D-FP-3: 上一轮指纹表（来自 PackerSessionState）。所有 return 路径都带更新后的 fingerprints。
	const fingerprints = new Map(prevFingerprints ?? [])

	if (!changedFiles || changedFiles.length === 0) {
		return { skip: true, incremental: false, options: {}, fingerprints }
	}

	// D-FP-4: 早固定所有 changedFiles——所有 return 路径（json/untracked 全量、incremental）都更新指纹
	for (const absPath of changedFiles) {
		const relPath = path.relative(workPath, absPath).split(path.sep).join('/')
		const prev = prevFingerprints?.get(relPath)
		const fp = fingerprintFile(absPath, prev)
		if (fp === null) {
			// 文件删除 → 从指纹表移除
			fingerprints.delete(relPath)
		} else {
			fingerprints.set(relPath, fp)
		}
	}

	// json 变化 → 全量（配置重扫，保守正确）——用绝对路径检查
	if (changedFiles.some((abs) => path.extname(abs).toLowerCase() === '.json')) {
		return { skip: false, incremental: false, configChanged: true, options: { incremental: false, configChanged: true }, fingerprints }
	}

	// 被图追踪的文件 → 增量；未被追踪 → 全量（新文件/未知文件不应 skip）
	const tracked = changedFiles.filter((abs) => dependencyGraph.hasFile(abs))
	const untracked = changedFiles.filter((abs) => !dependencyGraph.hasFile(abs))
	if (untracked.length > 0) {
		// add 事件（新文件）或未知文件 → 全量 rebuild
		return { skip: false, incremental: false, configChanged: false, options: { incremental: false, configChanged: false }, fingerprints }
	}
	if (tracked.length === 0) {
		return { skip: true, incremental: false, configChanged: false, options: {}, fingerprints }
	}

	// D-FP-5: content-based dedup——mtime 变但 content hash 没变的文件从 actuallyChanged 过滤掉（false positive）
	const actuallyChanged: string[] = []
	for (const absPath of tracked) {
		const relPath = path.relative(workPath, absPath).split(path.sep).join('/')
		const fp = fingerprints.get(relPath) // 已在 D-FP-4 计算
		const prev = prevFingerprints?.get(relPath)
		if (fp === undefined) {
			// fingerprintFile 返回 null（文件删除）→ 保留
			actuallyChanged.push(absPath)
		} else if (prev && prev.hash === fp.hash) {
			// content 未变 → false positive，跳过
		} else {
			// 新文件或 content 变了 → 保留
			actuallyChanged.push(absPath)
		}
	}
	if (actuallyChanged.length === 0) {
		return { skip: true, incremental: false, configChanged: false, options: {}, fingerprints }
	}

	// closure：变更文件 → 受影响 entry 集
	const affectedSet = computeAffectedEntries(dependencyGraph, actuallyChanged)
	const affectedEntries = [...affectedSet]
	if (affectedEntries.length === 0) {
		return { skip: true, incremental: false, configChanged: false, options: {}, fingerprints }
	}

	// M2 D-RC-4：computeInvalidatedModules — dirty moduleId 集
	const invalidatedModules = computeInvalidatedModules(dependencyGraph, actuallyChanged)

	// stages：变更文件的 kind → 需要跑的编译阶段
	const stages = computeStagesForFiles(dependencyGraph, actuallyChanged)
	if (stages.size === 0) {
		return { skip: false, incremental: false, configChanged: false, options: { incremental: false, configChanged: false }, fingerprints }
	}

	return {
		skip: false,
		incremental: true,
		configChanged: false,
		options: {
			incremental: true,
			configChanged: false,
			affectedEntries,
			stages: [...stages],
			invalidatedModules,
			seedPath: publishedPath,
			prepareConfig: false,
			prepareNpm: actuallyChanged.some((abs) => isNpmPackageFile(abs)),
		},
		fingerprints,
	}
}

function isSameOrDescendantPath(candidatePath: string, directoryPath: string) {
	const relativePath = path.relative(directoryPath, candidatePath)
	return relativePath === ''
		|| (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath))
}

function createIgnoredPathMatcher(ignoredPaths: string[]) {
	return (watchedPath: string) => {
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
