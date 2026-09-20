# Acceptance — fe-tools-module-convergence

Status: **draft（2026-09-21）** — 伞级文档门；子门各有 A-*。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-MC0 | R-MC0 | graph stale edge/node 清理 + 增量 closure 一致；graph 成为可靠结构权威 | P-MC00 | pending |
| A-MC1 | R-MC1 | D-MC-1..5 在档；子门顺序 MC0→MC1→MC2→MC3；继承 D-MF-1 方案 A；词汇统一 Module | P-MC01 | pending |
| A-MC2 | R-MC2 | GraphNode 扩 code/sourcemap/deps；logic worker 回填；cache 退化 | P-MC02 | pending |
| A-MC3 | R-MC3 | view scriptRes → graph node；view Module 入图；compileResCache 退化 | P-MC03 | pending |
| A-MC4 | R-MC4 | BuildModel 从图派生；散装 entries 退居兼容；产物 diff=0 | P-MC04 | pending |
| A-MC5 | R-MC5 | 行为 0：每子门 nomap + sourcemap diff=0；全量 vitest 绿 | P-MC05 | pending |

## Non-acceptance

- 用 M2 `ModuleResultCache` 的半步资产冒充 MC1 全套收敛。
- 在本伞直接实施子门代码却无子门授权。
- 改 emit 字符串 / transform 语义 / runtime id（行为 0 禁线）。
- 跳过 MC0（graph 正确性）直接做 MC1。
