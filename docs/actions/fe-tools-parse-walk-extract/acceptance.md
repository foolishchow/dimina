# Acceptance — fe-tools-parse-walk-extract

## A-PW-1 — style parse-walk 真抽出

- [ ] `style/parse-walk.ts` 含 `enhanceCSS` + `buildCompileCss` + 全部 helpers（非 re-export）
- [ ] `style/parse-walk.ts` 不含 `export.*from.*index`（`grep -c 'export.*from.*index' parse-walk.ts` = 0）
- [ ] `style/index.ts` 不含 `enhanceCSS` / `buildCompileCss` 定义（`grep -c 'function enhanceCSS\|function buildCompileCss' index.ts` = 0）

## A-PW-2 — view parse-walk 真抽出

- [ ] `view/parse-walk.ts` 含 `compileViewTree` + `compileModule` + `viewParseWalk` + `insertWxsToRenderResult` + 表达式 helpers（非 re-export）
- [ ] `view/parse-walk.ts` 不含 `export.*from.*index`（`grep -c 'export.*from.*index' parse-walk.ts` = 0）
- [ ] `view/index.ts` 不含 `compileViewTree` / `compileModule` / `viewParseWalk` / `insertWxsToRenderResult` 定义

## A-PW-3 — 无循环依赖

- [ ] ESM import 单向（`index.ts → parse-walk.ts`）；`parse-walk.ts` 不 import from `index.ts`

## A-PW-4 — W1 binding 全覆盖

- [ ] `view/index.ts` 调 `bindVueToolsLive` 传入 12 个函数（`transformTextInterpolation` / `isWrappedByBraces` / `parseBraceExp` / `parseSafeBraceExp` / `parseForExp` / `getForItemName` / `getForIndexName` / `parseKeyExpression` / `parseClassRules` / `parseTemplateDataExp` / `escapeQuotes` / `insertWxsToRenderResult`）
- [ ] 全部 12 个函数从 `view/parse-walk.ts` import

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
