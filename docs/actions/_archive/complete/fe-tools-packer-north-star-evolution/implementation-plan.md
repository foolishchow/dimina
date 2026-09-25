# Implementation Plan — fe-tools-packer-north-star-evolution

Status authority: [Action Status](../../../STATUS.md)

## 实施序（每相独立 commit + 行为 0 gate：tsc 0 + vitest 全绿 + 7 项目 diff=0）

### P-NS1 — Graph interface accessors 补全（D-NS-1）

- types.ts `Graph` interface 加：`getAppId(): string | undefined` / `getAppName(): string | undefined` / `getAppConfigInfo(): Record<string, unknown>` / `getConfigData(): GraphConfigData` / `getPageConfigInfo(): Record<string, PageConfig>`
- **PageConfig relocate**（F-S2-1 + F-AJ2-1）：PageConfig（+ ComponentConfig 成对）从 env.ts L64 → types.ts（shape 层 canonical home）；env.ts **`import type { PackerContext, PageConfig, ComponentConfig } from '../types.ts'`**（L10 加 2 型——供内部 L82/83/423 用；re-export `from` 不入 local scope，须 import）+ **`export type { PageConfig, ComponentConfig }`**（re-export 已 import，无 `from`——backward compat）；graph.ts L23 + config-fixpoint.ts L25 import 改 types.ts
- types.ts import `GraphConfigData` type（from graph.ts）——纯 type import（runtime erase）；**relocate PageConfig/ComponentConfig 先于此 import**（GraphConfigData transitive 引 PageConfig/ComponentConfig——relocate 后 graph.ts import 改 types.ts；types.ts ↔ graph.ts type-level cycle，`import type` 安全）
- PackerGraph 已实现（PC-B4c/B7）→ tsc 验 `implements Graph` 仍满足
- 行为 0：纯 interface additive + type relocate（runtime 0 改）

### P-NS2 — OrchestratorState moduleCache 对齐（D-NS-2）

- types.ts `ModuleResultCache<V>` interface：`get(moduleId): V | undefined`（弃 `{module, dependencies}` shape）+ `set(moduleId, result: V)` + 泛化 entries/toJSON
- types.ts **`size(): number`（method）→ `get size(): number`（getter，match class）**——全 member conformance 审计唯一残留 blocker（见 design.draft §2 D-NS-2 审计表）；零消费方，改 interface（class 不动，行为 0）
- types.ts `OrchestratorState.moduleCache: ModuleResultCache<CachedModuleResult>`（import CachedModuleResult type from cache/module-result-cache.ts）
- PackerSessionState：`moduleCache: ModuleResultCache`（class）→ assignable to `ModuleResultCache<CachedModuleResult>`（class get 返 CachedModuleResult）
- 验：`PackerSessionState assignable to OrchestratorState`——fingerprints/viewCache/styleCache 多出 session 字段 **OK**（bivariance + assignable-to-interface 允许 excess；PackerSessionState 多出 required `fingerprints` 不阻单向 assignable）。见 design.draft §2 D-NS-4 bivariance probe 证据。

### P-NS3 — return type composite + 消费者同步（D-NS-3）

- types.ts 加 `BuildResult` interface（entries + appId/name/path/dependencyGraph: GraphSnapshot/buildModel）
- types.ts `import type { BuildModel } from './emit/build-model.ts'`（纯 type import，runtime erase；与 EmitEntry-from-emit.ts 模式一致——build-model.ts shape-adjacent）
- types.ts `PackerOrchestrator.orchestrate(...) → Promise<BuildResult>`
- **build-model.ts L18/L32/L74/L77 kind 窄化**（F-S1-1 + F-AF1-1：4 处 inline `{kind: string}` 同步——L32 add param 须窄，否则 `entries.set` tsc error；推荐 extract `type BuildModelEntry` alias + 4 处引用 DRY）：`{kind: string; ...}` → `kind: EmitEntry['kind']`（源头窄化；runtime 已约束仅 view/logic/style，行为 0；消 orchestrator return cast）
- orchestrator.ts `_orchestrate` return type annotation `Promise<Record<string, unknown>>` → `Promise<BuildResult>`；`const result: BuildResult = {...}`（**显式 annotation**——非依赖 inference；force 字段 typed，tsc 早报 unknown source）；return block（L304-308）加 `entries: buildModel ? [...buildModel.entries.values()] : []` field（**null guard**——buildModel 可 undefined L308 cast `?:`，guard 避免 undefined.entries throw）+ `dependencyGraph: state.graph.toJSON()`（**F-AG1-1**：改 source `state.graph.toJSON(): GraphSnapshot` guaranteed 替代 `context.dependencyGraph?.toJSON()` loose undefined-possible——BuildResult.dependencyGraph: GraphSnapshot required）+ 返 BuildResult object（非 array-with-props）
- **cast 删/retain 区分**（F-Z1-1 + F-AG1-1 + F-AH1-1）：**删 cast**（source typed state.graph）—— name（`state.graph.getAppName(): string\|undefined` ✓）、**dependencyGraph**（F-AG1-1：改 source `state.graph.toJSON(): GraphSnapshot` ✓ guaranteed，删 `context.dependencyGraph?.toJSON()` cast）；**retain cast**（source loose context `Record<string,unknown>`）—— appId（`context.loadBindings?.appId` loose → retain `as {loadBindings?: {appId?: string}}`——F-AH1-1，改 source state.graph.getAppId() = 行为改 loadBindings.appid≠projectInfo.appid）、buildModel（`context.buildModel` loose → retain `as {buildModel?: BuildModel}`——F-AH1-1，无 alt source）、path（`getAppConfigInfo().entryPagePath` unknown → `as string\|undefined`）。非「全删内部 cast」——loose context source 字段（appId/buildModel/path）须 retain
- 消费者同步：
  - session/index.ts L244/248/256/269：result.buildModel/appId 不变（shape 同）+ **删 cast**（`as { buildModel? }`/`as { appId }` → BuildResult typed 后直接访问）
  - compile-cache createAppCacheEntry：**decisive 排除 entries + buildModel**——`const { dependencyGraph, entries: _entries, buildModel: _buildModel, ...appInfo }`（F-AD1-1：unique names——duplicate `_` = TS2451；noUnusedLocals 放行 `_`-prefix，probe exit=0；行为 0 要求——entries 含编译 code；buildModel 含 .entries Map code + 序列化 dead-weight；cache 写盘 JSON compile.ts L35；appInfo = {appId, name, path}）
  - watch-runner L95/130：result.appId 不变（cast 调整：`as { appId: string }` → 直接，或 BuildResult cast）
  - lifecycle-integration.spec L171：Object.keys 锚点 + `entries`
  - logic-loader.spec：result.buildModel.entries.size 不变（buildModel.entries 仍 Map，.size getter）
- 行为 0：runtime 返同字段 object（非 array）+ kind 窄化 runtime 0 改，diff=0

### P-NS4 — implements PackerOrchestrator（D-NS-4，依赖 P-NS2 含 size + P-NS3）

- orchestrator.ts `createPackerOrchestrator` 返回类型注解 `: PackerOrchestrator`（structural conformance + method bivariance，删 `as` 强转；createPackerOrchestrator 是 function 返 object literal 非 class——无 `implements` clause，经 return type annotation + structural 兑现；P-NS2 含 size + P-NS3 return type 就位后可达，见 design.draft §2 D-NS-4 真 dependency chain + bivariance probe）
- orchestrator.ts:6 自承注释删（D-OR-7 消解）
- orchestrate signature：`orchestrate(ctx: PackerContext, state: PackerSessionState, options: OrchestrateCallOptions): Promise<BuildResult>`（**F-AI1-1**：P-NS4 KEEP `OrchestrateCallOptions`（现态，extends OrchestrateOptions + useAppIdDir?/store?/lifecycle?/fileTypes?/compileOptions?）——**非改 `OrchestrateOptions`**（types.ts L380 缺此 5 字段；build() L60-70 传 object literal `{useAppIdDir, store, lifecycle, fileTypes, compileOptions, ...}` → excess property tsc error if impl options = OrchestrateOptions）；method bivariance 放行 OrchestrateCallOptions → interface PackerOrchestrator.orchestrate options: OrchestrateOptions（子→父）；**非 `CompileRequest|WatchRequest`**——该 2 类型由 P-NS5 加，P-NS4 阶段不可用。P-NS5 后续 refactor options → `CompileRequest|WatchRequest`（CompileRequest 含 useAppIdDir?/store?/lifecycle?/fileTypes?/compileOptions?——F-AB1-1 retain + 现有，build() object literal 匹配 ✓）。state 用 PackerSessionState concrete——bivariance 放行，需 `PackerSessionState assignable to OrchestratorState` via P-NS2；impl body 可访问 state.fingerprints/viewCache 等 PackerSessionState 独有字段）
- 验：tsc 0 无 `as unknown as PackerOrchestrator`
- 注：P-NS1（Graph accessors）非 P-NS4 阻塞（hygiene，可并行先做）——见 design.draft §2 D-NS-4

### P-NS5 — CompileRequest/WatchRequest 收敛（D-NS-5）

- types.ts refactor `OrchestrateOptions` → **`CompileOptions`**（parallel/stages/prepareConfig/prepareNpm/skipMaterialize + mode flags incremental?/configChanged?）+ **`WatchOptions`**（affectedEntries?/invalidatedModules?/seedPath?）——避免 CompileRequest extends OrchestrateOptions 继承 watch 字段（F-AA1-1）；OrchestrateOptions removed（3 消费方迁移）
- types.ts 加 `CompileRequest`（= CompileOptions + {useAppIdDir?/fileTypes?/compileOptions?/store?/lifecycle?}——F-AK1-1：store?/lifecycle? retain F-AB1-1 per-request override）+ `WatchRequest`（= CompileRequest & WatchOptions）
- types.ts `PackerOrchestrator.orchestrate` interface options 型 `OrchestrateOptions` → `CompileRequest | WatchRequest`（F-AA2-1：D-FC-5 北星彻底）
- orchestrator.ts `OrchestrateRequest`（L62-63）+ `OrchestrateCallOptions`（L76-77）**retain `store?`/`lifecycle?`**（per-request OVERRIDE——F-AB1-1：_orchestrate L170 `runStore ?? providedStore ?? create`，runStore 优先；watch-runner L95 传 activeStore；删则行为改）+ 拆 Compile/Watch
- `OrchestrateCallOptions` → `CompileRequest | WatchRequest`（**PUBLIC** orchestrate 3rd param type）——**refactor orchestrate() options 型 `OrchestrateOptions` → `CompileRequest | WatchRequest`**（P-NS4 阶段用 OrchestrateOptions interim，P-NS5 加类型后 refactor 为 type-safe CompileRequest|WatchRequest）
- **`OrchestrateRequest` 不删——refactor 为 INTERNAL unified _orchestrate param**（F-Y2-1：retain store?/lifecycle? + 全字段 superset——affectedEntries?/seedPath?/invalidatedModules?/incremental?/configChanged?/useAppIdDir?/fileTypes?/compileOptions?/stages? 全 optional + workPath/targetPath/state；extends CompileOptions & WatchOptions——F-AB2-1；_orchestrate L152-165 destructure store/lifecycle + affectedEntries/seedPath/invalidatedModules 从 unified 取，union 破 destructure）
- build() (src/index.ts) + dev session 适配器改写：构造 CompileRequest/WatchRequest
- useAppIdDir/compileOptions 归属 CompileRequest（非 OrchestrateOptions）

### P-NS6 — env.ts dead ALS writer 移除（D-NS-6，依赖 P-NS3/5；scope 收窄——F-T1-1/F-T4-1）

> **实施 audit 修正（commit `6a3086d6`）**：design 预设删 3 项，实证删 2 + retain 1：
> - 删 `packerALS`（L21）+ `runWithCompilerContext`（L259）——grep caller = 0，`packerALS.tryGet` 恒 undefined → dead ✓
> - **`storeInfo compat 写`（L222-229）RETAINED**——实证 load-bearing（删则 `mkdirSync(undefined)` 崩 + 7 diff≠0；主线程 pathInfo Proxy 喂 dist-preparer createDist + npm-builder fallback 读 getTemplateExts + parse-walk 经 worker resetStoreInfo）。「测试改读 storeInfo()」+「getDependencyGraph() main-thread caller 审计」推迟为后续 initiative（见 R-NS8 backflow）。

- env.ts **删**：`packerALS`（L21，PC-B9 后 dead）+ `runWithCompilerContext`（L259，无 caller）
- env.ts **retain**（worker ALS 全链 + compat 写——cohesive，不可部分删）：`defaultCompilerContext`（L22 singleton）+ `pathInfo` Proxy（L57）+ `configInfo` Proxy（L88）+ `getCompilerContext`（L44，简化为 `return defaultCompilerContext ||= createCompilerContext()`，删 packerALS.tryGet 分支）+ `resetStoreInfo`（L240 worker）+ getters + **storeInfo compat 写**（load-bearing，见 audit）
- `getAppStyleScopeId`（纯 uuid）保留
- publish.ts/npm-builder.ts fallback `?? getAppId()`/`?? getTargetPath()`/`?? isTemporaryTargetPath()`/`?? getTemplateExts()` **保留**（spec/non-collaborator 兑底，与 PC-B4c3 一致——collaborator 路径全传不触发 fallback）
- ~~测试改读 storeInfo()~~（推迟——见 audit + R-NS8 backflow；compat 写 retain 后 spec 无需改）

## 回滚

每相独立 commit。若某相破行为 0 → revert 该相 commit，重新评估。P-NS3（return type composite）是最大 blast radius——若 session/compile-cache ripple 过深，可拆 P-NS3a（orchestrator 返 BuildResult）+ P-NS3b（消费者逐个同步）。
