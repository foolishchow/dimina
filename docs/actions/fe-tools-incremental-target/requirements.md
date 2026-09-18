# Requirements — fe-tools-incremental-target

Status: **ready（2026-09-19）** — D-IT-1..4 全拍板，冻结 v1

## R-IT0（MUST）增量契约单源

增量路径（watch rebuild、compile-cache 增量）不得再以「碎片 `plan.options` + 管线隐式重解释」作为权威形态来源；权威须落在 CompileTarget / `deriveStagePlan` 上。

**方案 A（D-IT-1）**：`build(options)` 字段名不变；`stages` / `affectedEntries` / `seedPath` / `prepareConfig` / `prepareNpm` 成文为 CompileTarget 输入的权威增量补丁。`deriveStagePlan` 显式消费 `affectedEntries`（§3 S9 改道）；pipeline 删除平行 `filterPagesByEntries` 私算。

## R-IT1（MUST）行为 0

- 既有增量语义不变：stages 集合、affectedEntries 过滤结果、seedPath / prepareConfig / prepareNpm 时机与今日等价；
- tools/bundler 全量 vitest 绿；代表性增量用例（watch rebuild / compile-cache hit）产物或阶段集可核对；
- 公开 session API 形状对外兼容（内部白名单字段名不变）。

## R-IT2（MUST）双生产者对齐

watch-plan 与 compile-cache 不得维持两套互不相干的 stage 选择词汇；须共用 `COMPILE_STAGE_ORDER` 单源（D-IT-3）。

**注（S3）**：`computeStagesForFiles`（invalidation.ts）与 `getCompileStagesForFiles`（compile-stages.ts）边缘处理 intentionally different，本门仅统一常量源，不合并函数。

## R-IT3（MUST）结构判据

- session `PIPELINE_OPTION_KEYS` 字段名不变（方案 A），但语义升格：这些是 CompileTarget 输入的权威增量补丁，不是「管线随便再算一遍的提示」；
- pipeline 内 `filterPagesByEntries` 须搬入 `compile-target.ts` / `deriveStagePlan`，pipeline 仅设 `ctx.pages = plan.filteredPages`。

## R-IT4（MUST）范围切割

不碰 Listr 剥离、TS-2、真 web target、renderer 扩展、PS3。

## Non-requirements

- 增量图 applyChanges（PS3）
- 第二 renderer / 模板 IR
- sourcemapStrategy 真消费（真 web）
- 合并 `computeStagesForFiles` 与 `getCompileStagesForFiles`（另立）
