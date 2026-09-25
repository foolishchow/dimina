/**
 * ProjectStore — 工程上下文 + 依赖图权威的管家（build-model M1 后续 / project-store PS1）。
 *
 * 职责：装载结果的持有与图权威（load≈storeInfo、seed/merge/snapshot/query）。
 * 不是 session、不做 worker 派工、不做 Listr/HTTP/ws/产品 .dev/管会话。
 *
 * 生命周期：随 session 始终存在（非可选）；load 按需。
 * 权威：主线程；worker 只持注入引用，不反改。
 *
 * D-PS-SESSION：session 是唯一会话管理者；ProjectStore 不升级为会话。
 * PS1 不做 applyChanges/subscribe（PS3+）、graphDelta、TS-2 IR。
 *
 * 设计：ProjectStore 是 storeInfo + ALS 的**薄包**——load 调用 storeInfo
 * （其结果写入 ALS），后续 getDependencyGraph 从同一 ALS 读。
 * M-A：ctx.dependencyGraph 与 store.getDependencyGraph() 是同一引用。
 */

import { getDependencyGraph, storeInfo } from './env.ts'
import type { GraphSnapshot } from '../graph/dependency-graph.ts'

/**
 * ProjectStore 形状契约（facade-collaborator D-FC-1 类型来源）。
 *
 * createProjectStore 返回值的 typed 边界——collaborator deps 引用此接口
 * 而非 inferred 返回类型。load 按需（session 内首 build 调）。
 */
export interface ProjectStore {
	load(workPath: string, opts?: Record<string, unknown>): Record<string, unknown>
	getDependencyGraph(): { addFile: (n: string, f: string, k: string) => void; merge: (d: GraphSnapshot) => void; toJSON: () => unknown; getInnerGraph?: () => unknown }
	merge(delta: GraphSnapshot): void
	snapshot(): unknown
}

/**
 * @param {object} [_options]
 * @returns {object} ProjectStore
 */
export function createProjectStore(_options: Record<string, unknown> = {}): ProjectStore {
	/** @type {object | null} storeInfo 返回值 */
	let snapshot = null

	return {
		/**
		 * 装载工程上下文（薄包 storeInfo + ALS）——与今日语义一致。
		 *
		 * @param {string} workPath
		 * @param {object} [opts] { fileTypes, dependencyGraph }
		 * @returns {object} storeInfo 返回值
		 */
		load(workPath: string, opts: Record<string, unknown> = {}) {
			snapshot = storeInfo(workPath, opts)
			return snapshot
		},

		/** 获取活依赖图引用（M-A：与 ctx.dependencyGraph 同一引用） */
		getDependencyGraph() {
			return getDependencyGraph()
		},

		/** 合并依赖图增量 */
		merge(delta: GraphSnapshot) {
			getDependencyGraph().merge(delta)
		},

		/** 快照 */
		snapshot() {
			return getDependencyGraph().toJSON()
		},
	}
}

/**
 * 检查 store 是否已 load（有工程状态）。
 */
export function isLoaded(store: unknown) {
	return store !== null && store !== undefined
}
