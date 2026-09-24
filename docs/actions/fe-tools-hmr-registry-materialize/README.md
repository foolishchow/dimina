# FE Tools HMR Registry Materialize（H2 子门）

- Action: `fe-tools-hmr-registry-materialize`
- Status: `draft`
- Updated: 2026-10-09
- Status authority: [Action Status](../STATUS.md)
- 父伞：[`fe-tools-hmr-compiler`](../fe-tools-hmr-compiler/README.md)（**`ready`**；H2 子门）
- 文档集：[requirements](requirements.md) · [design.draft](design.draft.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`
- 前置：H1 `complete`（deriveFromGraph 接线——emit 已 graph 派生）

## 背景

HMR-compiler 伞 H2 子门。design.draft §4 目录 cycle 消解：H2 subsume ①③（core⇄packer env.ts god module + model→pipeline stage/emit 概念）。

**现状**：orchestrator.ts:54 `emptyRegistry`（D-OR-2 硬编码三车道 stub——`register()/get()/kinds()` 全空）。Packer shape `types.ts:186-215` 已定义 `Loader`/`Compiler`/`Emitter` 接口 + `kind→Loader` 映射，但未接线。legacy `compile-target.ts` 两段式（createCompileTarget 静态 + readLoadBindings 动态 + deriveStagePlan 纯派生）仍为唯一 compile 入口。

## Goal

`emptyRegistry` → 实体化。Loader/Compiler/Emitter registry 替代 legacy compile-target 编排。使 compile 路径经 registry 派发（非 compile-target 硬编码 stage）。

## Non-goals

- per-module view/style cache（H3）
- per-module HMR push（H4）
- env.ts 整体拆（W3 gradual migration——env.ts 薄壳继续瘦身至消解，非 big-bang split）
- 改 Loader/Compiler/Emitter 接口形状（types.ts 已冻 D-PCS-5/7）

## Scope

```text
H2:  emptyRegistry → 实体化（Loader/Compiler/Emitter 注册 + 派发）
     compile-target compile 段 → registry 派发（load/compile 经 registry）
     env.ts load 函数 → Loader registry（gradual，①消解路径）
不做: view/style cache 粒度（H3）; HMR push（H4）; types.ts 接口改; env.ts big-bang split
```

## Design inputs

- `orchestrator.ts:54` emptyRegistry（D-OR-2 stub）
- `types.ts:186-215` Loader/Compiler/Emitter 接口 + kind→Loader 映射（D-PCS-5/7）
- `compile-target.ts:35,76` createCompileTarget + readLoadBindings + deriveStagePlan（两段式 legacy）
- `stage-channel.ts` runCompileStage（worker 派发，经 compile-target stages）
- D-HMR-3（伞级）：方案 A 渐进 vs B 一次性——H2 formalize 锁
- D-OR-2: emptyRegistry stub 硬编码
- W3: env.ts gradual migration（packer-context 已迁 14 函数、graph-bootstrap 已迁 steps 3-6）

## Readiness gaps

- **D-REG-1 registry 实体化策略**（design.draft §1）：方案 A 渐进（compile-target 保留 fallback）vs B 一次性——SMPU/H1 经验：dual-path 风险，但 compile-target 是核心入口，渐进降风险
- **D-REG-2 load 归属**（design.draft §2）：env.ts load 函数 → Loader registry？compile-target readLoadBindings → Loader.load？
- **D-REG-3 stage 概念归属**（design.draft §3）：COMPILE_STAGE_ORDER + stage 常量 → model/shared？types.ts stage 概念？

## 闭合条件

- D-REG-1/2/3 锁 + 实体化
- emptyRegistry → 实体 registry（Loader/Compiler/Emitter 注册）
- compile-target compile 段 → registry 派发
- 行为 0：one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿
- 持久发现回流 architecture-notes
- STATUS / 导航一致
