# fe-tools-ts-migration

- Action: `fe-tools-ts-migration`
- Status: `complete`
- Updated: 2026-09-16
- Status authority: [Action Status](../../../STATUS.md)
- 前置上下文：[`fe-tools-worker-runtime`](../fe-tools-worker-runtime/README.md)（worker-runtime 新增 9 .js 文件，触发全仓 TS 迁移动机）；`fe-tools-bundler-tsc-dist`（D-TD-20 .js→.ts 隐式映射限制 + tsc rewrite 配置）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md) · [research](research.md)
- 工作分支：`feature/fe-tools-sidecar`

## 背景

`bundler/src/` 下 72 个 `.js` 文件 vs 6 个 `.ts` 文件。.ts 仅 wxml-refactor/parser-dist/tsc-dist 等 Action 产物（wxml-ir.types.ts, parity.ts, registry.ts, compile-target.ts）。worker-runtime 新增 9 文件全 .js——照搬现状 .js 惯例 + D-TD-20 worker .ts 限制。

## 问题

- 新代码用 .js（worker-runtime 9 文件），与 TS 迁移趋势（wxml 相关 .ts）不一致
- 缺类型安全（72 .js 无类型注解，checkJs:false）
- D-TD-20 限制使 import 后缀混用复杂（.js import .ts 显式 .ts；.ts import .ts 用 .js tsc rewrite）
- **R1 POC 证伪**：.js→.ts 纯改名不可行——tsc 对 .ts 强制类型检查，JSDoc `@typedef` 在 .ts 失效，隐式 any 报错 → tsc build 失败（详见 [research §6](research.md)）

## 目标

`bundler/src/` 72 个 `.js` → `.ts`，import 后缀链路修正，JSDoc → TS type 完善类型注解（不用 any），行为 0 保证（diff=0 + 584/584 + tsc OK）。

## Non-goals

- 不改行为（diff=0）
- 不用 any（JSDoc→TS type 完善类型，不用 `any` 或 `noImplicitAny:false` 放宽）
- 不改 `__tests__/` 逻辑（仅改 import 后缀，D-TM-2 scope 内）
- 不改 `scripts/`、`crates/` 等 src 外
- 不改行为（产物字节一致）

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

**类型完善（D-TM-4 = 选项 B）**：JSDoc → TS type
- 9 个 `@typedef` → TS `type`/`interface`（4 文件：document/document-ops/emit/napi-parse）
- 361 个 `@param/@returns` → TS 函数签名注解
- 隐式 any → 推断或显式类型（不用 `any`，不用 `noImplicitAny:false` 放宽）

## 依赖

- D-TD-20（.js→.ts 隐式映射 + tsc rewriteRelativeImportExtensions）
- worker `--experimental-strip-types` execArgv（stage-channel/executor 已注入）

## 交付物

- 72 个 .ts 文件（替代 .js）
- import 后缀全链路修正
- JSDoc → TS type 类型完善（9 @typedef + 361 @param/@returns）
- 行为 0 证据（diff=0 + 584/584 + tsc）

## readiness gaps

- 已 **ready**（R1-R26 全收敛：R22 F66 终检 + R25 F72 验证脚本 + R26 F73 流程终检）
- V-TM00..08 验证流程完整闭环
- 类型化难点 9 类全列（F37~F71）
- 待授权实施（P-TM00 → P-TM08）

## 交付摘要

**72 .js → .ts 全量迁移完成**（src/compiler 41 + shared/model/session/watch/dev/bin/根 31）。import 后缀全链路显式 .ts。行为 0（4 组 diff=0 + 584/584 + tsc 0 错）。

**深度类型化**（TH-1~9 + 续）：274→29 硬类型断言（89.4% 消除）；`as never`/`as Error`/`as any`/`: any`/`: Function` 全清零。剩余 29 处为 TS 语言限制（Proxy key、unknown→Record 无索引签名）或第三方库类型问题。

**lint 增强**：tsconfig 新增 5 类 strict lint 选项（`noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch`/`noImplicitReturns`/`noImplicitOverride`）；35 处存量 lint 问题全修复。tsc build 自动执行 lint 检查，0 错。

**@ts-expect-error**：556→3（99.5% 清理）。剩 3 个在 config-compiler.ts（TS 7.0.2 type narrowing 边缘 case）。

**新增类型/接口**：`ConfigInfo`/`PathInfo`/`PageConfig`/`ComponentConfig`（env.ts）、`RendererAdapter`（build-pipeline.ts）、`EnhancedError`/`StyleCompileError`/`HttpProxyError`/`errorMessage()`/`errorStack()`（shared/utils.ts）、`ErrorShape`（view/index.ts）、`ComparisonNode`（parity.ts）、`AstNode`（logic/index.ts）、`GraphSnapshot`（dependency-graph.ts）、ambient `less.d.ts`。

Close 复验 commit `b124f84c`：tsc 0 错 + 584/584 + 4 组 diff=0。

剩余技术债记录于 TODO「Bundler lint 增强」候选（noUncheckedIndexedAccess 63 错 / ESLint 语义规则 / forceConsistentCasingInFileNames）。

## 决策状态

| 决策 | 状态 | 备注 |
| --- | --- | --- |
| D-TM-1 | **已定** | 方案 A（显式 .ts，POC 验证 tsc 0 错 + dist rewrite）|
| D-TM-2 | **已定** | scope 内（__tests__ import .js→.ts 同步）|
| D-TM-3 | **已定** | 分阶段 core+shared→worker-runtime→pipeline+model+session+watch→view+logic+style→bin+dev+根 + 跨 import 后缀修正 |
| D-TM-4 | **已定** | 选项 B（JSDoc→TS type，不用 any）|
