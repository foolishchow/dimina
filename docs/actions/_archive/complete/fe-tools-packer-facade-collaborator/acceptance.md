# Acceptance — fe-tools-packer-facade-collaborator

Status: **complete（2026-10-10；FC-P0..P6 + D-FC-2b + B 切法 PC-B10a 签名完成；D-FC-2a implements+reconcile + A-FC3 → [fe-tools-packer-north-star-evolution](../../../fe-tools-packer-north-star-evolution/README.md) 承接，受阻 D-OR-7）**

| ID | requirement | 验证项 | 方法 | 状态 |
| --- | --- | --- | --- | --- |
| A-FC1 | R-FC-1 | 7 collaborator 抽取（logic 搬迁非包壳）| 7 collaborator 文件存在 + git diff -M 验逻辑体搬迁 + `grep 'await collaborators\.' orchestrator.ts` = 7 | ✓ done |
| A-FC2a | R-FC-2 | orchestrate 签名落地（北星不改）| **signature done**（B 切法 PC-B10a：`orchestrate(ctx: PackerContext, state, options)` 落地 + buildPackerContext helper）。**implements + result→EmitEntry[] reconcile** → [fe-tools-packer-north-star-evolution](../../../fe-tools-packer-north-star-evolution/README.md) A-NS3/NS4 承接（D-OR-7 三重张力：return type / state type / lifecycle Object.keys 锚点，需北星 interface 演进） | ◐ signature ✓；implements+reconcile superseded→north-star |
| A-FC2b | R-FC-2 | registry 私有化 | createPackerOrchestrator 仅返 `{ orchestrate }` + types.ts PackerOrchestrator 删 registry 字段 + logic-loader.spec 6 处伸手改行为验 | ✓ done |
| A-FC3 | R-FC-3 | OrchestrateRequest 收敛 | → [fe-tools-packer-north-star-evolution](../../../fe-tools-packer-north-star-evolution/README.md) A-NS5 承接（CompileRequest/WatchRequest 收敛与北星 interface 演进耦合，D-FC-3） | ◐ superseded→north-star |
| A-FC4 | R-FC-4 | 行为 0 | tsc 0 + vitest 全绿 + 7 项目 diff=0 | ✓ done |
| A-FC4b | rigor | collaborator 状态分类 | 6 无状态闭包复用 + NpmBuilder 有状态每次 build new + previousCompatibilityWarnings/isPrinted 模块级 state 不变 | ✓ done |
| A-FC5 | R-FC-5 | Non-scope 边界守 | renderer 副作用注册保留（orchestrator.ts webviewRenderer）+ aspect 穿线保留 + L/C/E NOT wired 保留 | ✓ done |
| A-FC6 | R-FC-6 | types.ts 形状纪律 | BuildCollaborator<Deps> 在 types.ts（纯形状）+ impl 在 packer/ 子目录 + types.ts 无 implementation import | ✓ done |
| A-FC7 | rigor 红线 | collaborator 拥有逻辑（非包壳）| collaborator 文件含原 orchestrator 逻辑体（sctx 字段设置 + lifecycle 事件 + 错误处理）+ 非 forward-only | ✓ done |
| A-FC8 | D-FC-4 | ALS 保留（B 留后）| `grep 'getWorkPath\|getPages\|getAppConfigInfo\|isMiniGame' src/packer/{store,emit,pipeline}/` 非 0 + collaborator 仍拥有业务逻辑 | ✓ done |

## B-deferred residuals（D-FC-2a + A-FC3）

facade 契约签名落地依赖 ALS→PackerContext 闭合（B 切法）+ OrchestratorState.buildModel 演进。B 就位后：
1. orchestrate 签名对齐 `(ctx: PackerContext, state: OrchestratorState, options: OrchestrateOptions)` + `implements PackerOrchestrator`
2. result→EmitEntry[] + metadata 伴随（session 改读 state.buildModel）
3. OrchestrateRequest → CompileRequest/WatchRequest
