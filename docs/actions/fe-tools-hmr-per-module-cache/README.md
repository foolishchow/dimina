# FE Tools HMR Per-Module Cache（H3 子门）

- Action: `fe-tools-hmr-per-module-cache`
- Status: `ready`
- Updated: 2026-10-09
- Status authority: [Action Status](../STATUS.md)
- 父伞：[`fe-tools-hmr-compiler`](../fe-tools-hmr-compiler/README.md)（**`ready`**；H3 子门）
- 文档集：[requirements](requirements.md) · [design.draft](design.draft.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`
- 前置：H2 `complete`（registry 实体化——compile 路径经 registry 派发）

**⚠️ F6 补：H2→H3 依赖可放松**——H3（per-module cache 粒度）改 session-state + compileML/compileSS cache 逻辑，不依赖 H2（registry compile dispatch）。H2→H3 依赖是伞 D-HMR-1 默认跟踪序，但 H3 可与 H2 并行实施（cache 粒度独立于 compile dispatch）。

## 背景

HMR-compiler 伞 H3 子门。design.draft §1.3 新发现：G5 per-page-bundle cache（`ViewCompiledModule[]` 存完整有序 bundle）阻碍 per-module HMR——单组件 recompile → 全 bundle re-emit。H3 反转粒度（per-page-bundle → per-module），使单组件 recompile → 单 module emit。

**G5 P-G506 先例**：G5 原设计用 `graph.getDirectDependencies(page,'component')` 重建 sub 集——实证不可行（direct-only + 无 wxs + 序不一致 → cache-hit bundle 缺内容，base/pages_index.js b1=10525 vs b2=3049 字节）。G5 反转 D-G5-4' per-page-bundle（存原序 bundle 保字节一致）。H3 须**不同策略**（D-HMR-4）。

## Goal

view/style cache 从 per-page-bundle → per-module。单组件 recompile → 单 module cache 更新 → emit 时重建 bundle（须保字节一致）。

## Non-goals

- per-module HMR push（H4）
- logic cache 粒度（logic 已 per-module via ModuleResultCache）
-改 G5 per-page-bundle 设计（G5 complete，immutable）
- runtime HMR API

**⚠️ H3 反转 G5 D-G5-4' bridge**（F6 补）：H3 反转 G5 D-G5-4'（per-page-bundle → per-module）。G5 complete immutable——H3 **不重写 G5 docs**，靠 architecture-notes bridge（如 SMPU bridged D-SM-2/D-CN-1/D-CN-3 reversal）。H3 实施时 architecture-notes 记 D-G5-4' → D-PMC-1 演进链。

## Scope

```text
H3:  view cache per-page-bundle → per-module（ViewCompiledModule per moduleId）
     style cache per-page → per-module（StyleCompiledModule per moduleId）
     emit 时 bundle 重建（须保字节一致——D-HMR-4 策略）
不做: HMR push（H4）; logic cache; G5 设计改; runtime API
```

## Design inputs

- `session-state.ts:23` viewCache per-page-bundle（`Map<string, ViewCompiledModule[]>`）
- G5 P-G506 先例（graph 重建不可行）
- D-HMR-4（伞级）：须不同策略——① stored order metadata ② compile/emit 粒度解耦
- `view/index.ts` compileML（viewParseWalk → EmitModule[] → bundle）
- `style/index.ts` compileSS（per-page cache-hit skip）

## Readiness gaps

- **D-PMC-1 bundle 重建策略**（design.draft §1）：per-module 存储 + emit 时重建 bundle——序如何保？stored order metadata vs compile/emit 粒度解耦
- **D-PMC-2 invalidation 粒度**（design.draft §2）：per-module cache invalidation（单组件 dirty → 单 module cache-miss）vs G5 per-page-bundle invalidation（bundle 内任一 dirty → 全 bundle miss）
- **D-PMC-3 watch 字节恒等**（design.draft §3）：per-module 派生须保 bundle 字节一致（G5 P-G506 序重建风险）

## 闭合条件

- D-PMC-1/2/3 锁 + 实体化
- view/style cache per-module
- watch 字节恒等（per-module 派生 == per-page-bundle 字节一致）
- 行为 0：one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿
- 持久发现回流 architecture-notes
- STATUS / 导航一致
