# FE Tools WXML Layout

- Action: `fe-tools-wxml-layout`（已转正，2026-09-15）
- Status: `complete`
- Updated: 2026-09-15（L0–L2 交付 `4259ebdd`；Close 复验 580/580 + P-WL06 diff=0；归档）
- Status authority: [Action Status](../../../STATUS.md)
- 前置：[`fe-tools-wxml-refactor`](../fe-tools-wxml-refactor/README.md)（complete `13c9c902`）；[`fe-tools-wxml-ir`](../fe-tools-wxml-ir/README.md)；[`fe-tools-compiler-layering`](../fe-tools-compiler-layering/README.md)
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

`fe-tools-wxml-refactor` 已交付标准 Document、零 cheerio 泄漏与默认 napi，但 **`view/wxml/` 目录轴仍按实施史堆叠**：

1. **parse 引擎藏在文件名里**：`parser/napi.js` / `parser/cheerio.js`，不是一级目录键 `(napi|cheerio)`。
2. **`transform/` 名实不符**：既含编排（`toCompileTemplate`），又含 load 侧工具；并非「IR 后通用改树」阶段，也易与 renderer 混淆。
3. **`backends/` 名含糊且杂货**：与平台 `app.json.renderer` / `core/renderers.js` 撞概念；且塞了 `vue-tools*`（实属 Vue lowering 私有工具，不是 registry 本体）。

可读性与后续换第二模板目标（Lynx 等）都会被目录误导。

## Goal

对 `fe/tools/bundler/src/compiler/view/wxml/` 做 **行为 0 的目录归位**（`git mv` + import 更新 + 按 D-WL-6 同门删净旧 Backend 名）：

```text
源串 → (napi|cheerio)/parse → common/Document
     → load/ → LoadedGraph
     → compile.js 编排
     → renderer/<target>/ → 模板串
```

## Non-goals

- 不改编译语义、Document 契约、parser 开关默认值（仍默认 napi）
- 不做 IR 纯化 / 产新树；不新建通用 `passes/` 阶段
- 不迁 wxs/asset/expression 目录归位
- 不实现第二 renderer（仅整理 vue/stub 落点）
- 不强制本门拆完 `napi.js` 内全部 helper 文件（首刀可单文件；拆分可后续）
- 不向 didi 推送；不以本门声称微信真源对齐

## Residual risks

行为 0 锚定当前 bundler view 产物；目录改名可能触及测例结构锚定（路径字符串）——须改测例路径断言，不得改产物语义。

## 边界

```text
本 Action:  wxml 目录轴 + API 命名前缀（WxmlRenderer）+ 文档回流
后续另立:  napi/vue 内多文件细拆；第二 renderer；IR transform pass
```

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **L0** | 目录按 technical-design §1 落位；删顶层 `parser/` `transform/` `backends/` | 树可对照；import 可加载 |
| **L1** | 行为 0 | 全量 vitest 绿；相对基线产物+sourcemap diff=0（或 napi↔cheerio diff=0 仍成立） |
| **L2** | 文档回流 | architecture-notes 更新目录不变量 |

## 已确认设计输入

- Close 后目录讨论收敛（2026-09-15）：引擎分树 + load ≠ renderer + vue 工具跟 vue
- 归档 [`fe-tools-wxml-refactor`](../fe-tools-wxml-refactor/technical-design.md) 阶段边界
- wxml-ir 阶段归属表（parse / load / Backend）

## 决策记录（已拍板 · 2026-09-15）

| ID | 决策 | 备注 |
| --- | --- | --- |
| **D-WL-1** | parse 轴：`wxml/napi/`、`wxml/cheerio/` 为一级目录 | 仅源→Document |
| **D-WL-2** | `wxml/common/`：document、document-ops、parity | 引擎无关 |
| **D-WL-3** | `wxml/load/`：load 本体 + paths + include/template 工具 + orchestrator-live | Document→LoadedGraph |
| **D-WL-4** | 删除顶层 `transform/`；编排文件为根 **`compile.js`**（`toCompileTemplate`） | 编排 ≠ transform |
| **D-WL-5** | `backends/` → `renderer/`；vue 工具进 `renderer/vue/` | ≠ 平台 renderer |
| **D-WL-6** | 公开 API 用 `Wxml` 前缀；**同门删净**旧 `getBackend` / `registerBackend` / `listBackends` / `unregisterBackend` / `VUE_BACKEND_ID` / `STUB_BACKEND_ID` / `createStubBackend` / `vueBackend` / 类型名 `WxmlBackend` 等，**不**留 deprecated re-export | 避撞 `core/renderers.js`；调用方（含测例）同门改完 |
| **D-WL-7** | 本门 = 行为 0；禁止借搬迁改逻辑 | Experience §3/§5 |
| **D-WL-8** | 不为「通用 IR transform」建目录 | 纯化另立 |
| **D-WL-9** | 首刀 **允许** `napi/parse.js`、`cheerio/parse.js`、以及 `renderer/vue/` 下工具仍为单文件（或 `tools.js` 一袋）；多文件细拆不阻塞本门 | 与 §1 目标树兼容：细拆为可选增强 |

## 待定

无。

## Status / 授权

- 当前 **`complete`**：交付 **`4259ebdd`**；Close 复验 580/580 + P-WL06a/b diff=0；A-WL0..5 / P-WL00..07 全 pass；architecture-notes 已回流；**已归档**

## 闭合条件

- L0–L2 交付；A-\* 全 pass；行为 0 证据；architecture-notes 回流 ✅
- STATUS/归档一致；`fe/packages` 零污染 ✅

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | formalize draft（目录讨论收敛后） |
| 2026-09-15 | **拍板待定**：① 旧 Backend API 同门删净；② 编排=`compile.js`；③ 首刀允许引擎/vue 单文件 → 升 `ready` |
| 2026-09-15 | Readiness findings 修：STATUS 竖线、删净符号表补全、TODO draft→ready、产品门去「草案」 |
| 2026-09-15 | 授权 **`in_progress`** |
| 2026-09-15 | **L0–L2 交付**：目录轴落位；API 同门删净；580/580；相对 `0074396c` nomap/sm diff=0；napi↔cheerio diff=0；消融 ✓；architecture-notes 回流 |
| 2026-09-15 | **Close**：交付 `4259ebdd`；复验 580/580 + P-WL06；升 `complete` 并归档 |