# Implementation Plan — fe-tools-module-convergence

Status: **draft（2026-09-21）** — 伞级规划。`draft` 不授权改产品代码；改 src 仅经子门 `in_progress`。

## 纪律

- 本伞不直接改 `fe/tools/bundler/src`。
- 子门必须另立 Action；本伞只跟踪子门状态。
- D-MF-4 纪律沿用：子门升 `ready` / `complete` 不自动改本伞 status。
- D-MC-* 需 review 冻结后本伞才升 `ready`。

## 步骤

| Step | 动作 | 状态 |
| --- | --- | --- |
| 1 | formalize 本伞 `draft` | **done**（2026-09-21） |
| 2 | 讨论冻结 D-MC-0（graph vs ModuleResult 职责边界）→ 选 A | **done**（2026-09-21） |
| 3 | MC3 拆为 MC3a（deriveFromGraph）+ MC3b（搬 emit，deferred）+ MC3c（view/style，deferred）；伞目标调整为「推进 Packer 形状」 | **done**（2026-09-21） |
| 4 | review 冻结剩余 D-MC-* → 升 `ready` | pending |
| 5 | formalize 子门 MC0（graph 正确性） | pending |
| 6 | MC0 实施 → complete | pending |
| 7 | formalize 子门 MC3a（deriveFromGraph） | pending |
| 8 | MC3a 实施 → complete | pending |
| 9 | 子门回流后更新本伞 roadmap；伞 close | pending |

## 子门依赖

```text
MC0 graph 正确性 ──► MC3a deriveFromGraph
```

MC0 是前置（图先正确才能从图派生）；MC3a 依赖 MC0（派生需要可靠的 GraphNode 结构）。
MC3b/MC3c/MC1/MC2 deferred。
