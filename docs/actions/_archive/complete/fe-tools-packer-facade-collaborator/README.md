# fe-tools-packer-facade-collaborator

- Status: `complete`
- Formalize: 2026-10-10（D-FC-1..5 locked，4 批 19 轮 review）
- 实施: 2026-10-10（FC-P0..P6 + D-FC-2b + B 切法 PC-B2..B10a 签名完成；D-FC-2a implements+reconcile + D-FC-3 CompileRequest/WatchRequest → [fe-tools-packer-north-star-evolution](../fe-tools-packer-north-star-evolution/README.md) 承接，受阻 D-OR-7 北星 interface 张力）
- Closed: 2026-10-10
- Created: 2026-10-09
- 设计门：[D-FC-1..5 locked](design.draft.md#§2-设计门draft-提议formalize-待锁)（4 批 19 轮 review 严格收敛）
- 实施计划：[implementation-plan.md](implementation-plan.md)（FC-P0..P7b 分相）
- Status authority: [Action Status](../../../STATUS.md)
- 前置：[`fe-tools-packer-directory-convergence`](../fe-tools-packer-directory-convergence/README.md)（complete 2026-10-09；packer/ 9 子目录就位，给本 Action 干净素材）
- 触发文档：[2026-10-09-packer-facade-aspect-retrospect.md](../../../../fe-tools/2026-10-09-packer-facade-aspect-retrospect.md)（**F-PA-1 critical** orchestrator god object + 北星 facade 契约未落地）
- 术语 / 结构真源：[docs/fe-tools/architecture-notes](../../../../fe-tools/architecture-notes.md)
- 文档集：[requirements](requirements.md) · [design.draft](design.draft.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)

## 目标

消解 F-PA-1：orchestrator god object → **facade + collaborator 抽取**。`_orchestrate` 7 类业务活（store.load / createDist / compileConfig / npmBuilder / stage 派发 / logic emit / materialize+publishToDist）下沉到**拥有逻辑的 collaborator**（非包壳），orchestrator 收敛为薄编排 facade（Listr 任务序 + 委托 + 合 delta）。

## 范围

- **in**：orchestrator `_orchestrate` 内 7 业务块 → collaborator 抽取；facade 契约（`PackerOrchestrator.orchestrate` 北星签名真落地）；4 registry 私有化（facade 内部，不公开返回）；`OrchestrateRequest` ~19 字段收敛
- **out**（Non-scope，后续轮）：
  - **renderer 注入点**（F-PA-3，A 切法）——独立 Action 或 C 轮
  - **aspect 分离**（F-PA-2，C 切法）——本 Action collaborator 内部暂留横切穿线
  - **ALS→PackerContext 闭合**（F-PA-4，B 切法）——**collaborator 内部暂可用 ALS**（rigor 红线：抽取单元须拥有逻辑，ALS 直调是 I/O 读非被抽逻辑）
  - **L/C/E dispatch wiring**（F-PA-5/E 切法）——runtime HMR API 外部阻塞，premature

## rigor 红线（核心约束）

**抽取单元必须拥有逻辑，不是改名/包壳**（retrospect §3.2 D 草案 + 用户 top-down 校正）。collaborator 须**搬入真实业务逻辑**（store.load 调用 + sctx 字段设置 + registry kinds 派发等），orchestrator task body 委托调用。禁止"facade theater"（collaborator 仅 forward 调用 + 包壳，逻辑仍在 orchestrator）。

## 行为 0 契约

纯结构重构（logic 搬迁到 collaborator，无语义改）。每 collaborator 抽取 = 独立 commit + 行为 0 gate（tsc 0 + vitest 全绿 + 7 项目 diff=0）。ALS 直调保留（collaborator 内部）→ build 产物字节不变。
