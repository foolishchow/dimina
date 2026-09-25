# Design Draft — fe-tools-packer-north-star-evolution

Status authority: [Action Status](../STATUS.md)

## §1 问题诊断（D-OR-7 三重张力）

B 切法（context-closure）+ facade-collaborator 实施后，`implements PackerOrchestrator` 受阻于 types.ts 北星 interface 与 concrete impl 的三处形状错配：

### 张力 1 — Graph interface 查询面不全

types.ts `Graph` interface 有 build/reconcile/mergeDelta/toJSON + 查询（getEntries/getFileOwners/getAffectedEntries/getInvalidatedModules/hasFile/getFileKinds），但**缺 config-data accessors**（getAppId/getAppName/getAppConfigInfo/getConfigData/getPageConfigInfo）。`PackerGraph implements Graph` 且已实现这 5 accessors（PC-B4c/B7 加）。interface 未补全 → 若第三方经 `OrchestratorState.graph: Graph` 调 `state.graph.getAppId()` 会 tsc 报错（Graph 无此方法）。**注**：impl 用 `state: PackerSessionState`（graph: PackerGraph，已有 5 accessors）→ impl 调 `state.graph.getAppId()` **不阻塞**（见 §2 D-NS-4 bivariance 注）；D-NS-1 是 interface 查询面补全（hygiene），非 impl conformance 前置。

### 张力 2 — OrchestratorState.moduleCache shape 错配

types.ts `ModuleResultCache<V>.get(moduleId): { module: V; dependencies: string[] } | undefined`（interface 形状）。concrete `ModuleResultCache` class（src/packer/cache/）`get(moduleId): CachedModuleResult | undefined`（`{compileInfo, logicDependencies}`）。`PackerSessionState.moduleCache: ModuleResultCache`（class，非 interface）。`PackerSessionState` 不写 `implements OrchestratorState`（session-state.ts:7 自承）——因 moduleCache shape 错配（`CachedModuleResult` ≠ `{module, dependencies}`）+ `PackerSessionState` 多 `fingerprints`/`viewCache`/`styleCache`/`viewOrderList`（窄于 OrchestratorState 的泛化但多 session 字段）。

### 张力 3 — return type aspirational

北星 `orchestrate(ctx, state, options) → Promise<EmitEntry[]>`。但消费者需 metadata：
- session/index.ts L244/256：`result.buildModel`（BuildModel 对象——含 `.entries` Map + `.getArtifact()` method + `.dirtyEntries`）
- session L248/269：`result.appId`
- compile-cache createAppCacheEntry：`result.dependencyGraph` + `...appInfo`（rest spread）
- watch-runner L95/130：`result.appId`
- lifecycle-integration.spec L170-171：`end.result toEqual(result)`（同 object deep equal） + `Object.keys(result) = ['appId','buildModel','dependencyGraph','name','path']`

PC-B10b attempted array-with-attached-metadata（`Object.assign(entries, {appId,...})`）→ 破 Object.keys 锚点（array indices 混入）。结论：北星 `Promise<EmitEntry[]>` 是 aspirational——session 需 buildModel 对象（非纯 entries），pure EmitEntry[] 不足。

## §2 设计门（formalize 提议，待锁）

### D-NS-1 — Graph interface accessors 补全（locked 提议）

types.ts `Graph` interface 加 5 accessors：`getAppId()/getAppName()/getAppConfigInfo()/getConfigData()/getPageConfigInfo()`。PackerGraph 已实现（`implements Graph` 满足）。**非 shape 重设计**——accessor 是查询面补全，D-FC-5 "北星不改" 纪律的 "演进" 非 "重写"（interface 补全已 impl 的查询面）。低风险 additive。

**PageConfig relocate**：`getPageConfigInfo(): Record<string, PageConfig>` 需 PageConfig type。PageConfig 现在 env.ts（L64，heavy implementation）——违 Packer 形状纪律（types.ts 不应从 env.ts import）。lock：PageConfig（+ ComponentConfig，成对）relocate env.ts → types.ts（shape 层 canonical home）；env.ts **`import type { PackerContext, PageConfig, ComponentConfig } from '../types.ts'`**（L10 已 import PackerContext，加 2 型——供内部 L82 `componentInfo?: Record<string, ComponentConfig>` + L83 `pageInfo?: Record<string, PageConfig>` + L423 `getPageConfigInfo(): Record<string, PageConfig>` 用；F-AJ2-1：re-export `from` 不入 local scope，须 import）+ **`export type { PageConfig, ComponentConfig }`**（re-export 已 import，**无 `from`**——backward compat）；graph.ts/config-fixpoint.ts（现 2 消费方）import 改 types.ts。

**type-only import 纪律注**：types.ts import `GraphConfigData`（from graph.ts）+ `EmitEntry`（from emit/emit.ts，已存 L26）+ `CachedModuleResult`（D-NS-2，from cache/module-result-cache.ts）均为 `import type`——runtime erase，不耦合 implementation（与现有 EmitEntry-from-emit.ts 模式一致）。env.ts 是唯一禁点（heavy ALS store），relocate PageConfig 后 types.ts 无 env.ts import。

### D-NS-2 — OrchestratorState moduleCache 对齐（locked 提议）

两条路：
- **路 A**（locked）：types.ts `ModuleResultCache<V>` interface 形状对齐 class——`get(moduleId): V | undefined`（泛化 result shape）+ `set(moduleId, result: V)`。`OrchestratorState.moduleCache: ModuleResultCache<CachedModuleResult>`。`PackerSessionState.moduleCache: ModuleResultCache`（class）assignable。types.ts import `CachedModuleResult` type（纯 type import，无 implementation 依赖）。
- 路 B（否决）：改 class 形状（`{module, dependencies}`）→ 破 logic engine cache 消费（`cached.logicDependencies`）+ ModuleResultCache class 7 处消费。风险高。

**路 A locked**：interface 泛化对齐 class，class 不动。

**全 member conformance 审计**（路 A get/set 泛化后残留 member）：

| member | interface | class | 对齐？ |
| --- | --- | --- | --- |
| get/set | `{module, dependencies}` → 泛化为 `V` | `CachedModuleResult` | ✓ 路A 对齐 |
| has/delete | `(id): boolean/void` | 同 | ✓ |
| clear | `(dirtyIds: Iterable<string>): void` | 同 | ✓ |
| **size** | `size(): number`（method） | `get size(): number`（getter property） | **✗ 残留 blocker** |
| toJSON | `[string, unknown][]` | `[string, CachedModuleResult][]` | ✓ 协变 assignable |
| entries | （interface 无） | `entries()` class extra | ✓ 非 conformance 问题 |

**`size` 残留 blocker**：interface `size(): number`（method）vs class `get size(): number`（getter）——shape 不兼容（`obj.size` property access vs `obj.size()` call）。消费方审计：`grep moduleCache.size / cache.size` = **0 消费方**（vestigial member）。fix：interface `size(): number` → `get size(): number`（match class getter，class 不动，行为 0）。或删 `size` from interface（零消费方）——择改 interface（class 不动）。

**Bivariance 验证**（empirical，6 个 TS probe）：`implements PackerOrchestrator` + `state: PackerSessionState`（narrower，多 required `fingerprints`）经 **TS method parameter bivariance**（method-syntax interface param 检查是 bivariant 非 strict contravariant）放行——**唯一要求**是 `PackerSessionState assignable to OrchestratorState`（单向），即 moduleCache shape 对齐（含 `size`）。`fingerprints`/`viewCache`/`styleCache`/`viewOrderList` 多出 session 字段**无需**加到 OrchestratorState（bivariance + assignable-to-interface 允许 excess）。见 D-NS-4 bivariance 注。

### D-NS-3 — return type composite 演进（locked 提议）

北星 interface `PackerOrchestrator.orchestrate(...) → Promise<EmitEntry[]>`（aspirational）演进为 `→ Promise<BuildResult>`（interface + impl 同步）：

```ts
export interface BuildResult {
  entries: EmitEntry[]
  appId: string | undefined
  name: string | undefined
  path: string | undefined
  dependencyGraph: GraphSnapshot
  buildModel: BuildModel | undefined
}
```

types.ts `PackerOrchestrator.orchestrate(...) → Promise<BuildResult>`（return type 演进）。orchestrator.ts `_orchestrate` 返 `const result: BuildResult = {entries: buildModel ? [...buildModel.entries.values()] : [], appId, name, path, dependencyGraph: state.graph.toJSON(), buildModel}`（显式 `: BuildResult` annotation；object，非 array-with-props；**null guard**——buildModel 可 undefined（L308 cast `?:`），guard 避免 undefined.entries throw；**F-AG1-1**：dependencyGraph source 改 `state.graph.toJSON()`（guaranteed GraphSnapshot——graph.ts L119 `toJSON(): GraphSnapshot`，state.graph: PackerGraph 常驻）替代 `context.dependencyGraph?.toJSON()`（loose context `Record<string,unknown>` → undefined-possible，不 assignable required GraphSnapshot））。

**cast 删/retain 区分**（F-Z1-1 + F-AG1-1 + F-AH1-1）：BuildResult 字段 source type 混——**删 cast**（source typed state.graph）：name（`state.graph.getAppName(): string|undefined`）+ dependencyGraph（`state.graph.toJSON(): GraphSnapshot`——F-AG1-1，guaranteed，删 `context.dependencyGraph?.toJSON()` cast）；**retain cast**（source loose context `Record<string,unknown>`——tasks.run() 返 loose）：appId（`context.loadBindings?.appId`——F-AH1-1，loose，改 source state.graph.getAppId() = 行为改 loadBindings.appid ≠ projectInfo.appid；retain `as {loadBindings?: {appId?: string}}`）+ buildModel（`context.buildModel`——F-AH1-1，loose，无 alt source（仅 context，compile 期建）；retain `as {buildModel?: BuildModel}`）+ path（`getAppConfigInfo().entryPagePath` from `Record<string,unknown>` = unknown → `as string|undefined`）。非「全删内部 cast」——loose context source 字段（appId/buildModel/path）须 retain cast。

**EmitEntry.kind shape 窄化**（F-S1-1）：`entries: EmitEntry[]` sourced from `[...buildModel.entries.values()]`——但 build-model.ts L18 `entries: Map<string, {kind: string; ...}>`（`kind: string` wide）vs EmitEntry L24 `kind: 'view'|'logic'|'style'`（union）。probe 证：`kind:string` 不可赋 union → tsc error。lock：build-model.ts **L18/L32/L74/L77（4 处 inline `{kind: string}`）** `kind: string` → `kind: EmitEntry['kind']`（F-AF1-1：4 处同步窄化——L32 add param 须窄，否则 `entries.set(id, entry)` tsc error string⊄union；推荐 extract `type BuildModelEntry = {entryId: string; kind: EmitEntry['kind']; files: ...; sourcemaps?: ...}` + 4 处引用 DRY；源头窄化，runtime 已约束仅 view/logic/style，行为 0）。消 orchestrator return 处 `as EmitEntry[]` cast。

消费者同步：
- session/index.ts：`result.buildModel`/`result.appId` 不变（shape 同）；`result.entries` 承载北星 aspirational 契约（D-FC-5：完成 `Promise<EmitEntry[]>` 落地）——watch 路径暂不消费（materialize 走 buildModel），runtime cost 可接受（单次 spread/rebuild）
- compile-cache createAppCacheEntry：`result.dependencyGraph` + `...appInfo`（rest = entries/appId/name/path/buildModel）→ **decisive 排除 entries + buildModel**：`const { dependencyGraph, entries: _entries, buildModel: _buildModel, ...appInfo }`（F-AD1-1：unique names——`entries: _, buildModel: _` duplicate `_` = TS2451；noUnusedLocals 放行 `_`-prefix destructured binding，probe 实证 exit=0；行为 0 要求——entries 含编译 code；buildModel 含 .entries Map code + 序列化 dead-weight Map→{}；cache 写盘 JSON compile.ts L35，两者均须排；appInfo = {appId, name, path}）
- watch-runner：`result.appId` 不变
- lifecycle-integration.spec L170-171：`end.result toEqual(result)` ✓（同 object deep equal——lifecycle.emit 传 result 引用，spec toEqual pass）；`Object.keys(result).sort()` → `['appId','buildModel','dependencyGraph','entries','name','path']`（+ entries）锚点更新

**D-FC-5 re-evaluation**：return type 演进是 "完成北星"（aspirational → 落地），非 "重写北星 facade/aspect/strategy SHAPE"。允许。

### D-NS-4 — implements PackerOrchestrator（locked，依赖 D-NS-2 含 size + D-NS-3）

`createPackerOrchestrator` 返回类型注解 `: PackerOrchestrator`（structural conformance + method bivariance，消 `as` 强转；注：createPackerOrchestrator 是 function 返 object literal，非 class——无 `implements` clause，经 return type annotation + structural 兑现）。`orchestrate(ctx: PackerContext, state: PackerSessionState, options: OrchestrateCallOptions) → Promise<BuildResult>`（**F-AI1-1**：P-NS4 KEEP `OrchestrateCallOptions`（现态，extends OrchestrateOptions + useAppIdDir?/store?/lifecycle?/fileTypes?/compileOptions?）——非改 `OrchestrateOptions`（types.ts L380 缺此 5 字段，build() L60-70 object literal 含 → excess property tsc error）；bivariance 放行 OrchestrateCallOptions → interface OrchestrateOptions；P-NS5 refactor → CompileRequest|WatchRequest）。

**真 dependency chain**（empirical，6 TS probe 证）：
- **D-NS-2**（moduleCache shape 对齐——含 `size` member getter/method 对齐）→ 使 `PackerSessionState assignable to OrchestratorState`（单向，bivariance 前提）
- **D-NS-3**（return type `Promise<BuildResult>`）→ 消 return type mismatch（`Record` vs `EmitEntry[]`，probe2 证此为 `as PackerOrchestrator` 真阻塞）
- D-NS-1（Graph accessors）= **hygiene 非 blocking**——impl 用 `state.graph.*` 其中 `state: PackerSessionState`（graph: PackerGraph，已 L183/188/163/168/208 有 5 accessors）；无消费方经 `OrchestratorState.graph: Graph` 调 accessor。D-NS-1 可并行（additive 低风险）但不阻塞 implements。
- D-NS-5/D-NS-6 = 独立收尾，非 implements 阻塞。

**Bivariance 机制注**（防误读）：TS method-syntax interface 的 parameter 检查是 **bivariant**（非 strict contravariant）——impl 的 `state: PackerSessionState`（narrower，多 required `fingerprints`）**可**经 bivariance 放行，**无需** OrchestratorState 演进加 session cache 字段（`fingerprints`/`viewCache`/`styleCache`/`viewOrderList`）。impl body 可访问 `state.fingerprints`/`state.viewCache` 等 PackerSessionState 独有字段。唯一前提：`PackerSessionState assignable to OrchestratorState`（moduleCache shape 对齐——D-NS-2 含 size）。前轮 review F-R1-1「state param conformance 未解」误判根因：未实证 bivariance，把 `as` cast 的 return type 错误误读为 state param 张力——已 withdraw。

### D-NS-5 — CompileRequest/WatchRequest 收敛（locked）

**OrchestrateOptions refactor**（F-AA1-1）：现 OrchestrateOptions（types.ts L380）含 watch-only 字段（affectedEntries?/invalidatedModules?/seedPath?）+ mode flags（incremental/configChanged）+ compile-shared（parallel/stages/prepareConfig/prepareNpm/skipMaterialize）。CompileRequest 若 `extends OrchestrateOptions` 继承 watch 字段 → 破 F-X1-1 WatchRequest-only 分类。lock：refactor OrchestrateOptions → **`CompileOptions`**（parallel/stages/prepareConfig/prepareNpm/skipMaterialize + mode flags `incremental?`/`configChanged?` default false）+ **`WatchOptions`**（affectedEntries?/invalidatedModules?/seedPath?）。OrchestrateOptions removed（3 消费方迁移：PackerOrchestrator interface options L422 / OrchestrateRequest L57 / OrchestrateCallOptions L74）。

`OrchestrateRequest`（~18 字段）拆：
- **CompileRequest = CompileOptions + { useAppIdDir?/fileTypes?/compileOptions?/store?/lifecycle? }**（F-AK1-1：store?/lifecycle? retain——F-AB1-1 per-request override；one-shot；workPath/targetPath 从 ctx；state 2nd arg；mode flags 在 CompileOptions base——_orchestrate L198-199 无条件访问）
- **WatchRequest = CompileRequest & WatchOptions**（= CompileRequest + {affectedEntries?/invalidatedModules?/seedPath?}——增量数据 only）

**PackerOrchestrator interface options 演进**（F-AA2-1）：types.ts L422 `options: OrchestrateOptions` → `options: CompileRequest | WatchRequest`（D-FC-5 北星彻底——interface options 用新 PUBLIC 类型；P-NS4 interim 仍 OrchestrateOptions，P-NS5 refactor）。

`store`/`lifecycle` 是 **per-request OVERRIDE**（非「构造参数已收」——F-AB1-1 修正）：`_orchestrate` L170 `runStore ?? providedStore ?? createProjectStore()` + L186 `runLifecycle || pipelineLifecycle || createLifecycle()`——3 层 precedence（per-request request.store > 构造 providedStore > default）。watch-runner L95 传 `store: activeStore`（per-request override）；build() L42 读 `options.store`。**RETAIN `store?`/`lifecycle?` in CompileRequest + OrchestrateRequest**（非删——删则行为改：activeStore 失 → default store）。`OrchestrateCallOptions` → `CompileRequest | WatchRequest`（**PUBLIC** orchestrate 3rd param type，含 store?/lifecycle?）。构造参数（providedStore/pipelineLifecycle）是 fallback，非 primary。

**PUBLIC vs INTERNAL 区分**（F-Y2-1）：`CompileRequest`/`WatchRequest` 是 **PUBLIC**（orchestrate 3rd param + caller 构造，含 store?/lifecycle? per-request override）。`OrchestrateRequest` **不删——refactor 为 INTERNAL unified _orchestrate param**（retain store?/lifecycle? + 全字段 superset——affectedEntries?/seedPath?/invalidatedModules?/incremental?/configChanged?/useAppIdDir?/fileTypes?/compileOptions?/stages? 全 optional + workPath/targetPath/state；extends CompileOptions & WatchOptions——F-AB2-1）。orchestrate() L121 `const request: OrchestrateRequest = {...options, workPath, targetPath, state}`（spread CompileRequest|WatchRequest → unified OrchestrateRequest）→ _orchestrate destructure store/lifecycle + affectedEntries/seedPath/invalidatedModules（L152-165）从 unified 取（union 破 destructure）。build() + dev session 适配器改写。

### D-NS-6 — PC-B9b env.ts dead ALS writer 移除（locked，依赖 D-NS-3/5 就位后；scope 收窄——F-T1-1/F-T4-1）

**删**（PC-B9 后 dead——main-thread 不再 `packerALS.run`）：
- `packerALS`（L21 AsyncContextStore）——PC-B9 移除 orchestrate `runWithCompilerContext` wrapper 后，仅 `runWithCompilerContext` L260 + `getCompilerContext` L45 tryGet 用；main-thread 不再 run → tryGet 恒 undefined → dead。
- `runWithCompilerContext`（L259）——无 caller（仅 L503 export，dead）。
- **storeInfo compat 写**（L222-229，F-AC1-1，PC-B8b）——`const context = getCompilerContext(); context.pathInfo/configInfo/compilerOptions/graph/dependencyGraph = ...`。删后 defaultCompilerContext main-thread 不再被设（仅 worker resetStoreInfo 设）→ main-thread fallback getAppId()/getTemplateExts() 返 undefined/empty。spec 须改读 storeInfo() 返回值（configInfo 取 appId / compilerOptions 取 fileTypes）。

**retain**（worker ALS 全链——cohesive，不可部分删；与 §3「不动 worker ALS 桥接」对齐）：
- `defaultCompilerContext`（L22 singleton）——worker 经 `getCompilerContext()` 读此（worker 无 `packerALS.tryGet` → 落 singleton，`resetStoreInfo` mutate 之）。
- `pathInfo` Proxy（L57）+ `configInfo` Proxy（L88）——getters（getWorkPath/getTargetPath/getAppId/getAppConfigInfo/getStyleExts/getTemplateExts）经 Proxy → `getCompilerContext().pathInfo/configInfo` 读。
- `getCompilerContext`（L44）——简化为 `return defaultCompilerContext ||= createCompilerContext()`（删 `packerALS.tryGet() ??` 分支）。
- `resetStoreInfo`（L240 worker 桥接 D-PC-5）+ getters——worker parse-walk/logic/style 调（parse-walk.ts L10/92, logic/index.ts L1/86, style/parse-walk.ts L18/492, view/wxml/compile.ts L6/39）。

**scope 重述**：非「env.ts ALS 实体移除」——是「dead main-thread ALS writer 移除」。worker ALS 桥接全链 retain。

测试改读 storeInfo 返回值（F-AC1-1——删 storeInfo compat 写后须改读，非依赖 fallback）：
- custom-file-types.spec：`getTemplateExts()` → `storeInfo().compilerOptions.templateExts`（storeInfo 返 compilerOptions）
- publish-incremental.spec：`publishToDist(distDir, false, true, buildDir, appId)` 显式传——`appId` 从 `storeInfo().configInfo`（graph.getConfigData 产物，含 appInfo.appId）取；`buildDir` 从 `storeInfo().pathInfo.targetPath` 取
- grep 验：`getDependencyGraph()` main-thread caller = 0（F-AC3-1——删 compat 写后 defaultCompilerContext.graph/dependencyGraph empty，若 main-thread 读者存须改读 storeInfo().dependencyGraph）

`getAppStyleScopeId`（纯 uuid）保留。publish/npm-builder fallback `?? getAppId()`/`?? getTargetPath()`/`?? isTemporaryTargetPath()`/`?? getTemplateExts()` **保留**（spec/non-collaborator 兑底，与 PC-B4c3 一致——collaborator 路径全传 appId/fileTypes 不触发 fallback；publish-incremental.spec 3-arg 调用依赖 fallback）。

## §3 非范围

- 不动 worker ALS 桥接全链（resetStoreInfo + getters + Proxy + defaultCompilerContext + getCompilerContext D-PC-5——D-NS-6 仅删 dead `packerALS`/`runWithCompilerContext`）
- 不动 7 collaborator（facade-collaborator ✓）
- 不动 renderer/aspect/dispatch wiring（A/C/E 轨）
- 不重做 B 切法 main-thread ALS 退役（PC-B9 ✓）

## §4 实施序（implementation-plan 要点）

P-NS1 Graph accessors（D-NS-1，hygiene 低风险 additive，非 implements 阻塞）→ P-NS2 moduleCache 对齐（D-NS-2，含 `size` member getter/method 对齐——全 member 审计唯一残留 blocker）→ P-NS3 return type composite + 消费者同步（D-NS-3，blast radius 大）→ P-NS4 implements（D-NS-4，依赖 2 含 size + 3；state 经 method bivariance 放行）→ P-NS5 CompileRequest/WatchRequest（D-NS-5，OrchestrateOptions refactor + retain store?/lifecycle? per-request override）→ P-NS6 env.ts dead ALS writer 移除（D-NS-6，删 `packerALS`/`runWithCompilerContext`；retain worker 全链；依赖 3/5）。每相行为 0 gate。
