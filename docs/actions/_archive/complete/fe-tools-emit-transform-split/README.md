# FE Tools Compile Pipeline Split

- Action: `fe-tools-emit-transform-split`
- Status: `complete`
- Updated: 2026-09-21
- Status authority: [Action Status](../../../STATUS.md)
- 前身：[`fe-tools-emit-relocate`](../fe-tools-emit-relocate/README.md)（**complete 已归档**；logic emit 已搬到 emit-worker；`produceEntry` 已从 `emitEntry` 拆出）
- 文档集：[README](README.md) · [requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

三车道（logic / view / style）的编译管线 `parse+walk → transform → emit` 焊在各自 compile 函数里，步骤边界不一致，且 parse+walk 没有标准化接口。

### 现状

| 车道 | parse+walk（焊在 compile 里） | transform | emit |
| --- | --- | --- | --- |
| logic | oxc `parseSync` + walk（依赖收集 + MagicString 路径重写）+ sourcemap | esbuild CJS 转换（ESM→CJS，在 `buildJSByPath` L431） | `produceEntry`（modDefine + sourcemap merge + package），`minify` 是 option |
| view | WXML parse + Vue `compileTemplate`（模板→render）+ oxc parse+walk（optional chaining / wxs）+ sourcemap | —（无 CJS） | `produceEntry`（modDefine + sourcemap merge + package），`minify` 是 option |
| style | less compile + postcss walk（rpx / external class / tag / `@import` / asset）+ sourcemap | —（无 CJS） | 手搓 EmitEntry + sink.write，CSS minify 藏在 `buildCompileCss` 里 |

### 关键澄清

- **minify 是 emit 的 option**，不是 transform。`produceEntry` 已经这么工作：`minify=true` 时 emit 内部调 esbuild，`minify=false` 时跳过。
- **transform = CJS 转换**（`esbuild.transform({ format:'cjs' })`），是模块语义转换（ESM→CJS），不是 minify。只有 logic 有。
- view/style 没有 CJS 转换，没有 transform 步。
- 因此 **transform 和 emit 不交织**——CJS 转换在 modDefine 之前，minify 在 modDefine 之后，但 minify 是 emit 的事，不是 transform 的事。

### 后果

- **parse+walk 没有标准化**：三车道各用各的 parser（oxc / Vue / less+postcss），焊在 compile 函数中间，不可独立调用
- **logic CJS 转换焊在 compile 里**：`buildJSByPath` L431 的 esbuild CJS 调用没有抽出为独立 transform 函数
- **view 二次编译**：`buildCompileView` 先编译页面（不知道组件 wxs）→ 递归编译组件 → 收集 wxs → `compileModuleWithAllWxs` 覆盖重编译。WXML parser（`toCompileTemplate`）已能在 parse 阶段给出 wxs 信息，不需要 Vue compile 就知道 wxs——二次编译可消除
- **view render 后处理焊在 compileModule 里**：`insertWxsToRenderResult`（oxc parse+walk，render 后处理）在 `compileModule` 内调用（L573）。`processWxsContent`（oxc parse+walk: getRegExp/getDate/require）在 `transTagWxs`/`loadWxsModule`（WXML parse 链）内，`addOptionalChaining`（oxc parse+walk）在 `parseSafeBraceExp`/`transformTextInterpolation`（表达式处理）内——这三者已是独立函数，但编排散落各处没统一
- **style CSS minify 藏在 compile 里**：`buildCompileCss` 内部调 esbuild，应归 emit 但现在在 compile
- **style 不走 produceEntry**：手搓 EmitEntry + sink.write，emit 路径不统一
- parse+walk / transform / emit 不可独立调度——HMR patch / Packer extraction / config-only rebuild 的前置条件缺失

## Goal

将三车道的编译管线拆成**三个标准化步骤**，每步为独立可调用的函数：

```text
parse+walk → transform → emit
```

### 步骤定义

| 步骤 | 职责 | 不碰 |
| --- | --- | --- |
| **parse+walk** | parser-based 源码处理：解析源码 → AST → 遍历 → 依赖收集 / 路径重写 / 模板渲染 / rpx 等 → 产出标准化模块中间体 | esbuild |
| **transform** | esbuild CJS 转换（ESM→CJS），logic 专有；view/style 无此步 | modDefine、sourcemap merge、package、minify |
| **emit** | modDefine 拼接 + sourcemap rebase/merge + package → EmitEntry；`minify` 是 emit 的 option（内部调 esbuild 或跳过） | — |

### 三车道目标

| 车道 | parse+walk | transform | emit |
| --- | --- | --- | --- |
| logic | oxc parse + walk → 依赖收集 + MagicString 路径重写 + sourcemap | CJS 转换（esbuild） | modDefine + sourcemap rebase + merge + package + optional minify |
| view | 预 walk 组件树（`toCompileTemplate` only）→ 收集全部 wxs；WXS 处理（oxc parse+walk: getRegExp/getDate/require/optional chaining，已在预 walk 中触发）；render 后处理（`insertWxsToRenderResult`，oxc: wxs 注入 + `_ctx` 成员访问，留 `compileModule` 内用 `allScriptModules`）；Vue `compileTemplate` → render + sourcemap；**无二次编译** | —（无） | modDefine + sourcemap merge + package + optional minify |
| style | less compile + postcss walk（rpx / external class / tag / asset）+ sourcemap | —（无） | package + optional CSS minify（无 modDefine） |

### view parse+walk 细节（D-ET-9）

逆向分析结论：WXML parser（`toCompileTemplate`）已能在 parse 阶段给出 wxs 信息（`instruction.scriptModule` + `instruction.templateModule`），不需要 Vue compile 就知道 wxs。

消除二次编译的方法：
1. **预 walk**：遍历组件树，每节点调 `toCompileTemplate`（只 parse WXML，不 Vue compile）→ 收集全部 wxs 模块（页面 + 所有组件的）
2. **WXS 处理 + render 后处理改编排**：`processWxsContent`（oxc: getRegExp/getDate/require，在 `transTagWxs`/`loadWxsModule`）+ `addOptionalChaining`（oxc: optional chaining，在表达式处理）已在预 walk 中触发；`insertWxsToRenderResult`（oxc: wxs 注入 + `_ctx` 成员访问，render 后处理非 WXS 处理）留 `compileModule` 内，用 `allScriptModules` 替代 `instruction.scriptModule`→ 处理后的代码。全部已是独立函数
3. **一次编译**：`compileModule(page)` 传入全部 wxs → 一次 Vue compile + 一次 code gen。删 `compileModuleWithAllWxs`

scriptRes 顺序不变：wxs 在编译时写入 scriptRes（不在预 walk 时写），编译顺序和现在一样（page 先、components 后）。Map 保持插入顺序，覆盖不改变位置——最终顺序和现在一致。

sourcemap 差异（D-ET-9 子项）：`compileModule` 对 page（`isComponent=false`）**改为用** `createLineSourcemap`（匹配当前 `compileModuleWithAllWxs` 第二遍行为——当前 `compileModule` 条件用 `createOriginsSourcemap`/`createLineSourcemap`）；components 不变（仍条件用 `createOriginsSourcemap`/`createLineSourcemap`）。

### 中间体形状（D-ET-2）

parse+walk 产出标准化模块中间体，喂给 transform（logic）和 emit（三车道）。复用已有 `EmitModule`：

```ts
interface EmitModule {
    moduleId: string
    code: string          // parse+walk 后的代码（路径重写 / 模板渲染 / rpx 等）
    map: string | null     // parse+walk 的 sourcemap
    extraInfoCode?: string  // modDefine header 注入（logic 专有）
}
```

三车道产出：
- logic：1 个 `EmitModule` per parse+walk 调用（循环里逐模块调）
- view：N 个 `EmitModule` per parse+walk（page + components + wxs 全放 scriptRes）
- style：1 个 `EmitModule` per parse+walk（moduleId = page path，code = CSS）

### 不分治

dev/prod（sourcemap on/off）路径**统一**走 `parse+walk → transform → emit`：
- minify 是 emit 的 option，emit 内部判断是否调 esbuild（minify=false 或 sourcemap=true 时跳过）
- 行为不变：sourcemap=true 不 minify；sourcemap=false+minify 做 esbuild

## 设计决策

| ID | 议题 | 状态 |
| --- | --- | --- |
| D-ET-1 | parse+walk 标准化接口：三车道统一签名 vs 各自签名 | **A：各自签名**。输入类型根本不同（string vs ViewModule vs StyleModule）——统一签名要么泛型空转要么联合类型+类型守卫，增加无价值复杂度。标准化在输出（三车道都产 `EmitModule[]`）和职责（parser-based 源码处理，不碰 esbuild），不在输入签名。和 logic 现有模式一致（`buildJSByPath` 吃 string 产 CompileInfo，`compileJS` 编排）。路 A 不阻碍未来统一入口——Packer 需要时可在上面包一层 |
| D-ET-2 | parse+walk 产出中间体形状 | **复用 `EmitModule[]`**。三车道产出粒度：logic 1 个 / view N 个 / style 1 个 |
| D-ET-3 | transform 函数签名与返回值（logic 专有） | **冻结**。`transformCjs(module: EmitModule, options: CjsTransformOptions): Promise<EmitModule>`。`format:'cjs'`+`platform:'neutral'` 硬编码（固有语义）。options 含 target/loader/sourcemap/sourceFile（调用方从 compile config + module info 构造）。sourcemap remap：`remapSourcemap(esbuildMap, module.map)`（module.map = parse+walk 的 MagicString sourcemap）。错误回退 `map: null`（匹配当前行为——esbuild 失败丢 sourcemap）。`extraInfoCode` 透传。`sourceFile` 在 options 而非 EmitModule（保持 EmitModule 干净） |
| D-ET-4 | emit 函数签名与返回值 | **B：独立 `emitStyle`**。`produceEntry` 不动（bundle + perModule 策略，logic/view 用）；style 走独立 `emitStyle(modules: EmitModule[], options: StyleEmitOptions): Promise<EmitEntry>`（package + optional CSS minify，无 modDefine）。理由：style 和 logic/view 的 emit 根本不同（无 modDefine、无 sourcemap merge、CSS minify vs JS minify）——硬塞进 `produceEntry` = 伪抽象。标准化在输出（都产 `EmitEntry`）和职责（emit = package + optional minify），不在强制一个入口。`EmitEntry.kind` 加 `'style'`（当前 style 已用但类型未声明——修类型缺口） |
| D-ET-5 | logic CJS transform 从 `buildJSByPath` L431 抽出 | **冻结**。纯函数提取——esbuild `{ format:'cjs', target, loader, sourcemap }` 调用 + sourcemap remap 原样搬到独立 transform 函数 |
| D-ET-6 | style CSS minify 从 `buildCompileCss` 移到 emit（作为 emit option） | **冻结（Phase 1）**。cssnano 留 parse+walk（postcss 插件，需 postcss AST，不能脱离 postcss pass）；esbuild CSS minify 从 `buildCompileCss` 移到 `emitStyle`（仅 sourcemap=false+minify 时触发）。四条路径全 diff=0（cssnano 同一次 postcss pass 同 sourcemap；esbuild 同调用同输入输出）。**Phase 2（未来另门）**：cssnano 也移到 emit（两次 postcss pass + sourcemap 串联），需验证 sourcemap diff=0——单次 pass sourcemap vs 两次 pass 串联 sourcemap 映射粒度可能不同。CSS 字节应一致，sourcemap 字节不保证 |
| D-ET-7 | graph 写入：parse+walk 保持 side effect（`getDependencyGraph()` 直调） vs 返回数据让调用方写 | **A：保持 side effect**。参数化 graph 访问 = PackerContext = Packer 范畴（non-goal）；行为 0 安全（写时序不变）；`clearOutgoingEdges` + `getDirectDependencies('component')` 留在 parse+walk 内部不泄漏；HMR dry run 是未来需求，那时再参数化 |
| D-ET-8 | env.ts 依赖：parse+walk 保持直调（`getWorkPath`/`getComponent` 等）vs 参数化为 hooks（= PackerContext，Packer 范畴） | **A：保持直调**。与 D-ET-7 一致（graph 直调，其他 env.ts 也直调，不割裂）；符合 non-goal（参数化 = PackerContext = Packer 范畴）；`resetStoreInfo` 在 worker 入口搭 ALS，parse+walk 假设上下文就绪——和今天一样；可测试性和参数化是 Packer 的收益，不在本 Action ROI 内 |
| D-ET-9 | view parse+walk 编排 + 二次编译消除 | **A：保持当前结构（一个大函数 + 内部子函数），增加预 walk + WXS 处理/render 后处理编排**。预 walk（`toCompileTemplate` only）收集全部 wxs → WXS 处理（已在预 walk 中触发）→ 一次编译（`compileModule` 传全部 wxs，`insertWxsToRenderResult` 用 `allScriptModules` 替代 `instruction.scriptModule`）。删 `compileModuleWithAllWxs`。scriptRes 顺序不变（行为 0）。sourcemap：page 改为用 `createLineSourcemap`（匹配当前第二遍），components 不变（条件用 `createOriginsSourcemap`/`createLineSourcemap`）。WXS 已用 oxc_parser + oxc_walker，不需换 parser |
| D-ET-10 | style less 编译定位 | **parse+walk**。less 是 parser（less→CSS），属 parser-based 源码处理 |
| D-ET-11 | transform 后 sourcemap remap：logic CJS 转换产 esbuild sourcemap，需串联 parse+walk 的 MagicString sourcemap | **冻结**。`remapSourcemap(esbuildMap, preEsbuildMap)` 已有函数，随 transform 一起搬 |
| D-ET-12 | `emitEntry` wrapper（produce + sink）去留 | **保留**。view 仍用 `emitEntry`（= produceEntry + sink，streaming，non-goal：交付方式不变）。logic 用 `produceEntry` 直调（emit-worker，no streaming，emit-relocate 已定）。style inline 调 `emitStyle` + `sink.write`（两行，不值得包 wrapper） |
| D-ET-13 | parse+walk / transform / emit 的执行位置（worker? emit-worker? 主线程?） | **冻结**。non-goal 已定「不改执行位置」——parse+walk/transform 留 compile-worker；logic emit 留 emit-worker；view/style emit 留 compile-worker；交付方式不变 |

## Non-goals

- Packer extraction / PackerContext 参数化（另门；本 Action 是前置之一）
- HMR patch 产物（另门）
- 改 transform 语义 / `modDefine` 格式 / sourcemap 算法 / minify 行为（行为 0）
- 改各车道 parser 选型（oxc / Vue / less+postcss 不换；标准化接口，不统一 parser）
- 改 emit 执行位置（logic 仍在 emit-worker；view/style 仍在各自 compile-worker；交付方式不变）
- view/style 交付方式对齐（streaming vs return，另门）
- 参数化 env.ts 依赖（PackerContext 是 Packer 范畴；见 D-ET-8）

## 边界

```text
emit-relocate（complete 归档）:  logic emit 搬到 emit-worker；produceEntry 已拆出
本 Action:                       三车道 parse+walk+transform+emit 拆标准化步骤
另门:                             view/style 交付方式对齐 / HMR / Packer extraction
```

## 行为 0 守卫

- nomap + sourcemap 产物 diff=0
- 全量 vitest 绿
- logic CJS 转换语义不变（esbuild `{ format:'cjs' }` 调用不变）
- minify 行为不变（emit option：sourcemap=true 跳过，sourcemap=false+minify 做 esbuild）
- perModule per-module minify 粒度不变（emit 内部行为不变）
- bundle 整包 minify 粒度不变（emit 内部行为不变）
- style CSS minify 语义不变
- view Vue template 渲染语义不变
- view 二次编译消除后 scriptRes 顺序不变（bundle 顺序不变 → 产出字节不变）
- view page sourcemap 改为用 `createLineSourcemap`（匹配当前 `compileModuleWithAllWxs` 第二遍产出）
- view component sourcemap 不变（仍条件用 `createOriginsSourcemap`/`createLineSourcemap`）
- parse+walk 的依赖收集 / 路径重写 / 资产收集语义不变
