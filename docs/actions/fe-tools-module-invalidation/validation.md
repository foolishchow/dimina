# Validation — fe-tools-module-invalidation

Status: **草案（随 Action `ready`）**

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-IV00 | D-MF-1 继承 | 对照伞 TD 与本 TD §1 七条；README Non-goals | A-IV0 | **pass**（2026-09-19） |
| P-IV01 | 决策冻结 | D-IV-1..9 成文；待定节为空；Goal=`string[]` | A-IV1 | **pass**（2026-09-19） |
| P-IV02 | 单测矩阵 | 手搓图测例 5 案（对齐 TD §2.2 + D-IV-3）：共享 JS / page.js / wxml / **component.js（验 D-IV-6：moduleId 进集、页 moduleId 不进集）** / **未知文件 → [] 不抛（验 D-IV-3）** | A-IV2 | pending |
| P-IV03 | 落点 / 边界 | Graph 方法 + `invalidation.ts`；`fe/packages` 空 diff | A-IV3 | pending |
| P-IV04 | 行为 0 | 仅加法 API；既有 vitest 绿 | A-IV4 | pending |

## Uncovered

- M2 缓存消费本 API：另 Action。
- watch / compile-cache 接线：明确不做（D-IV-4）。

## Actual

| When | What |
| --- | --- |
| 2026-09-19 | T1–T7 → D-IV-1..9；P-IV01 / A-IV1 pass。 |
| 2026-09-19 | review findings 修复：Goal=`string[]`；requirements 对齐 D-IV；P-IV00 / A-IV0 pass；Uncovered 改 D-IV-4。Action 仍 `draft`。 |
| 2026-09-20 | review F1–F4 修复：P-IV02 + A-IV2 补 component 案（F1）；D-IV-1 注结构类型（F2）；D-IV-9 改 dependency-graph.spec.js（F3）；plan 步 5 细化 IV1 序（F4）。复验 pass-with-findings → 无非阻塞项。 |
| 2026-09-20 | review R2 F1–F4 修复：R-IV2 补 component + 未知文件案（F1/F4 源头）；D-IV-1 参数名 files→changedFiles（F2）；README Updated 日期（F3）；A-IV2/P-IV02 补未知文件案（F4）。复验 pass。 |
| 2026-09-20 | review R3 F1–F2 修复：plan 步 5 案数 4→5 + 引用补 D-IV-3（F1）；TD §2.1 伪代码删死 owners 行 + 显式定义 file（F2）。复验 pass。 |
| 2026-09-20 | **升 `ready`**（用户授权）；6 轮 readiness review 收敛（4→4→2→1→1→0）。validator 0/0。升 `in_progress` 另授。 |
