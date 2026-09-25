# Acceptance — fe-tools-packer-north-star-evolution

Status: **in_progress（2026-10-10 formalize；D-NS-1..6 locked，P-NS1..6 实施序）**

Status authority: [Action Status](../STATUS.md)

| ID | Req | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-NS1 | R-NS1 | Graph interface accessors | types.ts `Graph` interface 含 getAppId/getAppName/getAppConfigInfo/getConfigData/getPageConfigInfo；PackerGraph implements；tsc 0 | pending |
| A-NS2 | R-NS2 | OrchestratorState moduleCache 对齐 | PackerSessionState assignable to OrchestratorState（moduleCache shape 对齐）；tsc 0 | pending |
| A-NS3 | R-NS3 | return type composite | orchestrate 返回 `{ entries: EmitEntry[]; metadata }`（或北星 re-design）；session/compile-cache/watch-runner 消费同步；lifecycle-integration.spec 锚点同步 | pending |
| A-NS4 | R-NS4 | implements PackerOrchestrator | createPackerOrchestrator 返回 implements PackerOrchestrator（无 `as unknown as` 强转）；orchestrator.ts:6 自承注释删 | pending |
| A-NS5 | R-NS5 | CompileRequest/WatchRequest 收敛 | OrchestrateRequest 拆 CompileRequest + WatchRequest；useAppIdDir/compileOptions 归属定；build() + dev session 适配器改写 | pending |
| A-NS6 | R-NS6 | env.ts ALS 实体移除 | grep `packerALS\|runWithCompilerContext\|pathInfo.*Proxy\|configInfo.*Proxy\|defaultCompilerContext` env.ts = 0（resetStoreInfo 保留）；custom-file-types.spec + publish-incremental.spec 改读 storeInfo 返回值 | pending |
| A-NS7 | R-NS7 | 行为 0 | tsc 0 + vitest 全绿 + 7 项目 diff=0 | pending |
| A-NS8 | R-NS8 | Non-scope 守 | worker resetStoreInfo 保留 + collaborator 不动 + renderer/aspect/dispatch 不动 | pending |

## 承接的 deferred residuals

- facade-collaborator A-FC2a（implements + return reconcile）→ A-NS3/NS4
- facade-collaborator A-FC3（CompileRequest/WatchRequest）→ A-NS5
- context-closure R-PC-3 entity removal（PC-B9b）→ A-NS6
- context-closure R-PC-4 implements + reconcile + CompileRequest → A-NS3/NS4/NS5
