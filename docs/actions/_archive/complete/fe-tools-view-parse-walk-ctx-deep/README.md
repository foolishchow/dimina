# Action — fe-tools-view-parse-walk-ctx-deep

> **状态：complete**——6 轮 readiness review 收敛 + 行为 0 三件套 ✓——view parse-walk 递归 caller 链 + wxml/load 跨层透传 + A2 deviation 撤回。补走 readiness review。承接 cleanup-final D-SCF-1-1 推迟 + 是 fallback-als-delete 前置。

## 背景

cleanup-final D-SCF-1-1 推迟 view parse-walk 迁（递归 caller 链 + A2 deviation 阻塞）。

## Scope

compileModule/tryModuleCache/mergeWxsModules/collectAllWxsModules 加 ctx（递归 caller 链）+ toCompileTemplate/loadTemplates 跨层透传 + processIncludedFileWxsDependencies 加 ctx + A2 deviation D-VPM-dev1 撤回。

## 文档

- [requirements.md](requirements.md)（R-VPD-1..4）
- [design.draft.md](design.draft.md)（D-VPD-1..3）
- [acceptance.md](acceptance.md)（A-VPD-1..4）
- [validation.md](validation.md)（V-VPD-1..6）

## 行为 0

tsc 0 + vitest 88/88 + 7-diff=0。
