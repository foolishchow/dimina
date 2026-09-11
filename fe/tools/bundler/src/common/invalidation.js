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
export function computeAffectedEntries(graph, changedFiles) {
	const affected = new Set()
	for (const filePath of changedFiles) {
		const entries = graph.getAffectedEntries(filePath)
		for (const entry of entries) {
			affected.add(entry)
		}
	}
	return affected
}

/**
 * 判定 Entry 是否需要重算。
 *
 * @param {string} entryId
 * @param {Set<string>} affectedEntries
 * @returns {boolean}
 */
export function entryNeedsRebuild(entryId, affectedEntries) {
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
export function computeStagesForFiles(graph, changedFiles, allStages = ['view', 'logic', 'style']) {
	const stages = new Set()
	for (const filePath of changedFiles) {
		const kinds = graph.getFileKinds(filePath)
		if (kinds.size === 0) {
			// 未知 kind → 保守全量
			return new Set(allStages)
		}
		for (const kind of kinds) {
			stages.add(kind)
		}
	}
	return stages
}
