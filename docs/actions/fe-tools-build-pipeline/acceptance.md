# Acceptance — fe-tools-build-pipeline

Status: **BP1 已交付（2026-09-12）** — Evidence 已填；审查后可归档

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-BP01 | R-BP1 | 存在 `src/compiler/build-pipeline.js`；`createBuildPipeline` / `run`（或等价）；`runBuild`/`build` 经 Pipeline.run（或薄委托）；**BP1 仍用 Listr（P6）**；阶段表自过程体等价抽出（并发/skip 条件不变） | P-BP01/P-BP07 + 源码 | **pass** — createBuildPipeline({store, lifecycle}).run(); index.js 20 行薄委托；Listr 阶段表等价搬入 |
| A-BP02 | R-BP2 | vitest 全绿；nomap 相对基线 diff=0；CLI build/watch/dev 冒烟 **SHOULD** | P-BP01 / P-BP02（+ CLI 若做） | **pass** — 481 全绿；nomap 94 / sourcemap 185 diff=0（对照 aa6b6508）；base 工程 build 冒烟通过 |
| A-BP03 | R-BP3 | package exports **无** Pipeline 子路径；公开编译入口仍为 `build()`（P6） | P-BP03 + 源码 | **pass** — check-package-exports 6 exports 校验通过；build() 仍唯一公开入口 |
| A-BP04 | R-BP4 | **保持** M-A（非本门独创交付）：注入 store 时 `Object.is(ctx.dependencyGraph, store.getDependencyGraph())`；无 store 时临时 createStore（L3）或与 PS1 对齐的临时路径仍可用。PS1 仅在 runBuild 挂 ctx **不算**本门已交付（R2） | P-BP04 | **pass** — store 注入与缺省两路径均绿；M-A 由 PS1 + 本门 keep（ctx.dependencyGraph = store.getDependencyGraph() 保持） |
| A-BP05 | R-BP5 | diff 以 `build-pipeline` + `index.js` 委托为主；**无** ProjectStore 主实现、**无** PS2、**无** cache 算法大改；与 PS1 **分 PR（P5）**；Pipeline **不**挂在 session 上跨 rebuild 长活（按次 · 源码审查） | P-BP05 + git | **pass** — diff 仅 pipeline+index.js+STATUS；与 PS1（aa6b6508）分 PR；pipeline 按次实例不长活 |

## Non-acceptance（本门不验）

| 项 | 说明 |
| --- | --- |
| ProjectStore 壳 / 刀 A | 兄弟门 |
| BP2 Listr 解耦；插件 / replaceStage | 后续 |
| compile-cache | R4 |

## Notes

- 阶段权威表：[stages.md](./stages.md)（**RR1 已迁**；迁表 ≠ BP1 交付）。  
- 首刀等价抽取；仍用 Listr。  
- 消融：非必须（结构搬迁）；行为 0 以 P-BP01/02 为主证据。  
- Evidence 列以 `P-BP*` 为主。  
- 设计已冻结 v1；Action **`ready`**；实施须升 `in_progress`。
