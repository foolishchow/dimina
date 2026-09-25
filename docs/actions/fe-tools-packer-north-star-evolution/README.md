# fe-tools-packer-north-star-evolution

- Action: `fe-tools-packer-north-star-evolution`
- Status: `in_progress`
- Formalize: 2026-10-10（D-NS-1..6 locked，6 相实施序）
- Updated: 2026-10-10
- 设计门：[D-NS-1..6 locked](design.draft.md)
- 实施计划：[implementation-plan.md](implementation-plan.md)（P-NS1..6 分相）
- Status authority: [Action Status](../STATUS.md)

## Background

B 切法（fe-tools-packer-context-closure）+ facade-collaborator 实施期揭示 **D-OR-7 三重张力**——`implements PackerOrchestrator` + result→EmitEntry[] reconcile 受阻于 types.ts 北星 interface 与 concrete impl 的形状错配：

1. **return type 张力**：北星 `orchestrate(ctx, state, options) → Promise<EmitEntry[]>` vs impl 返回 metadata object（session/index.ts + compile-cache + watch-runner 消费 `result.buildModel`/`result.appId`/`result.dependencyGraph`）。array-with-attached-metadata 尝试破 lifecycle-integration.spec `Object.keys(result) = ['appId','buildModel','dependencyGraph','name','path']` 结构锚点。
2. **state type 张力**：`PackerSessionState`（concrete，含 `fingerprints` + `viewCache`/`styleCache`/`viewOrderList` + `PackerGraph` accessors getAppId/getAppName/getAppConfigInfo/getConfigData/getPageConfigInfo）vs 北星 `OrchestratorState`（interface，`Graph` + `ModuleResultCache` + `Set<string>`，无 accessors + moduleCache shape 错配 `CachedModuleResult` vs `{module, dependencies}`）。
3. **装配参数归属张力**：`useAppIdDir`/`compileOptions` 不属 `PackerContext`/`OrchestratorState`/`OrchestrateOptions` 北星 trio——D-FC-3 CompileRequest/WatchRequest 收敛未决。

## Goal

演进 types.ts 北星 interface 使 `implements PackerOrchestrator` + result reconcile 可落地：

- `Graph` interface 加 accessors（getAppId/getAppName/getAppConfigInfo/getConfigData/getPageConfigInfo）——`PackerGraph` 已实现，interface 补全（非 shape 重设计）。
- `OrchestratorState` moduleCache shape 对齐 `PackerSessionState`（`ModuleResultCache<CachedModuleResult>` 或泛化）。
- return type composite：`Promise<EmitEntry[]>` → `Promise<{ entries: EmitEntry[]; metadata: BuildResult }>` 或北星 re-design（需评估 session/compile-cache/watch-runner 消费 ripple）。
- D-FC-3 OrchestrateRequest → CompileRequest/WatchRequest 收敛（装配参数归属）。
- PC-B9b env.ts `packerALS`/`runWithCompilerContext`/`pathInfo`/`configInfo` Proxy 实体移除（需测试改读 storeInfo 返回值：custom-file-types.spec + publish-incremental.spec）。

## Non-goals

- 不重做 B 切法 ALS 闭合（主线程 ALS 已退役——orchestrate 不包 runWithCompilerContext，PC-B9 ✓）。
- 不动 worker ALS 桥接（resetStoreInfo D-PC-5 保留）。
- 不动 collaborator 抽取（facade-collaborator 7 collaborator ✓）。
- 不动 renderer/aspect/dispatch wiring（A/C/E 轨）。

## Design inputs

- [D-OR-7 张力](../_archive/complete/fe-tools-packer-facade-collaborator/design.draft.md)（orchestrator.ts:6 自承）
- [PC-B10b D-OR-7 三重张力记录](../_archive/complete/fe-tools-packer-context-closure/validation.md)
- types.ts §7 OrchestratorState + §8 PackerOrchestrator + Graph interface
- session/index.ts result 消费（L244/248/256/269）+ compile-cache createAppCacheEntry + watch-runner casts

## Requirements

- R-NS1 MUST `Graph` interface 加 accessors（getAppId/getAppName/getAppConfigInfo/getConfigData/getPageConfigInfo）——PackerGraph 已实现，interface 补全。
- R-NS2 MUST `OrchestratorState` moduleCache shape 对齐 PackerSessionState（或泛化 ModuleResultCache<V>）。
- R-NS3 MUST orchestrate return type composite 落地（EmitEntry[] + metadata）——session/compile-cache/watch-runner 消费同步对齐。
- R-NS4 MUST `implements PackerOrchestrator`（消解 D-OR-7）。
- R-NS5 MUST D-FC-3 CompileRequest/WatchRequest 收敛（useAppIdDir/compileOptions 归属）。
- R-NS6 MUST PC-B9b env.ts packerALS/Proxy 实体移除（测试改读 storeInfo 返回值）。
- R-NS7 MUST 行为 0（tsc 0 + vitest 全绿 + 7 项目 diff=0）。

## Proposed design

待 design.draft 评估 return type composite 形状 + session 消费 ripple + 北星 "不改" 约束 re-evaluation（演进 vs 重设计边界）。

## Implementation plan

待 formalize 后出具（P-NS1..N 分相 + 每相行为 0 gate）。
