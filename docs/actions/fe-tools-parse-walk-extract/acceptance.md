# Acceptance — fe-tools-parse-walk-extract

## A-PW-1 — style parse-walk 真抽出

- [ ] `style/parse-walk.ts` 含 `enhanceCSS` + `buildCompileCss` + 全部 helpers + interfaces `StyleModule`/`StyleOptions`/`StyleCompileResult`（非 re-export）
- [ ] `style/parse-walk.ts` 不含 `export.*from.*index`（`grep -c 'export.*from.*index' parse-walk.ts` = 0）
- [ ] `style/parse-walk.ts` import `minifyCss` from `emit.ts`（`enhanceCSS` 用）
- [ ] `style/index.ts` 不含 `enhanceCSS` / `buildCompileCss` 定义（`grep -c 'function enhanceCSS\|function buildCompileCss' index.ts` = 0）
- [ ] `style/index.ts` 不 import `minifyCss`（`grep -c 'minifyCss' index.ts` = 0；`noUnusedLocals: true`）
- [ ] `style/index.ts` `import type { StyleModule, StyleOptions } from './parse-walk.ts'`
- [ ] `style/index.ts` export 块保留（`compileSS` 留定义 + `buildCompileCss`/`boostExternalClassSelectors`/`ensureImportSemicolons`/`normalizeCssUrlValue`/`normalizeRootStyleImports`/`processHostSelector`/`resolveStyleImportPath` re-export from parse-walk.ts）

## A-PW-2 — view parse-walk 真抽出

- [ ] `view/parse-walk.ts` 含 `compileViewTree` + `compileModule` + `viewParseWalk` + `insertWxsToRenderResult` + `transTagWxs` + 表达式 helpers + interfaces `ViewModule`/`ViewParseWalkOptions`/`ErrorShape`（非 re-export）
- [ ] `view/parse-walk.ts` 不含 `export.*from.*index`（`grep -c 'export.*from.*index' parse-walk.ts` = 0）
- [ ] `view/parse-walk.ts` import `enableSourcemap` + `templateRenderCache` from `state.ts`
- [ ] `view/parse-walk.ts` export `ensureWxsScan` + `resetWxsScan` + `clearViewCaches`
- [ ] `view/index.ts` 不含 `compileViewTree` / `compileModule` / `viewParseWalk` / `insertWxsToRenderResult` / `transTagWxs` 定义
- [ ] `view/index.ts` `import type { ViewModule } from './parse-walk.ts'`
- [ ] `view/index.ts` export 块保留（`compileML` 留定义 + 9 re-export from parse-walk.ts + 3 from tools.ts + 1 from include.ts）

## A-PW-3 — 无循环依赖

- [ ] ESM import 单向（`index.ts → parse-walk.ts`）；`parse-walk.ts` 不 import from `index.ts`

## A-PW-4 — W1 binding 全覆盖（两套 shim）

- [ ] `view/index.ts` 调 `bindVueToolsLive` 传入 12 个函数（shim 1：`transformTextInterpolation` / `isWrappedByBraces` / `parseBraceExp` / `parseSafeBraceExp` / `parseForExp` / `getForItemName` / `getForIndexName` / `parseKeyExpression` / `parseClassRules` / `parseTemplateDataExp` / `escapeQuotes` / `insertWxsToRenderResult`）
- [ ] `view/index.ts` 调 `bindTransformOrchestrator` 传入 3 个函数（shim 2：`transTagWxs` / `transAsses` / `processIncludedFileWxsDependencies`）
- [ ] 全部 15 个函数从 `view/parse-walk.ts` import

## A-PW-5 — TD 决策修正

- [ ] TD D-PW-3：`collectAllWxsModules` 保留为正式决策（非 fallback）
- [ ] TD D-PW-4：page sourcemap 条件用为正式决策
- [ ] TD D-PW-5：view 二次编译正式接受为决策
- [ ] `collectAllWxsModules` 缓存泄漏在 TD 中定性记录

## A-PW-6 — 行为 0

- [ ] tsc 0 错
- [ ] 全量 vitest 绿（608/608）
- [ ] nomap 产物 diff=0
- [ ] sourcemap 产物 diff=0
