# FE Tools Bundler TSC Dist

- Action: `fe-tools-bundler-tsc-dist`
- Status: `in_progress`
- Updated: 2026-09-15（授权实施；基线 `33bda111`；D-TD-19 已先行合入；T0a→T0b→T1→T2）
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-bundler-typecheck`](../_archive/complete/fe-tools-bundler-typecheck/README.md)（**complete 已归档**；S0–S1 已合入 `eb3b2bc4`——CI `tsc --noEmit` + 白名单 `@ts-check` 在档）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

1. **类型写法不直观**：契约大量靠 JSDoc `@typedef`，跳转/泛型/阅读体验差；动机是要 **TS 语法写类型**，不是整目录改后缀。
2. **绿场无法安全写 `.ts`**：当前 `build` = `sync-dist` 只镜像文件；`.ts` 不会变成可运行的 `dist/**/*.js`。
3. **B2 决策**：dist 中 JS/TS 的权威生产者改为 **`tsc` emit**（`allowJs` 下既有 `.js` 也可 emit）；不再用 sync 镜像整树 `.js`。
4. **明确不做**：`compiler/` 或 `view/` **全量**改 `.ts`（尤其 `view/index.js`、`vue/tools.js`）。

## Goal

1. **B2 build**：`@dimina/bundler` 的 `build` 改为以 `tsc`（`tsconfig.build.json`）产出 `dist/` 中的 JS；**删除**整树 `sync-dist`（D-TD-13）；**保留** `postbuild`（`copy-sdk-assets` 等）。
2. **类型模块 TS 化（第 0 刀）**：`wxml-ir.types` / `compile-target.types`（及必要的 document 契约）改为 **`.ts`** 中的 `type`/`interface`。
3. **小实现迁 TS（第 1 刀）**：`registry` / `stub` / `compile-target` / `parity` 实现改为 `.ts`。
4. **绿场规则**：`src/compiler/` 下新建文件默认允许 `.ts`（随 B2 生效）。
5. **行为 0**：小程序编译产物（示例 app）code+sourcemap 相对基线 **MUST** diff=0；**不以**「dist 与旧 sync 逐字节相同」为 MUST。

## Non-goals

- `view/index.js`、`renderer/vue/tools.js`（及 live/state）、`vue/index.js` 整文件迁 `.ts`
- `document.js` / `document-ops.js` / `load/index.js` 本门 MUST 迁 `.ts`（**第 2 刀另立**）
- `napi/parse`、`cheerio/parse`、`style/`、`logic/`、`npm-*`、`session`/`watch`/`dev` 全量迁 `.ts`
- 本门强制打开 `declaration` 发布 `.d.ts` 包面
- 第一刀上 `tsc -b` 多 project（单 `tsconfig.build.json` 即可）
- 微信真源 / `fe/packages` 污染

## Residual risks

- `tsc` emit 既有 `.js` 可能导致 **dist 文本**与旧 sync 不同；验收锚定 **应用编译产物**，并记录 dist 差异类别（若有）。
- 与 typecheck Action：**本门有意改变 build 模型**；typecheck 的 CI `noEmit` 门禁保留。typecheck 文档已澄清「本门不永久锁定 sync」，B2 以本 Action 为准。
- Type-only `.ts` emit 空/极薄 `.js` 可接受（D-TD-16）。

## 边界

```text
本 Action:  B2 emit + 第0/1刀迁 .ts + 绿场政策
另立:       第2刀 document/ops/load；S3 view/vue-tools；多 project -b
```

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **T0** | build = tsc emit；删除整树 sync；保留 postbuild | `pnpm build` 后 dist 可加载；typecheck 仍绿 |
| **T1** | 第 0+1 刀路径为 `.ts`；绿场政策成文 | 文件树可对照；`tsc --noEmit` 绿 |
| **T2** | 行为 0 + 回流 | vitest 绿；示例产物 diff=0；architecture-notes 更新 |

## 已确认设计输入（讨论收敛 · 2026-09-15）

| ID | 决策 |
| --- | --- |
| **D-TD-1** | **B2**：dist 的 JS/TS **全交 `tsc` emit**（`allowJs`）；不以 sync 镜像整树 `.js` |
| **D-TD-2** | **不**做 compiler / view **全量** `.ts` 迁移 |
| **D-TD-3** | 动机 = 类型写法直观（`type`/`interface`）；优先迁类型模块与小实现 |
| **D-TD-4** | 第 0 刀：`*.types.ts`（自现 `wxml-ir.types.js` / `compile-target.types.js` 等） |
| **D-TD-5** | 第 1 刀 MUST：`registry` / `stub` / `compile-target` / `parity` → `.ts` |
| **D-TD-6** | 第 2 刀（document / document-ops / load）**另立**，非本门 MUST |
| **D-TD-7** | 明确不迁：`view/index.js`、`vue/tools*`、`vue/index.js` |
| **D-TD-8** | 绿场：`src/compiler/` 新文件默认可 `.ts` |
| **D-TD-9** | 行为 0 = **应用编译产物** diff=0；dist 字节与旧 sync 对齐非 MUST |
| **D-TD-10** | 第一刀：单项目 `tsconfig.build.json`；**不开** `declaration`；**不上** `tsc -b` |
| **D-TD-11** | import 约定 NodeNext：源码写 `from './foo.js'`，实现可为 `foo.ts` |
| **D-TD-12** | 依赖 typecheck 门禁保留；本门改 build；建议 typecheck **Close 后再实施本门**（或同分支串行，先合 typecheck 交付） |
| **D-TD-13** | **删除**整树 `sync-dist-from-src`（`src` 当前无非 JS；整树镜像职责退役）；**保留** `postbuild` 链（`copy-sdk-assets` + `check-package-exports`） |
| **D-TD-14** | emit 范围 = 整棵 **`src/**`**（`rootDir: src`，`outDir: dist`）；与今日 sync / `files`/`exports` 同构；**不** emit `scripts/` |
| **D-TD-15** | typecheck `include` **对齐**全 `src/`；保持 `checkJs: false`；仅 `@ts-check` / `.ts` 报类型错（不对齐全仓强制 checkJs） |
| **D-TD-16** | 仅 `export type`/`interface` 的模块 emit 出空/极薄 `.js` **可接受**；消费方 `import type` |
| **D-TD-17**（R1-F1） | T0 前置：`napi/parse.js` 的 6 级相对 import `../../../../../../wxml-parser-napi/index.js` 改为**包名 import `@dimina/wxml-parser-napi`**（pnpm workspace 解析）并加入 `dependencies`——修复 TS5055（tsc emit 将 src 外文件纳入 program 输出重叠）**及** npm 发布后相对路径本就失效的隐疾；NodeNext 解析走 node_modules 不进 program |
| **D-TD-18**（R1-F2） | T0 前置：package.json `exports` 三个子路径（`./view-compiler` / `./logic-compiler` / `./style-compiler`）**重映射到 layering 后路径**（`./dist/compiler/view/index.js` 等）**或删除**（repo 内唯一消费方是 `check-package-exports.js` 自身）；`check-package-exports.js` 同步——修复 `npm run build` postbuild 必炸的 pre-existing 破损。**处置（删 vs 留）实施时与用户确认** |
| **D-TD-19**（R1-F3） | 独立热修（不属本门）：`sync-compatibility-reference.js` outputPath 改 `src/compiler/core/compatibility-reference.js`（layering 漂移；`npm test` pretest 当前必炸）；建议在本门授权前先行合入 |

## 待定

无。

## Status / 授权

- 当前 **`in_progress`**（2026-09-15 授权）：基线 `33bda111`；D-TD-19 已先行合入（`npm test` 绿）；T0a（D-TD-17/18 前置修复）→ T0b（build 改道）→ T1a/T1b（迁 ts）→ T2（行为 0 + 消融）

## 闭合条件

- T0–T2 交付；A-\* 全 pass；architecture-notes 回流（B2 + 迁徙边界）
- STATUS/归档一致；`fe/packages` 零污染

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | formalize draft（B2 tsc dist + 第0/1刀迁 ts；view/compiler 全量否） |
| 2026-09-15 | Review Finding 1：P-TD-1 → **D-TD-13**（删整树 sync、留 postbuild） |
| 2026-09-15 | P-TD-2/3 按建议 → **D-TD-14/15**；升 **`ready`** |
| 2026-09-15 | Readiness findings 修：typecheck 跨文档债；D-TD-16 type-only emit；R-TD1 第0刀范围收紧 |
| 2026-09-15 | **授权 `in_progress`**（基线 `33bda111`）；D-TD-19 热修先行合入 |
| 2026-09-15 | **Review R1（F1–F5）**：❶ **TS5055 硬阻断**（dry-run 实证：`napi/parse.js` 6 级相对 import 令 tsc emit exit 1、只出 49/69、bin/ 全缺）→ D-TD-17（包名 import）；❷ **`npm run build` pre-existing 破损**（exports 三子路径指 layering 前旧文件，postbuild `ERR_MODULE_NOT_FOUND` exit 1）→ D-TD-18；❸ **`npm test` pretest 同样必炸**（compat sync outputPath 漂移）→ D-TD-19 独立热修；❹ dist 重排版实测（ESM 下 shebang 保留 ✓、补分号非逐字节）——D-TD-9 已覆盖，P-TD00 补 CLI --version 门；❺ README 前置描述过时修正 |
