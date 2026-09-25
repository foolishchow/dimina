# Design Draft — fe-tools-packer-north-star-evolution

Status authority: [Action Status](../STATUS.md)

## §1 问题诊断（D-OR-7 三重张力）

B 切法（context-closure）+ facade-collaborator 实施后，`implements PackerOrchestrator` 受阻于 types.ts 北星 interface 与 concrete impl 的三处形状错配：

### 张力 1 — Graph interface 查询面不全

types.ts `Graph` interface 有 build/reconcile/mergeDelta/toJSON + 查询（getEntries/getFileOwners/getAffectedEntries/getInvalidatedModules/hasFile/getFileKinds），但**缺 config-data accessors**（getAppId/getAppName/getAppConfigInfo/getConfigData/getPageConfigInfo）。`PackerGraph implements Graph` 且已实现这 5 accessors（PC-B4c/B7 加）。interface 未补全 → `OrchestratorState.graph: Graph` 上调 `state.graph.getAppId()` tsc 报错（Graph 无此方法）。

### 张力 2 — OrchestratorState.moduleCache shape 错配

types.ts `ModuleResultCache<V>.get(moduleId): { module: V; dependencies: string[] } | undefined`（interface 形状）。concrete `ModuleResultCache` class（src/packer/cache/）`get(moduleId): CachedModuleResult | undefined`（`{compileInfo, logicDependencies}`）。`PackerSessionState.moduleCache: ModuleResultCache`（class，非 interface）。`PackerSessionState` 不写 `implements OrchestratorState`（session-state.ts:7 自承）——因 moduleCache shape 错配（`CachedModuleResult` ≠ `{module, dependencies}`）+ `PackerSessionState` 多 `fingerprints`/`viewCache`/`styleCache`/`viewOrderList`（窄于 OrchestratorState 的泛化但多 session 字段）。

### 张力 3 — return type aspirational

北星 `orchestrate(ctx, state, options) → Promise<EmitEntry[]>`。但消费者需 metadata：
- session/index.ts L244/256：`result.buildModel`（BuildModel 对象——含 `.entries` Map + `.getArtifact()` method + `.dirtyEntries`）
- session L248/269：`result.appId`
- compile-cache createAppCacheEntry：`result.dependencyGraph` + `...appInfo`（rest spread）
- watch-runner L95/130：`result.appId`
- lifecycle-integration.spec L170-171：`end.result === result` + `Object.keys(result) = ['appId','buildModel','dependencyGraph','name','path']`

PC-B10b attempted array-with-attached-metadata（`Object.assign(entries, {appId,...})`）→ 破 Object.keys 锚点（array indices 混入）。结论：北星 `Promise<EmitEntry[]>` 是 aspirational——session 需 buildModel 对象（非纯 entries），pure EmitEntry[] 不足。

## §2 设计门（formalize 提议，待锁）

### D-NS-1 — Graph interface accessors 补全（locked 提议）

types.ts `Graph` interface 加 5 accessors：`getAppId()/getAppName()/getAppConfigInfo()/getConfigData()/getPageConfigInfo()`。PackerGraph 已实现（`implements Graph` 满足）。**非 shape 重设计**——accessor 是查询面补全，D-FC-5 "北星不改" 纪律的 "演进" 非 "重写"（interface 补全已 impl 的查询面）。低风险 additive。

### D-NS-2 — OrchestratorState moduleCache 对齐（locked 提议）

两条路：
- **路 A**（提议）：types.ts `ModuleResultCache<V>` interface 形状对齐 class——`get(moduleId): V | undefined`（泛化 result shape）。`OrchestratorState.moduleCache: ModuleResultCache<CachedModuleResult>`。`PackerSessionState.moduleCache: ModuleResultCache`（class）assignable。types.ts import `CachedModuleResult` type（纯 type import，无 implementation 依赖）。
- 路 B（否决）：改 class 形状（`{module, dependencies}`）→ 破 logic engine cache 消费（`cached.logicDependencies`）+ ModuleResultCache class 7 处消费。风险高。

**路 A locked**：interface 泛化对齐 class，class 不动。

### D-NS-3 — return type composite 演进（locked 提议）

北星 `Promise<EmitEntry[]>` 演进为 `Promise<BuildResult>`：

```ts
export interface BuildResult {
  entries: EmitEntry[]
  appId: string | undefined
  name: string | undefined
  path: string | undefined
  dependencyGraph: unknown
  buildModel: BuildModel | undefined
}
```

types.ts `PackerOrchestrator.orchestrate(...) → Promise<BuildResult>`（return type 演进）。orchestrator.ts `_orchestrate` 返 `{entries: [...buildModel.entries.values()], appId, name, path, dependencyGraph, buildModel}`（object，非 array-with-props）。

消费者同步：
- session/index.ts：`result.buildModel`/`result.appId` 不变（shape 同）；`result.entries` 新可用（暂不消费，materialize 走 buildModel）
- compile-cache createAppCacheEntry：`result.dependencyGraph` + `...appInfo`（rest = entries/appId/name/path/buildModel）→ 调整 destructure（排除 entries 或接受 buildModel 进 appInfo）
- watch-runner：`result.appId` 不变
- lifecycle-integration.spec L170-171：`end.result === result` ✓（同引用）；`Object.keys(result).sort()` → `['appId','buildModel','dependencyGraph','entries','name','path']`（+ entries）锚点更新

**D-FC-5 re-evaluation**：return type 演进是 "完成北星"（aspirational → 落地），非 "重写北星 facade/aspect/strategy SHAPE"。允许。

### D-NS-4 — implements PackerOrchestrator（locked，依赖 D-NS-1/2/3）

`createPackerOrchestrator` 返回 `implements PackerOrchestrator`（消 `as` 强转）。`orchestrate(ctx: PackerContext, state: OrchestratorState, options: OrchestrateOptions) → Promise<BuildResult>`。D-NS-1（Graph accessors）+ D-NS-2（moduleCache）就位 → `PackerSessionState implements OrchestratorState` 可写（或仍不写，靠 structural 兼容——D-NS-2 使 assignable）。

### D-NS-5 — CompileRequest/WatchRequest 收敛（locked）

`OrchestrateRequest` ~19 字段拆：
- **CompileRequest**（one-shot）：`useAppIdDir/fileTypes/compileOptions/stages/prepareConfig/prepareNpm/skipMaterialize/parallel`（workPath/targetPath 从 ctx；state 2nd arg）
- **WatchRequest = CompileRequest & { affectedEntries/invalidatedModules/seedPath/incremental/configChanged }**

`store`/`lifecycle` 已是 createPackerOrchestrator 构造参数（非 per-request）——OrchestrateRequest 删此 2 字段（遗留冗余清）。build() + dev session 适配器改写。

### D-NS-6 — PC-B9b env.ts ALS 实体移除（locked，依赖 D-NS-3/5 就位后）

env.ts `packerALS`/`runWithCompilerContext`/`defaultCompilerContext`/`pathInfo` Proxy/`configInfo` Proxy 删除。`resetStoreInfo`（worker 桥接 D-PC-5）保留。测试改读 storeInfo 返回值：
- custom-file-types.spec：`getTemplateExts()` → `storeInfo().compilerOptions.templateExts`
- publish-incremental.spec：`publishToDist(distDir, false, true, buildDir, appId)` 显式传（setupEnv 返 storeInfo.pathInfo/compilerOptions）

`getAppStyleScopeId`（纯 uuid）保留。publish/npm-builder fallback `?? getAppId()` 删（collaborator 路径全传 appId/fileTypes）。

## §3 非范围

- 不动 worker ALS 桥接（resetStoreInfo D-PC-5 保留）
- 不动 7 collaborator（facade-collaborator ✓）
- 不动 renderer/aspect/dispatch wiring（A/C/E 轨）
- 不重做 B 切法 main-thread ALS 退役（PC-B9 ✓）

## §4 实施序（implementation-plan 要点）

P-NS1 Graph accessors（D-NS-1，低风险 additive）→ P-NS2 moduleCache 对齐（D-NS-2）→ P-NS3 return type composite + 消费者同步（D-NS-3，blast radius 大）→ P-NS4 implements（D-NS-4，依赖 1-3）→ P-NS5 CompileRequest/WatchRequest（D-NS-5）→ P-NS6 env.ts 实体移除 + 测试改读（D-NS-6，依赖 3/5）。每相行为 0 gate。
