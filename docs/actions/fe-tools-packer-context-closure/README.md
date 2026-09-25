# fe-tools-packer-context-closure

- Status: `in_progress`
- Created: 2026-10-10
- 切法：**B（ALS→PackerContext 闭合）**——消 ALS 全局，I/O 显式 PackerContext 贯穿
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-packer-facade-collaborator`](../fe-tools-packer-facade-collaborator/README.md)（in_progress；7 collaborator 抽取就位，D-FC-2a deferred to B）
- 触发：[2026-10-09-packer-facade-aspect-retrospect.md](../../fe-tools/2026-10-09-packer-facade-aspect-retrospect.md)（**F-PA-4 high** 三种 ctx 模型未 reconcile）
- 术语 / 结构真源：[docs/fe-tools/architecture-notes](../../fe-tools/architecture-notes.md)
- 文档集：[requirements](requirements.md) · [design.draft](design.draft.md) · [acceptance](acceptance.md) · [validation](validation.md)

## 目标

消解 F-PA-4：ALS 全局（env.ts ~30 函数）→ 显式 PackerContext（I/O：paths/fileTypes/readContent/resolvers）+ OrchestratorState.graph（config data：pages/appConfig/components/runtimeType）。

ALS 当前 conflates 两类数据：
- **I/O（→ PackerContext）**：workPath/targetPath/fileTypes/readContent（getWorkPath/getTargetPath/getStyleExts/getTemplateExts/getContentByPath）
- **config data（→ state.graph）**：pages/appConfigInfo/components/runtimeType（getPages/getAppConfigInfo/getComponent/isMiniGame）

闭合后 collaborator 收 `(ctx, state)` 显式读，消 ALS 隐式全局。解锁 facade-collaborator D-FC-2a（orchestrate 签名 `(ctx: PackerContext, state, options) → EmitEntry[]` + implements + result reconcile）。

## 范围

- **in**：env.ts ALS 函数 → 显式 PackerContext/OrchestratorState 贯穿；collaborator + parse-walk + emit-engine + graph + pipeline 消费者改写；orchestrate 签名对齐北星（解锁 D-FC-2a）
- **out**（Non-scope）：
  - **renderer 注入点**（A 切法）——另 Action
  - **aspect 分离**（C 切法）——collaborator 就位后挂 aspect seam
  - **L/C/E dispatch wiring**（E 切法）——runtime HMR API 外部阻塞
  - **resolveAlias/resolveNpm 实体化**（D-PCS-1 deferred）——B 闭合 I/O 壳，resolver 实体化留后

## 行为 0 契约

纯结构重构（ALS 读 → 显式 ctx/state 读，无语义改）。每相独立 commit + 行为 0 gate（tsc 0 + vitest 全绿 + 7 项目 diff=0）。ALS 值与 ctx/state 值同源（storeInfo 设）→ 产物不变。

## 前置依赖

- facade-collaborator 7 collaborator 就位（collaborator 收 deps，可加 ctx）✓
- als-store（AsyncContextStore 工具）✓
- graph-bootstrap（PackerGraph 自包含，getAppConfigInfo/getPages 已委托 graph）✓
