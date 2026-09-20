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
| 2 | review 冻结 D-MC-0..5 → 升 `ready` | pending |
| 3 | formalize 子门 MC0（graph 正确性） | pending |
| 4 | MC0 实施 → complete | pending |
| 5 | formalize 子门 MC1（GraphNode code） | pending |
| 6 | MC1 实施 → complete | pending |
| 7 | formalize 子门 MC2（view Module 入图） | pending |
| 8 | MC2 实施 → complete | pending |
| 9 | formalize 子门 MC3（BuildModel 派生） | pending |
| 10 | MC3 实施 → complete | pending |
| 11 | 子门回流后更新本伞 roadmap；伞 close | pending |

## 子门依赖

```text
MC0 graph 正确性 ──► MC1 GraphNode code ──► MC2 view 入图 ──► MC3 BuildModel 派生
```

MC0 是前置（图先正确才能放 code）；MC1 依赖 MC0（code 上图前图须正确）；MC2 依赖 MC1（view node 需要 code 字段）；MC3 依赖 MC1+MC2（派生需要全量 Module 在图）。
