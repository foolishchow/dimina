# Acceptance — fe-tools-packer-north-star-evolution

Status: **in_progress（2026-10-10 formalize；D-NS-1..6 locked，P-NS1..6 实施序）**

Status authority: [Action Status](../STATUS.md)

| ID | Req | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-NS1 | R-NS1 | Graph interface accessors | types.ts `Graph` interface 含 getAppId/getAppName/getAppConfigInfo/getConfigData/getPageConfigInfo；PageConfig（+ComponentConfig）relocate env.ts→types.ts（env.ts re-export backward compat）；PackerGraph implements；tsc 0 | pending |
| A-NS2 | R-NS2 | OrchestratorState moduleCache 对齐 | `ModuleResultCache<V>` interface get/set 泛化为 V + `size(): number`→`get size(): number`（match class getter，零消费方）；PackerSessionState assignable to OrchestratorState（单向，bivariance 前提）；tsc 0 | pending |
| A-NS3 | R-NS3 | return type composite | orchestrate 返 `Promise<BuildResult>` flat `{ entries: EmitEntry[]; appId; name; path; dependencyGraph: state.graph.toJSON(); buildModel }`；build-model.ts **L18/L32/L74/L77（4 处 inline）** `kind: string`→`EmitEntry['kind']`（F-AF1-1：4 处同步或 extract alias；源头窄化）；entries sourcing null guard（`buildModel ? [...] : []`）；dependencyGraph source 改 `state.graph.toJSON(): GraphSnapshot`（F-AG1-1：guaranteed，删 `context.dependencyGraph?.toJSON()` loose cast）；compile-cache createAppCacheEntry 排除 entries + buildModel；session/compile-cache/watch-runner 消费同步；lifecycle-integration.spec 锚点同步（+entries） | pending |
| A-NS4 | R-NS4 | implements PackerOrchestrator | createPackerOrchestrator 返回类型注解 `: PackerOrchestrator`（structural conformance + method bivariance；function 返 object 非 class）；无 `as unknown as` 强转；orchestrator.ts:6 自承注释删 | pending |
| A-NS5 | R-NS5 | CompileRequest/WatchRequest 收敛 | OrchestrateOptions refactor → CompileOptions + WatchOptions；CompileRequest = CompileOptions + {useAppIdDir?/fileTypes?/compileOptions?/store?/lifecycle?}（retain per-request override——F-AB1-1）；WatchRequest = CompileRequest & WatchOptions；PackerOrchestrator interface options → CompileRequest \| WatchRequest（F-AA2-1）；OrchestrateCallOptions → CompileRequest \| WatchRequest（PUBLIC）；OrchestrateRequest refactor 为 INTERNAL unified（extends CompileOptions & WatchOptions，retain store?/lifecycle?）；useAppIdDir/compileOptions 归属定；build() + dev session 适配器改写 | pending |
| A-NS6 | R-NS6 | env.ts dead ALS writer 移除 | grep `packerALS\|runWithCompilerContext` env.ts = 0 + storeInfo compat 写（L222-229）删；retain worker 全链（defaultCompilerContext + Proxy + getCompilerContext + resetStoreInfo + getters）；getCompilerContext 简化（删 packerALS.tryGet 分支）；custom-file-types.spec + publish-incremental.spec 改读 storeInfo() 返回值（configInfo 取 appId / compilerOptions 取 fileTypes / pathInfo 取 buildDir）；grep getDependencyGraph() main-thread caller = 0 | pending |
| A-NS7 | R-NS7 | 行为 0 | tsc 0 + vitest 全绿 + 7 项目 diff=0 | pending |
| A-NS8 | R-NS8 | Non-scope 守 | worker resetStoreInfo 保留 + collaborator 不动 + renderer/aspect/dispatch 不动 | pending |

## 承接的 deferred residuals

- facade-collaborator A-FC2a（implements + return reconcile）→ A-NS3/NS4
- facade-collaborator A-FC3（CompileRequest/WatchRequest）→ A-NS5
- context-closure R-PC-3 entity removal（PC-B9b）→ A-NS6
- context-closure R-PC-4 implements + reconcile + CompileRequest → A-NS3/NS4/NS5
