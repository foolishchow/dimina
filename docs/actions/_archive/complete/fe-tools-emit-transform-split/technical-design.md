# Technical Design — fe-tools-emit-transform-split

Status: **ready（2026-09-21）** — D-ET-1..13 全冻结；7 轮 readiness review pass（33 Findings 全修正）。

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

## §0 当前架构

### §0.1 logic 管线（`logic/index.ts`）

```text
buildJSByPath(module, ...):
  // parse+walk（oxc）
  parseSync(modulePath, sourceCode) → AST
  MagicString(sourceCode) → s
  walk(ast, { enter(node) { ... } })    // 依赖收集 + 路径重写
  // sourcemap
  s.generateMap() → preEsbuildMap
  // transform（esbuild CJS）— 焊在这里
  esbuild.transform(modifiedCode, { format:'cjs', target, loader, sourcemap })
  remapSourcemap(esbuildMap, preEsbuildMap)
  // 产出
  compileInfo = { path, code: cjsCode, map, sourceFile, logicDeps }
```

- parse+walk + transform 焊在同一个函数 `buildJSByPath`（673 行）
- `compileJS` 编排：遍历页面/分包，逐模块调 `buildJSByPath`

### §0.2 view 管线（`view/index.ts`）

```text
buildCompileView(page, ...):              // 编排器 + 单模块编译 混在一起
  compileModule(page):                     // 第一遍编译
    toCompileTemplate(page) → instruction  // WXML parse（含 wxs 处理——transTagWxs 调 processWxsContent）
    compileTemplate(tpl) → renderCode       // Vue 模板编译
    insertWxsToRenderResult(...)            // render 后处理（oxc: wxs 注入 + _ctx 成员访问）
    concatSourcemap(moduleChunks) → code+map
    scriptRes.set(page.path, code)
  递归 buildCompileView(component):          // 组件编译
    compileModule(component) → scriptRes
  compileModuleWithAllWxs(page):             // 第二遍编译（含全部 wxs）
    toCompileTemplate(page) → instruction
    compileTemplate(tpl) → renderCode
    insertWxsToRenderResult(allScriptModules)
    scriptRes.set(page.path, code)  // 覆盖第一遍
```

- 二次编译：第一遍不知道组件 wxs → 第二遍 `compileModuleWithAllWxs` 覆盖
- `insertWxsToRenderResult`（render 后处理）在 `compileModule` 内（L573）；`processWxsContent` 在 `transTagWxs`/`loadWxsModule`（WXML parse 链）；`addOptionalChaining` 在 `parseSafeBraceExp`/`transformTextInterpolation`（表达式处理）——三者已是独立函数，编排散落各处
- emit：`compileML` 调 `emitEntry({ strategy:'bundle', ... })` → `produceEntry` + `sink.write`

### §0.3 style 管线（`style/index.ts`）

```text
buildCompileCss(page, ...):
  // parse+walk（less + postcss）
  less.compile(source) → CSS + map
  compileStyle({ source, postcssPlugins: [styleTransformPlugin] }) → scoped CSS + map
    // styleTransformPlugin: rpx / tag / @import / asset
  postcss([externalClass, autoprefixer, (cssnano if sourcemap+minify)]) → CSS + map
    // sourcemap=true+minify: cssnano（postcss 插件，一次 pass）
    // sourcemap=false+minify: esbuild.transform(css, { loader:'css', minify:true })  ← 焊在这里
  return { code, map }

compileSS(pages, root, ...):
  for page of pages:
    result = buildCompileCss(page)
    sink.write({ entryId, kind:'style', files: [{path, code}], sourcemaps })  // 手搓 EmitEntry
```

- cssnano（sourcemap=true+minify）在 postcss pass 内（需 AST）
- esbuild CSS minify（sourcemap=false+minify）在 `buildCompileCss` 内（应归 emit）
- emit：手搓 EmitEntry + `sink.write`（不走 `produceEntry`）

### §0.4 emit 现状

```text
produceEntry(params): EmitEntry           // 纯函数（无 sink），策略: bundle/perModule
emitEntry(params) = produceEntry + sink    // wrapper，view 用
logic:  emit-worker 内 produceEntry → return → BuildModel.add（emit-relocate 已定）
view:   compile-worker 内 emitEntry → sink.write → BuildModel.add（streaming）
style:  compile-worker 内手搓 EmitEntry → sink.write（streaming，不走 produceEntry）
```

## §1 目标架构

### §1.1 统一管线

```text
parse+walk → transform(logic only) → emit
```

| 步骤 | 职责 | esbuild? | 产出 |
| --- | --- | --- | --- |
| parse+walk | parser-based 源码处理 | 不碰 | `EmitModule` / `EmitModule[]` |
| transform | CJS 转换（logic 专有） | 是（`format:'cjs'`） | `EmitModule` |
| emit | modDefine + sourcemap + package + optional minify | 是（minify option） | `EmitEntry` |

### §1.2 logic 目标

```text
logicParseWalk(source: string, modulePath: string, options: LogicParseWalkOptions): Promise<EmitModule>
  // oxc parseSync + walk（依赖收集 + MagicString 路径重写）
  // sourcemap: MagicString.generateMap → preEsbuildMap
  // graph 写入: getDependencyGraph().addFile/addDependency/clearOutgoingEdges（side effect，D-ET-7）
  // env.ts 直调: getWorkPath/getComponent/... （D-ET-8）
  // 不含 esbuild
  → EmitModule { moduleId, code: modifiedCode, map: preEsbuildMap, extraInfoCode }

transformCjs(module: EmitModule, options: CjsTransformOptions): Promise<EmitModule>
  // esbuild.transform(code, { format:'cjs', target, platform:'neutral', loader, sourcemap, sourcefile, sourcesContent })
  // remapSourcemap(esbuildMap, module.map) if both
  // 错误回退: { ...module, code: module.code, map: null }
  // extraInfoCode 透传
  → EmitModule { moduleId, code: cjsCode, map: remappedMap, extraInfoCode }

produceEntry({ strategy:'perModule', modules, ... }): Promise<EmitEntry>
  // 不变（modDefine + sourcemap rebase + merge + package + optional minify）
```

编排：
```text
compileJS(pages, root, mainCompileRes, ...):
  for module of pages:
    // buildJSByPath 内部：
    compileInfo = { path: module.path, code: '', sourceFile: null }  // CompileInfo
    compileRes.push(compileInfo)  // push 早于 walk（circular dep 检测）
    emitModule = logicParseWalk(source, modulePath, { isTypeScript, sourcemap })
    emitModule = await transformCjs(emitModule, { target, loader, sourcemap, sourceFile })
    // 从 EmitModule 填充 CompileInfo
    compileInfo.code = emitModule.code
    compileInfo.map = emitModule.map
    compileInfo.extraInfoCode = emitModule.extraInfoCode
    compileInfo.sourceFile = ...（从 modulePath + workPath 派生）
  // emit 在 emit-worker（emit-relocate 已定，不改）
```

`compileRes` 留 `CompileInfo[]`（不是 `EmitModule[]`）——`EmitModule` 是 parse+walk/transform 的中间体，`buildJSByPath` 从 `EmitModule` + module info 构造 `CompileInfo` 后 push。这保证：
- `hasCompileInfo`（读 `element.path`）正常工作
- `emitBuckets` shape 不变（`{ path, code, map?, extraInfoCode? }`）
- `build-pipeline.ts` `toEmitModule`（读 `m.path`）正常工作
- `build-pipeline.ts` 真正不变

### §1.3 view 目标

```text
viewParseWalk(pageModule: ViewModule, options: ViewParseWalkOptions): Promise<EmitModule[]>
  // 1. 预 walk 组件树（toCompileTemplate only，不 Vue compile）
  //    → 收集全部 wxs 模块（页面 + 所有组件的）
  //    预 walk 不触发 compileResCache（只 parse 不 compile）
  // 2. render 后处理（留 compileModule 内，用 allScriptModules）
  //    insertWxsToRenderResult（oxc: wxs 注入 + _ctx 成员访问）
  //    注：processWxsContent / addOptionalChaining 已在 step 1 预 walk 中触发
  //    （在 toCompileTemplate → transTagWxs / 表达式处理链内）
  // 3. 一次编译（compileModule 传全部 wxs）
  //    toCompileTemplate + compileTemplate + insertWxsToRenderResult + concatSourcemap
  //    page 改为用 createLineSourcemap（匹配当前第二遍）
  //    components 条件用 createOriginsSourcemap/createLineSourcemap（不变）
  // 4. scriptRes Map → EmitModule[]
  // 不含 esbuild
  → EmitModule[]

emitEntry({ strategy:'bundle', modules, ... })  // 不变（produceEntry + sink）
```

#### `compileModule` 新签名

```ts
// 之前（compileModule 用 instruction.scriptModule——页面自己的 wxs）
function compileModule(
    module: ViewModule,
    isComponent: boolean,
    scriptRes: Map<string, string>,
    options: { skipTemplatePaths: Set<string>; sourceMapRes: Map<string, string> }
): Record<string, unknown> | null

// 之后（compileModule 接受预收集的 allScriptModules——全部 wxs）
function compileModule(
    module: ViewModule,
    isComponent: boolean,
    scriptRes: Map<string, string>,
    options: {
        skipTemplatePaths: Set<string>
        sourceMapRes: Map<string, string>
        allScriptModules: Array<{ path: string; code: string; originalName?: string }>  // 新增：预收集的 wxs
    }
): Record<string, unknown> | null
```

`compileModule` 内部变更：
- `compileTemplateModuleRender` 调用改用 `options.allScriptModules`（替代 `compileInstruction.scriptModule`）——匹配 `compileModuleWithAllWxs` L844
- `compileInstruction.scriptModule` 设为 `options.allScriptModules`（替代 `instruction.scriptModule`）
- `insertWxsToRenderResult`（L573）通过 `compileInstruction.scriptModule` 间接用 `allScriptModules`——匹配 `compileModuleWithAllWxs` L846
- sourcemap：page（`isComponent=false`）总是用 `createLineSourcemap`（替代条件 `origins` / `createOriginsSourcemap`）——匹配 `compileModuleWithAllWxs` L837

#### 缓存交互

**缓存写路径**（cache miss → 编译后写缓存）：
- `instruction.scriptModule` = `options.allScriptModules`（匹配 `compileModuleWithAllWxs` L869-872 的 `mergedInstruction.scriptModule = allScriptModules`）
- 当前 `compileModule` L621 写 `compileInstruction`（`scriptModule` = 页面自己的 wxs）→ 新设计写 `allScriptModules`

**缓存读路径**（cache hit → 读缓存）：
- cache hit 时直接用 cached `allScriptModules`（缓存已存全量 wxs）
- **删 `collectAllWxsModules` 收集逻辑**（L529-548）——不再需要从 `scriptRes` 收集，参数已传入全部 wxs
- 失败缓存路径（MC1）不变

**预 walk 不触发 `compileResCache`**：预 walk 只调 `toCompileTemplate`（parse WXML），不调 `compileModule`（compile + cache）

#### `viewParseWalk` 编排

`viewParseWalk` 接管当前 `buildCompileView` 的全部编排职责：

1. **预 walk**（递归组件树）：
   - `activePaths` 防环（和现在一样）
   - 每节点调 `toCompileTemplate`（只 parse WXML，不 Vue compile）
   - 收集 `instruction.scriptModule`（页面 wxs）+ 递归组件 wxs
   - 收集 `instruction.templateModule`（模板去重用）
   - `inheritedTemplatePaths` / `skipTemplatePaths` 传递（和现在一样）

2. **WXS 处理 + render 后处理改编排**：
   - `processWxsContent`（oxc parse+walk: getRegExp/getDate/require）——在 `transTagWxs`/`loadWxsModule` 内，预 walk 调 `toCompileTemplate` 时已触发
   - `addOptionalChaining`（oxc parse+walk: optional chaining）——在 `parseSafeBraceExp`/`transformTextInterpolation` 内，表达式处理时已触发
   - `insertWxsToRenderResult`（render 后处理）——留 `compileModule` 内（L573），用 `allScriptModules`（通过 `compileInstruction.scriptModule = allScriptModules`）替代 `instruction.scriptModule`——匹配 `compileModuleWithAllWxs` L846
   - 这些函数留 `view/index.ts`，`parse-walk.ts` import 调用

3. **一次编译**（`compileModule` 传全部 wxs）：
   - MC1 error caching 留在 `compileModule` 调用处（和现在 `buildCompileView` L383-401 一样）
   - `compileModule` 接受 `allScriptModules` 参数
   - page 用 `createLineSourcemap`；components 条件用 `createOriginsSourcemap`/`createLineSourcemap`（不变）

4. **产出 `EmitModule[]`**：
   - `scriptRes` Map → `EmitModule[]` 转换（从 `compileML` 搬进来）
   - 返回 `EmitModule[]`

#### `insertWxsToRenderResult` 归类

`insertWxsToRenderResult` 不是 WXS 处理——它是 **render 后处理**：用 oxc parse+walk 修改 render 函数代码（注入 wxs require 声明 + 处理 `_ctx` 成员访问）。与 `processWxsContent`（WXS 本身的 oxc 处理）区分。

### §1.4 style 目标

```text
styleParseWalk(styleModule: StyleModule, options: StyleParseWalkOptions): Promise<EmitModule>
  // less compile + postcss walk（styleTransformPlugin + externalClass + autoprefixer + cssnano）
  // cssnano 留在此（postcss 插件，需 AST）
  // 不含 esbuild
  → EmitModule { moduleId: page.path, code: css, map: cssMap }

emitStyle(modules: EmitModule[], options: StyleEmitOptions): Promise<EmitEntry>
  // optional esbuild CSS minify（仅 sourcemap=false+minify）
  // package: { entryId, kind:'style', files, sourcemaps }
  → EmitEntry
```

`buildCompileCss` 不含 esbuild（cssnano 留，esbuild 移走）。

### §1.5 函数签名汇总

```ts
// === parse+walk（各自签名，D-ET-1）===

// logic
interface LogicParseWalkOptions {
    isTypeScript: boolean
    sourcemap: boolean
}

async function logicParseWalk(
    source: string,
    modulePath: string,
    options: LogicParseWalkOptions
): Promise<EmitModule>

// view
interface ViewParseWalkOptions {
    sourcemap: boolean
}

async function viewParseWalk(
    pageModule: ViewModule,
    options: ViewParseWalkOptions
): Promise<EmitModule[]>

// style
interface StyleParseWalkOptions {
    sourcemap: boolean   // 匹配 StyleOptions
    minify: boolean      // cssnano 在 sourcemap=true+minify 时触发
}

async function styleParseWalk(
    styleModule: StyleModule,
    options: StyleParseWalkOptions
): Promise<EmitModule>

// === transform（logic 专有，D-ET-3）===

interface CjsTransformOptions {
    target: string        // esTarget.logic
    loader: 'js' | 'ts'
    sourcemap: boolean
    sourceFile?: string
}

async function transformCjs(
    module: EmitModule,
    options: CjsTransformOptions
): Promise<EmitModule>

// === emit ===

// logic/view: produceEntry（不变）
// produceEntry(params: EmitEntryParams): Promise<EmitEntry>

// style: 独立 emitStyle（D-ET-4）
interface StyleEmitOptions {
    entryId: string
    filename: string
    relPrefix: string
    sourcemap: boolean
    minify: boolean
}

async function emitStyle(
    modules: EmitModule[],
    options: StyleEmitOptions
): Promise<EmitEntry>
```

### §1.6 EmitEntry.kind 扩展

```ts
// 之前
interface EmitEntry {
    kind: 'view' | 'logic'
    // ...
}

// 之后
interface EmitEntry {
    kind: 'view' | 'logic' | 'style'  // 加 'style'
    // ...
}
```

当前 style 已用 `kind:'style'`（通过 `Record<string, unknown>` 绕过类型检查）。本 Action 修类型缺口。

## §2 行为 0 分析

### §2.1 logic

- `logicParseWalk` = `buildJSByPath` 的 parse+walk 部分，原样抽
- `transformCjs` = `buildJSByPath` 的 esbuild 部分（esbuild 调用起始于 L431），原样抽
- esbuild 调用参数不变（`format:'cjs'`, `target`, `platform:'neutral'`, `loader`, `sourcemap`, `sourcefile`, `sourcesContent`）
- sourcemap remap 不变（`remapSourcemap(esbuildMap, preEsbuildMap)`）
- 错误回退不变（`code: modifiedCode`, `map: null`）
- **diff=0 保证**

### §2.2 view

- 预 walk 用 `toCompileTemplate`（已有函数，只 parse 不 compile）
- `compileModule` 传全部 wxs → 一次编译 = 当前第二遍 `compileModuleWithAllWxs` 的行为
- scriptRes 顺序：page 先、components 后（和现在一样）。Map 保持插入顺序，覆盖不改变位置 → 最终顺序不变
- page sourcemap：新设计总是用 `createLineSourcemap`（匹配 `compileModuleWithAllWxs` 第二遍）。当前 `compileModule` 条件用——`origins` 存在时用 `createOriginsSourcemap`，不存在时用 `createLineSourcemap`。仅 `origins` 存在的 page 受影响——这些 page 的最终产出已来自 `compileModuleWithAllWxs`（`createLineSourcemap`），所以改 `compileModule` 后最终产出应一致
- component sourcemap：条件用 `createOriginsSourcemap`/`createLineSourcemap`（不变）
- `emitEntry` / `produceEntry` 不变
- **行为 0 风险**：page sourcemap 从条件 `createOriginsSourcemap`/`createLineSourcemap` 改为总是 `createLineSourcemap`。须实施时跑 sourcemap diff 验证。若 diff≠0，回退到保留 `compileModuleWithAllWxs`（仅做 parse+walk 抽出，不消除二次编译）

### §2.3 style

- `styleParseWalk` = `buildCompileCss` 的 less + postcss 部分（含 cssnano，不含 esbuild）
- cssnano 留在 postcss pass 内（同一次 pass，同 sourcemap）→ **diff=0**
- `emitStyle` 的 esbuild CSS minify = 当前 `buildCompileCss` 内的 esbuild 调用（`transform(css, { loader:'css', minify:true })`），同输入同输出 → **diff=0**
- 四条路径全 diff=0

### §2.4 风险点

| 风险 | 缓解 |
| --- | --- |
| view page sourcemap 差异：`compileModule` 当前条件用 `createOriginsSourcemap`（`origins` 存在时）或 `createLineSourcemap`（不存在时）；新设计总是用 `createLineSourcemap`（匹配 `compileModuleWithAllWxs`） | 仅 `origins` 存在的 page 受影响；最终产出已来自 `compileModuleWithAllWxs`（`createLineSourcemap`），应一致；实施时 diff 验证，若 diff≠0 回退 |
| view scriptRes 顺序变化 | 预 walk 不写 scriptRes；编译顺序和现在一样（page 先、components 后） |
| style cssnano 脱离 postcss pass | cssnano 不移动（Phase 1 留在 parse+walk） |
| logic transform 错误回退 map 不一致 | `transformCjs` 回退 `map: null`（匹配当前行为） |

## §3 落点

### §3.1 新增文件

| 文件 | 内容 |
| --- | --- |
| `compiler/logic/parse-walk.ts` | `logicParseWalk` + `LogicParseWalkOptions` |
| `compiler/logic/transform.ts` | `transformCjs` + `CjsTransformOptions` |
| `compiler/view/parse-walk.ts` | `viewParseWalk` + `ViewParseWalkOptions`（预 walk + 一次编译编排）。`compileModule` / `processWxsContent` / `addOptionalChaining` / `insertWxsToRenderResult` 等已有函数**留 `view/index.ts`**，`parse-walk.ts` import 调用 |
| `compiler/style/parse-walk.ts` | `styleParseWalk` + `StyleParseWalkOptions`（less + postcss，含 cssnano） |
| `compiler/style/emit.ts` | `emitStyle` + `StyleEmitOptions` |

### §3.2 修改文件

| 文件 | 改动 |
| --- | --- |
| `compiler/logic/index.ts` | `buildJSByPath` 调 `logicParseWalk` + `transformCjs`；删内联 parse+walk + esbuild |
| `compiler/view/index.ts` | 删 `buildCompileView`（编排搬进 `viewParseWalk`）；`compileML` 调 `viewParseWalk`；`compileModule` 接受预收集 wxs；删 `compileModuleWithAllWxs`；`compileModule` page 用 `createLineSourcemap` |
| `compiler/style/index.ts` | `buildCompileCss` 调 `styleParseWalk`（less+postcss，含 cssnano）；删 esbuild；`compileSS` 调 `emitStyle` + `sink.write` 替代手搓 |
| `compiler/pipeline/emit.ts` | `EmitEntry.kind` 加 `'style'` |

### §3.3 不变文件

| 文件 | 理由 |
| --- | --- |
| `compiler/pipeline/emit-engine.ts` | logic emit-worker 不变 |
| `compiler/pipeline/emit-worker-entry.ts` | 同上 |
| `compiler/worker-runtime/*` | 不变 |
| `compiler/pipeline/build-pipeline.ts` | (3.5) task 不变 |
| `compiler/pipeline/stage-channel.ts` | 不变 |

## §4 与 emit-relocate 的关系

```text
emit-relocate (complete):
  - produceEntry 从 emitEntry 拆出（无 sink）
  - logic emit 搬到 emit-worker
  - executeTask 泛化（支持 emit）
  - emitBuckets 结构化分桶

本 Action:
  - produceEntry 不动（emit-relocate 已拆好）
  - 三车道 parse+walk 从 compile 抽出
  - logic transform（CJS）从 compile 抽出
  - view 二次编译消除
  - style emit 统一（emitStyle）+ CSS minify 归属调整
  - EmitEntry.kind 加 'style'
```

## §5 Phase 2（未来另门）

cssnano 也移到 emit（两次 postcss pass + sourcemap 串联）：
- parse+walk: postcss(ext + auto) → CSS + sourcemap1
- emit: postcss(cssnano) → minified CSS + sourcemap2（chained from sourcemap1）
- 需验证：单次 pass sourcemap vs 两次 pass 串联 sourcemap，映射粒度可能不同
- CSS 字节应一致；sourcemap 字节不保证
- 若 diff≠0，cssnano 留 parse+walk（Phase 1 状态）
