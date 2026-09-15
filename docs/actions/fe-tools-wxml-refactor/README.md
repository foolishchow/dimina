# FE Tools WXML Refactor

- Action: `fe-tools-wxml-refactor`（已转正，2026-09-15）
- Status: `in_progress`
- Updated: 2026-09-15（W1–W3 已实施；P-WR05 580/580；P-WR06 napi↔cheerio diff=0）
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-wxml-ir`](../_archive/complete/fe-tools-wxml-ir/README.md)；[`fe-tools-wxml-bridge`](../_archive/complete/fe-tools-wxml-bridge/README.md)；[`fe-tools-compiler-layering`](../_archive/complete/fe-tools-compiler-layering/README.md)；`fe/tools/crates/dimina-wxml-parser` + `dimina-wxml-parser-napi`
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

### 病症一（P-W1）：wxml 函数仍在 view/index.js 编排壳内

layering L0 推迟了函数级拆散。view 域 **wxml 相关 24** = 本门应搬迁的 transform/backend **23** + `transTagWxs` **1**（留 wxs 轨道）。归属表已定，23 个尚未迁入 `view/wxml/{transform,backends}`。

### 病症二（P-W2）：transform/backend 直接操作 cheerio DOM——"双 parser 可切换"是假的

`load.js` / `backends/vue.js` 经 `_$` 等句柄调用 cheerio——**实现细节泄漏**。

### 病症三（P-W3）：napi parser 未接入编译管线

Rust parser + napi + SpanView 已交付但**只在测试中可用**。

### 病症四（P-W4）：JS Document 与 Rust AST 契约形状不一致

一期 Document 仍为平铺 attrs 等最小集，装不下 SpanView 完整类型——napi 接入的最大障碍。

## Goal

1. **W1**：将 **23** 个函数（名单见 technical-design §3）迁入 `view/wxml/{transform,backends}`；`transTagWxs` 非本门  
2. **W2**：JS Document 对齐 Rust AST 契约；cheerio 封在 parser 内；transform/backend 经 Document 操作面（§4.2）  
3. **W3**：`parser/napi.js` + `WXML_PARSER`（**默认 `napi`**）；两路语义等价 + 产物 diff=0  

## Non-goals

- **W1 以外**不借「归位」改编译逻辑；**W1** 逐字搬迁；**W2** 允许改访问面/签名（见 R-WR2），禁止改产物语义
- 不做 transform 纯化（产新树）
- 不做 logic / style / wxs **目录归位**（含本门不搬 `transTagWxs`；W2 仅允许 §4.6 Document 薄适配）
- 不消费 swc 表达式 AST（保留 raw）
- 不强制本门迁走 `transHtmlTag` 的 htmlparser2（非 cheerio）
- 不向 didi 推送
- 不以本门声称对齐微信真源（见 Residual）

## Residual risks（Experience §3）

行为 0 / 默认 napi 锚定**当前** bundler view 产物语义（含 Vue 降级），不是微信官方运行时逐条重标定。

## 边界

```text
本 Action:  W1 函数归位 → W2 Document 标准形状 → W3 napi 引擎装配
后续（另立）: transform 纯化 / 表达式消费 / 第二后端 / wxs 归位
```

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **W1** | technical-design §3 的 **23** 函数迁走；`transTagWxs` 不要求迁走 | 产物+sourcemap diff=0；vitest 绿；23 名在 index 无定义残留 |
| **W2** | 标准 Document + Document 操作面；零 cheerio/`_$` 泄漏 | 产物+sourcemap diff=0（D-WR-9）；vitest 绿；grep 锚定 |
| **W3** | 默认 napi；cheerio 可切；语义对拍 | 默认 napi vs cheerio 产物+sourcemap diff=0；语义对拍；消融 |

## 已确认设计输入

- layering 归属表 → 已**抄入** technical-design §3（本门权威）
- `docs/wxml/WXML-AST-TYPES.md`；wxml-ir Document；wxml-bridge SpanView；Rust `parse_wxml`

## 决策记录（已拍板 · 2026-09-15）

| ID | 决策 | 备注 |
| --- | --- | --- |
| **D-WR-1** | Document 方法面（无 ctx.dom 抽象层） | 操作面穷举见 technical-design §4.2（含 vue-tools） |
| **D-WR-2** | `WXML_PARSER` 默认 `napi`，可切 `cheerio` | |
| **D-WR-3** | 对拍 = 语义等价；硬验收 = 产物 diff=0 | |
| **D-WR-4** | Document = Rust AST 形状 + JS 可变实例 | |
| **D-WR-5** | 契约分层：napi 尽量填全；cheerio 可 null | **字段始终存在**；「可选」= 值可 null，非缺键（见 design） |
| **D-WR-6** | W2 同构形状；W3 纯引擎装配 | |
| **D-WR-7** | 完整形状；null / []；attrs 统一 Attr[] | |
| **D-WR-8** | 特殊节点类型化 | |
| **D-WR-9** | W2 行为 0 = 产物+sourcemap，非中间 Document 字节相等 | |

## 待定

无。

## Status / 授权

- 当前 **`in_progress`**：基线 `342af2f5`；**W1–W3 已交付**（A-WR0..5 / P-WR00..07 全 pass；580/580）；architecture-notes 已回流；**待 Close / 归档**

## 闭合条件

- W1–W3 交付；A-\* 全 pass；消融按 Experience §6  
- W1/W2/W3 行为 0 证据按上门表；Document 契约 + parser 开关回流 architecture-notes  
- STATUS/归档一致；`fe/packages` 零污染  

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | 初稿 → D-WR-1..9 → 五件套 → 升 `ready` |
| 2026-09-15 | **Review F-WR-R1 修**：24/23 统一；§3 函数穷举；§4.2 操作面；Status 子文档；消融纪律；P-WR06 可复跑；Residual；D-WR-5/7 澄清；TODO 去 ctx.dom |
| 2026-09-15 | **Review F-WR-R2 修**：§4.2 按 load/vue/tools 补全；§4.5 normalize 去 cheerio 环路；W1 逐字 / W2 可改访问面与签名 |
| 2026-09-15 | **Review F-WR-R3 修**：§4.6 `transTagWxs`/`transAsses` Document 薄适配；W1「禁止改 wxs/asset」收窄 |
