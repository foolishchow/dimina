# FE Tools Bundler Typecheck

- Action: `fe-tools-bundler-typecheck`
- Status: `complete`
- Updated: 2026-09-15（S0–S1 交付 `eb3b2bc4`；A-TC0..4 / P-TC00..07 全 pass；Close 复验 580/580 + diff=0；归档）
- Status authority: [Action Status](../../../STATUS.md)
- 前置：[`fe-tools-wxml-layout`](../fe-tools-wxml-layout/README.md)；[`fe-tools-compiler-target`](../fe-tools-compiler-target/README.md)；[`fe-tools-bundler-unvite`](../fe-tools-bundler-unvite/README.md)（曾列 TS 迁移为 Non-goal）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

`@dimina/bundler` 是 ESM **JavaScript** + 选择性 JSDoc，`build` = `sync-dist` 镜像拷贝，**无** `tsc` / `tsconfig`。Document / WxmlRenderer / CompileTarget 等契约已靠注释与测例锚定，但：

1. **编辑器与 CI 无统一类型门禁**——错误字段/错误调用要靠测例或人工发现。
2. 整仓改 `.ts` 成本过高（与 unvite 镜像模型、行为 0 纪律冲突）；既往 Action 亦将「TypeScript 迁移」列为 Non-goal。
3. 需要的是 **`allowJs` + 核心 `// @ts-check` + CI `tsc --noEmit` 必过**，不是语言换皮。

## Goal

在 **不改运行时语义、不强制 rename `.ts`** 的前提下（本门交付期内 dist 仍可为 sync；**build 改 tsc emit 另见** [`fe-tools-bundler-tsc-dist`](../../../fe-tools-bundler-tsc-dist/README.md)）：

1. **S0**：为 bundler 增加 `tsconfig`（`allowJs` / `noEmit`）+ `typecheck` 脚本；CI 跑 `tsc --noEmit` **必过**。
2. **S1**：在 `src/compiler/` 范围内，对第一刀白名单文件开启 `// @ts-check`（含 `load/index.js`），补齐必要 JSDoc / typedef，使 typecheck 绿。

## Non-goals

- 整仓或 `compiler/**` 一次性全开 `checkJs`
- 本门把现有 `.js` rename 为 `.ts`（选择性迁 ts / B2 emit → [`fe-tools-bundler-tsc-dist`](../../../fe-tools-bundler-tsc-dist/README.md)）
- 本门改 `sync-dist` 为 `tsc` emit（同上另立；**非**本门永久禁止全局改 build）
- `session` / `model` / `watch` / `dev` / `bin` 纳入本门交付时的 `include`（tsc-dist 可将 typecheck include 扩至全 `src/`）
- S2/S3（`view/index.js`、`vue/tools.js`、style/logic/npm 等重灾区）本门不承诺绿
- 微信真源 / 产物语义变更；`fe/packages` 污染

## Residual risks

- 白名单文件 import 未 check 的模块时，类型可能退化为隐式 `any`——可接受；不得借机大改算法。
- 本门交付时 `include` 以 `src/compiler/**` 为主；域外（如 `shared/`）模块形状不保证被 check。
- `strict: true` 可能迫使少量断言/`@ts-expect-error`（须注释理由，禁止无说明吞错）。
- **Build 模型**：本门 Close 时 dist 仍可能是 sync；**后续权威**以 [`fe-tools-bundler-tsc-dist`](../../../fe-tools-bundler-tsc-dist/README.md)（B2：tsc emit、删 sync）为准。

## 边界

```text
本 Action:  S0 脚手架 + S1 契约核（CI noEmit typecheck）
后续另立:  fe-tools-bundler-tsc-dist（B2 emit + 选择性 .ts）；S2/S3 加深 check
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
| **D-TC-6** | 本门交付：运行时仍 JS；**dist 生产者在本门内不改**（交付时可为 sync）；行为 0（产物+sourcemap MUST diff=0）。**B2 tsc emit / 删 sync** 移交 [`fe-tools-bundler-tsc-dist`](../../../fe-tools-bundler-tsc-dist/README.md) |
| **D-TC-7** | `strict: true`（本门一次到位） |
| **D-TC-8** | `typescript` 为 **`@dimina/bundler` devDependency**；version range **与 `fe/package.json` 的 typescript 同 major/range 对齐**（当前 workspace 为 ^7） |
| **D-TC-9** | CI 接线：`.github/workflows/fe-tests.yml`，在既有 FE test job 中增加 bundler `typecheck`（与 `pnpm test` 并列，失败阻断） |
| **D-TC-10** | `WxmlRenderer` / `LoadedGraph`（及 S1 所需相关形状）用 **白名单内集中 typedef**（`common/` 或 `renderer` 旁路 `*.types.js` / 等价）；**不**以未 check 的 `vue/index.js` 为类型权威源；**不**为本门给 `vue/index.js` 开 `@ts-check` |

## 待定

无。

## Status / 授权

- 终局 **`complete`**（2026-09-15）：S0–S1 交付（tsconfig + CI `tsc --noEmit` + 七文件 `@ts-check` + 集中 typedef）；A-TC0..4 / P-TC00..07 全 pass；580/580 + nomap/sourcemap diff=0；归档

## 闭合条件

- S0+S1 交付；A-\* 全 pass；CI typecheck 证据；architecture-notes 短回流（类型门禁不变量） ✅
- STATUS/归档一致；`fe/packages` 零污染 ✅（待 Close 归档）

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | formalize draft（allowJs + CI typecheck；S1 含 load/index.js） |
| 2026-09-15 | Review findings 全按建议：P-TC-1..3→D-TC-7..9；产物 diff MUST；集中 typedef D-TC-10；Residual 域外解析 → 升 `ready` |
| 2026-09-15 | 授权 **`in_progress`** |
| 2026-09-15 | **S0–S1 交付**：tsconfig/strict/CI；七文件 `@ts-check`；集中 typedef；580/580；相对 `8b024b78` diff=0；消融 ✓；architecture-notes 回流 |
| 2026-09-15 | Readiness 跨 Action 债：澄清本门不永久锁定 sync；B2/迁 ts 移交 `fe-tools-bundler-tsc-dist`（修 D-TC-6 / Non-goals） |
| 2026-09-15 | **Close：S0–S1 交付**（`eb3b2bc4`）——typecheck exit 0；580/580；nomap 94/94 + sm 185/185 diff=0 vs `8b024b78`；A-TC0..4 全 pass；升 `complete` 归档 |
