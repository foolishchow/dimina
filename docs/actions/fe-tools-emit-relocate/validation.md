# Validation — fe-tools-emit-relocate

Status: **draft（2026-09-21）**

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-ER01 | emit 不在 compile-worker | `logicCompile` 不调 `writeCompileRes`；grep 确认 | R-ER-1 | pending |
| P-ER02 | emit-worker 产出 EmitEntry | emit-worker 接收 params → `produceEntry` → postMessage(EmitEntry) | R-ER-2 | pending |
| P-ER03 | 主线程分组正确 | `getDependencyClosure` 分组 + filter 保序；main/sub 分组与当前一致 | R-ER-3 | pending |
| P-ER04 | 行为 0 | nomap + sourcemap 产物 diff=0 + 全量 vitest 绿 | R-ER-4 | pending |

## Uncovered

- `deriveFromGraph` 接入 production（deferred——module 顺序问题）
- view/style emit 搬迁（MC3c deferred）
- HMR patch 产物（另门）
- emit-worker 生命周期（D-ER-4 待讨论）

## Actual

| When | What |
| --- | --- |
| 2026-09-21 | 立项 `draft`：MC3b 从 convergence 伞 deferred → 独立立项。D-ER-0..3 已定（新 emit-worker / 打破 streaming / 只 logic / 主线程分组 B）。D-ER-4..6 待讨论。 |
