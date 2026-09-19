# Source Audit — fe-tools-packer-research

Status: **draft（2026-09-20）**

基线 commit：`ef879a87`（emit-memfs 归档后）。

## 1. 焊点总览

| 焊点 | 路径（`fe/tools/bundler/src`） | 行数 | 已反哺 |
| --- | --- | --- | --- |
| W1 emit | `compiler/pipeline/emit.ts` | 222 | ✓ emit-memfs |
| W2 logic | `compiler/logic/index.ts` | 633 | ✗ |
| W3 env | `compiler/core/env.ts` | 965 | ✗ |
| W4 graph | `model/dependency-graph.ts` | 186 | ✓ incremental-target |

辅助：`model/build-model.ts`（79 行，emit-memfs 产出层，不是焊点但紧邻 W1）。

## 2. W1 emit.ts — 方法/接口清单

### 导出

| 符号 | 类型 | Packer 胚 | Scheme 专有 | 说明 |
| --- | --- | --- | --- | --- |
| `EmitModule` | interface | ✓ | | `{ moduleId, code, map, extraInfoCode? }` — 模块集合元素 |
| `ModuleCollection` | type | ✓ | | `Iterable<EmitModule>` |
| `EmitEntryFile` | interface | ✓ | | `{ path, code }` |
| `EmitEntrySourcemap` | interface | ✓ | | `{ path, map }` |
| `EmitEntry` | interface | ◐ | `kind: 'view'\|'logic'` | `entryId` + `kind` + `files` + `sourcemaps?`。`kind` 是 Dimina 车道标识 |
| `EmitTransformConfig` | interface | ✓ | | `{ minify, target, platform }` |
| `EmitBundleCtx` | interface | ✓ | | bundle 策略上下文 |
| `EmitPerModuleCtx` | interface | ✓ | | perModule 策略上下文 |
| `EmitEntryParams` | interface | ◐ | `kind` | `{ entryId, kind, modules, transform, sourcemap, ... }` |
| `emitEntry()` | function | ◐ | `modDefine` 格式 | 唯一出口。内部 `strategies[strategy].apply()` → `sink.write(entry)` |

### 外部依赖

| 来源 | 导入 | Packer 侧 / Scheme 侧 |
| --- | --- | --- |
| `esbuild` | `transform` | Packer — transform 能力 |
| `node:path` | `relative`, `resolve`, `sep` | Packer — 路径计算 |
| `core/env.ts` | `getWorkPath` | 焊点用法 — perModule rebase 需要源根路径 |
| `core/sourcemap.ts` | `mergeSourcemap` | Packer — sourcemap 合并 |
| `shared/compile-config.ts` | `effectiveJsMinify` | Scheme — minify 配置策略 |
| `worker-runtime/context.ts` | `abilityContext` | Scheme — worker runtime sink |

### Dimina 专有元素

1. **`modDefine(moduleId, function(require, module, exports) { ... })`** — AMD-like 包裹格式，出现在 3 处（bundle / perModule+minify / perModule+无minify）
2. **`kind: 'view' | 'logic'`** — Dimina 车道标识，贯穿 `EmitEntry` / `EmitEntryParams`
3. **`getWorkPath()`** — perModule rebase 依赖 env.ts 的源根路径

### 策略表

| 策略 | 调用方 | sourcemap 模式 | minify 模式 | 布局 |
| --- | --- | --- | --- | --- |
| `bundle` | view 车道 | mergeSourcemap 整包 | esbuild transform 整包 | moduleRanges 行定位 |
| `perModule` | logic 车道 | rebase + mergeSourcemap | esbuild transform 逐模块 | 天然定位 |

## 3. W2 logic/index.ts — 方法/依赖清单

### 结构（633 行）

| 函数 | 行数 | Packer 胚 | Scheme 调用 |
| --- | --- | --- | --- |
| `writeCompileRes()` | L44-58 | | `emitEntry()` 调用（模块集合 → emit） |
| `compileJS()` | L76-87 | | 页面遍历编排、进度报告 |
| `buildJSByPath()` | L88-200+ | ◐ AST parse + walk + import/require 收集 + MagicString 路径重写 + esbuild transform + remapSourcemap | `getDependencyGraph()` ×9（addFile/addDependency kind='logic'）、`getComponent()` ×2、`getAppId()` ×2、`getWorkPath()` ×9、`getTargetPath()` ×3、`resolveAppAlias()` ×2、`getContentByPath()` ×2、`getNpmResolver()` ×2、`getAppConfigInfo()` ×2、`storeInfo()` ×2、`resetStoreInfo()` ×3 |

### Packer 胚元素（可抽提）

- `parseSync`（oxc-parser）→ AST
- `walk`（oxc-walker）→ traverse AST
- `import` / `require` / `export` 语句收集
- `MagicString` → 路径重写（`resolveDependencyId()`）
- `esbuild.transform()` → CJS transform + minify
- `remapSourcemap()` → sourcemap remap
- `emitEntry()` 调用 → 产出（通过 emit 焊点）

### Scheme 调用（混入，需抽成 hooks）

| env.ts 调用 | 次数 | 用途 | 可参数化？ |
| --- | --- | --- | --- |
| `getDependencyGraph()` | 9 | 写模块边（addFile/addDependency kind='logic'） | 可 → graph hook |
| `getWorkPath()` | 9 | 源根路径 | 可 → sourceRoot 参数 |
| `getTargetPath()` | 3 | 输出路径 | 可 → outputRoot 参数 |
| `getComponent()` | 2 | 组件配置 | 可 → componentResolver hook |
| `getAppId()` | 2 | 模块 ID 前缀 | 可 → moduleIdPrefix 参数 |
| `getAppConfigInfo()` | 2 | app 配置 | 可 → appConfig hook |
| `getContentByPath()` | 2 | 内容查找 | 可 → contentResolver hook |
| `getNpmResolver()` | 2 | npm 解析 | 可 → npmResolver 参数 |
| `resolveAppAlias()` | 2 | 路径别名 | 可 → aliasResolver hook |
| `storeInfo()` | 2 | 状态存储 | 可 → storeHook |
| `resetStoreInfo()` | 3 | 状态重置 | 可 → resetHook |

## 4. W3 env.ts — 26 exports 扇入分析

### 扇入统计（谁 import env.ts 后用这个函数）

| 函数 | 扇入数 | Packer 侧文件 | Scheme 侧文件 |
| --- | --- | --- | --- |
| `getWorkPath` | 7 | logic, view, style, emit | build-pipeline, config-compiler, project-store |
| `getDependencyGraph` | 7 | logic, view, style, emit | build-pipeline, compile-target, project-store |
| `getTargetPath` | 6 | logic, view, style, emit | build-pipeline, config-compiler |
| `getAppId` | 6 | logic, view, style | build-pipeline, emit, config-compiler |
| `storeInfo` | 5 | logic, view, style | build-pipeline, config-compiler |
| `getViewScriptTags` | 4 | — | view, compatibility |
| `getContentByPath` | 4 | logic, view, style | — |
| `resetStoreInfo` | 3 | logic, view, style | — |
| `isMiniGame` | 3 | — | view, style, compatibility |
| `getViewScriptExts` | 3 | — | view, compatibility, platforms |
| `getTemplateExts` | 3 | — | view, paths, platforms |
| `getComponent` | 3 | logic, view, style | — |
| `getStyleExts` | 2 | — | style, platforms |
| `getPages` | 2 | — | view, style |
| `getAppConfigInfo` | 3 | logic | config-compiler, build-pipeline |
| `getAppName` | 1 | — | build-pipeline |
| `runWithCompilerContext` | 1 | — | define-engine（基础设施） |
| `resolveAppAlias` | 1 | logic | — |
| `isTemporaryTargetPath` | 1 | — | build-pipeline |
| `getTemplateDirectivePrefixes` | 1 | — | view |
| `getPageConfigInfo` | 1 | — | view |
| `getNpmResolver` | 1 | logic | — |
| `getAppStyleScopeId` | 1 | — | style |
| `storeProjectConfig` | 0 | — | — |
| `getRuntimeType` | 0 | — | — |
| `getProjectConfig` | 0 | — | — |

### 初步分类

| 分类 | 函数 | 数量 |
| --- | --- | --- |
| **Packer 侧** | `getDependencyGraph`, `getNpmResolver`, `resolveAppAlias` | 3 |
| **Packer + Scheme 共用** | `getWorkPath`, `getTargetPath`, `getAppId`, `getContentByPath`, `getComponent`, `getAppConfigInfo`, `storeInfo`, `resetStoreInfo` | 8 |
| **Scheme 侧** | `getPages`, `getProjectConfig`, `getPageConfigInfo`, `getAppName`, `getViewScriptExts`, `getViewScriptTags`, `getTemplateExts`, `getTemplateDirectivePrefixes`, `getStyleExts`, `isMiniGame`, `getRuntimeType`, `getAppStyleScopeId`, `isTemporaryTargetPath`, `storeProjectConfig` | 14 |
| **基础设施** | `runWithCompilerContext` | 1 |
| **未使用** | `storeProjectConfig`, `getRuntimeType`, `getProjectConfig` | 3 |

### env.ts 内部结构

- `CompilerContext` interface：`{ pathInfo, configInfo, npmResolver, dependencyGraph }`
- `compilerContextStorage`：AsyncLocalStorage（`runWithCompilerContext` 的实现）
- `pathInfo` / `configInfo`：Proxy 代理，读写转发到 context
- 大量 `get*()` 函数：从 `pathInfo` / `configInfo` / `storeInfo` 读
- 图初始化（L814-891）：`addNode('app')` / `addNode(page.path, { type: 'page', entry: true })` / `addNode(component.path, { type: 'component' })` — 这是 Scheme 填工程图

## 5. W4 dependency-graph.ts — 方法清单

### API

| 方法 | Scheme 用 | Packer 用 | 失效用 |
| --- | --- | --- | --- |
| `addNode(id, { type, entry, packageRoot, files })` | ✓ `type='app'/'page'/'component'` | ✓ `type='module'`（默认） | — |
| `addFile(id, filePath, kind)` | ✓ kind=`'config'/'view'/'style'` | ✓ kind=`'logic'` | — |
| `addDependency(from, to, kind)` | ✓ kind=`'app'/'component'` | ✓ kind=`'logic'` | — |
| `getDirectDependencies(id, kinds?)` | ✓ kinds=`'component'` | — | — |
| `getDirectDependents(id, kinds?)` | — | — | ✓ |
| `getAffectedEntries(filePath)` | — | — | ✓ compile-cache / invalidation / watch-plan |
| `hasFile(filePath)` | — | — | ✓ watch-plan |
| `getFileKinds(filePath)` | — | — | ✓ compile-cache / compile-stages / invalidation |
| `merge(snapshot)` | ✓ | ✓ | — |
| `toJSON()` | ✓ | ✓ | — |

### 图节点 type 值

| type | 来源 | 归属 |
| --- | --- | --- |
| `'app'` | env.ts `addNode('app', { type: 'app' })` | Scheme |
| `'page'` | env.ts `addNode(page.path, { type: 'page', entry: true })` | Scheme |
| `'component'` | env.ts `addNode(component.path, { type: 'component' })` | Scheme |
| `'module'` | 默认值 | Packer（logic addNode 不传 type） |
| `MINI_GAME_RUNTIME_TYPE` | env.ts | Scheme |

### 边 kind 值

| kind | 来源 | 归属 |
| --- | --- | --- |
| `'app'` | env.ts `addDependency(page.path, 'app', 'app')` | Scheme |
| `'component'` | env.ts `addDependency(page.path, dep, 'component')` | Scheme |
| `'logic'` | logic/index.ts `addDependency(from, to, 'logic')` | Packer |
| `'config'` | env.ts / npm-builder `addFile(id, file, 'config')` | Scheme |
| `'view'` | view/compile.ts `addFile(path, fullPath, 'view')` | Scheme |
| `'style'` | style/index.ts `addFile(owner, abs, 'style')` | Scheme |

### 失效语义（incremental-target 已探明）

`getAffectedEntries(filePath)`：从 file → `fileOwners` → owners → BFS `getDirectDependents` → 收集 `entry=true` 节点。跨 Scheme 节点（page→app）和 Packer 节点（module→module→page）遍历。

## 6. build-model.ts（辅助，非焊点）

| 符号 | 归属 | 说明 |
| --- | --- | --- |
| `BuildModel` class | Scheme | 主线程构建模型。entries Map 持有 worker 回传产物 |
| `add(entry)` | Scheme | 收编产物条目 |
| `getArtifact(relativePath)` | Scheme | dev memfs 反查（emit-memfs 新增） |
| `materialize(model, targetPath)` | Scheme | 唯一写盘出口 |

`BuildModel` 不是 Packer 的一部分——它是 Scheme 的产物持有者。Packer 的产出通过 `sink.write(entry)` 到达 `BuildModel`。

## 7. 待分析项（research 阶段填充）

- W2 `resolveDependencyId()` 完整逻辑（import/require/export 解析）
- W3 env.ts 图初始化完整逻辑（L814-891）
- W3 env.ts `storeInfo` / `getContentByPath` 完整逻辑
- 跨焊点依赖：logic → env → graph 的写图路径
- 跨焊点依赖：emit → env → workPath 的 rebase 路径
