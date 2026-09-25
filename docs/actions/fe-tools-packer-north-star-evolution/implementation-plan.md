# Implementation Plan — fe-tools-packer-north-star-evolution

Status authority: [Action Status](../STATUS.md)

## 实施序（每相独立 commit + 行为 0 gate：tsc 0 + vitest 全绿 + 7 项目 diff=0）

### P-NS1 — Graph interface accessors 补全（D-NS-1）

- types.ts `Graph` interface 加：`getAppId(): string | undefined` / `getAppName(): string | undefined` / `getAppConfigInfo(): Record<string, unknown>` / `getConfigData(): GraphConfigData` / `getPageConfigInfo(): Record<string, PageConfig>`
- types.ts import `GraphConfigData` type（from graph.ts）+ `PageConfig`（from env.ts）——纯 type import
- PackerGraph 已实现（PC-B4c/B7）→ tsc 验 `implements Graph` 仍满足
- 行为 0：纯 interface additive，无 runtime 改

### P-NS2 — OrchestratorState moduleCache 对齐（D-NS-2）

- types.ts `ModuleResultCache<V>` interface：`get(moduleId): V | undefined`（弃 `{module, dependencies}` shape）+ `set(moduleId, result: V)` + 泛化 entries/toJSON
- types.ts `OrchestratorState.moduleCache: ModuleResultCache<CachedModuleResult>`（import CachedModuleResult type from cache/module-result-cache.ts）
- PackerSessionState：`moduleCache: ModuleResultCache`（class）→ assignable to `ModuleResultCache<CachedModuleResult>`（class get 返 CachedModuleResult）
- 验：`PackerSessionState` assignable to `OrchestratorState`（fingerprints/viewCache/styleCache 多出——optional? 需确认 OrchestratorState 不要求严格 excess）

### P-NS3 — return type composite + 消费者同步（D-NS-3）

- types.ts 加 `BuildResult` interface（entries + appId/name/path/dependencyGraph/buildModel）
- types.ts `PackerOrchestrator.orchestrate(...) → Promise<BuildResult>`
- orchestrator.ts `_orchestrate` 返 BuildResult object（非 array-with-props）
- 消费者同步：
  - session/index.ts L244/248/256/269：result.buildModel/appId 不变（shape 同）
  - compile-cache createAppCacheEntry：destructure 排除 entries（`const { dependencyGraph, entries: _, ...appInfo }`）或接受 entries 进 appInfo（评估）
  - watch-runner L95/130：result.appId 不变（cast 调整：`as { appId: string }` → 直接，或 BuildResult cast）
  - lifecycle-integration.spec L171：Object.keys 锚点 + `entries`
  - logic-loader.spec：result.buildModel.entries.size 不变
- 行为 0：runtime 返同字段 object（非 array），diff=0

### P-NS4 — implements PackerOrchestrator（D-NS-4，依赖 P-NS1/2/3）

- orchestrator.ts `createPackerOrchestrator` 返回 `implements PackerOrchestrator`（删 `as` 强转——已无需，D-NS-1/2/3 就位）
- orchestrator.ts:6 自承注释删（D-OR-7 消解）
- orchestrate signature：`orchestrate(ctx: PackerContext, state: PackerSessionState, options: CompileRequest | WatchRequest): Promise<BuildResult>`（state 用 PackerSessionState concrete——assignable to OrchestratorState via D-NS-2）
- 验：tsc 0 无 `as unknown as PackerOrchestrator`

### P-NS5 — CompileRequest/WatchRequest 收敛（D-NS-5）

- types.ts 加 `CompileRequest` + `WatchRequest`（= CompileRequest & 增量字段）
- orchestrator.ts `OrchestrateRequest` 删 `store`/`lifecycle`（构造参数已收）+ 拆 Compile/Watch
- build() (src/index.ts) + dev session 适配器改写：构造 CompileRequest/WatchRequest
- useAppIdDir/compileOptions 归属 CompileRequest（非 OrchestrateOptions）

### P-NS6 — env.ts ALS 实体移除（D-NS-6，依赖 P-NS3/5）

- env.ts 删：`packerALS`/`runWithCompilerContext`/`defaultCompilerContext`/`pathInfo` Proxy/`configInfo` Proxy
- env.ts 保留：`resetStoreInfo`（worker）+ `getAppStyleScopeId`（uuid）+ `storeInfo`（建图，localCtx）+ ALS getters（worker 用——resetStoreInfo 设 worker ALS，getters 读 worker ALS）
- publish.ts/npm-builder.ts fallback `?? getAppId()`/`?? getTemplateExts()` 删（collaborator 全传）
- 测试改读：
  - custom-file-types.spec：getTemplateExts() 等 → storeInfo().compilerOptions.{templateExts,...}
  - publish-incremental.spec：publishToDist 显式传 buildDir/appId（setupEnv 返 storeInfo）

## 回滚

每相独立 commit。若某相破行为 0 → revert 该相 commit，重新评估。P-NS3（return type composite）是最大 blast radius——若 session/compile-cache ripple 过深，可拆 P-NS3a（orchestrator 返 BuildResult）+ P-NS3b（消费者逐个同步）。
