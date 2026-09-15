# Requirements — fe-tools-bundler-tsc-dist

Status: **冻结（2026-09-15）** — D-TD-1..16 已拍板；随 Action `ready`。

## R-TD0（MUST）B2 build

- `build` 使用 `tsc` + `tsconfig.build.json`（`allowJs`、emit 至 `dist/`，`rootDir: src` / `outDir: dist`，与现 `exports` 同构）（D-TD-14）。
- **删除**整树 `sync-dist-from-src`（D-TD-13）；**保留** `postbuild`（`copy-sdk-assets` + `check-package-exports`）。
- `pnpm typecheck`（`tsc --noEmit`）保持 CI 必过；`include` **对齐**全 `src/`，`checkJs: false`（D-TD-15）。

## R-TD1（MUST）第 0 刀类型模块

- **MUST**：将现有 `wxml-ir.types.js`、`compile-target.types.js` 改为 **`.ts`**，以 `type` / `interface`（及 `export type`）为权威；停止以纯 JSDoc `*.types.js` 为权威。
- **非 MUST**：不要求本门另抽 `document.types.ts`；Document 相关形状可继续由 `document.js` 既有 typedef + `wxml-ir.types.ts` 引用覆盖，直至第 2 刀另立。
- 白名单/迁徙消费方改为引用这些 TS 类型模块（运行时无值或 `export type` only）。

## R-TD2（MUST）第 1 刀实现迁徙

以下实现改为 `.ts`（路径相对 `src/compiler/`）：

| 原 | 目标 |
| --- | --- |
| `view/wxml/renderer/registry.js` | `registry.ts` |
| `view/wxml/renderer/stub.js` | `stub.ts` |
| `pipeline/compile-target.js` | `compile-target.ts` |
| `view/wxml/common/parity.js` | `parity.ts` |

语义不变；仅语言/类型面迁移。

## R-TD3（MUST）行为 0 与污染

- 全量 vitest 通过；`fe/packages` 零改动。
- 相对实施基线：示例 app（`examples/miniprogram/base`）产物 code+sourcemap **MUST** diff=0（D-TD-9）。
- dist 与旧 sync 文本 diff **非** MUST；若存在须在 validation 记录类别。

## R-TD4（MUST）范围纪律

- **禁止**本门迁 `view/index.js`、`renderer/vue/tools.js`、`vue/index.js`（D-TD-7）。
- **禁止**把第 2 刀（document / document-ops / load）塞进本门 MUST（D-TD-6）。
- 绿场政策成文：`src/compiler/` 新文件允许 `.ts`（D-TD-8）。

## R-TD5（MUST）证据与回流

- 消融：临时去掉 build 中 tsc emit（无 sync 可回退）→ dist 缺产物或入口加载失败 → 恢复通过（Experience §6）。
- architecture-notes 短回流：B2 生产者（tsc emit）、已删整树 sync、postbuild 保留、迁徙边界、绿场规则。
