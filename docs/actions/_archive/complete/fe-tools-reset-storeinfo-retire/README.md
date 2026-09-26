# Action — fe-tools-reset-storeinfo-retire

> **状态：complete**——6 轮 readiness review 收敛 + 行为 0 三件套 ✓——resetStoreInfo caller 退役 + emit.ts:142 迁 ctx + emit-engine 建 ctx。补走 readiness review。承接 cleanup-final D-SRC-2 + 是 env-singleton-delete 前置。

## Scope

resetStoreInfo 4 处 caller 退役 + emit.ts produceEntry/emitEntry 加 ctx + emit-engine 建 ctx + emitEntry caller 传 ctx + storeInfo wrapper compat 写保留。

## 文档

- [requirements.md](requirements.md)（R-RSR-1..4）
- [design.draft.md](design.draft.md)（D-RSR-1..3）
- [acceptance.md](acceptance.md)（A-RSR-1..4）
- [validation.md](validation.md)（V-RSR-1..6）

## 行为 0

tsc 0 + vitest 88/88 + 7-diff=0。
