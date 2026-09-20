import type { DependencyGraph } from './dependency-graph.ts'
import type { ModuleResultCache } from './module-result-cache.ts'
import type { EmitModule } from '../compiler/pipeline/emit.ts'

/**
 * deriveFromGraph — Packer 核心形状：entry → 遍历 GraphNode → 取 module 集 → ModuleResult 取 code → [EmitModule]
 *
 * 只读：不改 graph、不改 cache、不碰 emit/transform/bundle。
 *
 * 遍历所有 kind outgoing 边（'logic' + 'app' + 'component'）——
 * 'app' 和 'component' 边的目标也是 logic module（有 .js）。
 * 非 logic 模块（view/style）不在 ModuleResultCache 中，cache.get(id) 自然过滤。
 * 闭包含 entryId 自身——entry 的自有 code 也是 logic module。
 */
export function deriveFromGraph(
	graph: DependencyGraph,
	cache: ModuleResultCache,
	entryId: string,
): EmitModule[] {
	const moduleIds = graph.getDependencyClosure(entryId)
	const modules: EmitModule[] = []
	for (const id of moduleIds) {
		const cached = cache.get(id)
		if (!cached) continue
		modules.push({
			moduleId: id,
			code: cached.compileInfo.code,
			map: cached.compileInfo.map || null,
			extraInfoCode: cached.compileInfo.extraInfoCode,
		})
	}
	return modules
}
