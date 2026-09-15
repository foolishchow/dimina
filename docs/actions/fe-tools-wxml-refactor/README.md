# FE Tools WXML Refactor

- Action: `fe-tools-wxml-refactor`（暂名，转正见待定 ③）
- Status: `draft`
- Updated: 2026-09-15（三层次讨论后初稿；前置 layering 已合入）
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-wxml-ir`](../_archive/complete/fe-tools-wxml-ir/README.md)（缝+Document+registry）；[`fe-tools-wxml-bridge`](../_archive/complete/fe-tools-wxml-bridge/README.md)（napi 桥+SpanView）；[`fe-tools-compiler-layering`](../_archive/complete/fe-tools-compiler-layering/README.md)（两轴目录归位——view/wxml/ 已就位）；`fe/tools/crates/dimina-wxml-parser`（483 tests）+ `dimina-wxml-parser-napi`（SpanView）
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

### 病症一（P-W1）：24 个 wxml 函数仍在 view/index.js 编排壳内

layering L0 因嵌套函数推迟了函数级拆散。view/index.js（2420 行）中 wxml 相关函数 24 个（transform 10 + backends/vue 工具袋 13 + transTagWxs 1），归属表已定但未迁移——**wxml 域不完整，transform 算法和 Vue 降级工具袋仍在编排壳里**。

### 病症二（P-W2）：transform 层直接操作 cheerio DOM——"双 parser 可切换"是假的

`view/wxml/load.js` 直接 `$(elem).replaceWith(...)` / `$includeContent('template').remove()` / `$.html(elem)` 序列化定位。切到 napi parser（产出不可变 Rust AST）后这些操作崩溃。**切面不干净**：
- load.js：4 处 cheerio import + ~15 处 `$()` 操作
- backends/vue.js：2 处 + `$.html()` 遍历（行源表绑定 cheerio 序列化）

### 病症三（P-W3）：napi parser 未接入编译管线

Rust parser + napi 桥 + SpanView JSON 均已交付但**只在测试中可用**——编译管线没有消费路径，`WXML_PARSER=napi` 开关不存在。

## Goal

三层次打包，三门顺序执行（每门独立验证后进下一门）：

1. **W1 函数归位**：view/index.js 中 24 个 wxml 函数（含嵌套函数的外层块整体搬迁）→ view/wxml/{transform,backends} 子域
2. **W2 ctx.dom 抽象**：transform 层定义 IR 操作接口，cheerio 实现之，transform 零 cheerio import
3. **W3 napi parser 接入**：`view/wxml/parser/napi.js`（SpanView→Document IR 适配）；`WXML_PARSER=napi` 切换开关；两版对拍

## Non-goals

- 不改任何函数体逻辑（含嵌套函数——外层块整体搬迁，内部结构不变）
- 不做 wxml transform 纯化（"产新树"模式）——W2 的 ctx.dom 接口已是过渡方案，纯化是后续
- 不做 logic / style / wxs 的函数归位（各自后续处理）
- 不消费表达式 AST（SpanView 的 expr/raw 留 relative:true）
- 不向 didi 推送

## 边界

```text
本 Action:  W1 函数归位 → W2 ctx.dom 抽象 → W3 napi 接入（三门顺序，各自行为 0）
后续（另立）: transform 纯化（产新树）/ 表达式消费 / 第二后端
```

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **W1 函数归位** | 24 个 wxml 函数（含嵌套外层块）从 view/index.js → view/wxml/{transform,backends}；view/index.js 瘦身为纯编排（compileML/buildCompileView/compileModule + worker + wxs/expression/asset 留存） | **行为 0**；全量 vitest 绿；code diff=0；view/index.js 中 wxml 函数零残留（grep 锚定） |
| **W2 ctx.dom 抽象** | `view/wxml/transform/` 定义 IR 操作接口（ctx.dom）；cheerio 实现之；transform + backends 零 cheerio import | **行为 0**；transform/backends 零 `import * as cheerio`（grep 锚定）；接口形状成文 |
| **W3 napi 接入** | `view/wxml/parser/napi.js`（SpanView JSON → Document IR）；`WXML_PARSER=napi` 开关；两版 Document 对拍 | **默认 cheerio**（行为 0）；napi 路径测例绿；两版对拍一致 |

## 已确认设计输入

- layering 归属表（61 函数穷举，view/wxml 域 24 函数）——W1 的权威
- wxml-ir 的 Document 契约（document.js 173 行）+ 投影句柄 `_$`
- wxml-bridge 的 SpanView JSON 形状（三层 span + raw + sourceFile）——W3 的输入
- Rust parser API：`parse_wxml(source_file, source) -> ParseResult`（483 tests）

## 待定（Readiness 前需确认）

1. **ctx.dom 接口最小集**：哪些操作进接口（findInclude / replaceWith / removeNodes / serialize / query…）——design 冻结项
2. **W3 对拍口径**：两版 Document 的相等判定（字段级 deep-equal vs 抽样断言）——cheerio 投影 vs Rust AST 类型差异
3. **Action 名**：`fe-tools-wxml-refactor`（建议）/ `fe-tools-wxml-parser`（原 TODO 候选名）

## Status / 授权

- 当前 **`draft`**：三病症 + 三门已定；待定 3 项拍板后补 Readiness 五件套
- 未授权实施

## 闭合条件

- W1–W3 交付；A-\* 全 pass；消融 ×2（拔 ctx.dom → transform 层 cheerio 引用回归；拔 napi 开关 → 默认路径不变）
- 行为 0 证据：W1/W2 code diff=0；W3 默认路径 diff=0
- ctx.dom 接口形状 + parser 切换机制回流 architecture-notes
- STATUS/归档一致；`fe/packages` 零污染

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | 初稿：三病症（函数未归位 / transform 污染 cheerio / napi 未接入）→ 三门（W1 归位 / W2 dom 抽象 / W3 napi 接入）；打包一个 Action；3 项待定 |