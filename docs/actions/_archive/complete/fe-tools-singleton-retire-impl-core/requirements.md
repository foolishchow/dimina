# Requirements — fe-tools-singleton-retire-impl-core

## R-SIC-1 — PackerContext 扩 optional

PackerContext 加 optional：graph/appId/component/configInfo/npmResolver + resolveAlias 闭包 appInfo。buildPackerContextFromOptions 扩。

## R-SIC-2 — ALS 残留 31 处迁移到 ctx 读

parse-walk × 3 + index × 3 ALS getter 改 ctx optional + fallback ALS（31 处）。

## R-SIC-3 — successPayload 3 处改 ctx.graph

define-engine 签名扩 + logic/view successPayload 改 ctx.graph + fallback ALS。

## R-SIC-4 — 行为 0

tsc 0 + vitest 全绿 + 7-diff=0。ctx optional + fallback ALS 渐进——行为 0。
