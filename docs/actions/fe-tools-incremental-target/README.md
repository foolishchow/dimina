# FE Tools Incremental Target

- Action: `fe-tools-incremental-target`
- Status: `draft`
- Updated: 2026-09-14
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-compiler-target`](../_archive/complete/fe-tools-compiler-target/README.md)（T0+T1+T2 已归档；E7 为 Non-goal 另立）；[`fe-tools-session-unify`](../_archive/complete/fe-tools-session-unify/README.md)；病症地图：[compiler-symptom-inventory.md](../fe-tools-sidecar/compiler-symptom-inventory.md)（S1/S2/S3/S9）
- 文档集：[requirements](requirements.md) · [design.draft](design.draft.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

`fe-tools-compiler-target` 已把**全量**路径的「编译成什么」收进 CompileTarget / deriveStagePlan。增量路径仍走旁路：

```text
watch-plan / compile-cache
  → plan.options = { stages, affectedEntries, seedPath, prepareConfig, prepareNpm, … }
  → build(...plan.options)
  → createCompileTarget(runOptions) 再解释 stages
  → deriveStagePlan + pipeline.filterPagesByEntries(affectedEntries)
```

Source audit 实锚（病症清单 **S1/S2/S3/S9**）：

| # | 病症 | 代码实锚 |
| --- | --- | --- |
| **S1** | watch rebuild 用碎片 options 回灌，管线再派生 | `watch/watch-plan.js` ~128–138；`watch/watch-runner.js` spread `plan.options` |
| **S2** | session `PIPELINE_OPTION_KEYS` 把该袋锁成跨层契约 | `session/runner.js` 32–40；dev-reload 同袋 |
| **S3** | compile-cache / `compile-stages.js` 另产同形袋；与 watch stage 词汇双套 | `model/compile-cache.js`；`compiler/compile-stages.js` |
| **S9** | `affectedEntries` → `filterPagesByEntries` 仅在 pipeline，不在 derive | `compiler/build-pipeline.js` |

**痛点**：形态单源只覆盖全量；增量路径仍在「碎片回灌 → 管线重解释」，与 CompileTarget 结构不变量（形态条件单源于 compile-target）冲突。

## Goal

1. 增量路径（watch rebuild + 批量 compile-cache 增量）的阶段/页面过滤语义与全量路径**同形**：经 CompileTarget / derive（或显式增量补丁 API），不再靠碎片 options 隐式重派生。
2. session 白名单与 watch/cache 生产者对齐新契约（行为 0：增量结果字节/阶段集等价）。
3. `COMPILE_STAGE_ORDER` 邻接单源（S4）随门收口，避免三份拷贝继续分叉。

## Non-goals

- 不重开真 web target；不新增 renderer；不做 TS-2 模板 IR
- 不剥 Listr / BP2（S5/S6 另立）
- 不改 PS3 applyChanges；不改公开 `build()` 门面签名（除增量契约字段演进所需）
- 不向 didi 推送本门交付物

## 边界

```text
compiler-target（已归档）: 全量形态描述 + 阶段派生
本 Action:                 增量生产者/消费者与形态层对齐（E7）
Listr/BP2（未立）:         阶段语义与 UI 拆缝
TS-2（deferred）:          模板 IR
```

## 产品门（草案 · 待拍板）

| 门 | 内容 | 验收方向 |
| --- | --- | --- |
| **I0** 契约冻结 | 增量回灌的权威形状（仍 options 袋 vs 显式 patch / StagePlan 片段）+ session 白名单 | 决策入 design；测例锁定形状 |
| **I1** watch 路径 | watch-plan 生产端 + runner 消费端改道；pipeline 增量过滤进 derive（或等价单源） | 行为 0；结构锚定无碎片重解释 |
| **I2** cache 路径 + S4 | compile-cache / compile-stages 与 watch 共用阶段词汇；`COMPILE_STAGE_ORDER` 单源 | 行为 0；双套词汇消失 |

## Status / 授权

- 当前 **`draft`**：病症地图已成文并选定本方向；**设计决策未拍板**（见 design.draft 待定）；未授权实施。
- 升 `ready` 前置：I0 契约拍板 + Readiness 五件套收敛 + 明确行为 0 基线命令。

## 闭合条件（草案）

- I0–I2 交付；A-\* 全 pass；消融证明结构锚定；
- 病症清单 S1/S2/S3/S9（及选定范围内的 S4）标为已收口；
- 回流 architecture-notes（增量路径亦经形态单源）；
- STATUS / 归档一致变更。

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | 初稿 `draft`：自 compiler-symptom-inventory 选定 E7 簇 formalize |
