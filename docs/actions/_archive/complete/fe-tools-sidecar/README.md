# FE Tools Sidecar（Umbrella）

- Action: `fe-tools-sidecar`
- Status: `complete`
- Updated: 2026-09-20（伞级 Close：A-001..010 全 pass；TS-3/PS3/CI/style 书面 Uncovered 或 deferred；归档）
- Status authority: [Action Status](../../../STATUS.md)
- 活真源（不随本包进归档）：[architecture-notes](../../../../fe-tools/architecture-notes.md) · [sync-rhythm](../../../../fe-tools/sync-rhythm.md)
- 文档集：[requirements](requirements.md) · [acceptance](acceptance.md) · [validation](validation.md) · [roadmap](roadmap.md)
- 工作分支：`feature/fe-tools-sidecar`
- 前置上下文：[compiler-improvement](../compiler-improvement/README.md)、[compiler-configuration](../compiler-configuration/README.md)

## Background

`feature/compiler-improve` 已交付并归档多门编译器/dev/HMR/配置改造，但实现主要落在 `fe/packages/*`。本伞建立 **`fe/tools/*` 旁路孵化**：主路径 `packages/*` 与 upstream 同构；私有能力只在 tools。

**闭合结论（2026-09-20）**：TS-0 冻结与落地、TS-1 bootstrap、TS-2 wxml-ir、TS-4 sync-rhythm 均已 complete；TS-3 / PS3 书面 deferred；CI 为外部 Uncovered。伞级 MUST 全 pass。**伞级不再授权大实施**；后续 Module 中心等见 [TODO 近端顺序](../../../TODO.md)。

## Goal（已交付）

1. `fe/tools` 旁路战略与 TS-0 冻结约定 — **完成**
2. 搬迁冒烟由 [`fe-tools-bootstrap-copy`](../fe-tools-bootstrap-copy/README.md) — **complete**
3. tools 内模板管线（parse → Document → Backend）— [`fe-tools-wxml-ir`](../fe-tools-wxml-ir/README.md) **complete**（view；style 剩余另议）
4. 终态 B：`packages/*` 无私有 improve 长期 diff — **可检查且复测为空**
5. 不向 didi 推送本伞交付物 — **成文 Non-goal**

## Non-goals

- 向 didi/dimina 合入本 umbrella 交付物
- 一次拆出大量微包；通用 JS bundler 竞品；改原生三端
- 在 `packages/*` 保留半套私有 compiler
- 伞级授权 Module / Packer 实施（另立）

## TS 门终态

| 门 | 现状 |
| --- | --- |
| TS-0 | 决策已冻；落地完成 |
| TS-1 | bootstrap **complete** |
| TS-2 | wxml-ir **complete**（view；style = U-SC4） |
| TS-3 | **deferred**（2026-09-20）：session 已交控制面；sdk 深改无消费者 |
| TS-4 | sync-rhythm **文档完成**；packages 干净 |

### PS3 deferred（2026-09-12）

不实施 `applyChanges` / `subscribe`。再激活：① watch 全量 load 成可量化瓶颈；② preview 需要 store 内部 metadata 消费方。

### CI（U-SC1）

tools 独立 job / fork Actions 绿 = **外部 Uncovered**。不阻塞伞级 complete。

## Closure

- A-001..010 **pass**（见 [acceptance](acceptance.md) / [validation](validation.md)）
- 闭合条件：TS 完成或 deferred；终态 B；packages 不依赖 tools；VENDOR/同步说明；STATUS 指向本归档路径
- **活文档**已迁至 [`docs/fe-tools/`](../../../../fe-tools/README.md)（architecture-notes / sync-rhythm / 症状地图 / session 草案）

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-10 | 立项；TS-0 冻结 |
| 2026-09-12 | bootstrap / TS-4 / PS3 deferred |
| 2026-09-14 | TS-2 wxml-ir complete |
| 2026-09-20 | **Close**：acceptance 全 pass；CI 外部 Uncovered；`complete` + 归档；活真源留原路径 |
