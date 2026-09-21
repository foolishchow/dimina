# Technical Design — fe-tools-parse-walk-extract

Status: **draft**（2026-09-21）。

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

**循环依赖分析**：`createStyleTransformPlugin`（在 `enhanceCSS` 内）调 `buildCompileCss`（`@import` 处理）。两者都在 `index.ts` → 无循环。若 `enhanceCSS` + `buildCompileCss` 都搬到 `parse-walk.ts` → 仍在同一文件 → 无循环。`index.ts` 只需 import `buildCompileCss` from `parse-walk.ts`（单向）。

### §0.2 view 现状

```text
view/index.ts (1476 行):
  模块级变量: optionalChainingCache, compileResCache, wxsModuleRegistry, wxsFilePathMap, ...
  表达式 helpers: parseJs(), parseBraceExp(), parseSafeBraceExp(), transformTextInterpolation(), ...
  wxs helpers: processWxsContent(), loadWxsModule(), collectAllWxsModules(), ...
  parse+walk: compileViewTree() → compileModule() → toCompileTemplate + compileTemplate + insertWxsToRenderResult
  编排: viewParseWalk() → compileViewTree + scriptRes→EmitModule[]
  engine入口: compileML() → viewParseWalk + emitEntry
  engine: viewCompile(), viewSuccessPayload(), viewEngine

view/parse-walk.ts (8 行):
  export { viewParseWalk } from './index.ts'   ← re-export 壳
```

**循环依赖分析（关键）**：view 有 W1 cycle-break 机制：

```text
view/wxml/renderer/vue/live.ts:
  export let insertWxsToRenderResult, parseBraceExp, ... (12 个 let bindings)
  export function bindVueToolsLive(deps) { 注入 }

view/wxml/renderer/vue/tools.ts:
  import { insertWxsToRenderResult, ... } from './live.ts'   ← 运行时用 binding

view/index.ts:
  定义 insertWxsToRenderResult, parseBraceExp, ...
  调 bindVueToolsLive({ insertWxsToRenderResult, ... })   ← 初始化时注入
```

若 `insertWxsToRenderResult` + 表达式 helpers 搬到 `parse-walk.ts`：
- `parse-walk.ts` 定义它们 + export
- `index.ts` import from `parse-walk.ts` + 调 `bindVueToolsLive({ ...fns })`（注入给 `live.ts`）
- `tools.ts` 仍从 `live.ts` 用 binding（不变）
- **无循环依赖**：`index.ts → parse-walk.ts`（单向）；`tools.ts → live.ts`（不变）

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
  模块级变量: compileRes, autoprefixerPlugin, cssnanoLoader, lessLoader, sassLoader
  loaders: loadCssnano(), loadLess(), loadSass()
  interfaces: StyleModule, StyleOptions, StyleCompileResult
  parse+walk: buildCompileCss() → enhanceCSS() → less + postcss
  helpers: createExternalClassPlugin(), ..., processHostSelector()
  exports: buildCompileCss, boostExternalClassSelectors, ..., resolveStyleImportPath

style/emit.ts: (不变)
  minifyCss(), emitStyle()

style/index.ts:
  imports: buildCompileCss from parse-walk.ts; emitStyle, minifyCss from emit.ts
  interfaces: Progress
  编排: compileSS() → buildCompileCss + emitStyle + sink.write
  engine: styleCompile(), styleNormalizeError(), styleEngine
```

### §1.2 view 目标

```text
view/parse-walk.ts:
  模块级变量: optionalChainingCache, compileResCache, wxsModuleRegistry, wxsFilePathMap, ...
  表达式 helpers: parseJs(), parseBraceExp(), ..., escapeQuotes()
  wxs helpers: processWxsContent(), loadWxsModule(), collectAllWxsModules(), ...
  parse+walk: compileViewTree(), compileModule(), viewParseWalk()
  render后处理: insertWxsToRenderResult()
  其他 helpers: initWxsFilePathMap(), scanWxsFiles(), ..., transAsses()
  exports: viewParseWalk, insertWxsToRenderResult, parseBraceExp, ..., processWxsContent, ...

view/index.ts:
  imports: viewParseWalk, insertWxsToRenderResult, parseBraceExp, ... from parse-walk.ts
  编排: compileML() → viewParseWalk + emitEntry
  W1 注入: 调 bindVueToolsLive({ insertWxsToRenderResult, ... })
  engine: viewCompile(), viewSuccessPayload(), viewEngine
```

### §1.3 落点表

| 文件 | 动作 | 内容 |
| --- | --- | --- |
| `style/parse-walk.ts` | 重写（8 行 → 真抽出） | `enhanceCSS` + `buildCompileCss` + 全部 helpers + 模块级变量 |
| `view/parse-walk.ts` | 重写（8 行 → 真抽出） | `compileViewTree` + `compileModule` + `viewParseWalk` + `insertWxsToRenderResult` + 表达式/wxs helpers + 模块级变量 |
| `style/index.ts` | 变薄（551 → ~100 行） | `compileSS` + `emitStyle` 调用 + `styleEngine` |
| `view/index.ts` | 变薄（1476 → ~100 行） | `compileML` + `bindVueToolsLive` + `viewEngine` |
| `style/emit.ts` | 不变 | `minifyCss` + `emitStyle` |
| `view/wxml/renderer/vue/live.ts` | 不变 | W1 cycle-break shim |
| `view/wxml/renderer/vue/tools.ts` | 不变 | 从 `live.ts` 用 binding |

### §1.4 不变文件

| 文件 | 理由 |
| --- | --- |
| `logic/parse-walk.ts` / `logic/transform.ts` / `logic/index.ts` | 已真抽出 |
| `pipeline/emit.ts` | emit 层不变 |
| `worker-runtime/*` | 不变 |

## §2 设计决策

### D-PW-1：style parse-walk 自包含

`style/parse-walk.ts` 自包含：模块级变量 + loaders + interfaces + `enhanceCSS` + `buildCompileCss` + 全部 helpers。`index.ts` 只 import `buildCompileCss`（+ export 的 helpers）。

**循环依赖**：`createStyleTransformPlugin`（在 `enhanceCSS` 内）调 `buildCompileCss`——两者同在 `parse-walk.ts` → 内部调用，无循环。

### D-PW-2：view parse-walk 自包含

`view/parse-walk.ts` 自包含：模块级变量 + 表达式 helpers + wxs helpers + `compileViewTree` + `compileModule` + `viewParseWalk` + `insertWxsToRenderResult`。

**循环依赖**：W1 `live.ts` cycle-break 机制——`index.ts` import from `parse-walk.ts` + 调 `bindVueToolsLive` 注入。`tools.ts` 仍从 `live.ts` 用 binding。单向 `index.ts → parse-walk.ts`。

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
- W1 `bindVueToolsLive` 注入机制不变——`index.ts` 从 `parse-walk.ts` import 后注入，`tools.ts` 仍从 `live.ts` 用 binding。
- **diff=0 保证**：产物字节不变（代码逻辑不变，只是文件位置变）。
- **vitest 保证**：608/608 不变。
- **tsc 保证**：0 错（import 路径修正后）。

## §4 风险

| 风险 | 缓解 |
| --- | --- |
| W1 `bindVueToolsLive` 注入遗漏函数 | 对照 `live.ts` 12 个 binding 逐一检查 |
| style 模块级变量（`compileRes` 等）搬走后 `index.ts` 的 `styleCompile` 引用断裂 | `styleCompile` 调 `compileRes.clear()`——`parse-walk.ts` export `compileRes` 或 `clearCompileRes()` |
| view 模块级变量（`compileResCache` 等）搬走后 `index.ts` 的 `viewCompile` 引用断裂 | `viewCompile` 调 `compileResCache.clear()` 等——`parse-walk.ts` export 清理函数或变量 |
| ESM circular import（runtime call 虽可，但 tsc 可能报错） | 单向 import（`index.ts → parse-walk.ts`），无 circular |
