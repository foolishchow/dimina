# FE Tools Bundler Typecheck

- Action: `fe-tools-bundler-typecheck`
- Status: `in_progress`
- Updated: 2026-09-15（授权 `in_progress`；基线见 validation Actual）
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-wxml-layout`](../_archive/complete/fe-tools-wxml-layout/README.md)；[`fe-tools-compiler-target`](../_archive/complete/fe-tools-compiler-target/README.md)；[`fe-tools-bundler-unvite`](../_archive/complete/fe-tools-bundler-unvite/README.md)（曾列 TS 迁移为 Non-goal）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

`@dimina/bundler` 是 ESM **JavaScript** + 选择性 JSDoc，`build` = `sync-dist` 镜像拷贝，**无** `tsc` / `tsconfig`。Document / WxmlRenderer / CompileTarget 等契约已靠注释与测例锚定，但：

1. **编辑器与 CI 无统一类型门禁**——错误字段/错误调用要靠测例或人工发现。
2. 整仓改 `.ts` 成本过高（与 unvite 镜像模型、行为 0 纪律冲突）；既往 Action 亦将「TypeScript 迁移」列为 Non-goal。
3. 需要的是 **`allowJs` + 核心 `// @ts-check` + CI `tsc --noEmit` 必过**，不是语言换皮。

## Goal

在 **不改运行时语义、不改 sync-dist emit 模型、不强制 rename `.ts`** 的前提下：

1. **S0**：为 bundler 增加 `tsconfig`（`allowJs` / `noEmit`）+ `typecheck` 脚本；CI 跑 `tsc --noEmit` **必过**。
2. **S1**：在 `src/compiler/` 范围内，对第一刀白名单文件开启 `// @ts-check`（含 `load/index.js`），补齐必要 JSDoc / typedef，使 typecheck 绿。

## Non-goals

- 整仓或 `compiler/**` 一次性全开 `checkJs`
- 把现有 `.js` rename 为 `.ts`；改 `sync-dist` 为 `tsc` emit
- `session` / `model` / `watch` / `dev` / `bin` 纳入本门 `include`（另立）
- S2/S3（`view/index.js`、`vue/tools.js`、style/logic/npm 等重灾区）本门不承诺绿
- 微信真源 / 产物语义变更；`fe/packages` 污染

## Residual risks

- 白名单文件 import 未 check 的模块时，类型可能退化为隐式 `any`——可接受；不得借机大改算法。
- `include: src/compiler/**` 会解析到域外（如 `shared/`）模块形状，**不保证**对其做 check。
- `strict: true` 可能迫使少量断言/`@ts-expect-error`（须注释理由，禁止无说明吞错）。

## 边界

```text
本 Action:  S0 脚手架 + S1 契约核（见 technical-design §1）
后续另立:  S2 管线壳；S3 重灾区；可选绿场 .ts 文件策略
```

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **S0** | tsconfig + typecheck 脚本 + CI 必过 | `tsc --noEmit` exit 0；CI 配置可指认 |
| **S1** | 白名单文件 `@ts-check` + typedef 够用 | 同命令绿；白名单可 grep；行为 0（vitest + 产物+sourcemap **MUST** diff=0） |

## 已确认设计输入（讨论收敛 · 2026-09-15）

| ID | 决策 |
| --- | --- |
| **D-TC-1** | `allowJs: true`；**不**做整仓 `.ts` 迁移 |
| **D-TC-2** | CI **`tsc --noEmit` 必过** |
| **D-TC-3** | 第一刀范围 = **`src/compiler/`**（S0 include）；非 compiler 轴另立 |
| **D-TC-4** | 全局 **`checkJs: false`**；核心文件用 **`// @ts-check`** |
| **D-TC-5** | S1 白名单含：`wxml/common/*`、`renderer/registry.js`、`renderer/stub.js`、`pipeline/compile-target.js`、**`load/index.js`** |
| **D-TC-6** | 运行时仍 JS；dist 仍 sync-dist；本门行为 0（产物+sourcemap MUST diff=0） |
| **D-TC-7** | `strict: true`（本门一次到位） |
| **D-TC-8** | `typescript` 为 **`@dimina/bundler` devDependency**；version range **与 `fe/package.json` 的 typescript 同 major/range 对齐**（当前 workspace 为 ^7） |
| **D-TC-9** | CI 接线：`.github/workflows/fe-tests.yml`，在既有 FE test job 中增加 bundler `typecheck`（与 `pnpm test` 并列，失败阻断） |
| **D-TC-10** | `WxmlRenderer` / `LoadedGraph`（及 S1 所需相关形状）用 **白名单内集中 typedef**（`common/` 或 `renderer` 旁路 `*.types.js` / 等价）；**不**以未 check 的 `vue/index.js` 为类型权威源；**不**为本门给 `vue/index.js` 开 `@ts-check` |

## 待定

无。

## Status / 授权

- 当前 **`in_progress`**：用户授权实施（2026-09-15）；D-TC-1..10 冻结；按 S0→S1 执行

## 闭合条件

- S0+S1 交付；A-\* 全 pass；CI typecheck 证据；architecture-notes 短回流（类型门禁不变量）
- STATUS/归档一致；`fe/packages` 零污染

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | formalize draft（allowJs + CI typecheck；S1 含 load/index.js） |
| 2026-09-15 | Review findings 全按建议：P-TC-1..3→D-TC-7..9；产物 diff MUST；集中 typedef D-TC-10；Residual 域外解析 → 升 `ready` |
| 2026-09-15 | 授权 **`in_progress`** |
