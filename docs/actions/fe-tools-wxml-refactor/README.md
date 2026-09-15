# FE Tools WXML Refactor

- Action: `fe-tools-wxml-refactor`（已转正，2026-09-15）
- Status: `ready`（2026-09-15）：Readiness 五件套齐；D-WR-1..9 全部拍板；实施未授权
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

### 病症四（P-W4）：JS Document 与 Rust AST 契约形状不一致

`docs/wxml/WXML-AST-TYPES.md` 已冻结完整契约（Element{span,name,attrs:Vec\<Attr\>,directives,slot,children,self_closing} / Attr{span,name,value:Option\<Value\>} / Value=Static|Expr|Template），但 JS Document（wxml-ir 一期最小集）仍是**平铺 attrs 对象** `{name:value}`、无 Value 三态、无 directives/slot/self_closing、特殊节点靠 name 字符串区分。**"形状指南"早已成文，JS 侧未落地**——这正是 napi 接入的最大障碍（SpanView 有完整类型信息，当前 JS Document 装不下）。

## Goal

三门打包，顺序执行（每门独立验证后进下一门）：

1. **W1 函数归位**：view/index.js 中 24 个 wxml 函数（含嵌套函数的外层块整体搬迁）→ view/wxml/{transform,backends} 子域
2. **W2 Document 标准形状**：JS Document 对齐 Rust AST 契约（attrs 平铺 → Vec\<Attr\>、Value 三态、directives、slot、selfClosing、类型化特殊节点）；cheerio 封装在 parser/cheerio.js 内部（零 `_$` 暴露）；transform/backend 改造为消费标准形状
3. **W3 napi 引擎装配**：`view/wxml/parser/napi.js`（SpanView JSON → 标准 Document，**纯构造无形状适配**——W2 已对齐）；`WXML_PARSER` 环境变量（**默认 `napi`**，可切 `cheerio`）；两版 Document **语义等价**对拍

## Non-goals

- 不改任何函数体逻辑（含嵌套函数——外层块整体搬迁）
- 不做 transform 纯化（"产新树"模式）——标准 Document 仍为 JS 可变实例
- 不做 logic / style / wxs 的函数归位
- 不消费 swc 表达式 AST（ExprContainer.expr 不进入 JS Document；raw 保留用于序列化）
- 不向 didi 推送

## 边界

```text
本 Action:  W1 函数归位 → W2 Document 标准形状 → W3 napi 引擎装配
后续（另立）: transform 纯化（产新树）/ 表达式消费（expr）/ 第二后端
```

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **W1 函数归位** | 24 个 wxml 函数（含嵌套外层块）从 view/index.js → view/wxml/{transform,backends}；view/index.js 瘦身为纯编排 + wxs/expression/asset | **行为 0**；全量 vitest 绿；code diff=0；view/index.js 中 wxml 函数零残留（grep 锚定） |
| **W2 Document 标准形状** | Document 对齐 Rust AST 契约（WXML-AST-TYPES.md）；cheerio 封装在 parser/cheerio.js 内部；transform/backend 零 `import * as cheerio`、零 `_$` 句柄；attrs 读取从平铺对象 → Vec\<Attr\> 查找 | **行为 0**；全量 vitest 绿；code diff=0；transform/backends 零 cheerio import（grep 锚定）；形状对照 WXML-AST-TYPES.md 抽样锚定 |
| **W3 napi 引擎装配** | `parser/napi.js`（SpanView JSON → 标准 Document 构造）；`WXML_PARSER` 环境变量（默认 `napi`）；cheerio 路径保留 | **产物 diff=0**（默认 napi 下编译输出与 cheerio 版一致）；全量测试绿；两版 Document **语义等价**对拍（结构同构 + span 一致 + 分类一致） |

## 已确认设计输入

- layering 归属表（61 函数穷举，view/wxml 域 24 函数）——W1 的权威
- `docs/wxml/WXML-AST-TYPES.md`（1553 行完整契约）——W2 的标准形状来源
- wxml-ir 的 Document 契约（document.js 173 行）——W2 的改造基座
- wxml-bridge 的 SpanView JSON 形状（三层 span + raw + sourceFile）——W3 的输入
- Rust parser API：`parse_wxml(source_file, source) -> ParseResult`（483 tests）
- load.js 实际 cheerio 操作仅 **8 种**；vue.js 仅 **4 种**——封装范围可穷举

## 决策记录（已拍板 · 2026-09-15）

| ID | 决策 | 备注 |
| --- | --- | --- |
| **D-WR-1** | 不做 ctx.dom 抽象层——Document 类直接提供操作面 | 接口 = Document 的方法面；load 8 种 + vue 4 种操作可穷举 |
| **D-WR-2** | `WXML_PARSER` 环境变量，**默认 `napi`**，可切 `cheerio` | Rust parser 483 tests + SpanView 对拍 7 用例已验证；默认用最优引擎 |
| **D-WR-3** | 对拍口径 = **语义等价**（结构同构 + span 一致 + 分类一致），非 deep-equal | Rust AST 有 cheerio 没有的类型信息；**产物 diff=0** 才是硬验收 |
| **D-WR-4** | **Document 对齐 Rust AST 契约**（`Document = Rust AST 形状 + JS 可变实例`） | 不可变性不迁移到 JS：body 为可变数组，transform 直接 splice/replace。双 parser 产出**同构** Document → 切换天然为真。D-WIR-2"形状指南"落地 |
| **D-WR-5** | **契约分层**：napi 完整（attr span / directives / self_closing 全量），cheerio 缺省 `null` | cheerio 拿不到 attr 级 span。契约定义必填层（name/type/children/body/loc）+ 可选层（span/directives/self_closing）。transform 只消费必填层，可选层有值即用 |
| **D-WR-6** | W2/W3 解耦：W2 做出双 parser 同构，W3 只是引擎装配 | 形状对齐后 napi 接入为纯构造——无形状适配层 |
| **D-WR-7** | **契约分层**：JS Document 采完整形状（对齐 Rust AST）；`null` = 字段有明确意义但 parser 无法提供，`[]` = 空集合，**不使用字段缺失**；`Element.attrs` 统一 `Attr[]`（cheerio 也输出数组） | 消费者免 `?.` 与 parser 分支；属性 span 对 cheerio 可 `null`，结构字段不可缺 |
| **D-WR-8** | **特殊节点类型化**：`include/import/wxs/template-def/template-ref/slot` 独立类型（`{type:'include', src, selfClosing}`），不依赖 `name` 字符串判别 | malformed 保留类型（`src:null` 仍为 include）——类型表达意图，`null` 表达缺失，诊断层报错；淘汰 `templateNodeKind()` 二次猜测 |
| **D-WR-9** | **W2 行为 0 口径**：内部 IR 允许结构性变更（attrs 平铺→`Attr[]`）；验收以**产物 + sourcemap diff=0** + 全量回归为准，不以源码/中间 Document diff 为准 | 双 parser 语义对拍 fixture（类型/名/值分类/directives/span 对齐，属性 span cheerio 可 null 不计不等价） |

## 待定（Readiness 前需确认）

无待定（D-WR-1..9 已全拍板）；Readiness 五件套按 README 结构补全即升 `ready`

## Status / 授权

- 当前 **`ready`**：三病症+P-W4 + 三门 + D-WR-1..9 全拍板 + Readiness 五件套（requirements / technical-design / implementation-plan / acceptance / validation P-WR01..07）；**实施未授权**
- 未授权实施

## 闭合条件

- W1–W3 交付；A-\* 全 pass；消融 ×2（拔 napi 开关 → cheerio 路径仍全绿；拔标准形状 → transform 报错）
- 行为 0 证据：W1/W2 code diff=0；W3 产物 diff=0（默认 napi）
- Document 标准形状 + 契约分层表 + parser 切换机制回流 architecture-notes
- STATUS/归档一致；`fe/packages` 零污染

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | 初稿：三病症 → 三门（W1 归位 / W2 dom 抽象 / W3 napi 接入） |
| 2026-09-15 | **D-WR-1..3 拍板**：W2 简化（Document 方法面，去抽象层）；W3 默认 napi；对拍 = 语义等价 |
| 2026-09-15 | **D-WR-4..6 拍板（用户拍板重排）**：W2 升级为 **Document 标准形状**（对齐 Rust AST：attrs→Vec / Value 三态 / directives / slot / selfClosing / 类型化特殊节点）；`Document = Rust AST 形状 + JS 可变实例`；契约分层（cheerio 缺省 null）；W3 降为**纯引擎装配**（形状已同构，无适配层）；Action 名转正 `fe-tools-wxml-refactor`；新增 P-W4（形状不一致） |
| 2026-09-15 | **Readiness 五件套成稿**：requirements R-WR0..5 + technical-design v1（标准 Document contract / W1 搬迁 map / W2 cheerio 封装 / W3 napi 装配）+ implementation-plan（W1→W2→W3 禁混）+ acceptance A-WR0..5 + validation P-WR01..07。**升 `ready`**——实施仍待授权。关键实证：24 个 wxml 相关函数全部顶层（行首无缩进——L0 嵌套顾虑不适用于 wxml 域）；精确实施集合 23 个（transTagWxs 留 wxs 轨道），跨域依赖面已穷举（compileTemplateModuleRender→insertWxsToRenderResult 等） |