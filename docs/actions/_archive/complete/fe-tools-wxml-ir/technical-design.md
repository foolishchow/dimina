# Technical design — fe-tools-wxml-ir

Status: **决策已冻（2026-09-14）** — D-WIR-1..9 + Review R1..R6；Action **`ready`**；实施须另授权

> 原 `design.draft.md` 已更名为本文件（Review F-008）。

## 目标形状

```text
WXML source
  → parseWxml(source, { sourceFile? }) → Document
  → loadTemplates(Document, ctx) → LoadedGraph
  → getBackend(id).render({ loaded, document? }, ctx) → { code, map? }
```

### Cheerio 角色不变量（F-005）

- cheerio / htmlparser2 **仅**允许作为 **parse 投影工具**（D-WIR-6），把源串变成 Document（含 `loc`）。
- **权威**始终是 Document（及 load 后的 LoadedGraph）。
- `vueBackend` **不得**再以「原始 WXML 字符串 → cheerio → 产物」作为权威路径；过渡期若序列化中间 HTML，输入必须来自 Document/LoadedGraph 投影，不得绕过 IR 重读源文件主路径。

## Document（最小）

以 [`WXML-AST-TYPES`](../../../../wxml/WXML-AST-TYPES.md) 为 **分类指南**：

| 概念 | JS 侧最小约定 |
| --- | --- |
| Document | `{ body: Node[], sourceFile? }` |
| Node | `type` 判别 + **`loc: { start, end }`**（D-WIR-5）；跨文件可选 `sourceFile` |
| Element | `name`, `attrs`, `directives?`, `slot?`, `children`，及 `loc` |
| Value | 首版约定：`{ kind: 'static' \| 'expr' \| 'template', … }`（或等价 `type`）；**expr / template 的表达式体为字符串**（D-WIR-7）；关键插值宜带 `loc`；字段名允许与 `docs/wxml` 同义微调，但三种互斥须可测 |
| Directive | if / elif / else / for / key / hidden（可分期从 attrs 分离） |
| Loc | `{ start, end }` 半开；JS string 索引；行/列派生 |

## LoadedGraph（最小 · F-006）

```js
/**
 * @typedef {object} LoadedGraph
 * @property {Document} document          // 展开后的主文档（或页/组件入口树）
 * @property {Array<{ path: string, document: Document }>} [includes] // 可选：保留展开前片段供诊断
 * @property {object[]} templateModule    // 与今日 instruction.templateModule 同形目标（可分期对齐）
 * @property {object[]} scriptModule      // wxs 等脚本模块列表（编译后代码可挂此）
 * @property {Map<string, string>} [sourceTexts] // sourceFile → 源串（供 loc→line / sourcemap）
 */
```

字段可在 T-IR1 微调，但 **不得**退回「只有 HTML 字符串、无 Document」。

## 阶段归属表（F-002）

| 关注点 | 归属 | 说明 |
| --- | --- | --- |
| 标签/属性/文本/注释 → Node；特殊节点分型；`loc` | **parse** | D-WIR-6 投影 |
| Import / Include **节点保留** | **parse** | D-WIR-3 |
| 路径解析、读盘、依赖图边、include/import **展开**；展开后 `sourceFile` | **load** | |
| 多根包装（页） | **load** | 今日 toCompileTemplate 行为迁此 |
| usingComponents / 组件模块解析上下文 | **load**（ctx） | |
| component-host 包裹（组件） | **load** | 模块边界元数据，非 Vue 特有 |
| `<wxs>` 入树 | **parse** | |
| Wxs **编译**（oxc / processWxsContent） | **load** | 禁止在 parse |
| `<template name>` 收集为 templateModule | **load** | |
| 图片等 assets 收集 / 图边 | **load** | |
| slot 分组、`dimina-slot-group`、标签→Vue、指令改写、`compileTemplate` | **vueBackend** | Vue 特有 |
| optional-chaining 等表达式改写 | **vueBackend**（或 backend 共享 util） | 首版字符串路径 D-WIR-7 |
| Backend 选择 | **view worker / view 编译入口** | D-WIR-8；不写 platform |

## Backend 接口（F-001）

```js
/**
 * @typedef {object} BackendContext
 * @property {boolean} sourcemap
 * @property {object} compileConfig
 * @property {object} [module]           // 页/组件模块元数据（path、usingComponents…）
 * @property {object} [componentPlaceholder]
 */

/**
 * @typedef {object} BackendRenderInput
 * @property {import('./document').LoadedGraph} loaded
 * @property {object} [document]         // 可选快捷：等同 loaded.document
 */

/**
 * @typedef {object} BackendResult
 * @property {string} code
 * @property {object|string|null} [map]
 * @property {object} [meta]             // 可选：instruction 残余等
 */

/**
 * @typedef {object} WxmlBackend
 * @property {string} id                 // 如 'vue' | 'stub'
 * @property {(input: BackendRenderInput, ctx: BackendContext) => BackendResult | Promise<BackendResult>} render
 */

// registry
registerBackend(backend)  // 同 id **抛错**（禁静默覆盖）；测例先 unregister 或换 id
unregisterBackend(id)     // 可选；消融/测例用
getBackend(id)
listBackends()
```

- **backend₀**：`id: 'vue'`（webview）。
- **桩**：`id: 'stub'`（或 `count`）——`render` 可返回空/`ok` 标记，**证明注册表真实**（A-WIR2）；不要求可产物。
- **生产路径**：默认且**仅**使用 `vue`；本 Action **不**提供用户可见的 backend 切换选项。其它 id 仅测例 / 消融注册。
- 选择点在 view 编译路径（D-WIR-8），**不**经 `platform`。

## 模块落点（F-006）

约定目录（可微调文件名，轴不变）：

```text
fe/tools/bundler/src/compiler/wxml/
  document.js      // 类型约定 / 工厂（可选）
  parse.js         // parseWxml
  load.js          // loadTemplates
  backends/
    registry.js
    vue.js
    stub.js        // 测例桩；可仅测试可见
view-compiler.js   // 编排：parse → load → getBackend → 既有缓存/打包壳
```

## 与今日 view-compiler 的迁法

| 步骤 | 做法 |
| --- | --- |
| T-IR0 | `wxml/parse.js` 投影 + Document/loc 测例 |
| T-IR1 | `wxml/load.js`；归属表 load 行迁入 |
| T-IR2 | `backends/vue.js`；view-compiler 薄编排；P-WIR01/02 |
| T-IR3 | registry + stub；消融 P-WIR06 |

## 已冻结

| ID | 内容 |
| --- | --- |
| **D-WIR-1** | 仅 JS |
| **D-WIR-2** | `docs/wxml` = 形状指南；表达式细节可分期 |
| **D-WIR-3** | 特殊节点先入树，展开/编译后置 |
| **D-WIR-4** | 节点保定位；sourcemap ≥ 今日；禁猜行权威路径 |
| **D-WIR-5** | `loc: { start, end }` 半开 / JS string 索引；行列派生；可选 `sourceFile` |
| **D-WIR-6** | parse 首版 = DOM→Document 投影；真扫描后置 |
| **D-WIR-7** | 表达式首版 = 字符串 + 既有 optional-chaining；Accept/Reject 后置 |
| **D-WIR-8** | Backend 选在 view worker/编译路径；parser/Document 无 platform |
| **D-WIR-9** | 行为 0 = bundler 全量 vitest + base nomap/sourcemap **严格** diff=0（无运行时白名单） |

## 待定

无。

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | 草案 → D-WIR-1..9 |
| 2026-09-14 | Review R1 修：Backend 接口、归属表、LoadedGraph、模块落点、cheerio 不变量；更名 technical-design；Goal 取消差分白名单 |
| 2026-09-14 | Review R2/R3 文案：同 id 抛错；生产仅 vue；Value `kind` 三态；README/STATUS 同步 Readiness |
| 2026-09-14 | Review R5：对齐 Experience Residual / Uncovered / 消融纪律 / `[wxml]` 日志（详见 validation + README） |
