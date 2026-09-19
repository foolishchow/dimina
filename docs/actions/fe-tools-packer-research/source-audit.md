# Source Audit — fe-tools-packer-research

Status: **in_progress（2026-09-20）**

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
| `buildJSByPath()` | L88-415 | ◐ AST parse + walk + import/require 收集 + MagicString 路径重写 + esbuild transform + remapSourcemap | `getDependencyGraph()` ×8、`getWorkPath()` ×8、`getComponent()` ×1、`getAppId()` ×1、`getAppConfigInfo()` ×1、`getContentByPath()` ×1、`getNpmResolver()` ×1、`resolveAppAlias()` ×1、`isMiniGame()` ×1、`getTargetPath()` ×1；另有 `resetStoreInfo()` ×1 在 logicCompile 入口（非 buildJSByPath 内） |

### Packer 胚元素（可抽提）

- `parseSync`（oxc-parser）→ AST
- `walk`（oxc-walker）→ traverse AST
- `import` / `require` / `export` 语句收集
- `MagicString` → 路径重写（`resolveDependencyId()`）
- `esbuild.transform()` → CJS transform + minify
- `remapSourcemap()` → sourcemap remap
- `emitEntry()` 调用 → 产出（通过 emit 焊点）

### Scheme 调用（混入，需抽成 hooks）

| env.ts 调用 | 调用次数 | 用途 | 可参数化？ |
| --- | --- | --- | --- |
| `getDependencyGraph()` | 8 | 写模块边（addFile/addDependency kind='logic'） | 可 → graph hook |
| `getWorkPath()` | 8 | 源根路径 | 可 → sourceRoot 参数 |
| `getTargetPath()` | 2 | 输出路径 | 可 → outputRoot 参数 |
| `resetStoreInfo()` | 1 | 状态重置（logicCompile 入口） | 可 → resetHook |
| `getComponent()` | 1 | 组件配置 | 可 → componentResolver hook |
| `getAppId()` | 1 | 模块 ID 前缀 | 可 → moduleIdPrefix 参数 |
| `getAppConfigInfo()` | 1 | app 配置 | 可 → appConfig hook |
| `getContentByPath()` | 1 | 内容查找 | 可 → contentResolver hook |
| `getNpmResolver()` | 1 | npm 解析 | 可 → npmResolver 参数 |
| `resolveAppAlias()` | 1 | 路径别名 | 可 → aliasResolver hook |
| `isMiniGame()` | 1 | 运行时类型检查 | 可 → runtimeType 参数 |

## 4. W3 env.ts — 26 exports 扇入分析

### 扇入统计（grep 校验，基线 `ef879a87`）

文件名缩写：logic=`compiler/logic/index.ts`、emit=`compiler/pipeline/emit.ts`、build-pipeline=`compiler/pipeline/build-pipeline.ts`、compile-target=`compiler/pipeline/compile-target.ts`、config-compiler=`compiler/pipeline/config-compiler.ts`、publish=`compiler/pipeline/publish.ts`、style=`compiler/style/index.ts`、view=`compiler/view/index.ts`、view/compile=`compiler/view/wxml/compile.ts`、view/paths=`compiler/view/wxml/load/paths.ts`、view/template=`compiler/view/wxml/load/template.ts`、define-engine=`compiler/worker-runtime/define-engine.ts`、compatibility=`compiler/core/compatibility.ts`、npm-builder=`compiler/core/npm-builder.ts`、project-store=`model/project-store.ts`。**Packer 胚文件**= logic（唯一含 Packer 模块编译管线的焊点）；**Scheme 文件**= 其余全部（含 emit 焊点的 Scheme 侧、view/style 车道、编排设施）。

| 函数 | 扇入数 | logic (Packer 胚) | Scheme 文件 |
| --- | --- | --- | --- |
| `getWorkPath` | 7 | ✓ | build-pipeline, config-compiler, emit, style, view, view/compile |
| `getDependencyGraph` | 7 | ✓ | build-pipeline, style, view, view/compile, define-engine, project-store |
| `getTargetPath` | 6 | ✓ | build-pipeline, config-compiler, publish, style, view |
| `getAppId` | 6 | ✓ | compile-target, config-compiler, publish, style, view |
| `storeInfo` | 1 | — | project-store |
| `getViewScriptTags` | 4 | — | compatibility, view, view/compile, view/template |
| `getContentByPath` | 4 | ✓ | style, view, view/compile |
| `resetStoreInfo` | 3 | ✓ | style, view |
| `isMiniGame` | 3 | ✓ | build-pipeline, compile-target |
| `getViewScriptExts` | 3 | — | npm-builder, view, view/paths |
| `getTemplateExts` | 3 | — | npm-builder, view/compile, view/paths |
| `getComponent` | 3 | ✓ | style, view |
| `getStyleExts` | 2 | — | npm-builder, style |
| `getPages` | 2 | — | build-pipeline, compile-target |
| `getAppConfigInfo` | 3 | ✓ | build-pipeline, config-compiler |
| `getAppName` | 2 | — | build-pipeline, config-compiler |
| `runWithCompilerContext` | 1 | — | build-pipeline（基础设施） |
| `resolveAppAlias` | 1 | ✓ | — |
| `isTemporaryTargetPath` | 1 | — | publish |
| `getTemplateDirectivePrefixes` | 1 | — | compatibility |
| `getPageConfigInfo` | 1 | — | config-compiler |
| `getNpmResolver` | 1 | ✓ | — |
| `getAppStyleScopeId` | 1 | — | compile-target |
| `storeProjectConfig` | 0 | — | — |
| `getRuntimeType` | 0 | — | — |
| `getProjectConfig` | 0 | — | — |

### 初步分类

| 分类 | 函数 | 数量 |
| --- | --- | --- |
| **Packer 侧** | `getNpmResolver`, `resolveAppAlias` | 2 |
| **Packer + Scheme 共用** | `getWorkPath`, `getTargetPath`, `getAppId`, `getContentByPath`, `getComponent`, `getDependencyGraph`, `getAppConfigInfo`, `resetStoreInfo`, `isMiniGame` | 9 |
| **Scheme 侧** | `getPages`, `getProjectConfig`, `getPageConfigInfo`, `getAppName`, `getViewScriptExts`, `getViewScriptTags`, `getTemplateExts`, `getTemplateDirectivePrefixes`, `getStyleExts`, `storeInfo`, `getRuntimeType`, `getAppStyleScopeId`, `isTemporaryTargetPath`, `storeProjectConfig` | 14 |
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

## 7. 分析结果（P-PR01..04 深度审计）

### P-PR01 — W2 logic/index.ts 深度审计

#### resolveDependencyId (L459-509)

- 模块标识解析：miniprogram_npm/ 前缀 → 相对路径(./, ../) → 绝对路径(/) → app 别名 → bare specifier(@, npm)
- **Packer 胚**：模块标识解析是 Packer 核心能力
- **Scheme 耦合**：resolveAppAlias 读 configInfo.appInfo.resolveAlias（Scheme 状态）；resolveNpmModuleId 读 getNpmResolver()（Scheme 基础设施）；resolveRelativeModuleId 读 getWorkPath()（Scheme 路径状态）
- **结论**：可参数化为 resolver hook（alias + npm + path 三合一）

#### buildJSByPath (L88-415) — Packer 核心管线

1. 模块文件解析（getJSAbsolutePath → getWorkPath）
2. 源码读取（getContentByPath → fs.readFileSync 包装）
3. 图写（getDependencyGraph().addFile kind='logic'）
4. AST parse（parseSync from oxc-parser）
5. AST walk（walk from oxc-walker）
   - 依赖收集（addDependency kind='logic'）
   - 资产收集（addFile kind='logic' for local assets）
   - 组件解析（getComponent → configInfo.componentInfo 查表）
   - 分包配置（getAppConfigInfo().subPackages）
   - 组件依赖过滤（getDirectDependencies('component') — 读 Scheme 节点边）
   - 路径重写（MagicString.overwrite）
6. Sourcemap（MagicString.generateMap）
7. Transform（esbuild.transform → CJS + minify）
8. Sourcemap remap（remapSourcemap）
9. 产物 → compileRes → writeCompileRes → emitEntry

#### hooks 收敛分析

11 种 env.ts 调用可收敛为 4 个 hooks：

| Hook | 包含的 env.ts 函数 | 语义 |
| --- | --- | --- |
| graphWriter | getDependencyGraph（addFile + addDependency + getDirectDependencies） | 写模块边 + 读组件依赖（Scheme 节点边） |
| pathProvider | getWorkPath + getTargetPath | sourceRoot + outputRoot（标量参数） |
| resolver | getContentByPath + getNpmResolver + resolveAppAlias + getComponent + getAppConfigInfo | 内容/npm/别名/组件/appConfig 五合一 |
| stateRestore | resetStoreInfo + getAppId + isMiniGame | 状态恢复 + 模块 ID 前缀 + 运行时类型（标量 + 状态） |

**≤5 ✓**。但 resolver hook 粒度较粗（5 函数合一），需验证语义不冲突。

### P-PR02 — W3 env.ts 深度审计

#### storeInfo (L192-213)

- 入口函数：storePathInfo + storeProjectConfig + storeAppConfig + storePageConfig + createInitialDependencyGraph
- **纯 Scheme**：初始化整个工程上下文（路径、配置、图）
- **Packer 无关**：Packer 胚不调 storeInfo（仅 project-store 调）

#### getContentByPath (L?)

- `fs.readFileSync(path, { encoding: 'utf-8' })` — 纯文件读取
- **可参数化**：content(path) => string

#### getComponent (L?)

- `configInfo.componentInfo[src]` — 配置查表
- **可参数化**：component(path) => unknown

#### getNpmResolver (L?)

- `getCompilerContext().npmResolver` — 从 ALS 读
- **可参数化**：直接注入 npmResolver 实例

#### resolveAppAlias (L?)

- 读 configInfo.appInfo.resolveAlias → 别名匹配（endswith('/*') 或全等）
- **可参数化**：alias(specifier) => string | null

#### 图初始化 (L814-899)

- Scheme 填工程图：addNode('app') / addNode(page.path, { type: 'page', entry: true }) / addNode(component.path, { type: 'component' })
- addFile for app.json/app.js/project.config.json（kind='config'）
- addDependency(page.path, 'app', 'app') + addDependency(page.path, dep, 'component')
- **纯 Scheme**：Packer 不参与图初始化

#### 结论

env.ts 不拆。改为注入 PackerContext（4 hooks），Packer 胚通过 context 访问需要的 9 个共用函数。env.ts 保持为 Scheme 基础设施。

### P-PR03 — W4 dependency-graph.ts 跨图遍历分析

#### getAffectedEntries 遍历路径

file → fileOwners → owners → BFS getDirectDependents → 收集 entry=true

跨两侧：
- 'logic' file → 'module' owner (Packer) → dependents 可能是 'page' (Scheme) → entry=true ✓
- 'config' file → 'app' owner (Scheme) → dependents = pages (Scheme) → entry=true ✓

**本质耦合**：一条 file→entry 路径可能跨 Packer 节点和 Scheme 节点。拆成两图需要跨图索引。

#### 拆分方案评估

- **方案 A（拆 + 跨图索引）**：ProjectGraph + ModuleGraph + CrossGraphIndex。复杂度高，getAffectedEntries 需查两图。
- **方案 B（不拆，暴露 Packer API）**：保持一份实例，Packer 用 addModuleFile/addModuleDependency 限定 kind='logic'。简单，零行为风险。

**推荐方案 B**：不拆图。Packer 通过限定 kind 的 API 间接使用同一图实例。

#### getFileKinds 分离

kind 值分两侧：Scheme（config/view/style/app/component）vs Packer（logic）。getFileKinds 返回所有 kind — 用于 compile-stages 选道（Scheme 逻辑）。拆图后需查两图合并。方案 B 下无需拆。

### P-PR04 — W1 emit.ts parameterize 验证

#### modDefine 参数化

`modDefine('${moduleId}', function(require, module, exports) { ... })` 出现在 3 处。

参数化为 `wrapModule(moduleId: string, code: string): string`：
- Packer 提供函数签名
- Scheme 提供 wrapModule 实现（注入 modDefine 格式器）
- 行为 0 可守：wrapModule 返回相同字符串即字节等价

#### getWorkPath 参数化

perModule rebase：`relative(finalOutputDir, resolve(getWorkPath(), sourcePath))`

参数化为 `sourceRoot: string`：直接传入。行为 0 可守。

#### kind 泛化

`kind: 'view' | 'logic'` → 可泛化为 `kind: string` 或移除（strategy 已区分）。
但 kind 用于 BuildModel.entries 键（`${kind}:${entryId}`）和 dev server 路由——移除需改 Scheme 侧。

**推荐**：保留 kind，但 Packer API 接受 kind 作为参数（注入而非硬编码）。

### 计数修正

resetStoreInfo 实际调用 ×1（非 ×2）：`typeof resetStoreInfo` 类型引用被误计为函数调用。总调用 27→26。
