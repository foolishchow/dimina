# Requirements — fe-tools-packer-north-star-evolution

Status authority: [Action Status](../STATUS.md)

## 背景

B 切法（context-closure PC-B2..B10a）+ facade-collaborator（FC-P0..P6 + D-FC-2b + PC-B10a 签名）实施后，`implements PackerOrchestrator` + result→EmitEntry[] reconcile 受阻于 D-OR-7 三重张力（return type / state type / 装配参数归属）。北星 interface（types.ts）与 concrete impl 形状错配——需北星演进（非 B 切法 ALS 闭合范畴）。

承接 deferred residuals：
- facade-collaborator R-FC-2（implements + return reconcile）+ R-FC-3（CompileRequest/WatchRequest）
- context-closure R-PC-3（env.ts dead ALS writer 移除）+ R-PC-4（implements + reconcile + CompileRequest）

## R-NS1 — Graph interface accessors 补全

types.ts `Graph` interface 加 accessors：`getAppId()/getAppName()/getAppConfigInfo()/getConfigData()/getPageConfigInfo()`。`PackerGraph` 已实现（PC-B4c/B7 加），interface 补全（非 shape 重设计——accessor 是查询面，非结构改）。

## R-NS2 — OrchestratorState moduleCache shape 对齐

`ModuleResultCache<V>` interface get/set 泛化（路 A locked——弃 `{module, dependencies}` shape，`get(moduleId): V | undefined`）+ `size(): number`→`get size(): number`（match class getter，零消费方）。对齐使 `PackerSessionState` assignable to `OrchestratorState`（method bivariance 前提——见 design.draft §2 D-NS-2 全 member 审计表 + D-NS-4 bivariance 注）。

## R-NS3 — orchestrate return type composite

`Promise<EmitEntry[]>` → `Promise<BuildResult>` flat composite `{ entries: EmitEntry[]; appId; name; path; dependencyGraph; buildModel }`（见 design.draft §2 D-NS-3 BuildResult shape）。session/index.ts（L244/248/256/269 result.buildModel/appId）+ compile-cache createAppCacheEntry（排除 entries）+ watch-runner casts 同步对齐。lifecycle-integration.spec `Object.keys(result)` 锚点同步（+ entries）。

## R-NS4 — implements PackerOrchestrator

`createPackerOrchestrator` 返回类型注解 `: PackerOrchestrator`（structural conformance + method bivariance；function 返 object literal 非 class——无 `implements` clause，经 return type annotation + structural 兑现；消解 orchestrator.ts:6 自承 D-OR-7 张力）。依赖 R-NS2（含 size）+ R-NS3 就位（R-NS1 hygiene 非 blocking，可并行）。

## R-NS5 — D-FC-3 CompileRequest/WatchRequest 收敛

OrchestrateOptions refactor → `CompileOptions`（compile-shared + mode flags）+ `WatchOptions`（watch-only）——避免 CompileRequest extends 继承 watch 字段。`CompileRequest` = CompileOptions + {useAppIdDir?/fileTypes?/compileOptions?/store?/lifecycle?}（retain per-request override——F-AB1-1：_orchestrate L170 runStore 优先 providedStore；watch-runner L95 传 activeStore）。`WatchRequest` = CompileRequest & WatchOptions（增量数据 only）。PackerOrchestrator interface options → `CompileRequest | WatchRequest`（D-FC-5 北星彻底）。`useAppIdDir`/`compileOptions` 归属（CompileTarget 字段 or options）。OrchestrateRequest refactor 为 INTERNAL unified（extends CompileOptions & WatchOptions，retain store?/lifecycle?）。build() + dev session 适配器改写。

## R-NS6 — PC-B9b env.ts dead ALS writer 移除

env.ts 删 dead `packerALS`/`runWithCompilerContext`（PC-B9 后无 caller）+ **storeInfo compat 写**（L222-229，PC-B8b，F-AC1-1——`getCompilerContext()` + 设 pathInfo/configInfo/compilerOptions/graph/dependencyGraph 的 compat block；删后 defaultCompilerContext main-thread 不再被设 → fallback 返 undefined/empty，须 spec 改读 storeInfo 返回值）。retain worker ALS 全链（defaultCompilerContext + pathInfo/configInfo Proxy + getCompilerContext + resetStoreInfo + getters——worker parse-walk/logic/style 调）。getCompilerContext 简化（删 packerALS.tryGet 分支）。测试改读 storeInfo 返回值（F-AC1-1）：custom-file-types.spec（getTemplateExts() → storeInfo().compilerOptions.templateExts）+ publish-incremental.spec（显式传 buildDir/storeInfo().pathInfo.targetPath + appId/storeInfo().configInfo.appInfo.appId 给 publishToDist）+ grep 验 getDependencyGraph() main-thread caller = 0（F-AC3-1）。

## R-NS7 — 行为 0

纯结构重构（interface 演进 + 实体移除，无语义改）。每相独立 commit + 行为 0 gate。ALS 值与 ctx/state 值同源 → 产物不变。

## R-NS8 — Non-scope 边界

- 不动 worker ALS 桥接（resetStoreInfo 保留）。
- 不动 collaborator 抽取（7 collaborator ✓）。
- 不动 renderer/aspect/dispatch wiring（A/C/E 轨）。
- 不重做 B 切法 main-thread ALS 退役（PC-B9 ✓）。
