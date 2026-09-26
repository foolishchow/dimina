# Acceptance — fe-tools-singleton-retire-impl-core

## A-SIC-1 — PackerContext 扩 optional 实施

types.ts PackerContext 加 5 optional 字段 + config-fixpoint buildPackerContextFromOptions 扩 + 注释修改。

## A-SIC-2 — ALS 残留 31 处迁移实施

parse-walk × 3 + index × 3 ALS getter 改 ctx optional + fallback ALS（31 处）。

## A-SIC-3 — successPayload 3 处改 ctx.graph 实施

define-engine 签名扩 + logic/view successPayload 改 ctx.graph + fallback ALS。

## A-SIC-4 — 行为 0 三件套

tsc 0 + vitest 全绿 + 7-diff=0。
