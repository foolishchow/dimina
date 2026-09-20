# Requirements — fe-tools-emit-transform-split

## 背景

三车道（logic / view / style）的编译管线 `parse+walk → transform → emit` 焊在各自 compile 函数里。parse+walk 没有标准化接口。logic CJS 转换焊在 `buildJSByPath`。view 二次编译（`compileModuleWithAllWxs`）可消除。style CSS minify 藏在 `buildCompileCss`。minify 是 emit 的 option，不是独立的 transform 步。

## 关键澄清

- **minify = emit option**：`produceEntry` 已经这么工作——`minify=true` 时 emit 内部调 esbuild，`minify=false` 时跳过。不在本 Action 改变。
- **transform = CJS 转换**：`esbuild.transform({ format:'cjs' })`，ESM→CJS 模块语义转换。只有 logic 有。view/style 无 transform 步。
- **parse+walk = parser-based 源码处理**：oxc（logic/view）+ Vue（view）+ less+postcss（style）。含依赖收集、路径重写、模板渲染、rpx 等。不碰 esbuild。

## 需求

### R1 — parse+walk 标准化

三车道的 parse+walk 须从各自 compile 函数中抽出为独立可调用函数：

- **logic**：从 `buildJSByPath`（`logic/index.ts`）抽出 oxc parse + walk（依赖收集 + MagicString 路径重写）+ sourcemap → `EmitModule`
- **view**：从 `view/index.ts` 抽出 parse+walk 编排为 `viewParseWalk`。含预 walk 组件树（`toCompileTemplate` only）收集全部 wxs + WXS 处理（`processWxsContent` / `addOptionalChaining`，已是独立函数，已在预 walk 中触发）+ render 后处理（`insertWxsToRenderResult`，留 `compileModule` 内，用 `allScriptModules` 替代 `instruction.scriptModule`）+ Vue `compileTemplate` → render + sourcemap → `EmitModule[]`。**消除二次编译**（删 `compileModuleWithAllWxs`）。
- **style**：从 `style/index.ts` 抽出 less compile + postcss walk（rpx / external class / tag / `@import` / asset）+ sourcemap → `EmitModule`

parse+walk 产出标准化模块中间体（`EmitModule` / `EmitModule[]`），不含 esbuild 调用。

### R2 — transform 抽出（logic 专有）

logic 的 CJS 转换须从 `buildJSByPath`（L431）抽出为独立 transform 函数：

```ts
// 从 buildJSByPath 抽出
transformCjs(module: EmitModule, options: CjsTransformOptions): Promise<EmitModule>
// esbuild.transform(code, { format:'cjs', target, loader, sourcemap })
// + sourcemap remap（串联 MagicString sourcemap）
```

view/style 无 CJS 转换，无 transform 步。

### R3 — emit 统一

emit 保持 `produceEntry` 语义：modDefine 拼接 + sourcemap rebase/merge + package → EmitEntry，`minify` 是 emit 的 option。

- **logic**：`produceEntry`（perModule 策略），已在 emit-worker
- **view**：`produceEntry`（bundle 策略）+ `emitEntry` wrapper（streaming），在 compile-worker
- **style**：独立 `emitStyle` 函数（package + optional esbuild CSS minify，无 modDefine），替代手搓 EmitEntry。`EmitEntry.kind` 加 `'style'`

style CSS minify 分两阶段：
- **Phase 1（本 Action）**：cssnano 留 parse+walk（postcss 插件，需 postcss AST）；esbuild CSS minify 从 `buildCompileCss` 移到 `emitStyle`（仅 sourcemap=false+minify 时触发）。四条路径全 diff=0。
- **Phase 2（未来另门）**：cssnano 也移到 emit（两次 postcss pass + sourcemap 串联），需验证 sourcemap diff=0。

### R4 — view 二次编译消除

WXML parser（`toCompileTemplate`）已能在 parse 阶段给出 wxs 信息（`instruction.scriptModule` + `instruction.templateModule`）。利用此能力：

1. **预 walk**：遍历组件树，每节点调 `toCompileTemplate`（只 parse WXML，不 Vue compile）→ 收集全部 wxs 模块（页面 + 所有组件的）
2. **WXS 处理 + render 后处理改编排**：`processWxsContent` + `addOptionalChaining`（WXS 处理，已在预 walk 中触发）+ `insertWxsToRenderResult`（render 后处理，留 `compileModule` 内，用 `allScriptModules` 替代 `instruction.scriptModule`，均已有 oxc parse+walk）→ 处理后的代码
3. **一次编译**：`compileModule(page)` 传入全部 wxs → 一次 Vue compile + 一次 code gen
4. **删 `compileModuleWithAllWxs`**：不再需要

scriptRes 顺序不变：wxs 在编译时写入 scriptRes（不在预 walk 时写），编译顺序和现在一样。Map 保持插入顺序，覆盖不改变位置——最终顺序和现在一致。

sourcemap：`compileModule` 对 page（`isComponent=false`）总是用 `createLineSourcemap`（匹配当前 `compileModuleWithAllWxs` 第二遍产出——当前 `compileModule` 条件用 `createOriginsSourcemap`/`createLineSourcemap`，新设计统一为 `createLineSourcemap`）；components 不变（仍条件用 `createOriginsSourcemap`/`createLineSourcemap`）。

### R5 — 不分治

dev/prod 路径**统一**走 `parse+walk → transform → emit`：
- 不按 `sourcemap` 开关分支决定流程
- minify 是 emit 内部 option，emit 自己判断是否调 esbuild
- 行为不变：sourcemap=true 不 minify；sourcemap=false+minify 做 esbuild

### R6 — 行为 0

- nomap + sourcemap 产物 diff=0
- 全量 vitest 绿
- logic CJS 转换语义不变
- minify 行为不变（emit option：sourcemap=true 跳过，sourcemap=false+minify 做 esbuild）
- perModule per-module minify 粒度不变（emit 内部行为不变）
- bundle 整包 minify 粒度不变（emit 内部行为不变）
- style CSS minify 语义不变
- view Vue template 渲染语义不变
- view 二次编译消除后 scriptRes 顺序不变（bundle 顺序不变 → 产出字节不变）
- view page sourcemap 改为用 `createLineSourcemap`（匹配当前 `compileModuleWithAllWxs` 第二遍产出）
- view component sourcemap 不变（仍条件用 `createOriginsSourcemap`/`createLineSourcemap`）
- parse+walk 依赖收集 / 路径重写 / 资产收集语义不变

## 验收标准

- [x] 三车道 parse+walk 从 compile 函数中抽出为独立函数
- [x] logic CJS 转换从 `buildJSByPath` 抽出为独立 transform 函数
- [x] `buildJSByPath` 不含 esbuild 调用
- [x] view 二次编译消除（`compileModuleWithAllWxs` 删除）
- [x] view WXS 处理（`processWxsContent` / `addOptionalChaining`，已在预 walk 中触发）+ render 后处理（`insertWxsToRenderResult`，留 `compileModule` 内用 `allScriptModules`）——三者已是独立函数，编排由 `viewParseWalk` 统一
- [x] view 预 walk 组件树收集全部 wxs
- [x] style CSS minify 从 `buildCompileCss` 移到 emit
- [x] `buildCompileCss` 不含 esbuild 调用
- [x] style 走独立 `emitStyle` 函数（不再手搓 EmitEntry）
- [x] cssnano 留 parse+walk（postcss 插件，不动）
- [x] esbuild CSS minify 从 `buildCompileCss` 移到 `emitStyle`（仅 sourcemap=false+minify）
- [x] `buildCompileCss` 不含 esbuild 调用
- [x] `EmitEntry.kind` 加 `'style'`（修类型缺口）
- [x] `produceEntry` 的 minify 行为不变（仍是 emit option）
- [x] cssnano 行为不变（同一次 postcss pass，同 sourcemap）
- [x] esbuild CSS minify 语义不变（同调用，同输入输出）
- [x] 三车道均走 parse+walk → transform（logic only）→ emit 流程
- [x] nomap + sourcemap 产物 diff=0
- [x] 全量 vitest 绿
- [x] tsc 0 错
