# FE Tools Packer Directory Convergence

- Action: `fe-tools-packer-directory-convergence`
- Status: `ready`
- Updated: 2026-10-09
- 设计门：D-DC-1..5（draft 提议，formalize 锁定）
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-hmr-chain-residuals`](../_archive/complete/fe-tools-hmr-chain-residuals/README.md)（complete 2026-10-09；HMR 编译侧链路收尾）
- 触发文档：[2026-10-09-packer-facade-aspect-retrospect.md](../../fe-tools/2026-10-09-packer-facade-aspect-retrospect.md)（F-PA-1..6 设计模式缺陷诊断）
- 术语 / 结构真源：[docs/fe-tools/architecture-notes](../../fe-tools/architecture-notes.md)
- 文档集：[requirements](requirements.md) · [design.draft](design.draft.md) · [acceptance](acceptance.md) · [validation](validation.md) · [implementation-plan](implementation-plan.md)

## Background

packer 架构 retrospect（F-PA-1..6）发现：packer 域逻辑散在 4 处——`packer/`（6 文件）+ `model/`（9 文件，全是 packer 域，命名误导）+ `compiler/pipeline/`（10 文件，全是 packer 编排，名实不符）+ `compiler/worker-runtime/`（7 文件，D-PCS-8 通用 worker 是 packer 派发机制）。`compiler/core/` 是混合袋（packer 域 + shared/compiler 混杂）。

散落致：
1. **跨层 import 温床**——③b/③c（model→pipeline import residual；③a 已 fixed）是散落的直接症状：model/ 的 compile-cache/convergence 反向 import compiler/pipeline/，因边界未按域收敛
2. **facade/aspect 重构缺干净素材**——后续 D（facade+collaborator）/ C（aspect）轮从散落 4 处拼凑，风险高
3. **北星 6 组件形状无物理落地**——types.ts 声明 6 组件（PackerContext/Graph/LoadedModule+CompiledModule/Loader-Compiler-Emitter+3registry/OrchestratorState/PackerOrchestrator），但目录结构未对应

本 Action 是 **D/C 前置结构轮（Round 0）**：纯目录搬迁 + import 路径改写，逻辑零改，给 D/C 干净素材 + 消解 ③b/③c（③a 已 fixed）。

## Scope

**In-scope**：
- packer 域全部文件（~27）归位 `packer/` 子目录（mirror 北星 6 组件形状）
- `model/` 解散（9 文件迁 packer/）
- `compiler/pipeline/` 解散（10 文件迁 packer/pipeline+emit+state）
- `compiler/worker-runtime/` 解散（7 文件迁 packer/worker/）
- `compiler/core/` 解体（packer 域迁 packer/；sourcemap/expression-parser 去 shared/compiler）
- `compiler/` 收敛后只剩 `logic/view/style` per-kind transforms
- ③b/③c 跨顶层目录 import 消解（③a 已 fixed，非本 Action）
- 行为 0 三件套（tsc 0 + vitest 全绿 + 6 项目 diff=0）

**Non-scope**：
- D（facade + collaborator 抽取）——Round 1
- C（aspect 分离）——Round 2
- B（ALS→PackerContext 闭合）——Round 2 后 checkpoint 评估
- compiler/logic|view|style per-kind 子结构调整（本 Action 只收敛 packer 域 + 解体 core/，per-kind 结构留待后续）
- logicLoader 对齐 buildJSByPath（dispatch wiring，Round E，runtime 就绪后）

## 切法

切法：纯搬迁（含受控文件拆分 `registry.ts → dispatch.ts + lce.ts` + `core/` 解体）。分批搬迁按依赖序：graph+store（底层）→ cache+registry → emit+worker → pipeline+state → aspect+core解体，每批 tsc + vitest + 6 项目 diff 行为 0 gate。design gates D-DC-1..5（formalize 锁定）。

## Deliverables

- `src/packer/` 子目录结构落地（9 子目录 mirror 北星 6 组件 + worker/pipeline/aspect 支撑）
- `src/model/` 解散（目录删除或空）
- `src/compiler/pipeline/` + `src/compiler/worker-runtime/` 解散
- `src/compiler/core/` 解体
- `src/compiler/` 只剩 `logic/view/style/`
- 全量 import 路径改写（~100+ 处，含 `__tests__/` spec 导入被搬路径同步更新；ESM 显式后缀 + tsc 全量验）
- 行为 0 三件套验证档
- tracker ③b/③c 状态更新（③a 已 fixed） + architecture-notes 目录收敛条目 + stale path 引用更新
