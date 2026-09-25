# fe-tools-packer-north-star-evolution

- Action: `fe-tools-packer-north-star-evolution`
- Status: `complete`
- Formalize: 2026-10-10（D-NS-1..6 locked，6 相实施序）
- Implemented: 2026-10-10（P-NS1..6 全 commit，行为 0 三件套全 pass）
- Updated: 2026-10-10
- 设计门：[D-NS-1..6 locked](design.draft.md)
- 实施计划：[implementation-plan.md](implementation-plan.md)（P-NS1..6 分相）
- 验证：[validation.md](validation.md)（V-NS1..6 全 pass）
- Status authority: [Action Status](../../../STATUS.md)

## Implementation evidence（2026-10-10）

P-NS1..6 全 6 相实施完，行为 0 三件套（tsc 0 + vitest 88/88 648 全绿 + 7 项目 diff=0）：

| 相 | commit | 内容 |
| --- | --- | --- |
| P-NS1 | `ac7e1c05` | Graph interface 加 5 accessors + PageConfig/ComponentConfig relocate env.ts→types.ts |
| P-NS2 | `a13a7bf9` | ModuleResultCache<V> get/set 泛化 + size()→get size()；OrchestratorState.moduleCache 对齐 |
| P-NS3 | `52d59000` | BuildResult composite + build-model kind 窄化 4 inline + cast 删/retain 三组 + 消费者同步 |
| P-NS4+5 | `f223d5b6` | createPackerOrchestrator : PackerOrchestrator + CompileOptions/WatchOptions/CompileRequest/WatchRequest 收敛 |
| P-NS6 | `6a3086d6` | packerALS + runWithCompilerContext 删（dead）；compat write RETAINED（audit load-bearing） |

### P-NS6 实施 deviation（architecture backflow）

design D-NS-6 预设删 3 项（packerALS + runWithCompilerContext + storeInfo compat 写 L222-229）。实施 audit 实证：

- **packerALS + runWithCompilerContext 确为 dead**（grep caller = 0；packerALS.tryGet 恒 undefined 因 .run 永不执行）→ 删。
- **compat write 经实证 load-bearing**（删后 7 项目 diff≠0 + mkdirSync(undefined) 崩）：主线程 pathInfo/configInfo Proxy 喚 dist-preparer createDist(targetPath) + npm-builder fallback 读 getTemplateExts 等 + view/style/logic parse-walk 经 worker resetStoreInfo。**主线程 getter 消费方未全迁 storeInfo() 返回值前不可删**——留作后续独立 initiative（非 north-star-evolution scope）。

## Background

B 切法（fe-tools-packer-context-closure）+ facade-collaborator 实施期揭示 **D-OR-7 三重张力**——`implements PackerOrchestrator` + result→EmitEntry[] reconcile 受阻于 types.ts 北星 interface 与 concrete impl 的形状错配：

1. **return type 张力**：北星 `orchestrate(ctx, state, options) → Promise<EmitEntry[]>` vs impl 返回 metadata object（session/index.ts + compile-cache + watch-runner 消费 `result.buildModel`/`result.appId`/`result.dependencyGraph`）。array-with-attached-metadata 尝试破 lifecycle-integration.spec `Object.keys(result) = ['appId','buildModel','dependencyGraph','name','path']` 结构锚点。
2. **state type 张力**：`PackerSessionState`（concrete，含 `fingerprints` + `viewCache`/`styleCache`/`viewOrderList` + `PackerGraph` accessors getAppId/getAppName/getAppConfigInfo/getConfigData/getPageConfigInfo）vs 北星 `OrchestratorState`（interface，`Graph` + `ModuleResultCache` + `Set<string>`，无 accessors + moduleCache shape 错配 `CachedModuleResult` vs `{module, dependencies}`）。
3. **装配参数归属张力**：`useAppIdDir`/`compileOptions` 不属 `PackerContext`/`OrchestratorState`/`OrchestrateOptions` 北星 trio——D-FC-3 CompileRequest/WatchRequest 收敛未决。

## Goal

演进 types.ts 北星 interface 使 `implements PackerOrchestrator` + result reconcile 可落地：

- `Graph` interface 加 accessors（getAppId/getAppName/getAppConfigInfo/getConfigData/getPageConfigInfo）——`PackerGraph` 已实现，interface 补全（非 shape 重设计）。
- `OrchestratorState` moduleCache shape 对齐 `PackerSessionState`（`ModuleResultCache<V>` get/set 泛化 + `size` getter/method 对齐）——经 method bivariance 使 `implements PackerOrchestrator` 可达。
- return type composite：`Promise<EmitEntry[]>` → `Promise<BuildResult>` flat `{ entries; appId; name; path; dependencyGraph; buildModel }`（build-model.ts `kind` 窄化；D-FC-5 re-evaluation：演进非重设计）。
- D-FC-3 OrchestrateRequest → CompileRequest/WatchRequest 收敛（装配参数归属）。
- PC-B9b env.ts dead ALS writer 移除（删 `packerALS`/`runWithCompilerContext`/storeInfo compat 写 L222-229；retain worker 全链 defaultCompilerContext + Proxy + getters + resetStoreInfo；需测试改读 storeInfo 返回值：custom-file-types.spec + publish-incremental.spec（configInfo 取 appId / compilerOptions 取 fileTypes / pathInfo 取 buildDir））。

## Non-goals

- 不重做 B 切法 ALS 闭合（主线程 ALS 已退役——orchestrate 不包 runWithCompilerContext，PC-B9 ✓）。
- 不动 worker ALS 桥接（resetStoreInfo D-PC-5 保留）。
- 不动 collaborator 抽取（facade-collaborator 7 collaborator ✓）。
- 不动 renderer/aspect/dispatch wiring（A/C/E 轨）。

## Design inputs

- [D-OR-7 张力](../fe-tools-packer-facade-collaborator/design.draft.md)（orchestrator.ts:6 自承）
- [PC-B10b D-OR-7 三重张力记录](../fe-tools-packer-context-closure/validation.md)
- types.ts §7 OrchestratorState + §8 PackerOrchestrator + Graph interface
- session/index.ts result 消费（L244/248/256/269）+ compile-cache createAppCacheEntry + watch-runner casts

## Requirements

- R-NS1 MUST `Graph` interface 加 accessors（getAppId/getAppName/getAppConfigInfo/getConfigData/getPageConfigInfo）——PackerGraph 已实现，interface 补全。
- R-NS2 MUST `OrchestratorState` moduleCache shape 对齐 PackerSessionState（路 A locked：`ModuleResultCache<V>` get/set 泛化 + `size` getter/method 对齐）。
- R-NS3 MUST orchestrate return type composite 落地（`Promise<BuildResult>` flat：entries + appId/name/path/dependencyGraph/buildModel）——session/compile-cache/watch-runner 消费同步对齐。
- R-NS4 MUST `implements PackerOrchestrator`（消解 D-OR-7）。
- R-NS5 MUST D-FC-3 CompileRequest/WatchRequest 收敛（useAppIdDir/compileOptions 归属）。
- R-NS6 MUST PC-B9b env.ts dead ALS writer 移除（删 packerALS/runWithCompilerContext/storeInfo compat 写 L222-229；retain worker 全链；测试改读 storeInfo 返回值）。
- R-NS7 MUST 行为 0（tsc 0 + vitest 全绿 + 7 项目 diff=0）。

## Design

见 [design.draft.md](design.draft.md)——D-NS-1..6 locked（含 6 TS probe 实证 bivariance 验证）。

## Implementation plan

见 [implementation-plan.md](implementation-plan.md)——P-NS1..6 分相 + 每相行为 0 gate（tsc 0 + vitest 全绿 + 7 项目 diff=0）。
