# Requirements — fe-tools-parse-walk-extract

## 问题

`fe-tools-emit-transform-split`（complete 归档）交付了三车道 `parse+walk → transform → emit` 文件结构，但实施结果有三层"名不副实"：

### 1. parse-walk.ts 是 re-export 壳

| 车道 | parse-walk.ts 行数 | 实际代码位置 |
| --- | --- | --- |
| logic | 406 行（真抽出） | `parse-walk.ts` |
| style | 8 行（re-export `buildCompileCss`） | `index.ts` 551 行 |
| view | 8 行（re-export `viewParseWalk`） | `index.ts` 1476 行 |

style/view 的 `parse-walk.ts` 是一行 `export { X } from './index.ts'`。文件结构显示"三段"了，但代码全在 `index.ts`。

### 2. 3 条 TD 假设失败走 fallback

| TD 原设计 | 实施结果 | 根因 |
| --- | --- | --- |
| `collectAllWxsModules` 可删 | 保留 | 跨页面缓存泄漏 wxs（预 walk 收集 ≠ `collectAllWxsModules` 收集） |
| page sourcemap 总是 `createLineSourcemap` | 条件用 | pages with `<include>` but no `<wxs>` 不触发 2nd pass |
| `emitStyle` 聚合 esbuild CSS minify | per-module（`minifyCss` 在 `enhanceCSS` 内调） | per-module + join 保留模块间 `\n`；aggregated 删 `\n` |

这 3 条在 validation.md 中记录为"实施偏差"，但 TD 原文未修正——TD 与实施不一致。

### 3. view 二次编译未消除

TD D-ET-9 北星"一次编译（预 walk + 一次编译）"走 fallback。`compileViewTree` 仍是 first pass → 递归组件 → second pass（`compileModule` 用 `allScriptModules` 参数区分）。`compileModuleWithAllWxs` 合并进了 `compileModule`，但二次编译结构不变。

## MUST Requirements

- **R-PW-1** `style/parse-walk.ts` MUST 含 `enhanceCSS` + `buildCompileCss` + 所有 helpers（`createExternalClassPlugin` / `boostExternalClassSelectors` / `getStyleSourcePath` / `createStyleCompileError` / `normalizePreprocessorMap` / `getPostcssMapOptions` / `createStyleTransformPlugin` / `normalizeCssUrlValue` / `getAbsolutePath` / `resolveStyleImportPath` / `normalizeRootStyleImports` / `ensureImportSemicolons` / `processHostSelector` / `loadCssnano` / `loadLess` / `loadSass`）——非 re-export。
- **R-PW-2** `view/parse-walk.ts` MUST 含 `compileViewTree` + `compileModule` + `viewParseWalk` + `insertWxsToRenderResult` + 表达式 helpers（`parseJs` / `getProgramCode` / `addOptionalChaining` / `parseSafeBraceExp` / `transformTextInterpolation` / `isStringLiteral` / `getStringLiteralRawValue` / `getSource` / `applyCodeReplacements` / `parseBraceExp` / `isWrappedByBraces` / `splitWithBraces` / `parseClassRules` / `parseForExp` / `getForItemName` / `getForIndexName` / `parseKeyExpression` / `parseTemplateDataExp` / `escapeQuotes` / `processWxsContent` / `processWxsDependency` / `processIncludedFileWxsDependencies` / `collectAllWxsModules` / `isWxsModuleByContent` / `isRegisteredWxsModule` / `extractWxsDependencies` / `loadWxsModule` / `initWxsFilePathMap` / `scanWxsFiles` / `registerWxsModule` / `transAsses` 等）——非 re-export。
- **R-PW-3** `style/index.ts` MUST 不含 `enhanceCSS` / `buildCompileCss` 定义（只 import + 编排）。
- **R-PW-4** `view/index.ts` MUST 不含 `compileViewTree` / `compileModule` / `viewParseWalk` / `insertWxsToRenderResult` 定义（只 import + 编排 + `bindVueToolsLive` 注入）。
- **R-PW-5** ESM import MUST 单向（`index.ts → parse-walk.ts`），无循环依赖。
- **R-PW-6** 3 条 fallback MUST 在 TD 中标注为正式决策（D-PW-3/4/5），非临时 fallback。
- **R-PW-7** `collectAllWxsModules` 缓存泄漏 MUST 在 TD 中定性记录（已知行为，behavior 0 约束下保留，后续正确性修复候选）。
- **R-PW-8** 行为 0 MUST 保持（nomap + sourcemap 产物 diff=0；全量 vitest 绿；tsc 0 错）。

## 约束

- 真抽出是纯机械搬代码——不碰产物语义、不改函数签名、不改调用逻辑。
- `collectAllWxsModules` 缓存泄漏**不在本门修**——修它是行为变化（sub-package 产物 diff≠0），需另门。
- `minifyCss` 的跨界调用（定义在 `emit.ts`，调用在 `enhanceCSS`）**不变**——行为 0 要求 per-module。

## 非范围

- logic 车道（已真抽出）
- 产物语义变更
- emit 搬迁（MC3c deferred）
- HMR / watch 增量
- 修 `collectAllWxsModules` 缓存泄漏（定性 + 记录，不在本门修）
- 消除 view 二次编译（本门正式接受 fallback 为决策 D-PW-5）
