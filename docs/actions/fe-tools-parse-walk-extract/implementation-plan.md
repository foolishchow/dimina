# Implementation Plan — fe-tools-parse-walk-extract

Status: **draft**（2026-09-21）。

## 纪律

- 行为 0：nomap + sourcemap 产物 diff=0；全量 vitest 绿。
- 真抽出是纯机械搬代码——不改函数体、不改签名、不改调用逻辑。
- 每步完成后跑 tsc + vitest + diff 验证行为 0。

## 步骤

### Step 1 — style parse-walk 真抽出

| 动作 | 文件 |
| --- | --- |
| `style/parse-walk.ts`：从 `index.ts` 搬入全部 parse+walk 代码（模块级变量 `compileRes`/`autoprefixerPlugin`/`cssnanoLoader`/`lessLoader`/`sassLoader` + loaders + interfaces `StyleModule`/`StyleOptions`/`StyleCompileResult` + `buildCompileCss` + `enhanceCSS` + 全部 helpers）。import 依赖（less/postcss/autoprefixer/env.ts/utils.ts/sourcemap.ts/emit.ts 的 `minifyCss`）跟着搬。export `buildCompileCss` + 其他被 `index.ts` 用的 helpers + `compileRes`（或 `clearCompileRes()`）。 | `style/parse-walk.ts`（重写） |
| `style/index.ts`：删搬走的代码，import `buildCompileCss` from `parse-walk.ts`。保留 `compileSS`（编排）+ `emitStyle` 调用 + `styleCompile`/`styleNormalizeError`/`styleEngine`。`styleCompile` 的 `compileRes.clear()` 改调 `clearCompileRes()` 或 import `compileRes`。 | `style/index.ts`（变薄） |

**验证**：`style/parse-walk.ts` 非 re-export（`grep -c 'export.*from' parse-walk.ts` = 0）；`style/index.ts` 不含 `enhanceCSS`/`buildCompileCss` 定义；tsc 0 错；vitest 绿；diff=0。

### Step 2 — view parse-walk 真抽出

| 动作 | 文件 |
| --- | --- |
| `view/parse-walk.ts`：从 `index.ts` 搬入全部 parse+walk 代码（模块级变量 + 表达式 helpers + wxs helpers + `compileViewTree` + `compileModule` + `viewParseWalk` + `insertWxsToRenderResult` + `initWxsFilePathMap`/`scanWxsFiles`/`registerWxsModule`/`isRegisteredWxsModule`/`collectAllWxsModules`/`isWxsModuleByContent`/`extractWxsDependencies`/`loadWxsModule`/`processWxsContent`/`processWxsDependency`/`processIncludedFileWxsDependencies`/`transAsses`/`parseJs`/`getProgramCode`/`addOptionalChaining`/`parseSafeBraceExp`/`transformTextInterpolation`/`parseBraceExp`/`isWrappedByBraces`/`splitWithBraces`/`parseClassRules`/`parseForExp`/`getForItemName`/`getForIndexName`/`parseKeyExpression`/`parseTemplateDataExp`/`escapeQuotes`/`isStringLiteral`/`getStringLiteralRawValue`/`getSource`/`applyCodeReplacements` 等）。import 依赖跟着搬。export `viewParseWalk` + W1 `bindVueToolsLive` 需要的 12 个函数 + `compileResCache.clear()`/`templateRenderCache.clear()`/`wxsModuleRegistry.clear()`/`wxsFilePathMap.clear()`/`wxsScannedWorkPath` 清理函数。 | `view/parse-walk.ts`（重写） |
| `view/index.ts`：删搬走的代码，import from `parse-walk.ts`。保留 `compileML`（编排）+ `bindVueToolsLive` 调用 + `viewCompile`/`viewSuccessPayload`/`viewEngine`。`viewCompile` 的清理调用改调 `parse-walk.ts` 导出的清理函数。 | `view/index.ts`（变薄） |

**验证**：`view/parse-walk.ts` 非 re-export；`view/index.ts` 不含 `compileViewTree`/`compileModule`/`viewParseWalk`/`insertWxsToRenderResult` 定义；W1 `bindVueToolsLive` 12 个 binding 全覆盖；tsc 0 错；vitest 绿；diff=0。

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
| readiness review（findings 按严重度排序） |
| 跨文档同步检查 |
| architecture-notes 回流 |
| close 另授 |

## 实施注意

### style

- `createStyleTransformPlugin`（在 `enhanceCSS` 内）调 `buildCompileCss`——两者同在 `parse-walk.ts`，内部调用。
- `compileRes` 是模块级 `Map`——`styleCompile` 调 `compileRes.clear()`。`parse-walk.ts` export `compileRes` 或 `clearCompileRes()`。
- `autoprefixerPlugin` 是模块级常量——搬走即可。
- `minifyCss` import 从 `emit.ts`——跟着 `enhanceCSS` 搬到 `parse-walk.ts`。

### view

- W1 `live.ts` 12 个 binding：`transformTextInterpolation` / `isWrappedByBraces` / `parseBraceExp` / `parseSafeBraceExp` / `parseForExp` / `getForItemName` / `getForIndexName` / `parseKeyExpression` / `parseClassRules` / `parseTemplateDataExp` / `escapeQuotes` / `insertWxsToRenderResult`——全部从 `parse-walk.ts` export，`index.ts` import 后注入。
- `viewCompile` 清理：`compileResCache.clear()` / `templateRenderCache.clear()` / `wxsModuleRegistry.clear()` / `wxsFilePathMap.clear()` / `wxsScannedWorkPath = null` / `optionalChainingCache.clear()`——`parse-walk.ts` export 清理函数（如 `clearViewCaches()`）或逐个 export。
- `compileML` 调 `viewParseWalk` + `emitEntry`——`viewParseWalk` from `parse-walk.ts`，`emitEntry` from `pipeline/emit.ts`。
- `compileML` 调 `initWxsFilePathMap` + 读 `wxsScannedWorkPath`——这些从 `parse-walk.ts` import。

## 验证矩阵

| 车道 | parse-walk.ts 行数 | index.ts 行数 | re-export? | diff=0 | vitest |
| --- | --- | --- | --- | --- | --- |
| logic | 406 | 312 | 否（已真抽出） | — | — |
| style | ~450 | ~100 | 否 | ✅ | ✅ |
| view | ~1300 | ~100 | 否 | ✅ | ✅ |
