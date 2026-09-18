# FE Tools Incremental Target

- Action: `fe-tools-incremental-target`
- Status: `ready`
- Updated: 2026-09-19
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-compiler-target`](../_archive/complete/fe-tools-compiler-target/README.md)（T0+T1+T2 已归档；E7 为 Non-goal 另立）；[`fe-tools-session-unify`](../_archive/complete/fe-tools-session-unify/README.md)；病症地图：[compiler-symptom-inventory.md](../fe-tools-sidecar/compiler-symptom-inventory.md)（S1/S2/S3/S9）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

`fe-tools-compiler-target` 已把**全量**路径的「编译成什么」收进 CompileTarget / `deriveStagePlan`。增量路径仍走旁路：

```text
watch-plan / compile-cache
  → plan.options = { stages, affectedEntries, seedPath, prepareConfig, prepareNpm, … }
  → build(...plan.options)
  → createCompileTarget(runOptions) 再解释 stages
  → deriveStagePlan(target, bindings, { filteredPages })
                                ^^^^^^^^^^^^^^^
                                pipeline 私算 filterPagesByEntries → 传入
```

Source audit 实锚（病症清单 **S1/S2/S3/S4/S9**）：

| # | 病症 | 代码实锚 |
| --- | --- | --- |
| **S1** | watch rebuild 用碎片 options 回灌，管线再派生 | `watch/watch-plan.ts` L132-138；`watch/watch-runner.ts` L114 `...plan.options` |
| **S2** | session `PIPELINE_OPTION_KEYS` 把该袋锁成跨层契约 | `session/runner.ts` L33-41 |
| **S3** | watch 用 `computeStagesForFiles`（invalidation.ts）；cache 用 `getCompileStagesForFiles`（compile-stages.ts）— 双套词汇 | `watch/watch-plan.ts` L12；`model/compile-cache.ts` L5 |
| **S4** | `COMPILE_STAGE_ORDER` 拷贝 3 份 | `compile-target.ts` L25 + `compile-stages.ts` L1 + `invalidation.ts` L49 |
| **S9** | `filterPagesByEntries` 在 pipeline 闭包内私算 | `build-pipeline.ts` L168（调用）+ L276（定义） |

## Goal

1. 增量路径的阶段/页面过滤语义与全量路径**同形**：经 CompileTarget / `deriveStagePlan` 显式消费 `affectedEntries`，不再靠 pipeline 私过滤。
2. `COMPILE_STAGE_ORDER` 单源（S4 收口）；双生产者共用阶段词汇（S3 仅对齐常量源，不合并函数）。
3. session 白名单字段名不变（方案 A）；语义升格为权威增量补丁。

## 决策（冻结 v1）

| ID | 决策 |
| --- | --- |
| **D-IT-1** | 契约 = 方案 A — `build(options)` 字段名不变；`deriveStagePlan` 显式消费 `affectedEntries`；pipeline 删 `filterPagesByEntries` 私算 |
| **D-IT-2** | compile-cache 与 watch 分门（I1 / I2），可分 PR 禁混 |
| **D-IT-3** | `COMPILE_STAGE_ORDER` 单源在 `compile-target.ts`（已导出）；compile-stages / invalidation 删本地拷贝改 import |
| **D-IT-4** | dev-reload 随 I1 自动对齐（字段名读不变）；专测锁定 |

## Non-goals

- 不重开真 web target；不新增 renderer；不做 TS-2 模板 IR
- 不剥 Listr / BP2（S5/S6 另立）
- 不改 PS3 applyChanges；不改公开 `build()` 门面签名
- 不合并 `computeStagesForFiles` 与 `getCompileStagesForFiles`（intentionally different）
- 不向 didi 推送本门交付物

## 边界

```text
compiler-target（已归档）: 全量形态描述 + 阶段派生
本 Action:                 增量生产者/消费者与形态层对齐（E7）+ S4 单源
Listr/BP2（未立）:         阶段语义与 UI 拆缝
TS-2（deferred）:          模板 IR
```

## 产品门

| 门 | 内容 | 验收方向 |
| --- | --- | --- |
| **I0** 契约冻结 | D-IT-1..4 拍板；technical-design 冻结 v1 | ✅ |
| **I1** watch 路径 | `filterPagesByEntries` 搬入 derive；pipeline 删私算；`deriveStagePlan` 消费 `affectedEntries` | 行为 0；结构锚定 |
| **I2** cache 路径 + S4 | `COMPILE_STAGE_ORDER` 单源；compile-stages / invalidation import | 行为 0；grep 单源 |

## Status / 授权

- **`ready`**（2026-09-19）：D-IT-1..4 全拍板；source audit 实锚；五件套完备；待授权 `in_progress`。

## 闭合条件

- I0–I2 交付；A-\* 全 pass；消融证明结构锚定；
- 病症清单 S1/S2/S3/S4/S9 标为已收口；
- 回流 architecture-notes（增量路径亦经形态单源 + `COMPILE_STAGE_ORDER` 单源）；
- STATUS / 归档一致变更。

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | 初稿 `draft`：自 compiler-symptom-inventory 选定 E7 簇 formalize |
| 2026-09-19 | source audit 实锚 S1/S2/S3/S4/S9；D-IT-1..4 全拍板；五件套完备；升 `ready` |
