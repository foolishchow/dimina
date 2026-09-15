# FE Tools Compiler Layering

- Action: `fe-tools-compiler-layering`（暂名，转正见待定 ④）
- Status: `draft`
- Updated: 2026-09-15（顺序调整：L0 先独立合入；目录维度修正两轴）
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

1. **L0 目录归位**：compiler/ 平铺 → **两轴分组**（编译域 + 基建/管线）；wxs 独立成域；view-compiler 瘦身或消失
2. **L1 wxml dom 抽象**：transform 层定义 IR 操作接口（`ctx.dom`），cheerio 实现之——双 parser 真正可切换
3. **L2 napi parser 接入**：`wxml/parser/napi.js`（SpanView → Document）；`WXML_PARSER=napi` 开关

## Non-goals

- **logic / style / wxs 的 parser/transform 内部细分**——等有第二引擎/复杂 transform 需求再拆（讨论已确认）
- wxml transform 纯化（"产新树"模式）——L1 之后的下一步，另立 Action
- 不改 view-compiler 内部转换算法（transHtmlTag / normalizeTemplateDom 等仍在工具袋）
- 不向 didi 推送

## 边界

```text
本 Action:  L0 目录归位 → L1 dom 抽象 → L2 napi parser 接入（三门顺序执行，L0 独立合入）
L3+（另立）: wxml transform 纯化 / logic-style-wxs 细分 / 第二后端
```

## 实施顺序（已确认）

**L0 先独立合入，再开 L1/L2**——不拆 Action，但 L0 的 diff 全是 `git mv` + import 更新，审阅成本极低，快速合入后 L1/L2 建在干净目录结构上开发，避免路径 rebase。

## 目录维度（两轴）

```text
轴一：编译域（语言维度）     wxml / logic / style / wxs
轴二：基建与编排（生命周期） core / pipeline
```

### L0 目标结构

```text
src/compiler/
├── wxml/                  ← 轴一：wxml 域（已有，收编 view-compiler 的 wxml 函数）
│   ├── parser/
│   ├── transform/
│   └── backends/
├── logic/                 ← 轴一：logic 域（logic-compiler.js 拆入）
├── style/                 ← 轴一：style 域（style-compiler.js 拆入）
├── wxs/                   ← 轴一：wxs 域（processWxsContent 等从 view-compiler 抽出）
├── core/                  ← 轴二：跨域基建
│   ├── env.js             ALS 上下文（936 行）
│   ├── npm-resolver.js    npm 组件寻址
│   ├── npm-builder.js     npm 包构建
│   ├── sourcemap.js       sourcemap 工具
│   ├── compatibility.js   兼容性检查
│   └── expression-parser.js  表达式解析
└── pipeline/              ← 轴二：编排
    ├── build-pipeline.js  编排壳
    ├── compile-target.js  形态描述
    ├── compile-stages.js  阶段定义
    ├── config-compiler.js 配置编译
    ├── stage-channel.js   worker 通道
    └── publish.js         产物后处理
```

**view-compiler.js**：拆完后 wxml 函数 → wxml/，wxs 函数 → wxs/，expression → core/，template/slot/asset → wxml/transform/。剩余编排入口（`compileML` 等）→ pipeline/ 或薄委托。预计 2420 行 → ~100 行或消失。

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **L0 目录归位** | compiler/ 平铺 → 两轴分组；wxs 从 view-compiler 抽出；view-compiler 瘦身 | **行为 0**（纯 git mv + import 更新，零逻辑变更）；全量 vitest 绿；code diff=0；目录结构可对照指认 |
| **L1 dom 抽象** | `wxml/transform` 定义 `ctx.dom` IR 操作接口（findInclude / replaceWith / removeNodes / serialize…）；cheerio 实现之；transform 层不再直接引用 cheerio | **行为 0**；transform 层零 cheerio import（grep 锚定）；接口形状成文 |
| **L2 napi 接入** | `wxml/parser/napi.js`（SpanView → Document IR 适配）；`WXML_PARSER=napi` 切换开关；两版对拍 | 默认 cheerio（**行为 0**）；napi 路径测例绿；两版 Document 对拍一致 |

## 待定（Readiness 前需确认）

1. **L1 接口形状**：`ctx.dom` 暴露哪些操作（最小集 vs 完整集）——design 冻结项
2. **L2 对拍口径**：两版 Document 的相等判定（字段级 deep-equal vs 抽样断言）——需考虑 cheerio 投影 vs Rust AST 的类型差异
3. **L0 分组边界**：`expression-parser` 归 wxml 还是 core（供 wxml 插值解析用，但未来 logic 可能复用）；view-compiler 残余编排入口归 pipeline 还是保留薄壳
4. **Action 名**：`fe-tools-compiler-layering`（建议）/ `fe-tools-compiler-restructure`

## Status / 授权

- 当前 **`draft`**：四问题 + 两轴目录 + 实施顺序已定；待定 4 项拍板后补 Readiness 五件套
- 未授权实施

## 闭合条件

- L0–L2 交付；A-\* 全 pass；消融 ×2（拔 dom 抽象 → transform 层 cheerio 引用回归；拔 napi 开关 → 默认路径不变）
- 行为 0 证据：L0/L1 code diff=0；L2 默认路径 diff=0
- 目录结构 + dom 接口形状回流入 architecture-notes
- STATUS/归档一致；`fe/packages` 零污染

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | 初稿：三问题（cheerio 污染 / 平铺混乱 / wxs 寄生）→ 三门（L0 归位 / L1 dom 抽象 / L2 napi 接入）；Non-goals 明确 logic/style/wxs 不细分；4 项待定 |
| 2026-09-15 | **顺序调整 + 目录维度修正**：L0 先独立合入（纯移动快速审阅）；npm 归 core/（两轴：编译域 wxml/logic/style/wxs + 基建/管线 core/pipeline）；新增 P-L4（npm 两轴混淆病症） |