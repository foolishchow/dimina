# Action — fe-tools-fallback-als-delete

> **状态：complete**——6 轮 readiness review 收敛（R5+R6 连续 0-finding）+ 行为 0 三件套 ✓——删 fallback ALS 34 处（补走 readiness review）。承接 A5b 推迟的 D-SRC-1b。

## 背景

A5b 实证 D-SRC-1b 删 fallback 破坏 121 测试——根因：独立函数 caller 不传 ctx。前置 action（`fe-tools-style-parse-walk-ctx-leaf` + `fe-tools-view-parse-walk-ctx-deep` + `fe-tools-singleton-retire-cleanup-final` D-SCF-1-1）已完成独立函数迁 ctx——根因解决。本 action 删 fallback（ctx 必传——无 121 failed）。

## Scope

删 `ctx?.x ?? ALSGetter()` → `ctx!.x[!]`（5 文件 34 处）+ import 清理（5 文件未用 getter 删）。

## 文档

- [requirements.md](requirements.md)（R-FAD-1..3）
- [design.draft.md](design.draft.md)（D-FAD-1..2）
- [acceptance.md](acceptance.md)（A-FAD-1..3）
- [validation.md](validation.md)（V-FAD-1..6）

## 行为 0 三件套

tsc 0 + vitest 88/88（flaky solo pass）+ 7-diff=0。
