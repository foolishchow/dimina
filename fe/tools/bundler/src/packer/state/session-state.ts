/**
 * PackerSessionState — session-scoped 状态收敛（D-OS-5, D-PCS-3, D-PCS-9）。
 *
 * 持有活 graph + 活 cache + invalidated 集，跨 rebuild 持久。
 * watch-runner 创建（可注入），经入口适配器传入 PackerOrchestrator.orchestrate。
 *
 * 注意：不写 `implements OrchestratorState`——PackerSessionState 多 required
 * `fingerprints`/`viewCache`/`styleCache`/`viewOrderList`（窄于 OrchestratorState
 * 的泛化但多 session 字段）。P-NS2（D-NS-2）已将 types.ts ModuleResultCache<V>
 * interface 泛化对齐 class（get→V，V=CachedModuleResult；get size getter），
 * `PackerSessionState assignable to OrchestratorState` 经结构类型成立（bivariance
 * 前提，P-NS4 `: PackerOrchestrator` 依赖此）。impl 用 concrete PackerSessionState
 * ——经 method bivariance 放行，可访问 session 独有字段。
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
