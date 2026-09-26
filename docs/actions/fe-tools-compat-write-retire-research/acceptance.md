# Acceptance — fe-tools-compat-write-retire-research

## A-CWR-1 — source-audit 6 section

source-audit.md 含 6 section（compat 写 6 条 + 112 caller + getPages 22 caller + worker resetStoreInfo 4 处 + ALS 残留 ~32 处 + A5 scope 评估）。

## A-CWR-2 — design D-CWR-1..6

design.draft.md 含 D-CWR-1..6（env.ts 退役 + storeInfo 重构 + worker resetStoreInfo 退役 + parse-walk ALS 残留退役 + __tests__ 迁移 + 迁移顺序）。

## A-CWR-3 — 跨权威一致性

design §4 跨权威一致性注记（A0/A2/A3 + D-PCS-1/D-LR-3）。

## A-CWR-4 — 行为 0

git diff = 0（研究性——无代码改动）。
