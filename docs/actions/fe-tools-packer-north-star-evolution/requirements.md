# Requirements — fe-tools-packer-north-star-evolution

Status authority: [Action Status](../STATUS.md)

## 背景

B 切法（context-closure PC-B2..B10a）+ facade-collaborator（FC-P0..P6 + D-FC-2b + PC-B10a 签名）实施后，`implements PackerOrchestrator` + result→EmitEntry[] reconcile 受阻于 D-OR-7 三重张力（return type / state type / 装配参数归属）。北星 interface（types.ts）与 concrete impl 形状错配——需北星演进（非 B 切法 ALS 闭合范畴）。

承接 deferred residuals：
- facade-collaborator R-FC-2（implements + return reconcile）+ R-FC-3（CompileRequest/WatchRequest）
- context-closure R-PC-3（env.ts entity removal）+ R-PC-4（implements + reconcile + CompileRequest）

## R-NS1 — Graph interface accessors 补全

types.ts `Graph` interface 加 accessors：`getAppId()/getAppName()/getAppConfigInfo()/getConfigData()/getPageConfigInfo()`。`PackerGraph` 已实现（PC-B4c/B7 加），interface 补全（非 shape 重设计——accessor 是查询面，非结构改）。

## R-NS2 — OrchestratorState moduleCache shape 对齐

`OrchestratorState.moduleCache: ModuleResultCache` vs `PackerSessionState.moduleCache`（`ModuleResultCache<CachedModuleResult>` 或泛化）。对齐使 `PackerSessionState` assignable to `OrchestratorState`。

## R-NS3 — orchestrate return type composite

`Promise<EmitEntry[]>` → composite `{ entries: EmitEntry[]; metadata: { appId; name; path; dependencyGraph; buildModel } }` 或北星 re-design。session/index.ts（L244/248/256/269 result.buildModel/appId）+ compile-cache createAppCacheEntry + watch-runner casts 同步对齐。lifecycle-integration.spec `Object.keys(result)` 锚点同步。

## R-NS4 — implements PackerOrchestrator

`createPackerOrchestrator` 返回 `implements PackerOrchestrator`（消解 orchestrator.ts:6 自承 D-OR-7 张力）。依赖 R-NS1/NS2/NS3 就位。

## R-NS5 — D-FC-3 CompileRequest/WatchRequest 收敛

`OrchestrateRequest` ~19 字段 → `CompileRequest`（one-shot）+ `WatchRequest`（增量 = CompileRequest + affectedEntries/invalidatedModules/seedPath/incremental/configChanged）。`useAppIdDir`/`compileOptions` 归属（CompileTarget 字段 or options）。build() + dev session 适配器改写。

## R-NS6 — PC-B9b env.ts ALS 实体移除

env.ts `packerALS`/`runWithCompilerContext`/`pathInfo` Proxy/`configInfo` Proxy/`defaultCompilerContext` 实体删除（主线程）。`resetStoreInfo`（worker 桥接 D-PC-5）保留。测试改读 storeInfo 返回值：custom-file-types.spec（getTemplateExts() → storeInfo().compilerOptions.templateExts）+ publish-incremental.spec（显式传 buildDir/appId 给 publishToDist）。

## R-NS7 — 行为 0

纯结构重构（interface 演进 + 实体移除，无语义改）。每相独立 commit + 行为 0 gate。ALS 值与 ctx/state 值同源 → 产物不变。

## R-NS8 — Non-scope 边界

- 不动 worker ALS 桥接（resetStoreInfo 保留）。
- 不动 collaborator 抽取（7 collaborator ✓）。
- 不动 renderer/aspect/dispatch wiring（A/C/E 轨）。
- 不重做 B 切法 main-thread ALS 退役（PC-B9 ✓）。
