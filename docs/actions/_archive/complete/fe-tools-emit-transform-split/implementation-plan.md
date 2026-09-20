# Implementation Plan — fe-tools-emit-transform-split

Status: **ready（2026-09-21）** — D-ET-1..13 全冻结，7 轮 readiness review pass（33 Findings 全修正）。待授权 `in_progress`。

## 纪律

- 行为 0：nomap + sourcemap 产物 diff=0；全量 vitest 绿。
- 遵守 D-ET-1..13（见 [README](README.md) 设计决策表）。
- 未授 `in_progress` 不改 `src`。
- 每步完成后跑 diff + vitest 验证行为 0。

## 依赖

```text
fe-tools-emit-relocate (complete; produceEntry 已拆出，logic emit 已在 emit-worker)
        │
        ▼
本 Action ready → in_progress（另授）→ complete
```

## 步骤

### Step 1 — logic: 抽 `logicParseWalk` + `transformCjs`

| 动作 | 文件 |
| --- | --- |
| 新增 `compiler/logic/parse-walk.ts`：`logicParseWalk(source, modulePath, options) → EmitModule`。从 `buildJSByPath` 抽出 oxc parse + walk + MagicString + sourcemap（parse+walk 部分）。graph 写入（side effect）+ env.ts 直调保留。 | `logic/parse-walk.ts`（新增） |
| 新增 `compiler/logic/transform.ts`：`transformCjs(module, options) → EmitModule`。从 `buildJSByPath` 抽出 esbuild CJS + sourcemap remap（esbuild 部分，起始 L431）。`format:'cjs'`+`platform:'neutral'` 硬编码。错误回退 `map: null`。`extraInfoCode` 透传。 | `logic/transform.ts`（新增） |
| `logic/index.ts`：`buildJSByPath` 改为调 `logicParseWalk` → `transformCjs`，从 `EmitModule` 填充 `CompileInfo`（不是直接 push `EmitModule`），删内联 parse+walk + esbuild。`buildJSByPath` 变薄编排。 | `logic/index.ts` |

**验证**：`buildJSByPath` 不含 `parseSync` / `walk` / `transform` import（搬到 parse-walk.ts / transform.ts）；tsc 0 错；vitest 绿；diff=0。

### Step 2 — style: 抽 `styleParseWalk` + 新增 `emitStyle`

| 动作 | 文件 |
| --- | --- |
| 新增 `compiler/style/parse-walk.ts`：`styleParseWalk(styleModule, options) → EmitModule`。从 `buildCompileCss` 抽出 less + postcss（styleTransformPlugin + externalClass + autoprefixer + cssnano）。**不含 esbuild**。 | `style/parse-walk.ts`（新增） |
| 新增 `compiler/style/emit.ts`：`emitStyle(modules, options) → EmitEntry`。package + optional esbuild CSS minify（仅 sourcemap=false+minify）。`EmitEntry.kind` = `'style'`。 | `style/emit.ts`（新增） |
| `style/index.ts`：`buildCompileCss` 改为调 `styleParseWalk`，删 esbuild。`compileSS` 改为调 `emitStyle` + `sink.write`，替代手搓 EmitEntry。 | `style/index.ts` |
| `pipeline/emit.ts`：`EmitEntry.kind` 加 `'style'`。 | `pipeline/emit.ts` |

**验证**：`buildCompileCss` 不含 `transform` import；`compileSS` 不含手搓 EmitEntry；tsc 0 错；vitest 绿；diff=0（四条路径）。

### Step 3 — view: 预 walk + WXS/render 后处理改编排 + 消除二次编译

| 动作 | 文件 |
| --- | --- |
| 新增 `compiler/view/parse-walk.ts`：`viewParseWalk(pageModule, options) → EmitModule[]`。含预 walk 组件树（`toCompileTemplate` only，`activePaths` 防环 + `inheritedTemplatePaths`/`skipTemplatePaths`）→ 收集全部 wxs（`processWxsContent` / `addOptionalChaining` 已在预 walk 中触发）→ 一次编译（`compileModule` 传全部 wxs，`insertWxsToRenderResult` 用 `allScriptModules`，MC1 error caching 留在调用处）→ `scriptRes` Map → `EmitModule[]`（转换从 `compileML` 搬进来）。 | `view/parse-walk.ts`（新增） |
| `view/index.ts`：`compileModule` 接受 `allScriptModules` 参数（替代 `instruction.scriptModule`）。`compileTemplateModuleRender` 调用改用 `options.allScriptModules`。缓存写 `instruction.scriptModule` = `options.allScriptModules`。缓存读删 `collectAllWxsModules` 收集逻辑。`compileModule` page（`isComponent=false`）总是用 `createLineSourcemap`（替代条件 `origins`/`createOriginsSourcemap`）。components 不变。 | `view/index.ts` |
| `view/index.ts`：删 `compileModuleWithAllWxs`。删 `buildCompileView`（编排搬进 `viewParseWalk`）。`compileML` 改为调 `viewParseWalk`，删 `scriptRes` → `EmitModule[]` 转换（搬进 `viewParseWalk`）。 | `view/index.ts` |
| `view/index.ts`：`compileML` 调 `viewParseWalk` → `EmitModule[]` 喂 `emitEntry`（emitEntry 调用不变）。 | `view/index.ts` |

**验证**：`compileModuleWithAllWxs` 已删；`buildCompileView` 已删（`grep -r 'buildCompileView' src/` 无命中）；tsc 0 错；vitest 绿；diff=0（page sourcemap `createLineSourcemap` 一致）。

### Step 4 — 清理 + 类型修正

| 动作 | 文件 |
| --- | --- |
| 兜底 grep：确认 Step 2 `EmitEntry.kind` 加 `'style'` 已完成；清理死 import。 | `pipeline/emit.ts` |
| 兜底 grep：确认 `buildJSByPath` 内联 parse+walk + esbuild 残留已删（Step 1 应已删）。 | `logic/index.ts` |
| 兜底 grep：确认 `buildCompileCss` 内联 esbuild 残留已删（Step 2 应已删）。 | `style/index.ts` |
| 确认三车道 compile 函数不含 esbuild import（esbuild 只在 transform.ts / emit.ts / produceEntry 内）。 | 全量 grep |

**验证**：`grep -r 'from .esbuild.' src/compiler/logic/ src/compiler/style/` 只命中 transform.ts / emit.ts；`grep -r 'compileModuleWithAllWxs' src/` 无命中；tsc 0 错；vitest 绿。

### Step 5 — 行为 0 全量验证

| 动作 | 命令 |
| --- | --- |
| nomap 产物 diff | 对比基线（本 Action 实施前 commit） |
| sourcemap 产物 diff | 同上 |
| 全量 vitest | `node <pnpm> test` |
| tsc | `node <pnpm> build` 或 `tsc --noEmit` |
| validator | `python3 <validator> --repo . --all` |

### Step 6 — 更新 acceptance.md + validation.md + review + close

| 动作 |
| --- |
| 更新 acceptance.md（实施后填充证据，勾选 checkbox） |
| 更新 validation.md（实施后填充实际验证结果） |
| 多轮 readiness review（findings 按严重度排序，修正后复检） |
| 跨文档同步检查（README / requirements / TD / IP / acceptance / validation） |
| 回流 architecture-notes（parse+walk / transform / emit 标准化步骤；view 二次编译消除；style emitStyle） |
| close 另授 |

## 实施注意

### logic

- `logicParseWalk` 产出 `EmitModule`，其中 `map` = `preEsbuildMap`（MagicString sourcemap）。
- `transformCjs` 的 `CjsTransformOptions.sourceFile` 从 `compileInfo.sourceFile` 取（调用方传）。
- `buildJSByPath` 变薄：创建 `CompileInfo` → push 到 `compileRes`（早于 walk，circular dep 检测）→ `logicParseWalk` → `transformCjs` → 从 `EmitModule` 填充 `CompileInfo`（`code`/`map`/`extraInfoCode` 从 `emitModule`；`sourceFile` 从 `modulePath`+`workPath` 派生；`component`/`usingComponents` 从 `module` 来）。
- `compileRes` 留 `CompileInfo[]`（不是 `EmitModule[]`）——`EmitModule` 是中间体，`buildJSByPath` 负责转换。
- `logicDeps` 收集仍在 `logicParseWalk` 内（walk 时收集）。
- MC0 `clearOutgoingEdges` 在 `logicParseWalk` 内（walk 前）。
- M2 cache hit 路径不变（`buildJSByPath` 入口的 cache check 不动）。

### view

- 预 walk 只调 `toCompileTemplate`（不 Vue compile），收集 `instruction.scriptModule` + `instruction.templateModule`。
- 预 walk 递归组件树（`getComponent` + `getDependencyGraph().getDirectDependencies('component')`）。
- `activePaths` 防环 + `inheritedTemplatePaths` / `skipTemplatePaths` 模板去重——从 `buildCompileView` 搬进 `viewParseWalk`。
- MC1 error caching 留在 `compileModule` 调用处（和现在一样）。
- WXS 处理（`processWxsContent` / `addOptionalChaining`）已有 oxc 调用，在 `transTagWxs`/`loadWxsModule`/表达式处理内，已在预 walk 中触发。`insertWxsToRenderResult` 是 render 后处理，留 `compileModule` 内（L573），用 `allScriptModules`（通过 `compileInstruction.scriptModule`）替代 `instruction.scriptModule`。
- `compileModule` 签名变：接受 `allScriptModules` 参数（替代 `instruction.scriptModule`）。
- `compileModule` 内部变更：`compileTemplateModuleRender` 调用改用 `options.allScriptModules`；`compileInstruction.scriptModule` 设为 `options.allScriptModules`。
- `compileModule` 缓存写：`instruction.scriptModule` = `options.allScriptModules`（匹配 `compileModuleWithAllWxs`）。
- `compileModule` 缓存读（cache hit）：删 `collectAllWxsModules` 收集逻辑，直接用 cached `allScriptModules`。
- `compileModule` page 路径（`isComponent=false`）：`inMap` 总是用 `createLineSourcemap`（匹配 `compileModuleWithAllWxs`，替代条件 `origins`/`createOriginsSourcemap`）。
- `compileModule` component 路径（`isComponent=true`）：`inMap` 不变（条件 `createOriginsSourcemap`/`createLineSourcemap`）。
- `compileResCache` 失败缓存路径不变（MC1）。
- scriptRes 顺序：wxs 在编译时写（不在预 walk 时写），编译顺序 page 先、components 后。
- `scriptRes` Map → `EmitModule[]` 转换从 `compileML` 搬进 `viewParseWalk`。

### style

- `styleParseWalk` 含 cssnano（postcss 插件，sourcemap=true+minify 时在 postcss pass 内）。
- `emitStyle` 含 esbuild CSS minify（sourcemap=false+minify 时）。
- `buildCompileCss` 变薄：调 `styleParseWalk`，返回 `EmitModule`。
- `compileSS` 变薄：调 `styleParseWalk` → `emitStyle` → `sink.write`。
- `fs.mkdirSync`（`compileSS` L75）是死代码（`materialize` 已建目录），一并删。
- `EmitEntry.kind` 加 `'style'` 后，style 的 `sink.write` 产出类型对齐（不再绕 `Record<string, unknown>`）。

### 通用

- esbuild import 只出现在 `logic/transform.ts`、`style/emit.ts`、`pipeline/emit.ts`（produceEntry 内）。三车道 compile 函数不直接 import esbuild。
- pnpm 路径：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs`。
- validator：`python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all`。

## 验证矩阵

| 车道 | diff=0 | vitest | grep 无残留 |
| --- | --- | --- | --- |
| logic | nomap + sourcemap | 全量 | `buildJSByPath` 无 `parseSync`/`walk`/`transform` |
| view | nomap + sourcemap | 全量 | `compileModuleWithAllWxs` 已删 |
| style | nomap + sourcemap（四路径） | 全量 | `buildCompileCss` 无 `transform` import |
