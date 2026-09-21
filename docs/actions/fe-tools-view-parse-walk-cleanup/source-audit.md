# Source Audit — fe-tools-view-parse-walk-cleanup

## 审计对象

`fe/tools/bundler/src/compiler/view/parse-walk.ts`（1,368 行 / 40 函数）

## 文件概况

| 指标 | 值 |
|---|---|
| 行数 | 1,368 |
| 函数数 | 40 |
| export 函数 | 20（含 15 个 W1 shim binding） |
| 模块级变量 | 10（5 缓存 + 4 正则/Map + 1 let） |
| import 来源 | 20 |

## 函数职责分区

### 簇 1: JS AST 工具（6 函数，L46-117）

| 函数 | 行数 | 职责 | export? |
|---|---|---|---|
| `parseJs` | 6 | oxc parseSync 封装 | 否 |
| `getProgramCode` | 8 | 提取单表达式语句源码 | 否 |
| `isStringLiteral` | 6 | AST 节点类型判断 | 否 |
| `getStringLiteralRawValue` | 11 | 从 StringLiteral 提取 raw value | 否 |
| `getSource` | 3 | 从源码切取节点范围 | 否 |
| `applyCodeReplacements` | 31 | MagicString 批量替换（去重叠） | 否 |

**观察**：纯工具函数，无外部依赖。与 `logic/parse-walk.ts` 概念重叠（oxc parse + walk），但参数不同（view 支持 `'module'|'script'`，logic 仅 `'module'`）。**不在本 Action 范围内**（非目标 #3）。

### 簇 2: 表达式转换（12 函数，L128-1038）

W1 shim 1 的 12 个 binding（`bindVueToolsLive` 注入给 `tools.ts`）：

| 函数 | 行数 | 职责 |
|---|---|---|
| `addOptionalChaining` | 53 | AST walk → 插入 `?.` 空值保护 |
| `parseSafeBraceExp` | 3 | `addOptionalChaining(parseBraceExp(exp))` |
| `transformTextInterpolation` | 16 | 文本插值空值保护 |
| `parseKeyExpression` | 52 | `wx:key` 表达式转换 |
| `escapeQuotes` | 3 | `"` → `'` |
| `isWrappedByBraces` | 3 | 判断 `{{...}}` 包裹 |
| `splitWithBraces` | 40 | 按空格分割但跳过 `{{}}` 内部 |
| `parseClassRules` | 11 | class 规则解析 |
| `getForItemName` | 9 | `wx:for-item` 名称提取 |
| `getForIndexName` | 9 | `wx:for-index` 名称提取 |
| `parseForExp` | 6 | `wx:for` 表达式解析 |
| `parseBraceExp` | 30 | `{{}}` → JS 表达式 |
| `parseTemplateDataExp` | 7 | `<template data>` 解析 |
| `encodeReservedTemplateContextIdentifier` | 3 | 保留字别名编码 |

**观察**：纯字符串/AST 转换。`optionalChainingCache` 是唯一的缓存（纯函数缓存）。**本 Action 不碰这组**——函数已足够小，无需拆分。

### 簇 3: WXS 模块管理（7 函数，L262-1237）

| 函数 | 行数 | 职责 | export? |
|---|---|---|---|
| `initWxsFilePathMap` | 10 | 扫描 `miniprogram_npm` 下的 wxs 文件 | ✅ |
| `scanWxsFiles` | 24 | 递归目录扫描 | 否 |
| `registerWxsModule` | 3 | 注册表 add | 否 |
| `isRegisteredWxsModule` | 3 | 注册表 has | 否 |
| `processWxsContent` | **121** | wxs 代码转换（4 种转换） | ✅ |
| `processWxsDependency` | 27 | 递归处理 wxs require 依赖 | 否 |
| `loadWxsModule` | 31 | 从文件系统加载 wxs 模块 | ✅ |
| `isWxsModuleByContent` | 10 | 判断是否是已注册 wxs 模块 | 否 |
| `collectAllWxsModules` | 47 | 递归收集 scriptRes 中所有 wxs 模块 | 否 |
| `extractWxsDependencies` | 17 | 正则提取 `require("...")` 依赖路径 | 否 |

**观察**：`processWxsContent`（121 行）是本 Action 拆分目标 #5。`collectAllWxsModules` 被重复调用（本 Action 去重目标 #2）。

### 簇 4: 模板编译编排（3 函数，L246-582）

| 函数 | 行数 | 职责 | export? |
|---|---|---|---|
| `viewParseWalk` | 11 | 入口 | ✅ |
| `compileViewTree` | 95 | 组件树递归 walk + WXS 收集 + 二次编译 | 否 |
| `compileModule` | **167** | 单模块编译（缓存 / 编译 / 包装） | 否 |

**观察**：`compileModule`（167 行）是本 Action 拆分目标 #4。`compileViewTree`（95 行）含二次编译逻辑（D-PW-5 保留），不在本 Action 范围。

### 簇 5: 资产/WXS 标签处理（2 函数）

| 函数 | 行数 | 职责 | export? |
|---|---|---|---|
| `transAsses` | 22 | image src 资产收集（W1 shim 2 binding） | ✅ |
| `transTagWxs` | 82 | `<wxs>` 标签处理 | ✅ |

**观察**：不在本 Action 范围。

### 簇 6: render 结果注入 + 缓存管理

| 函数 | 行数 | 职责 | export? |
|---|---|---|---|
| `insertWxsToRenderResult` | **99** | wxs 声明注入 render 函数 | ✅ |
| `processIncludedFileWxsDependencies` | 34 | 递归处理 include 文件的 wxs 依赖（W1 shim 2 binding） | ✅ |
| `ensureWxsScan` | 6 | 封装 wxsScannedWorkPath check | ✅ |
| `resetWxsScan` | 3 | 编译前重置扫描标记 | ✅ |
| `clearViewCaches` | 8 | 编译后清全部缓存 | ✅ |

**观察**：`insertWxsToRenderResult`（99 行）是本 Action 拆分目标 #6。`clearViewCaches` 需在缓存拆分后更新（clear 3 个 Map 替代 clear 1 个）。

## 模块级缓存变量

### `compileResCache`（L212）— 本 Action 拆分目标

```
const compileResCache = new Map<string, unknown>()
```

**三种用途**：

| 用途 | key | value 类型 | 写入位置 | 读取位置 |
|---|---|---|---|---|
| 模块编译结果 | `module.path` | `{ code, instruction, map }` | L571 | L437-470 |
| 模块失败缓存 | `module.path` | `{ failed: true, errorShape }` | L340 | L440-455 |
| WXS 内容 | `cacheKey` / `wxsFilePath` | `string` | L1105 | L1082-1083 |

**读取端类型分派**（L436-470）：
```typescript
const cacheData = compileResCache.get(module.path) as (Record<string, unknown> & { errorShape?: ErrorShape; code?: string; ...; failed?: boolean }) | undefined
if (cacheData && cacheData.failed) { ... }  // 失败缓存分支
if (cacheData && typeof cacheData === 'object' && cacheData.code && cacheData.instruction) { ... }  // 编译结果分支
else if (typeof cacheData === 'string') { ... }  // 旧格式兼容
```

**风险**：module.path 和 wxsFilePath 可能碰撞（虽然实际不会），类型不安全。

### `optionalChainingCache`（L127）

```
const optionalChainingCache = new Map()
```

纯函数缓存（`addOptionalChaining` 结果）。`clearViewCaches()` 清。不在本 Action 范围。

### `wxsModuleRegistry`（L215）

```
const wxsModuleRegistry = new Set()
```

已注册 wxs 模块路径。`clearViewCaches()` 清。不在本 Action 范围。

### `wxsFilePathMap`（L218）

```
const wxsFilePathMap = new Map()
```

npm wxs 模块名 → 文件路径。`clearViewCaches()` 清。不在本 Action 范围。

### `wxsScannedWorkPath`（L219）

```
let wxsScannedWorkPath: string | null = null
```

扫描标记（let 变量，ESM live binding 封装）。不在本 Action 范围。

## `compileModule` 167 行内部分区

```
L416-434: toCompileTemplate 获取模板 + 构建 compileInstruction
L436-470: 缓存命中分派（失败缓存重抛 → 编译结果复用 → 旧格式兼容）
L472-505: collectAllWxsModules + 合并到 instruction（缓存命中时）  ← 重复 #1
L507-532: 正常路径 — Vue compileTemplate（含 sourcemap 条件 D-PW-4）
L534-536: compileTemplateModuleRender（子模板渲染）
L538-548: insertWxsToRenderResult（wxs 注入 render）
L550-566: Module({}) 包裹 + concatSourcemap
L568-577: collectAllWxsModules + 合并到 instruction（正常路径）  ← 重复 #2
L579-582: 缓存写入 + 返回
```

**代码重复**：L472-505 和 L568-577 逻辑几乎完全一致。

## `processWxsContent` 121 行内部分区

walk 循环内处理四种转换：

| 转换 | 行范围 | 逻辑 |
|---|---|---|
| `getRegExp` | L640-665 | 参数为字面量 → 正则字面量；参数为变量 → `new RegExp()` |
| `getDate` | L667-672 | `getDate(...)` → `new Date(...)` |
| `require` | L674-713 | wxs 内部 require 路径重写 + 递归处理依赖（含 npm 组件特殊路径） |
| `constructor` | L715-722 | `.constructor` → `Object.prototype.toString.call().slice(8, -1)` |

## `insertWxsToRenderResult` 99 行内部分区

| 段 | 行范围 | 职责 |
|---|---|---|
| 声明构建 | L1249-1265 | 构建 wxsBindings + declarations（`const __wxs_N = require(...)`） |
| 声明注入 | L1267-1273 | 插入 declarations 到 render body |
| walk 替换 | L1275-1295 | AST walk：`_ctx.xxx` → `__wxs_N` / 保留字别名 |
| sourcemap | L1297-1317 | MagicString 生成 sourcemap + remap |
| 返回 | L1319-1337 | getProgramCode + 返回 |

## import 清单

```
node:fs, node:path              — fs/path
oxc-parser                      — parseSync, Program (type)
oxc-walker                      — walk
magic-string                    — MagicString
@vue/compiler-sfc               — compileTemplate
../core/compatibility.ts        — getTemplateDirectiveName
../../shared/utils.ts           — collectAssets, getAbsolutePath, isCollectableImageAsset, resolveAssetSourcePath, errorMessage, EnhancedError (type)
../core/env.ts                  — getAppId, getComponent, getContentByPath, getDependencyGraph, getTargetPath, getViewScriptExts, getViewScriptTags, getWorkPath
./wxml/common/document.ts       — WxmlNode (type)
../core/sourcemap.ts            — concatSourcemap, createLineSourcemap, createOriginsSourcemap, remapSourcemap
./wxml/common/document-ops.ts   — getAttr, queryAll, removeAll, serializeChildren, setAttr
./wxml/load/paths.ts            — stripViewScriptExt
./wxml/compile.ts               — toCompileTemplate
./wxml/renderer/vue/tools.ts    — getTemplateCompilerOptions, compileTemplateModuleRender
./wxml/renderer/vue/state.ts   — enableSourcemap, templateRenderCache
../pipeline/emit.ts             — EmitModule (type)
```

**无跨车道 import**（不 import from `../logic/` 或 `../style/`）。

## W1 shim binding 表面

15 个 export 函数从 parse-walk.ts → index.ts import → `bindVueToolsLive()` / `bindTransformOrchestrator()` 注入。

**本 Action 约束**：15 个 export 函数的签名不可变（消费方 `tools.ts` / `compile.ts` / `load/index.ts` 依赖 live binding）。拆分后这些函数仍须 export，签名不变。

## 类型安全现状

- `compileResCache`: `Map<string, unknown>` — **无类型安全**
- `optionalChainingCache`: `Map` (无泛型) — 无类型安全（不在本 Action 范围）
- `wxsModuleRegistry`: `Set` (无泛型) — 无类型安全（不在本 Action 范围）
- `wxsFilePathMap`: `Map` (无泛型) — 无类型安全（不在本 Action 范围）
- 0 处 `any` / `@ts-nocheck` / `as any`
- 0 处 `@ts-expect-error`（view/parse-walk.ts 内无）

## 行为 0 基线

- tsc: 0 errors
- vitest: 608/608 passed (82 test files)
- 产物 diff: diff=0（basic test project）
