# FE Tools Compiler Layering

- Action: `fe-tools-compiler-layering`（暂名，转正见待定 ④）
- Status: `draft`
- Updated: 2026-09-15（方案 A 确认；wxml 改造移出到 TODO 候选；本 Action 只做 L0）
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-wxml-ir`](../_archive/complete/fe-tools-wxml-ir/README.md)（缝已交付）；[`fe-tools-wxml-bridge`](../_archive/complete/fe-tools-wxml-bridge/README.md)（napi 桥 + SpanView 已交付）；`fe/tools/crates/dimina-wxml-parser`（483 tests 绿）；architecture-notes「WXML SpanSource」节
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

### 病症一（P-L1）：wxml 双 parser 但 transform 污染 cheerio

`wxml/transform`（load.js）与 `wxml/backends/vue.js` 直接操作 cheerio DOM（`$(elem).replaceWith(...)` / `$includeContent('template').remove()` / `$.html(elem)` 序列化定位），而**未来 napi parser 产出不可变 Rust AST**——切到 napi 后 transform 层崩溃。**"双 parser 可切换"目前是假的**——切面不干净：

| 文件 | cheerio 引用 | 污染点 |
| --- | --- | --- |
| `wxml/parse.js` | 6 处 | 合理（它就是 cheerio 投影实现） |
| `wxml/load.js` | 4 处 + ~15 处 `$()` 操作 | **污染**——transform 层直接操作 cheerio DOM |
| `wxml/backends/vue.js` | 2 处 + `$.html()` 遍历 | **污染**——行源表绑定 cheerio 序列化 |

### 病症二（P-L2）：compiler 下无分类平铺

`src/compiler/` 14 个 .js + 1 个 wxml/ 目录，7112 行，无域分组。找东西靠记忆，新人无从下手，"改 wxml 要看 view-compiler 2420 行混体"。

### 病症三（P-L3）：wxs 寄生在 view-compiler

`processWxsContent` / `transTagWxs` / `processWxsDependency` 散在 view-compiler.js 内——wxs 是独立语言域，却没有自己的目录。

### 病症四（P-L4）：npm 不是编译域，目录维度混淆

npm-builder / npm-resolver 是**依赖解析基建**（被 env.js 消费、服务全部编译域），不是与 wxml/logic/style 平行的"语言域"。原方案把 npm/ 当作域目录是**两轴混淆**。

## Goal

**本 Action 只做 L0 目录归位**（wxml 改造已移出到 TODO 候选，前置为本 Action 合入）：

- compiler/ 平铺 → **方案 A 两轴分组**：轴一编译域 `view / logic / style`（view 含 wxml/wxs/expression/asset 子域）；轴二基建与编排 `core / pipeline`
- `wxml/` → `view/wxml/`（域名修正：view = 渲染面，wxml 是其语法子域）
- wxs 从 view-compiler 抽出 → `view/wxs/`
- view-compiler 2420 行拆散归位（函数原样迁移，零逻辑变更）

## Non-goals

- **wxml 双 parser 改造（ctx.dom 抽象 + napi parser 接入）**——已移出到 TODO 候选，前置为本 Action L0 合入
- logic / style / wxs 的 parser/transform 内部细分——等有第二引擎/复杂 transform 需求再拆
- 不改任何函数体逻辑（transHtmlTag / normalizeTemplateDom / processWxsContent 等原样迁移）
- 不向 didi 推送

## 边界

```text
本 Action:  L0 目录归位（方案 A 两轴 + wxml→view 重命名 + wxs 抽出）——纯移动
下一 Action: wxml 双 parser 改造（ctx.dom + napi）——前置 = 本 Action 合入（TODO 候选）
更后（另立）: wxml transform 纯化 / logic-style-wxs 细分 / 第二后端
```

## 实施顺序（已确认 2026-09-15）

**方案 A**（view 域含子域）+ **wxml 改造移出本 Action**——L0 独立合入后，下一 Action（wxml 双 parser）建在 `view/wxml/` 结构上开发。

## 目录维度（两轴）

```text
轴一：编译域（语言维度）     wxml / logic / style / wxs
轴二：基建与编排（生命周期） core / pipeline
```

### L0 目标结构（方案 A：view 域含子域）

```text
src/compiler/
├── view/                  ← 轴一：view 渲染域（view-compiler.js 拆散 + 现有 wxml/ 迁入）
│   ├── wxml/              ← WXML 语法子域（现有 wxml/{document,parse,load,backends} 迁入）
│   │   ├── parser/
│   │   ├── transform/
│   │   └── backends/
│   ├── wxs/               ← wxs 子域（processWxsContent/transTagWxs 等从 view-compiler 抽出）
│   ├── expression/        ← 表达式子域（parseJs/addOptionalChaining/parseKeyExpression/…）
│   ├── asset/             ← 资产收集子域（transAsses）
│   ├── template/          ← 模板收集子域（transTagTemplate/toCompileTemplate 接线）
│   └── index.js           ← 编排入口（compileML/buildCompileView/compileModule）
├── logic/                 ← 轴一：logic 域（logic-compiler.js 拆入）
├── style/                 ← 轴一：style 域（style-compiler.js 拆入）
├── core/                  ← 轴二：跨域基建
│   ├── env.js             ALS 上下文（936 行）
│   ├── npm-resolver.js    npm 组件寻址
│   ├── npm-builder.js     npm 包构建
│   ├── sourcemap.js       sourcemap 工具
│   ├── compatibility.js   兼容性检查
│   └── expression-parser.js  表达式解析（view 插值用，暂归 core）
└── pipeline/              ← 轴二：编排
    ├── build-pipeline.js  编排壳
    ├── compile-target.js  形态描述
    ├── compile-stages.js  阶段定义
    ├── config-compiler.js 配置编译
    ├── stage-channel.js   worker 通道
    └── publish.js         产物后处理
```

**view-compiler.js 2420 行拆散归位**（函数原样迁移，零逻辑变更）：

| 函数群 | 归属 |
| --- | --- |
| toCompileTemplate / transTagTemplate / transTagWxs / processIncludeConditionalAttrs / collectIncludedComponentTags | view/wxml/transform/ |
| processWxsContent / processWxsDependency / initWxsFilePathMap / scanWxsFiles / registerWxsModule / isWxsModuleByContent | view/wxs/ |
| parseJs / addOptionalChaining / parseSafeBraceExp / transformTextInterpolation / parseKeyExpression / parseClassRules / splitWithBraces / isWrappedByBraces / escapeQuotes | view/expression/ |
| transAsses | view/asset/ |
| normalizeTemplateDom / transHtmlTag / transTag / groupDuplicateNamedSlots / wrapForIfScopes / generateSlotDirective / getProps / generateVModelTemplate | view/wxml/backends/vue 工具袋（暂不拆，归 view/wxml/） |
| getViewPath / resolveTemplateDependencyPath / buildExtStripRegex / stripViewScriptExt | view/wxml/transform/（路径工具） |
| compileML / buildCompileView / compileModule / compileModuleWithAllWxs | view/index.js（编排入口） |
| worker 协议（isMainThread/parentPort） | view/index.js |

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **L0 目录归位**（唯一门） | compiler/ 平铺 → 方案 A 两轴分组；`wxml/` → `view/wxml/`；wxs 从 view-compiler 抽出；view-compiler 2420 行拆散归位 | **行为 0**（纯 git mv + import 更新，零函数体变更）；全量 vitest 绿；code diff=0；目录结构可对照本 README 归属表指认 |

## 待定（Readiness 前需确认）

1. **expression-parser 归属**：view/expression/（view 插值专用）还是 core/expression-parser.js（暂定 core，未来 logic 复用时再迁）
2. **view/index.js vs pipeline/**：compileML/buildCompileView 编排入口归 view/index.js（域内编排）还是 pipeline/（跨域编排）——暂定 view/index.js（它编排的是 view 内部子域，不是跨域）
3. **Action 名**：`fe-tools-compiler-layering`（建议）/ `fe-tools-view-restructure`

## Status / 授权

- 当前 **`draft`**：四问题 + 两轴目录 + 实施顺序已定；待定 4 项拍板后补 Readiness 五件套
- 未授权实施

## 闭合条件

- L0 交付；A-\* 全 pass
- 行为 0 证据：code diff=0（纯移动，零函数体变更）
- 目录结构回流入 architecture-notes（方案 A 两轴 + 归属表）
- STATUS/归档一致；`fe/packages` 零污染

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | 初稿：三问题（cheerio 污染 / 平铺混乱 / wxs 寄生）→ 三门（L0 归位 / L1 dom 抽象 / L2 napi 接入）；Non-goals 明确 logic/style/wxs 不细分；4 项待定 |
| 2026-09-15 | **顺序调整 + 目录维度修正**：L0 先独立合入（纯移动快速审阅）；npm 归 core/（两轴：编译域 wxml/logic/style/wxs + 基建/管线 core/pipeline）；新增 P-L4（npm 两轴混淆病症） |
| 2026-09-15 | **方案 A + wxml 改造移出**：域名 wxml→view（view 渲染域含 wxml/wxs/expression/asset/template 子域——wxs 寄生 view 是架构现实）；L1 dom 抽象 + L2 napi 移到 TODO 候选（前置 = 本 Action 合入）；本 Action 收窄为纯 L0（唯一门，零函数体变更）；函数归属表入档 |