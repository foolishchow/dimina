import type { DependencyGraph } from '../graph/dependency-graph.ts'
import type { ModuleResultCache } from '../cache/module-result-cache.ts'
import type { EmitModule } from './emit.ts'

/**
 * deriveFromGraph — Packer 核心形状：entry → 遍历 GraphNode → 取 module 集 → ModuleResult 取 code → [EmitModule]
 *
 * 只读：不改 graph、不改 cache、不碰 emit/transform/bundle。
 *
 * 遍历所有 kind outgoing 边（'logic' + 'app' + 'component'）——
 * 'app' 和 'component' 边的目标也是 logic module（有 .js）。
 * 非 logic 模块（view/style）不在 ModuleResultCache 中，cache.entries() 自然过滤。
 * 闭包含 entryId 自身——entry 的自有 code 也是 logic module。
 *
 * D-ED-1 B2（实证 #1 pass）：按 cache 插入序迭代（非 graph closure 序）。
 * graph.getDependencyClosure 返回 .sort() 字典序 ≠ emitBuckets 插入序 → diff≠0。
 * cache 插入序 == compileJS push 序 == emitBuckets 序（实证 58==58 完美序匹配）。
 */
export function deriveFromGraph(
	graph: DependencyGraph,
	cache: ModuleResultCache,
	entryId: string,
): EmitModule[] {
	const closureSet = new Set(graph.getDependencyClosure(entryId))
	const modules: EmitModule[] = []
	for (const [id, cached] of cache.entries()) {
		if (!closureSet.has(id)) continue
		modules.push({
			moduleId: id,
			code: cached.compileInfo.code,
			map: cached.compileInfo.map || null,
			extraInfoCode: cached.compileInfo.extraInfoCode,
		})
	}
	return modules
}

/**
 * deriveLogicBuckets — H1（D-ED-1 B2+E）：graph + cache → logic emit buckets（main + subs）。
 *
 * 替代 emitBuckets（logic worker 全量输出）。orchestrator Logic emit task 调此函数。
 *
 * B2：按 cache 插入序迭代（== emitBuckets 序，实证 #1 pass）。
 * E（cross-bucket dedup）：sub bucket = sub closure MINUS main closure
 *   （sub page depends on app，但 app 属 main bucket——compileJS for subs 传
 *   mainCompileRes，已在 main 的不 push 到 sub。实证 #3：7-1=6 ✓）。
 *
 * 只读：不改 graph、不改 cache。
 */
export function deriveLogicBuckets(
	graph: DependencyGraph,
	cache: ModuleResultCache,
	mainEntryIds: string[],
	subBuckets: { root: string; entryIds: string[]; independent?: boolean }[],
): { main: EmitModule[]; subs: { root: string; modules: EmitModule[] }[] } {
	// main closure union
	const mainClosureSet = new Set<string>()
	for (const entryId of mainEntryIds) {
		for (const dep of graph.getDependencyClosure(entryId)) mainClosureSet.add(dep)
	}
	// main modules: cache 插入序，filter by main closure set
	const main: EmitModule[] = []
	for (const [id, cached] of cache.entries()) {
		if (!mainClosureSet.has(id)) continue
		main.push({
			moduleId: id,
			code: cached.compileInfo.code,
			map: cached.compileInfo.map || null,
			extraInfoCode: cached.compileInfo.extraInfoCode,
		})
	}
	// sub buckets: sub closure union; non-independent MINUS main closure（cross-bucket dedup E）
	// independent subs: compileJS 传 [] 作 mainCompileRes → 不 dedup main（保留完整闭包）
	const subs: { root: string; modules: EmitModule[] }[] = []
	for (const { root, entryIds, independent } of subBuckets) {
		const subClosureSet = new Set<string>()
		for (const entryId of entryIds) {
			for (const dep of graph.getDependencyClosure(entryId)) subClosureSet.add(dep)
		}
		// cross-bucket dedup: non-independent subs remove modules already in main bucket
		if (!independent) {
			for (const id of mainClosureSet) subClosureSet.delete(id)
		}
		const subModules: EmitModule[] = []
		for (const [id, cached] of cache.entries()) {
			if (!subClosureSet.has(id)) continue
			subModules.push({
				moduleId: id,
				code: cached.compileInfo.code,
				map: cached.compileInfo.map || null,
				extraInfoCode: cached.compileInfo.extraInfoCode,
			})
		}
		subs.push({ root, modules: subModules })
	}
	return { main, subs }
}
