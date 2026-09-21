# Technical Design — fe-tools-parse-walk-extract

Status: **in_progress**（2026-09-21）。

权威参考：[Experience-Review.md](../../Experience-Review.md)

## §0 当前架构

### §0.1 style 现状

```text
style/index.ts (551 行):
  模块级变量: compileRes, autoprefixerPlugin, cssnanoLoader, lessLoader, sassLoader
  loaders: loadCssnano(), loadLess(), loadSass()
  interfaces: StyleModule, StyleOptions, StyleCompileResult, Progress
  编排: compileSS() → buildCompileCss() → emitStyle() → sink.write
  parse+walk: buildCompileCss() → enhanceCSS() → less + postcss
  helpers: createExternalClassPlugin(), boostExternalClassSelectors(), ..., processHostSelector()
  engine: styleCompile(), styleNormalizeError(), styleEngine

style/parse-walk.ts (8 行):
  export { buildCompileCss } from './index.ts'   ← re-export 壳

style/emit.ts (58 行):
  minifyCss() (esbuild CSS minify, per-module)
  emitStyle() (packaging)
```

**循环依赖分析**：`createStyleTransformPlugin`（在 `enhanceCSS` 内）调 `buildCompileCss`（`@import` 处理）。两者都在 `index.ts` → 无循环。若 `enhanceCSS` + `buildCompileCss` 都搬到 `parse-walk.ts` → 仍在同一文件 → 无循环。`index.ts` import `buildCompileCss` + `clearStyleCaches` from `parse-walk.ts`（单向）。

### §0.2 view 现状

```text
view/index.ts (1476 行):
  模块级变量: optionalChainingCache, compileResCache, wxsModuleRegistry, wxsFilePathMap, wxsScannedWorkPath, ...
  注: enableSourcemap 来自 state.ts（非 index.ts 模块级变量；index.ts import from state.ts）
  表达式 helpers: parseJs(), parseBraceExp(), parseSafeBraceExp(), transformTextInterpolation(), ...
  wxs helpers: processWxsContent(), loadWxsModule(), collectAllWxsModules(), transTagWxs(), ...
  parse+walk: compileViewTree() → compileModule() → toCompileTemplate + compileTemplate + insertWxsToRenderResult
  编排: viewParseWalk() → compileViewTree + scriptRes→EmitModule[]
  engine入口: compileML() → viewParseWalk + emitEntry
  engine: viewCompile(), viewSuccessPayload(), viewEngine
  re-export: generateVModelTemplate / generateSlotDirective / normalizeTemplateSyntax (from tools.ts) + processIncludeConditionalAttrs (from include.ts)

view/parse-walk.ts (8 行):
  export { viewParseWalk } from './index.ts'   ← re-export 壳
```

**循环依赖分析（关键）**：view 有**两套** W1 cycle-break 机制：

```text
— shim 1: live.ts (12 个 binding) —
view/wxml/renderer/vue/live.ts:
  export let insertWxsToRenderResult, parseBraceExp, ... (12 个 let bindings)
  export function bindVueToolsLive(deps) { 注入 }

view/wxml/renderer/vue/tools.ts:
  import { insertWxsToRenderResult, ... } from './live.ts'   ← 运行时用 binding

— shim 2: orchestrator-live.ts (3 个 binding) —
view/wxml/load/orchestrator-live.ts:
  export let transTagWxs, transAsses, processIncludedFileWxsDependencies (3 个 let bindings)
  export function bindTransformOrchestrator(deps) { 注入 }

view/index.ts:
  定义 insertWxsToRenderResult, parseBraceExp, ... (shim 1)
  定义 transTagWxs, transAsses, processIncludedFileWxsDependencies (shim 2)
  调 bindVueToolsLive({ insertWxsToRenderResult, ... })         ← shim 1 注入
  调 bindTransformOrchestrator({ transTagWxs, transAsses, ... })  ← shim 2 注入
```

若上述 15 个函数（12 + 3）搬到 `parse-walk.ts`：
- `parse-walk.ts` 定义它们 + export
- `index.ts` import from `parse-walk.ts` + 调 `bindVueToolsLive({ ...fns })` + 调 `bindTransformOrchestrator({ ...fns })`
- `tools.ts` / orchestrator-live.ts 消费方仍从各自 shim 用 binding（不变）
- **无循环依赖**：`index.ts → parse-walk.ts`（单向）；`tools.ts → live.ts`；`orchestrator-live.ts` 消费方不变

### §0.3 logic 模板（已真抽出，作参照）

```text
logic/parse-walk.ts (406 行):
  imports: oxc-parser, oxc-walker, MagicString, env.ts, utils.ts, EmitModule
  export: logicParseWalk(), processedModules, getJSAbsolutePath()
  自包含，无循环依赖

logic/transform.ts (72 行):
  export: transformCjs()

logic/index.ts (312 行):
  imports: logicParseWalk from parse-walk.ts, transformCjs from transform.ts
  编排: buildJSByPath() → logicParseWalk → transformCjs → CompileInfo
  engine: logicCompile(), logicSuccessPayload(), logicEngine
```

## §1 目标架构

### §1.1 style 目标

```text
style/parse-walk.ts:
  imports: minifyCss from emit.ts (enhanceCSS 用)
  模块级变量: compileRes, autoprefixerPlugin, cssnanoLoader, lessLoader, sassLoader
  loaders: loadCssnano(), loadLess(), loadSass()
  interfaces: StyleModule, StyleOptions, StyleCompileResult
  parse+walk: buildCompileCss() → enhanceCSS() → less + postcss
  helpers: createExternalClassPlugin(), ..., processHostSelector()
  exports: buildCompileCss, boostExternalClassSelectors, ..., resolveStyleImportPath, clearStyleCaches

style/emit.ts: (不变)
  minifyCss(), emitStyle()

style/index.ts:
  imports: buildCompileCss, clearStyleCaches from parse-walk.ts; emitStyle from emit.ts
  imports: import type { StyleModule, StyleOptions } from parse-walk.ts (compileSS 参数类型)
  interfaces: Progress
  编排: compileSS() → buildCompileCss + emitStyle + sink.write
  re-export from parse-walk.ts: buildCompileCss, boostExternalClassSelectors, ensureImportSemicolons, normalizeCssUrlValue, normalizeRootStyleImports, processHostSelector, resolveStyleImportPath
  re-export from index.ts (defined here): compileSS
  engine: styleCompile() → clearStyleCaches(), styleNormalizeError(), styleEngine
```

**style re-export 保留**：`__tests__/style-compiler.spec.js` L5 import `boostExternalClassSelectors` / `ensureImportSemicolons` / `normalizeCssUrlValue` / `normalizeRootStyleImports` / `resolveStyleImportPath` from `style/index.ts`。这些搬到 `parse-walk.ts` 后，`index.ts` 必须 re-export 它们（行为 0：export 块不变）。

**style `compileRes` 处理**：`compileRes` 是 `const` Map（非 `let`）——可 export 后导入方调 `.clear()`（mutate object 非 reassign binding）。`parse-walk.ts` export `compileRes` 或 `clearStyleCaches()` 封装；`styleCompile` 调之。

### §1.2 view 目标

```text
view/parse-walk.ts:
  模块级变量: optionalChainingCache, compileResCache, wxsModuleRegistry, wxsFilePathMap, wxsScannedWorkPath
  interfaces: ViewModule, ViewParseWalkOptions, ErrorShape
  注: enableSourcemap + templateRenderCache 从 state.ts import（非 parse-walk.ts 定义）
  表达式 helpers: parseJs(), parseBraceExp(), ..., escapeQuotes()
  wxs helpers: processWxsContent(), loadWxsModule(), collectAllWxsModules(), transTagWxs(), ...
  parse+walk: compileViewTree(), compileModule(), viewParseWalk()
  render后处理: insertWxsToRenderResult()
  其他 helpers: initWxsFilePathMap(), scanWxsFiles(), transAsses(), processIncludedFileWxsDependencies()
  exports: viewParseWalk, insertWxsToRenderResult, parseBraceExp, ..., processWxsContent, transTagWxs, transAsses, ...
           ensureWxsScan(workPath) — 封装 wxsScannedWorkPath check + initWxsFilePathMap + 赋值
           resetWxsScan() — 设 wxsScannedWorkPath = null（viewCompile 编译循环前调用）
           clearViewCaches() — 封装 compileResCache.clear() + templateRenderCache.clear() + wxsModuleRegistry.clear() + ...

view/index.ts:
  imports: viewParseWalk, insertWxsToRenderResult, parseBraceExp, ..., transTagWxs, transAsses, processIncludedFileWxsDependencies, ensureWxsScan, resetWxsScan, clearViewCaches from parse-walk.ts
  imports: enableSourcemap, setEnableSourcemap from state.ts（templateRenderCache 不需——clearViewCaches 在 parse-walk.ts 内处理）
  imports: bindVueToolsLive from live.ts; bindTransformOrchestrator from orchestrator-live.ts
  imports: generateVModelTemplate, generateSlotDirective, normalizeTemplateSyntax from tools.ts; processIncludeConditionalAttrs from include.ts
  模块级变量: activeCompileConfig
  interfaces: Progress
  imports: import type { ViewModule } from parse-walk.ts (compileML/viewCompile 参数类型)
  编排: compileML() → ensureWxsScan + viewParseWalk + emitEntry
  viewCompile() → resetWxsScan() (编译循环前) + clearViewCaches() (编译循环后)
  W1 注入: 调 bindVueToolsLive({ 12 fns }) + 调 bindTransformOrchestrator({ transTagWxs, transAsses, processIncludedFileWxsDependencies })
  re-export from parse-walk.ts: viewParseWalk, initWxsFilePathMap, loadWxsModule, parseBraceExp, parseClassRules, parseKeyExpression, parseTemplateDataExp, processWxsContent, splitWithBraces
  re-export from tools.ts: generateVModelTemplate, generateSlotDirective, normalizeTemplateSyntax
  re-export from include.ts: processIncludeConditionalAttrs
  engine: viewCompile() → resetWxsScan() (循环前) + clearViewCaches() (循环后), viewSuccessPayload(), viewBuildConfig(), viewEngine
```

**view re-export 保留**：`__tests__/view-compiler.spec.js` L2 import `parseBraceExp` / `parseClassRules` / `parseKeyExpression` / `parseTemplateDataExp` / `processWxsContent` / `splitWithBraces` from `view/index.ts`；`__tests__/npm-view-script-custom-loading.spec.js` L6 import `initWxsFilePathMap` / `loadWxsModule`。这些搬到 `parse-walk.ts` 后，`index.ts` 必须 re-export 它们（行为 0：export 块不变）。

**`wxsScannedWorkPath` 处理**：该变量是 `let`，ESM live binding 不可从导入方赋值。
`parse-walk.ts` export 三个函数：
- `ensureWxsScan(workPath): boolean`（封装 `wxsScannedWorkPath !== workPath` check + `initWxsFilePathMap` + 赋值）— `compileML` 调用
- `resetWxsScan()`（设 `wxsScannedWorkPath = null`）— `viewCompile` 编译循环**前**调用（强制下次 `compileML` 重扫 WXS）
- `clearViewCaches()`（封装全部 cleanup，含 `wxsScannedWorkPath = null` + `compileResCache.clear()` + `templateRenderCache.clear()` + `wxsModuleRegistry.clear()` + `wxsFilePathMap.clear()` + `optionalChainingCache.clear()`）— `viewCompile` 编译循环**后**调用

`resetWxsScan()` 不可被 `clearViewCaches()` 替代——后者清空全部 cache（含 `compileResCache`），在编译前调会导致缓存丢失 = 行为变化。

### §1.3 落点表

| 文件 | 动作 | 内容 |
| --- | --- | --- |
| `style/parse-walk.ts` | 重写（8 行 → 真抽出） | `enhanceCSS` + `buildCompileCss` + 全部 helpers + 模块级变量 |
| `view/parse-walk.ts` | 重写（8 行 → 真抽出） | `compileViewTree` + `compileModule` + `viewParseWalk` + `insertWxsToRenderResult` + 表达式/wxs helpers + 模块级变量 |
| `style/index.ts` | 变薄（551 → ~100 行） | `compileSS` + `emitStyle` 调用 + re-export from parse-walk.ts + `styleEngine` |
| `view/index.ts` | 变薄（1476 → ~100 行） | `compileML` + `bindVueToolsLive` + `bindTransformOrchestrator` + re-export + `viewEngine` |
| `style/emit.ts` | 不变 | `minifyCss` + `emitStyle` |
| `view/wxml/renderer/vue/live.ts` | 不变 | W1 cycle-break shim 1（12 binding） |
| `view/wxml/renderer/vue/tools.ts` | 不变 | 从 `live.ts` 用 binding |
| `view/wxml/load/orchestrator-live.ts` | 不变 | W1 cycle-break shim 2（3 binding） |

### §1.4 不变文件

| 文件 | 理由 |
| --- | --- |
| `logic/parse-walk.ts` / `logic/transform.ts` / `logic/index.ts` | 已真抽出 |
| `pipeline/emit.ts` | emit 层不变 |
| `worker-runtime/*` | 不变 |
| `view/wxml/renderer/vue/state.ts` | `enableSourcemap` / `templateRenderCache` / `setEnableSourcemap` 共享状态（parse-walk.ts import `enableSourcemap` + `templateRenderCache`；index.ts import `enableSourcemap` + `setEnableSourcemap`） |

## §2 设计决策

### D-PW-1：style parse-walk 自包含

`style/parse-walk.ts` 自包含：模块级变量 + loaders + interfaces + `enhanceCSS` + `buildCompileCss` + 全部 helpers。`index.ts` import `buildCompileCss`（+ re-export 搬走的 helpers 给测试消费）。

**循环依赖**：`createStyleTransformPlugin`（在 `enhanceCSS` 内）调 `buildCompileCss`——两者同在 `parse-walk.ts` → 内部调用，无循环。

### D-PW-2：view parse-walk 自包含

`view/parse-walk.ts` 自包含：模块级变量 + 表达式 helpers + wxs helpers + `compileViewTree` + `compileModule` + `viewParseWalk` + `insertWxsToRenderResult`。

**循环依赖**：W1 两套 cycle-break 机制——shim 1（`live.ts`，12 binding）`index.ts` import from `parse-walk.ts` + 调 `bindVueToolsLive` 注入；shim 2（`orchestrator-live.ts`，3 binding）`index.ts` import from `parse-walk.ts` + 调 `bindTransformOrchestrator` 注入。`tools.ts` 仍从 `live.ts` 用 binding。单向 `index.ts → parse-walk.ts`。

### D-PW-3：`collectAllWxsModules` 保留（正式决策）

**TD 原假设**（emit-transform-split D-ET-9）：预 walk 预收集全量 wxs → 可删 `collectAllWxsModules`。

**实施结果**：`collectAllWxsModules` 收集跨页面缓存泄漏的 wxs（`compileResCache` 存了上一页面编译时 `collectAllWxsModules` 合并进 `instruction.scriptModule` 的 wxs）。预 walk 只调 `toCompileTemplate` 收集当次 wxs ≠ `collectAllWxsModules` 的收集。删除后 sub-package 产物 diff≠0。

**正式决策**：`collectAllWxsModules` 保留。记录为**已知行为**（behavior 0 约束下保留）。后续正确性修复候选（修它是行为变化，需另门）。

### D-PW-4：page sourcemap 条件用（正式决策）

**TD 原假设**（emit-transform-split D-ET-9）：page sourcemap 总是用 `createLineSourcemap`（匹配 `compileModuleWithAllWxs` 第二遍）。

**实施结果**：pages with `<include>` but no `<wxs>` 不触发 2nd pass（`allScriptModules.length === 0`）→ 最终 sourcemap 来自 1st pass → 改了就丢 `origins` → `wxml-sourcemap.spec.js` 失败。

**正式决策**：page sourcemap 条件用——2nd pass（`allScriptModules` provided）用 `createLineSourcemap`；1st pass + components 条件用 `createOriginsSourcemap`/`createLineSourcemap`。

### D-PW-5：view 二次编译正式接受（正式决策）

**TD 原假设**（emit-transform-split D-ET-9 北星）：一次编译（预 walk + WXS/render 后处理改编排 + 一次编译）。

**实施结果**：走 fallback——`compileViewTree` 仍是 first pass → 递归组件 → second pass。`compileModuleWithAllWxs` 合并进 `compileModule`（用 `allScriptModules` 参数区分 1st/2nd pass），但二次编译结构不变。

**正式决策**：接受二次编译。北星从"消除二次编译"修正为"合并函数 + `allScriptModules` 参数化"。一次编译消除需先修 `collectAllWxsModules` 缓存泄漏（D-PW-3 后续候选）。

### D-PW-6：`minifyCss` 跨界调用保留

`minifyCss` 定义在 `emit.ts`（emit 侧），调用点在 `enhanceCSS`（parse+walk 段）——per-module minify 必须在 parse+walk 时执行。本门不改此跨界调用。

## §3 行为 0 分析

- 真抽出是纯机械搬代码：函数定义从 `index.ts` 搬到 `parse-walk.ts`，不改函数体、不改签名、不改调用逻辑。
- import 路径从同文件调用变为跨文件 import——但函数行为不变。
- W1 两套注入机制不变——shim 1 `bindVueToolsLive`（12 fns）+ shim 2 `bindTransformOrchestrator`（3 fns）：`index.ts` 从 `parse-walk.ts` import 后注入，`tools.ts` / orchestrator-live.ts 消费方仍从各自 shim 用 binding。
- **diff=0 保证**：产物字节不变（代码逻辑不变，只是文件位置变）。
- **vitest 保证**：608/608 不变。
- **tsc 保证**：0 错（import 路径修正后）。

## §4 风险

| 风险 | 缓解 |
| --- | --- |
| W1 两套 shim 注入遗漏函数 | 对照 `live.ts` 12 + `orchestrator-live.ts` 3 = 15 个 binding 逐一检查 |
| style 模块级变量（`compileRes` 等）搬走后 `index.ts` 的 `styleCompile` 引用断裂 | `styleCompile` 调 `clearStyleCaches()`——`parse-walk.ts` export `clearStyleCaches()` 封装 cleanup（`compileRes` 是 const Map，也可直接 export + `.clear()`） |
| view 模块级变量（`compileResCache` 等）搬走后 `index.ts` 的 `viewCompile` 引用断裂 | `viewCompile` 调 `resetWxsScan()`（编译前）+ `clearViewCaches()`（编译后）——`parse-walk.ts` export 两者封装（`wxsScannedWorkPath` 是 `let`，不可外部赋值，必须封装） |
| 确认 `parse-walk.ts` 不 import `index.ts`（单向 import 验证） | 实施后 `grep -rn "from './index'" parse-walk.ts` = 0 |
