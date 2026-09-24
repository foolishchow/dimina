/**
 * invalidation — 指纹失效传播（build-model M2 / D-BM-3）。
 *
 * 变更集 → 依赖图闭包 → 受影响 Entry 集。
 * 单实现：服务 watch（事件降级为触发器）与后续 cache 路径。
 *
 * D-BM-3：状态对比替代事件推导——事件合并（count>1）歧义自然消失。
 * closure 复用 DependencyGraph.getAffectedEntries 语义，粒度落 Entry。
 */

/**
 * 计算受影响的 Entry 集（图闭包）。
 *
 * @param {DependencyGraph} graph 依赖图实例
 * @param {string[]} changedFiles 项目相对路径列表
 * @returns {Set<string>} 受影响的 entryId 集合（页面/组件路径）
 */
export function computeAffectedEntries(graph: { getAffectedEntries: (f: string) => string[] }, changedFiles: string[]): Set<string> {
	const affected = new Set<string>()
	for (const filePath of changedFiles) {
		const entries = graph.getAffectedEntries(filePath)
		for (const entry of entries) {
			affected.add(entry)
		}
	}
	return affected
}

/**
 * 计算受影响的全 kind Module 集（图闭包，全 kind 边）。
 *
 * D-IV-1: computeInvalidatedModules — 批量；返回排序去重 string[]。
 * D-IU-1: 闭包沿全 kind dependents（D-IV-6/7 已反转：原 logic-only）。
 * 粒度落 Module（全 kind moduleId），与 computeAffectedEntries（Entry）分工。
 *
 * @param {DependencyGraph} graph 依赖图实例
 * @param {string[]} changedFiles 变更文件路径列表
 * @returns {string[]} 受影响的全 kind moduleId 列表（排序去重）
 */
export function computeInvalidatedModules(graph: { getInvalidatedModules: (f: string) => string[] }, changedFiles: string[]): string[] {
	const out = new Set<string>()
	for (const filePath of changedFiles) {
		for (const id of graph.getInvalidatedModules(filePath)) {
			out.add(id)
		}
	}
	return [...out].sort()
}

/**
 * 判定 Entry 是否需要重算。
 *
 * @param {string} entryId
 * @param {Set<string>} affectedEntries
 * @returns {boolean}
 */
export function entryNeedsRebuild(entryId: string, affectedEntries: Set<string>) {
	return affectedEntries.has(entryId)
}

/**
 * 计算需要重算的 stages（view/logic/style）——基于变更文件的 kind。
 *
 * @param {DependencyGraph} graph
 * @param {string[]} changedFiles
 * @param {string[]} allStages 可用 stages 列表（默认 ['view','logic','style']）
 * @returns {Set<string>} 需要跑的 stage 集合（空 = 全部需要，表示全量）
 */
import { COMPILE_STAGE_ORDER } from '../../model/stage-order.ts'

export function computeStagesForFiles(graph: { getFileKinds: (f: string) => string[] }, changedFiles: string[], allStages: string[] = COMPILE_STAGE_ORDER): Set<string> {
	const stages = new Set<string>()
	for (const filePath of changedFiles) {
		const kinds = graph.getFileKinds(filePath)
		if ((kinds as { size?: number }).size === 0) {
			// 未知 kind → 保守全量
			return new Set<string>(allStages)
		}
		for (const kind of kinds) {
			stages.add(kind)
		}
	}
	return stages
}
