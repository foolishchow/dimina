# Requirements — fe-tools-build-pipeline

Status: **冻结（Final Readiness · FR4 · 2026-09-12）** — 与 design v1 / acceptance / stages 对齐

## R-BP1（MUST）BuildPipeline 模块

存在 `fe/tools/bundler/src/compiler/build-pipeline.js`：可 `createBuildPipeline` / `run`（或等价），表达今日 runBuild 的 init / concurrent compile / publish 阶段；**BP1 仍用 Listr**（P6）；阶段表按 [stages.md](./stages.md) 等价抽出（并发/skip 不变）。

## R-BP2（MUST）行为 0 变化

相对约定基线：全量 vitest 绿；nomap 字节等价 MUST；CLI build/watch/dev 可观察语义不变。CLI 冒烟 SHOULD。A1 lifecycle **零改语义（RR9）**。

## R-BP3（MUST）门面

对外编译入口仍为 `build()`（P6）；Pipeline **不**作为稳定 package exports。

## R-BP4（MUST）Store 注入可选 · **保持** M-A

有 ProjectStore 则经 **`options.store`（RR4）** 注入并 **保持** `Object.is(ctx.dependencyGraph, store.getDependencyGraph())`（**RR6**）；无则 `build()` 内临时 createStore（L3）或与 PS1 对齐的临时路径。**不硬依赖** PS1 已合并（P5）。PS1 仅挂 ctx **不算**本门交付（R2）。**FR2**：`build:start` 仍须剥 `store`。

## R-BP5（MUST）范围切割

**不**实现 ProjectStore 壳（兄弟）；**不**做 PS2 删闭包；**不**改 compile-cache（R4）；**不**改 preview 协议；**不**与 PS1 同一 PR（P5）。Pipeline **按次**（不挂 session 跨 rebuild 长活）。

## Non-requirements

- BP2 Listr 解耦  
- 插件 / replaceStage  
- graphDelta；TS-2；SAB  

## Stages 权威（RR1）

[stages.md](./stages.md) 为本门 inventory 权威；迁表 ≠ BP1 已交付。
