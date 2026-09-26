# Requirements — fe-tools-compat-write-retire-research

## R-CWR-1 — storeInfo wrapper compat 写审计

审计 storeInfo wrapper compat 写 6 条 load-bearing 消费方（dist-preparer/npm-builder/worker resetStoreInfo/测试 fixture）。

## R-CWR-2 — 112 caller 分布审计

审计 storeInfo wrapper caller 分布（src 0 + __tests__ 107 + env.ts 3）。

## R-CWR-3 — getPages caller 审计

审计 getPages caller 分布（22 文件——A5 前置门控）。

## R-CWR-4 — ALS 残留 getter 审计

审计 A1-A3 parse-walk ALS 残留 getter（~32 处——logic 19 + view 8 + style 5）。

## R-CWR-5 — A5 迁移规划

产出 A5 singleton/Proxy 退役迁移规划（D-CWR-1..6）。

## R-CWR-6 — 行为 0

研究性——无代码改动（git diff = 0）。
