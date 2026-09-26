# Acceptance — fe-tools-singleton-retire-impl-cleanup

## A-SRC-1 — worker ctx 建立传全 optional 实施

logic/view/style index.ts worker ctx 建立传全 optional + view 补传 graph + runtime caller 传 graph。

## A-SRC-2 — 删 fallback ALS 实施

parse-walk × 3 + index × 3 删 fallback ALS（ctx 必传）。

## A-SRC-3 — resetStoreInfo 退役 + storeInfo wrapper 重构

resetStoreInfo 4 处 caller 删 + 函数删 + storeInfo wrapper 删 compat 写。

## A-SRC-4 — 测试迁移

107 __tests__ caller + 21 getPages caller 迁移 + getPages 函数删。

## A-SRC-5 — env.ts singleton 删

env.ts 删 singleton + Proxy + 20 getters（L34 re-export 保留）。

## A-SRC-6 — 行为 0 三件套

tsc 0 + vitest 全绿 + 7-diff=0。
