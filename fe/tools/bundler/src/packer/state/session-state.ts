/**
 * PackerSessionState — session-scoped 状态收敛（D-OS-5, D-PCS-3, D-PCS-9）。
 *
 * 持有活 graph + 活 cache + invalidated 集，跨 rebuild 持久。
 * watch-runner 创建（可注入），经入口适配器传入 PackerOrchestrator.orchestrate。
 *
 * 注意：不写 `implements OrchestratorState`——现有 ModuleResultCache class
 * 的 get/set 返回 CachedModuleResult（非 { module, dependencies }），
 * 且 size 是 getter（非 method），与 types.ts §7 interface 不兼容。
 * 接口 conformance deferred 到 ModuleResultCache 泛型化 Action。
 * 当前用结构类型——字段名与形状一致，运行时行为正确。
 */

import { PackerGraph } from '../graph/graph.ts'
import { ModuleResultCache } from '../cache/module-result-cache.ts'
import type { FileFP } from '../cache/fingerprint.ts'
import type { ViewCompiledModule, StyleCompiledModule } from '../types.ts'  // G5 D-G5-1: view/style cache value 类型

export class PackerSessionState {
	readonly graph: PackerGraph = new PackerGraph()
	readonly moduleCache: ModuleResultCache = new ModuleResultCache()
	// H3 D-PMC-1: view cache per-module（was G5 per-page-bundle Map<string, ViewCompiledModule[]>）。
	// viewCache: key = moduleId, value = ViewCompiledModule（单 module）。
	// viewOrderList: key = pagePath, value = moduleId[]（ordered——viewParseWalk DFS 序）。
	// optional bare Map（one-shot 不 init→undefined→no-op；watch-runner 赋值）
	viewCache?: Map<string, ViewCompiledModule>
	viewOrderList?: Map<string, string[]>
	// G5 D-G5-1/F10: style cache = per-page（无 transitive subs，无 bundle 序问题——H3 style per-module = per-page 同义）
	styleCache?: Map<string, StyleCompiledModule>
	// D-FP-1: fingerprints 跨 rebuild 持久（watch-runner 每次 rebuild 重新赋值，同 invalidatedModules）
	fingerprints: Map<string, FileFP> = new Map()
	invalidatedModules: Set<string> = new Set()
}
