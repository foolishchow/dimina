# Validation — fe-tools-build-pipeline

Status: `draft`（计划；与 Acc Round 2 + RR 对齐；Result 实施时填）

**基线（RR3）：** 升 `in_progress` 时记下对照 HEAD SHA。

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-BP01 | 全量回归 | `npm test` in `fe/tools/bundler` | A-BP01 / A-BP02 | pending |
| P-BP02 | 字节等价 | 基线 vs HEAD，base 示例 nomap MUST；sourcemap SHOULD | A-BP02 | pending |
| P-BP03 | exports | `check-package-exports`；无新 Pipeline export；`build()` 仍为公开入口 | A-BP03 | pending |
| P-BP04 | Store 注入 / M-A 保持 | `options.store`：同引用；无 store：临时路径仍可 | A-BP04 | pending |
| P-BP05 | diff 范围 | 以 `build-pipeline` + `index.js` 委托为主；无 PS 主实现混入；分 PR；按次 | A-BP05 | pending |
| P-BP06 | CLI 冒烟（SHOULD） | build；可选 watch/dev | A-BP02 | pending |
| P-BP07 | Listr 仍在（审查） | BP1 实现仍经 Listr 跑阶段 | A-BP01 | pending |

消融：非必须。  
**RR1：** stages 权威见 [stages.md](./stages.md)（已迁；非本表 Result）。
