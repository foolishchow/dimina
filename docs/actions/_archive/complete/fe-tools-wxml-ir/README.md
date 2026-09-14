# FE Tools WXML IR

- Action: `fe-tools-wxml-ir`
- Status: `complete`
- Updated: 2026-09-14（T-IR0..3 交付；A-WIR0..9 全 pass；消融 ×2；S13 view 收口 + 回流；归档）
- Status authority: [Action Status](../../../STATUS.md)
- 伞门：[`fe-tools-sidecar`](../../../fe-tools-sidecar/README.md) **TS-2**（本 Action 为再激活载体）
- 病症锚点：[compiler-symptom-inventory.md](../../../fe-tools-sidecar/compiler-symptom-inventory.md) **S13**（主）；**S14 本 Action 非目标**（见 Non-goals）
- 形状输入：[`docs/wxml/WXML-AST-TYPES.md`](../../../../wxml/WXML-AST-TYPES.md)
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

今日 `@dimina/bundler` 模板路径在 `view-compiler.js` 内熔断：

```text
WXML 字符串 → cheerio 预处理（include/import 当场展开）→ Vue compileTemplate
```

没有中立 `Document` / Backend 缝。换第二模板后端只能再抄一遍熔断逻辑。

## Goal

1. 在 **tools 内、纯 JS** 切开：`parse → Document → load → Backend`。
2. Vue（webview）为 **backend₀**：行为 / 代表性产物 **严格 0**（D-WIR-9；nomap + sourcemap `diff -rq` = 0）；**sourcemap 质量不低于今日**。
3. 硬验收：第二 Backend **可注册**（测例桩即可），不要求生产第二渲染器。

## Non-goals

- 不重写整份 `view-compiler` 算法细节（先切缝，再迁语义）
- 不做 E7 增量形态（[`fe-tools-incremental-target`](../../../fe-tools-incremental-target/README.md)）
- 不剥 Listr / BP2；不改 PS3；不向 didi 推送
- 不把 `platform: native|web` 写进 parser / Document
- 不在本 Action 引入第二种实现语言或跨语言绑定
- **不做 S14**（stage-channel 载荷补 renderer/platform）——Backend 选择仅在 view 编译路径（D-WIR-8）
- 运行时「差分白名单」豁免产物对拍（禁止；与 D-WIR-9 冲突的旧表述已废止）
- **不**以本门「行为 0」声称已对齐微信小程序真源语义（见 Residual）

## Residual risks（Experience §3）

- **行为 0 锚定的是当前 `@dimina/bundler` view 路径**（含 Vue `compileTemplate` 与既有降级），不是微信官方运行时的逐条重标定。
- 真源纠偏 / 表达式 Accept-Reject 全量 / 非 Vue 生产后端：另立 Action；本门只保证缝可挂、今日产物不漂。

## 已冻结决策

| ID | 决定 |
| --- | --- |
| **D-WIR-1** | **实现语言 = JS**（`@dimina/bundler` / `fe/tools`） |
| **D-WIR-2** | Document 分类以 `docs/wxml` 为形状指南；字段级可分期 |
| **D-WIR-3** | Import / Include / Wxs **先入 Document**；展开与 Wxs 编译属 load |
| **D-WIR-4** | Sourcemap 必保；禁猜行权威路径 |
| **D-WIR-5** | `loc: { start, end }` 半开；JS string 索引；行列派生；可选 `sourceFile` |
| **D-WIR-6** | parse 首版 = cheerio/htmlparser2 → Document **投影** |
| **D-WIR-7** | 表达式首版 = 字符串 + 既有 optional-chaining；Accept/Reject 后置 |
| **D-WIR-8** | Backend 选在 view worker/编译路径；parser·Document·load 无 platform |
| **D-WIR-9** | 行为 0 = 全量 vitest + base nomap/sourcemap **严格** diff=0 |

补充不变量与接口见 [technical-design](technical-design.md)：Backend API、阶段归属表、LoadedGraph、模块落点、cheerio 角色。

## 边界

```text
parse:     WXML 源 → Document（特殊节点仍在树上；cheerio 仅投影）
load:      读盘/展开/图/Wxs 编译/component-host/… → LoadedGraph
Backend:   LoadedGraph → 产物；registry 可挂 vue + stub
```

## 产品门

| 门 | 内容 |
| --- | --- |
| **T-IR0** | Document + `loc` + 投影 parse + 单测 |
| **T-IR1** | load + 归属表 load 行；`sourceFile` 可追溯 |
| **T-IR2** | `vueBackend`；行为 0（P-WIR01/02） |
| **T-IR3** | registry + stub；消融 |

## Status / 授权

- 终局 **`complete`**（2026-09-14）：T-IR0..3 交付（`a5262a53`）；A-WIR0..9 全 pass；严格 diff=0 + 消融 ×2；S13 view 侧收口（style 书面剩余）；结构不变量已回流 architecture-notes；归档。
- 执行允许：满足 manage-actions「ready 后经明确执行请求」即可实施。

## 闭合条件（草案）

- T-IR0..3 交付；A-\* 全 pass；消融（Backend 缝 + loc/sourcemap）按 Experience §6；
- S13 标收口（或书面剩余）；S14 保持非本门；
- validation **Uncovered** 已勾选说明；回流 sidecar architecture-notes / roadmap；
- STATUS / 归档一致；**不**污染 `fe/packages`（Experience §11）。

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | 初稿；更名 wxml-ir；D-WIR-1..9 |
| 2026-09-14 | **Review R1 修文档**：Backend 接口、归属表、LoadedGraph、模块落点、cheerio 不变量、P-WIR02 可执行命令、Goal 废止白名单、S14 明确非目标；`design.draft` → `technical-design` |
| 2026-09-14 | **Review R2/R3 文案**：registry 同 id 抛错；生产仅 `vue`；Value `kind` 三态；P-WIR04 含 S14；Status/STATUS 反映 Readiness 已过 |
| 2026-09-14 | **Review R5 修**：Residual（§3）；Uncovered（§5）；消融纪律（§6）；`[wxml]` 日志（§7）；Status 对齐 R4/R5 |
| 2026-09-14 | **升 `ready`**（R6 Experience 对照 pass；未授权实施） |
| 2026-09-14 | 升 **`in_progress`**：T-IR0..3 实施授权开工；基线 `744b732c` |
| 2026-09-14 | **T-IR0..3 交付**（`a5262a53`）：Document/parse/load/backends（686 行）+ view-compiler 缝编排（−170 熔断行）；过渡注记两处（component-host 源级包装 / compileTemplate 打包壳）。验证：550/550；严格 diff=0（nomap+sourcemap）；消融 ×2（缝→结构锚定失败；loc→loc 断言失败）；[wxml] 诊断。A-WIR0..9 全 pass |
| 2026-09-14 | **Close：升 `complete` 并归档**——闭合条件逐项核验（三门交付 / 消融在档 / 行为 0 严格 / S13 view 收口 + style 书面剩余 / Uncovered 声明 / 回流 architecture-notes + 症状清单 / 归档一致变更 / packages 零污染）；相对链接随归档调整 |
