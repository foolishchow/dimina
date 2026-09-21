# FE Tools Packer Lifecycle Audit

- Action: `fe-tools-packer-lifecycle-audit`
- Status: `complete`
- Updated: 2026-09-21
- Status authority: [Action Status](../../../STATUS.md)
- 后继：[`fe-tools-packer-core-shape`](../fe-tools-packer-core-shape/README.md)（**complete 已归档**；形状定义——本审计是其事实基础）
- 前身：[`fe-tools-packer-research`](../fe-tools-packer-research/README.md)（**complete 已归档**；4 焊点方法级审计，结论"不值得立即抽取"）
- Closure: `complete` — A-PLA-1..9 全 pass，F-1..F-6 回流 fe-tools-packer-core-shape，research only 零产品代码变更

## 背景

`fe-tools-packer-core-shape`（draft）试图定义 Packer core 形状（审计时为 5 组件；core-shape 后续演化为 6+ 组件：Graph / PackerContext / Loader+Compiler+Emitter+registry / OrchestratorState / Orchestrator）。但形状设计在抽象层面推理时，多处假设被实际代码推翻——PackerContext 是 ALS-backed 不是 plain object、graph/cache 跨线程写权分叉、fixpoint 是 per-lane 并行不是全局串行、emit 时机因车道而异。

形状定义不能凭抽象推理——需要有事实基础。本 Action 就是这个事实基础：从 Packer（= 整个 bundler = session 完整生命周期）的创建点开始，逐环节梳理到产物输出 + watch rebuild 循环，每步标注读什么、写什么、碰 graph 还是 cache。

## 目标

**梳理 Packer 全流程生命周期，产出事实基础文档**——为 `fe-tools-packer-core-shape` 的形状设计提供可验证的参照。

不做形状设计、不做 Packer 抽取、不改产品代码（research only）。

## 非目标

- 不定义 Packer core 形状（`fe-tools-packer-core-shape` 的事）
- 不做 Packer 物理抽取
- 不改任何产品代码（research only）
- 不设计 PackerContext / PackerModule / Packer API 接口
- 不实现 watch 增量 / HMR / deriveFromGraph

## 设计输入

- [`fe-tools-packer-research`](../fe-tools-packer-research/README.md) — 4 焊点方法级审计 + PackerContext 草案
- [`fe-tools-packer-core-shape`](../fe-tools-packer-core-shape/README.md) — Packer core 形状定义（complete 已归档；本审计是其前置。审计时 5 组件，core-shape 后续演化为 6+ 组件）
- [`fe-tools-module-centric`](../fe-tools-module-centric/README.md) — D-MF-1（方案 A；刀 2 仅 logic）
- [`fe-tools-module-invalidation`](../fe-tools-module-invalidation/README.md) — M1：computeInvalidatedModules
- [`fe-tools-module-result-cache`](../fe-tools-module-result-cache/README.md) — M2：ModuleResultCache
- [`fe-tools-emit-relocate`](../fe-tools-emit-relocate/README.md) — D-ER-5：produceEntry
- 现有代码：`session/index.ts` / `session/runner.ts` / `index.ts` / `pipeline/build-pipeline.ts` / `pipeline/stage-channel.ts` / `model/project-store.ts` / `watch/watch-runner.ts` / `watch/watch-plan.ts` / `core/env.ts`

## 交付物

1. `source-audit.md` — Packer 全流程生命周期审计（8 章节）
2. 不改任何产品代码（research only）
3. 关键发现回流 `fe-tools-packer-core-shape` 的 technical-design

## Requirements

- R-PLA-1 MUST 梳理 Packer 入口（CLI / session / Packer 创建点 storeInfo）
- R-PLA-2 MUST 梳理第一 build 全流程（pipeline.run 4 阶段 + 逐步读/写/graph/cache 标注）
- R-PLA-3 MUST 梳理 Worker 内流程（compile worker + emit worker + 三车道 emit 差异）
- R-PLA-4 MUST 梳理 watch rebuild 流程（chokidar → watch-plan → 增量数据流）
- R-PLA-5 MUST 梳理 graph 生命周期（创建/变异/合并 + 写权分布）
- R-PLA-6 MUST 梳理 cache 生命周期（创建/读/写 + 写权分布）
- R-PLA-7 MUST 文档化组件映射现状（形状假设 vs 现实 gap。审计时为 5 组件，core-shape 后续演化为 6+）
- R-PLA-8 MUST 总结关键发现（F-1..F-6）回流 core-shape
- R-PLA-9 MUST 不改产品代码（research only，diff=0）

## Readiness gaps

- 无——审计已完成，文档已产出（`source-audit.md`）
- F-1..F-6 准确性已确认（5 轮 review pass）

## Closure conditions

- R-PLA-1..9 全 passed
- 关键发现 F-1..F-6 回流 `fe-tools-packer-core-shape` technical-design
- 行为 0 守卫通过（diff=0；vitest 不受影响）
