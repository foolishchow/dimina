# fe-tools-ts-migration

- Action: `fe-tools-ts-migration`
- Status: `draft`
- Updated: 2026-09-16
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-worker-runtime`](../_archive/complete/fe-tools-worker-runtime/README.md)（worker-runtime 新增 9 .js 文件，触发全仓 TS 迁移动机）；`fe-tools-bundler-tsc-dist`（D-TD-20 .js→.ts 隐式映射限制 + tsc rewrite 配置）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md) · [research](research.md)
- 工作分支：`feature/fe-tools-sidecar`

## 背景

`src/compiler/` 下 41 个 `.js` 文件 vs 6 个 `.ts` 文件。.ts 仅 wxml-refactor/parser-dist/tsc-dist 等 Action 产物（wxml-ir.types.ts, parity.ts, registry.ts, compile-target.ts）。worker-runtime 新增 9 文件全 .js——照搬现状 .js 惯例 + D-TD-20 worker .ts 限制。

## 问题

- 新代码用 .js（worker-runtime 9 文件），与 TS 迁移趋势（wxml 相关 .ts）不一致
- 缺类型安全（41 .js 无类型注解，checkJs:false）
- D-TD-20 限制使 import 后缀混用复杂（.js import .ts 显式 .ts；.ts import .ts 用 .js tsc rewrite）

## 目标

`bundler/src/` 72 个 `.js` → `.ts`，import 后缀链路修正，行为 0 保证（diff=0 + 584/584 + tsc OK）。

## Non-goals

- 不改行为（diff=0）
- 不加类型注解（仅改名 + 后缀，类型注解留后续；checkJs 保持 false）
- 不改 `__tests__/`（测试文件留后续，D-TM-2 待拍板）
- 不改 `scripts/`、`crates/` 等 src 外

## 范围

`bundler/src/` 全部 72 .js：
- `src/compiler/` 41 .js（core/pipeline/view/logic/style/worker-runtime）
- `src/` 根 2（index.js 等）
- `src/bin/` 3
- `src/dev/` 5
- `src/model/` 6（build-model 等）
- `src/session/` 4
- `src/shared/` 8
- `src/watch/` 3

import 后缀修正（.js→.ts 显式，D-TD-20 tsc rewrite）。
worker-entry × 3 + worker-runtime × 6（worker strip-types 已注入）。

## 依赖

- D-TD-20（.js→.ts 隐式映射 + tsc rewriteRelativeImportExtensions）
- worker `--experimental-strip-types` execArgv（stage-channel/executor 已注入）

## 交付物

- 41 个 .ts 文件（替代 .js）
- import 后缀全链路修正
- 行为 0 证据（diff=0 + 584/584 + tsc）

## readiness gaps

- research.md 摸排：41 文件 import 依赖图 + 后缀策略 + 分阶段实施 + 行为 0 风险
- 待 review 收敛后升 ready
