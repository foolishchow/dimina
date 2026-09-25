# Validation — fe-tools-packer-facade-collaborator

Status: **in_progress（2026-10-10；FC-P0..P6 + D-FC-2b 完成，D-FC-2a/P7a/P7b deferred to B）**

## Validation Plan

| ID | 验证项 | 命令/方法 | 状态 |
| --- | --- | --- | --- |
| P-FC0 | 类型来源前置 | ProjectStore export（project-store.ts）+ Lifecycle export（shared/lifecycle.ts）+ BuildCollaborator<Deps> ADD（types.ts §9） | ✓ done |
| P-FC1 | DistPreparer + ConfigCompiler | 2 collaborator 文件（packer/emit/dist-preparer + packer/pipeline/config-compiler-collab）+ git diff -M 逻辑体搬迁 | ✓ done |
| P-FC2 | NpmBuilder 接线 | packer/pipeline/npm-builder.ts 加 createNpmBuilderCollaborator + 有状态每次 build new（不在闭包构造） | ✓ done |
| P-FC3 | ConfigCollector | packer/store/config-collector.ts + 写 9 sctx 字段 + ctx→sctx 统一 | ✓ done |
| P-FC4 | StageDispatcher | packer/pipeline/stage-dispatcher.ts + createStageTask 搬迁 + loadBindings→sctx.loadBindings + compile-target.spec test-sync | ✓ done |
| P-FC4b | collaborator 状态分类 | 6 无状态闭包复用 + NpmBuilder 有状态每次 new + previousCompatibilityWarnings/isPrinted 模块级不变 | ✓ done |
| P-FC5 | LogicEmitter | packer/emit/logic-emitter.ts + ctx→sctx 统一（buildModel/storeInfo） | ✓ done |
| P-FC6 | Publisher | packer/emit/publisher.ts + 读 sctx.buildModel + ALS getTargetPath 保留 | ✓ done |
| P-FC7 | rigor check | `grep 'await collaborators\.' orchestrator.ts` = 7 + collaborator 含 sctx/lifecycle/错误处理 + git diff -M 非空壳 + `grep ALS src/packer/{store,emit,pipeline}/` 非 0 | ✓ done |
| P-FC8 | 行为 0 三件套 | tsc 0 + vitest 647 pass（compile-cli-cache/session-unify flaky solo pass）+ 7 项目 diff=0 | ✓ done |
| P-FC9 | types.ts 形状纪律 | BuildCollaborator<Deps> 在 types.ts + impl 在 packer/ 子目录 + types.ts 无 implementation import | ✓ done |
| P-FC10 | orchestrator 行数收敛 | orchestrator.ts 429 → 321 行（保留 Listr task 序 + createPackerOrchestrator + result 合 + webviewRenderer + printCompatibilityWarnings） | ✓ done（321 < 估 120-150 因 result 合 + webviewRenderer + printCompatibilityWarnings 保留项占行） |
| P-FC2b | registry 私有化 | createPackerOrchestrator 仅 `{ orchestrate }` + types.ts PackerOrchestrator 删 3 字段 + logic-loader.spec 6 处伸手改行为验（fixture orchestrate 跑通 + buildModel.entries.size > 0） | ✓ done |
| P-FC2a | orchestrate 签名落地 | DEFERRED to B——`implements PackerOrchestrator` + `(ctx,state,options)→EmitEntry[]` 需 ALS→PackerContext 闭合（B 切法）+ result reconcile 依赖 session buildModel | ✗ deferred B |
| P-FC3a/b | OrchestrateRequest 收敛 | DEFERRED to B——入口签名收敛与 P-FC2a 耦合 | ✗ deferred B |

## 行为 0 边界

- **纯结构重构**：logic 搬迁到 collaborator，无语义改。ALS 直调保留 → build 产物字节不变
- **每相独立 commit + 行为 0 gate**：FC-P0..P6 + D-FC-2b 各独立 commit（7 commit + P0 + 2b）
- **7 项目 diff=0**：collaborator 搬迁不改 build 产物（logic 逐字搬迁，ALS 保留）

## B-deferred residuals（D-FC-2a + P7a/P7b）

facade 契约签名落地依赖 ALS→PackerContext 闭合（B 切法）+ OrchestratorState.buildModel 演进。B 就位后：
1. orchestrate 签名对齐 `(ctx: PackerContext, state: OrchestratorState, options)` + `implements PackerOrchestrator`
2. result→EmitEntry[] + metadata 伴随（session 改读 state.buildModel）
3. OrchestrateRequest → CompileRequest/WatchRequest

## Uncovered（预期声明，后续轮）

- **renderer 注入点**（F-PA-3，A 切法）——后续 Action
- **aspect 分离**（F-PA-2，C 切法）——collaborator 就位后挂 aspect seam
- **ALS→PackerContext 闭合**（F-PA-4，B 切法）——collaborator shape 就位后高风险轮（**解锁 D-FC-2a + P7a/P7b**）
- **L/C/E dispatch wiring**（F-PA-5/E）——runtime HMR API 外部阻塞
