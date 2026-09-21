# Implementation Plan — fe-tools-parse-walk-extract

Status: **in_progress**（2026-09-21）。

## 纪律

- 行为 0：nomap + sourcemap 产物 diff=0；全量 vitest 绿。
- 真抽出是纯机械搬代码——不改函数体、不改签名、不改调用逻辑。
- 每步完成后跑 tsc + vitest + diff 验证行为 0。

## 步骤

### Step 1 — style parse-walk 真抽出

| 动作 | 文件 |
| --- | --- |
| `style/parse-walk.ts`：从 `index.ts` 搬入全部 parse+walk 代码（模块级变量 `compileRes`/`autoprefixerPlugin`/`cssnanoLoader`/`lessLoader`/`sassLoader` + loaders + interfaces `StyleModule`/`StyleOptions`/`StyleCompileResult` + `buildCompileCss` + `enhanceCSS` + 全部 helpers）。import 依赖（less/postcss/autoprefixer/env.ts/utils.ts/sourcemap.ts）跟着搬 + `minifyCss` from `emit.ts`（`enhanceCSS` 用）。export `buildCompileCss` + 其他被 `index.ts` re-export 的 helpers（`boostExternalClassSelectors`/`ensureImportSemicolons`/`normalizeCssUrlValue`/`normalizeRootStyleImports`/`processHostSelector`/`resolveStyleImportPath`）+ `clearStyleCaches()`（封装 `compileRes.clear()`）。 | `style/parse-walk.ts`（重写） |
| `style/index.ts`：删搬走的代码，import `buildCompileCss` + `clearStyleCaches` from `parse-walk.ts` + `emitStyle` from `emit.ts`（不 import `minifyCss`——已搬到 `parse-walk.ts`）。`import type { StyleModule, StyleOptions } from './parse-walk.ts'`（`compileSS` 参数类型）。保留 `compileSS`（编排）+ `styleCompile`/`styleNormalizeError`/`styleEngine`。保留 export 块（`compileSS` 留定义；`buildCompileCss`/`boostExternalClassSelectors`/`ensureImportSemicolons`/`normalizeCssUrlValue`/`normalizeRootStyleImports`/`processHostSelector`/`resolveStyleImportPath` 从 `parse-walk.ts` re-export）。`styleCompile` 的 `compileRes.clear()` 改调 `clearStyleCaches()`。 | `style/index.ts`（变薄） |

**验证**：`style/parse-walk.ts` 非 re-export（`grep -c 'export.*from' parse-walk.ts` = 0）；`style/index.ts` 不含 `enhanceCSS`/`buildCompileCss` 定义；`style/index.ts` 不 import `minifyCss`（`grep -c 'minifyCss' index.ts` = 0）；`style/index.ts` `import type { StyleModule, StyleOptions }`；`style/index.ts` export 块保留（`compileSS` + 7 re-export from parse-walk.ts）；tsc 0 错；vitest 绿；diff=0。

### Step 2 — view parse-walk 真抽出

| 动作 | 文件 |
| --- | --- |
| `view/parse-walk.ts`：从 `index.ts` 搬入全部 parse+walk 代码（模块级变量 + interfaces `ViewModule`/`ViewParseWalkOptions`/`ErrorShape` + 表达式 helpers + wxs helpers + `compileViewTree` + `compileModule` + `viewParseWalk` + `insertWxsToRenderResult` + `initWxsFilePathMap`/`scanWxsFiles`/`registerWxsModule`/`isRegisteredWxsModule`/`collectAllWxsModules`/`isWxsModuleByContent`/`extractWxsDependencies`/`loadWxsModule`/`processWxsContent`/`processWxsDependency`/`processIncludedFileWxsDependencies`/`transAsses`/`transTagWxs`/`parseJs`/`getProgramCode`/`addOptionalChaining`/`parseSafeBraceExp`/`transformTextInterpolation`/`parseBraceExp`/`isWrappedByBraces`/`splitWithBraces`/`parseClassRules`/`parseForExp`/`getForItemName`/`getForIndexName`/`parseKeyExpression`/`parseTemplateDataExp`/`escapeQuotes`/`isStringLiteral`/`getStringLiteralRawValue`/`getSource`/`applyCodeReplacements` 等）。import `enableSourcemap` + `templateRenderCache` from `state.ts`。export `viewParseWalk` + W1 `bindVueToolsLive` 需要的 12 个函数 + W1 `bindTransformOrchestrator` 需要的 3 个函数（`transTagWxs`/`transAsses`/`processIncludedFileWxsDependencies`）+ `ensureWxsScan(workPath)` + `resetWxsScan()` + `clearViewCaches()`。 | `view/parse-walk.ts`（重写） |
| `view/index.ts`：删搬走的代码，import from `parse-walk.ts`。`import type { ViewModule } from './parse-walk.ts'`（`compileML`/`viewCompile` 参数类型）。保留 `Progress` interface。保留 `compileML`（编排）+ `bindVueToolsLive` 调用（12 fns）+ `bindTransformOrchestrator` 调用（3 fns）+ `viewCompile`/`viewSuccessPayload`/`viewBuildConfig`/`viewEngine`。保留 export 块（`compileML` 留定义；`viewParseWalk`/`initWxsFilePathMap`/`loadWxsModule`/`parseBraceExp`/`parseClassRules`/`parseKeyExpression`/`parseTemplateDataExp`/`processWxsContent`/`splitWithBraces` 从 `parse-walk.ts` re-export；`generateVModelTemplate`/`generateSlotDirective`/`normalizeTemplateSyntax` 从 `tools.ts` re-export；`processIncludeConditionalAttrs` 从 `include.ts` re-export）。`compileML` 调 `ensureWxsScan(workPath)` 替代直接读写 `wxsScannedWorkPath`；`viewCompile` L1438 `wxsScannedWorkPath = null` 改调 `resetWxsScan()`；L1446-1451 逐个 cleanup 改调 `clearViewCaches()`。 | `view/index.ts`（变薄） |

**验证**：`view/parse-walk.ts` 非 re-export；`view/index.ts` 不含 `compileViewTree`/`compileModule`/`viewParseWalk`/`insertWxsToRenderResult` 定义；W1 `bindVueToolsLive` 12 + `bindTransformOrchestrator` 3 = 15 个 binding 全覆盖；`view/parse-walk.ts` export `ensureWxsScan` + `resetWxsScan` + `clearViewCaches`；`view/index.ts` export 块保留（`compileML` + 9 re-export from parse-walk.ts + 3 from tools.ts + 1 from include.ts）；`view/index.ts` `import type { ViewModule }`；tsc 0 错；vitest 绿；diff=0。

### Step 3 — 清理 + grep 验证

| 动作 | 文件 |
| --- | --- |
| 兜底 grep：`style/parse-walk.ts` 和 `view/parse-walk.ts` 非 re-export（`grep -c 'export.*from.*index'` = 0）；`style/index.ts` 和 `view/index.ts` 不含 parse+walk 函数定义。 | 全量 grep |
| 确认无循环依赖（`grep -rn "from './index'" parse-walk.ts` = 0）。 | parse-walk.ts |

### Step 4 — 行为 0 全量验证

| 动作 | 命令 |
| --- | --- |
| tsc | `node <pnpm> build` |
| vitest | `node <pnpm> test` |
| nomap diff | 对比基线（本 Action 实施前 commit） |
| sourcemap diff | 同上 |
| validator | `python3 <validator> --repo . --all` |

### Step 5 — review + close

| 动作 |
| --- |
| closure review（findings 按严重度排序） |
| 跨文档同步检查 |
| architecture-notes 回流 |
| close 另授 |

## 实施注意

### style

- `createStyleTransformPlugin`（在 `enhanceCSS` 内）调 `buildCompileCss`——两者同在 `parse-walk.ts`，内部调用。
- `minifyCss` import 从 `emit.ts`——`enhanceCSS` 用，搬到 `parse-walk.ts`。`index.ts` 不再 import `minifyCss`（`noUnusedLocals: true` 会报错）。
- `compileRes` 是 `const` Map（非 `let`）——可 export 后导入方调 `.clear()`（mutate object 非 reassign binding）。`parse-walk.ts` export `clearStyleCaches()` 封装 `compileRes.clear()`；`styleCompile` 调之。
- `autoprefixerPlugin` 是模块级常量——搬走即可。
- interfaces `StyleModule`/`StyleOptions`/`StyleCompileResult` 搬到 `parse-walk.ts`；`index.ts` `import type { StyleModule, StyleOptions } from './parse-walk.ts'`（`compileSS` 参数类型）。`Progress` 留 `index.ts`。
- re-export 保留：`buildCompileCss`/`boostExternalClassSelectors`/`ensureImportSemicolons`/`normalizeCssUrlValue`/`normalizeRootStyleImports`/`processHostSelector`/`resolveStyleImportPath` 从 `parse-walk.ts` re-export（`__tests__/style-compiler.spec.js` import 5 个）。`compileSS` 留定义在 `index.ts`。

### view

- W1 `live.ts` 12 个 binding（shim 1）：`transformTextInterpolation` / `isWrappedByBraces` / `parseBraceExp` / `parseSafeBraceExp` / `parseForExp` / `getForItemName` / `getForIndexName` / `parseKeyExpression` / `parseClassRules` / `parseTemplateDataExp` / `escapeQuotes` / `insertWxsToRenderResult`——全部从 `parse-walk.ts` export，`index.ts` import 后注入。
- W1 `orchestrator-live.ts` 3 个 binding（shim 2）：`transTagWxs` / `transAsses` / `processIncludedFileWxsDependencies`——同上，从 `parse-walk.ts` export，`index.ts` import 后注入。
- `enableSourcemap` + `templateRenderCache` 来自 `state.ts`（非 `index.ts` 模块级变量）——`parse-walk.ts` 直接 import from `state.ts`（不需从 `index.ts` 过）。`clearViewCaches()` 需调 `templateRenderCache.clear()`。`index.ts` 只 import `enableSourcemap` + `setEnableSourcemap`（不 import `templateRenderCache`——`noUnusedLocals: true`）。
- L230 注释 `// enableSourcemap / templateRenderCache: see wxml/renderer/vue/state.js` 需更新为 `// enableSourcemap: see wxml/renderer/vue/state.ts`（删 `templateRenderCache`——已不在 `index.ts`）。
- `wxsScannedWorkPath` 是 `let` 变量——ESM live binding 不可从导入方赋值。`parse-walk.ts` export 三个函数：
  - `ensureWxsScan(workPath)`（封装 `wxsScannedWorkPath !== workPath` check + `initWxsFilePathMap` + 赋值）——`compileML` 调。
  - `resetWxsScan()`（设 `wxsScannedWorkPath = null`）——`viewCompile` 编译循环前调（L1438 位）。
  - `clearViewCaches()`（封装全部 cleanup）——`viewCompile` 编译循环后调（L1446-1451 位）。
  - `resetWxsScan()` 不可被 `clearViewCaches()` 替代——后者清空全部 cache（含 `compileResCache`），编译前调 = 行为变化。
- `viewCompile` 清理：`resetWxsScan()`（编译循环前，L1438 位）+ `clearViewCaches()`（编译循环后，L1446-1451 位）。`clearViewCaches()` 封装 `compileResCache.clear()` / `templateRenderCache.clear()` / `wxsModuleRegistry.clear()` / `wxsFilePathMap.clear()` / `wxsScannedWorkPath = null` / `optionalChainingCache.clear()`。
- interfaces `ViewModule`/`ViewParseWalkOptions`/`ErrorShape` 搬到 `parse-walk.ts`；`index.ts` `import type { ViewModule } from './parse-walk.ts'`（`compileML`/`viewCompile` 参数类型）。`Progress` 留 `index.ts`。
- re-export 保留（两源）：
  - from `parse-walk.ts`：`viewParseWalk`/`initWxsFilePathMap`/`loadWxsModule`/`parseBraceExp`/`parseClassRules`/`parseKeyExpression`/`parseTemplateDataExp`/`processWxsContent`/`splitWithBraces`（`__tests__/view-compiler.spec.js` + `__tests__/npm-view-script-custom-loading.spec.js` import）。
  - from `tools.ts`：`generateVModelTemplate`/`generateSlotDirective`/`normalizeTemplateSyntax`（非 parse+walk，不从 parse-walk.ts 搬）。
  - from `include.ts`：`processIncludeConditionalAttrs`（非 parse+walk，不从 parse-walk.ts 搬）。
- `compileML` 留定义在 `index.ts`（engine 入口）。
- `compileML` 调 `viewParseWalk` + `emitEntry`——`viewParseWalk` from `parse-walk.ts`，`emitEntry` from `pipeline/emit.ts`。
- `activeCompileConfig` 是 `let` 变量，仅 `compileML`（读）和 `viewCompile`（写）用——留在 `index.ts`，不搬。

## 验证矩阵

| 车道 | parse-walk.ts 行数 | index.ts 行数 | re-export? | diff=0 | vitest |
| --- | --- | --- | --- | --- | --- |
| logic | 406 | 312 | 否（已真抽出） | — | — |
| style | ~450 | ~100 | 否 | ✅ | ✅ |
| view | ~1300 | ~100 | 否 | ✅ | ✅ |
