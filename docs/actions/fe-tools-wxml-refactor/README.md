# FE Tools WXML Refactor

- Action: `fe-tools-wxml-refactor`（暂名，转正见待定 ③）
- Status: `draft`
- Updated: 2026-09-15（W2 简化 + W3 默认 napi + 对拍重定——讨论修正后）
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-wxml-ir`](../_archive/complete/fe-tools-wxml-ir/README.md)（缝+Document+registry）；[`fe-tools-wxml-bridge`](../_archive/complete/fe-tools-wxml-bridge/README.md)（napi 桥+SpanView）；[`fe-tools-compiler-layering`](../_archive/complete/fe-tools-compiler-layering/README.md)（两轴目录归位——view/wxml/ 已就位）；`fe/tools/crates/dimina-wxml-parser`（483 tests）+ `dimina-wxml-parser-napi`（SpanView）
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

### 病症一（P-W1）：24 个 wxml 函数仍在 view/index.js 编排壳内

layering L0 因嵌套函数推迟了函数级拆散。view/index.js（2420 行）中 wxml 相关函数 24 个（transform 10 + backends/vue 工具袋 13 + transTagWxs 1），归属表已定但未迁移。

### 病症二（P-W2）：transform 层直接操作 cheerio DOM——"双 parser 可切换"是假的

`view/wxml/load.js` 直接 `$(elem).replaceWith(...)` / `$('include')` / `$.html(elem)`；`backends/vue.js` 直接 `$.html()` / `$.root().children()`。cheerio 实例经投影句柄 `_$` 暴露到 transform/backend 层——**实现细节泄漏**。

### 病症三（P-W3）：napi parser 未接入编译管线

Rust parser + napi 桥 + SpanView JSON 均已交付（483 tests + 7 用例）但**只在测试中可用**——编译管线没有消费路径，parser 引擎开关不存在。

## Goal

三层次打包，三门顺序执行（每门独立验证后进下一门）：

1. **W1 函数归位**：view/index.js 中 24 个 wxml 函数（含嵌套函数的外层块整体搬迁）→ view/wxml/{transform,backends} 子域
2. **W2 Document 操作面**：Document 类扩展操作方法（findIncludes / replaceNode / removeNode / serialize…），cheerio 封装在 parser 内部；transform + backends 零 cheerio import
3. **W3 napi 默认接入**：`view/wxml/parser/napi.js`（SpanView → Document）；`WXML_PARSER` 环境变量（**默认 `napi`**，可切 `cheerio`）；两版 Document **语义等价**对拍

## Non-goals

- 不改任何函数体逻辑（含嵌套函数——外层块整体搬迁）
- 不做 transform 纯化（"产新树"模式）——Document 操作方法已是过渡方案
- 不做 logic / style / wxs 的函数归位
- 不消费表达式 AST（SpanView expr/raw 留 relative:true）
- 不向 didi 推送

## 边界

```text
本 Action:  W1 函数归位 → W2 Document 操作面 → W3 napi 默认接入
后续（另立）: transform 纯化 / 表达式消费 / 第二后端
```

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **W1 函数归位** | 24 个 wxml 函数（含嵌套外层块）从 view/index.js → view/wxml/{transform,backends}；view/index.js 瘦身为纯编排 + wxs/expression/asset | **行为 0**；全量 vitest 绿；code diff=0；view/index.js 中 wxml 函数零残留（grep 锚定） |
| **W2 Document 操作面** | Document 类扩展操作方法（穷举：findIncludes / findByTag / replaceNode / removeNode / createWrapper / getRootChildren / serialize / serializeNode / attrOf / getChildren…）；cheerio 实现封装在 parser/cheerio.js 内部；transform + backends 零 `import * as cheerio` | **行为 0**；transform/backends 零 cheerio import（grep 锚定）；操作方法面成文 |
| **W3 napi 默认接入** | `view/wxml/parser/napi.js`（SpanView JSON → Document IR 构造）；`WXML_PARSER` 环境变量（默认 `napi`）；cheerio 路径保留可切 | **产物 diff=0**（默认 napi 下编译输出与 cheerio 版一致）；napi 路径全量测试绿；两版 Document **语义等价**对拍（结构同构 + span 一致 + 分类一致，非 deep-equal） |

## 已确认设计输入

- layering 归属表（61 函数穷举，view/wxml 域 24 函数）——W1 的权威
- wxml-ir 的 Document 契约（document.js 173 行）——W2 的扩展基础
- wxml-bridge 的 SpanView JSON 形状（三层 span + raw + sourceFile）——W3 的输入
- Rust parser API：`parse_wxml(source_file, source) -> ParseResult`（483 tests）
- load.js 实际 cheerio 操作仅 **8 种**；vue.js 仅 **4 种**——操作方法面可穷举

## 决策记录（已拍板 · 2026-09-15）

| ID | 决策 | 备注 |
| --- | --- | --- |
| **D-WR-1** | **不做 ctx.dom 抽象层**——Document 类直接扩展操作方法 | 接口 = Document 的方法面；cheerio 封装在 parser 内部；零额外抽象层。load.js 实际只用 8 种操作、vue.js 4 种——穷举可行 |
| **D-WR-2** | `WXML_PARSER` 环境变量，**默认 `napi`**，可切 `cheerio` | Rust parser 483 tests + SpanView 对拍 7 用例已验证质量；默认用最优引擎 |
| **D-WR-3** | W3 对拍口径 = **语义等价**（结构同构 + span 一致 + 分类一致），非 deep-equal | Rust AST 有 cheerio 没有的类型信息（Expression/Tpl/BooleanAttr）——deep-equal 不可行也不必要；**产物 diff=0** 才是硬验收 |

## 待定（Readiness 前需确认）

1. **Document 操作方法穷举清单**：W2 冻结项——从 load.js 8 种 + vue.js 4 种出发，合并去重后的最终方法签名
2. **napi Document 构造策略**：SpanView JSON 递归构造 Document 时，嵌套函数/闭包如何处理（transform 的操作方法在 napi Document 上怎么实现——不可变树上的 replaceNode 返回新树？还是内部仍用可变代理？）
3. **Action 名**：`fe-tools-wxml-refactor`（建议）

## Status / 授权

- 当前 **`draft`**：三病症 + 三门 + D-WR-1..3 已定；待定 3 项拍板后补 Readiness 五件套
- 未授权实施

## 闭合条件

- W1–W3 交付；A-\* 全 pass；消融 ×2（拔 napi 开关 → cheerio 路径仍全绿；拔 Document 操作方法 → transform 层报错）
- 行为 0 证据：W1/W2 code diff=0；W3 产物 diff=0（默认 napi）
- Document 操作方法面 + parser 切换机制回流 architecture-notes
- STATUS/归档一致；`fe/packages` 零污染

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | 初稿：三病症（函数未归位 / transform 污染 cheerio / napi 未接入）→ 三门（W1 归位 / W2 dom 抽象 / W3 napi 接入）；3 项待定 |
| 2026-09-15 | **D-WR-1..3 拍板**：W2 简化（ctx.dom 抽象层 → Document 类方法面，去抽象层）；W3 默认 napi + `WXML_PARSER` 环境变量；对拍口径 = 语义等价（非 deep-equal）+ 产物 diff=0 |