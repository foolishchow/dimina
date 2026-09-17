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

import { getDependencyGraph, storeInfo } from '../compiler/core/env.ts'

/**
 * @param {object} [options]
 * @returns {object} ProjectStore
 */
export function createProjectStore(options = {}) {
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
		load(workPath, opts = {}) {
			snapshot = storeInfo(workPath, opts)
			return snapshot
		},

		/** 获取活依赖图引用（M-A：与 ctx.dependencyGraph 同一引用） */
		getDependencyGraph() {
			return getDependencyGraph()
		},

		/** 合并依赖图增量 */
		merge(delta) {
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
export function isLoaded(store) {
	return store !== null && store !== undefined
}
