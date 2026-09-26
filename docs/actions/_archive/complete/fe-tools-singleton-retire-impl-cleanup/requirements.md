# Requirements — fe-tools-singleton-retire-impl-cleanup

## R-SRC-1 — worker ctx 建立传全 optional + runtime caller 传 graph

worker ctx 建立传全 optional（graph/appId/component/configInfo/npmResolver/runtimeType/appInfo）+ view 补传 graph + runtime caller 传 graph。

## R-SRC-2 — 删 fallback ALS（完全迁移）

parse-walk × 3 + index × 3：ctx?.x ?? ALSGetter() → ctx!.x（ctx 必传）。

## R-SRC-3 — resetStoreInfo 4 处退役 + storeInfo wrapper 重构

resetStoreInfo 4 处 caller 删 + 函数删 + storeInfo wrapper 删 compat 写 6 条。

## R-SRC-4 — __tests__ 107 caller + getPages 21 caller 迁移

107 caller 改 ctx 直传 + 21 getPages caller 迁移 + getPages 函数删。

## R-SRC-5 — env.ts singleton 删

删 defaultCompilerContext + pathInfo/configInfo Proxy + 20 getters（L34 re-export 保留）。

## R-SRC-6 — 行为 0

tsc 0 + vitest 全绿 + 7-diff=0。
