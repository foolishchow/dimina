# Requirements — fe-tools-incremental-target

Status: **draft（2026-09-14）** — 与 design 草案对齐；拍板后冻结

## R-IT0（MUST）增量契约单源

增量路径（watch rebuild、compile-cache 增量）不得再以「碎片 `plan.options` + 管线隐式重解释」作为权威形态来源；权威须落在 CompileTarget / derive（或 design 拍板的显式增量补丁 API）上。

## R-IT1（MUST）行为 0

- 既有增量语义不变：stages 集合、affectedEntries 过滤结果、seedPath / prepareConfig / prepareNpm 时机与今日等价；
- tools/bundler 全量 vitest 绿；代表性增量用例（watch rebuild / compile-cache hit）产物或阶段集可核对；
- 公开 session API 形状对外兼容（内部白名单可演进）。

## R-IT2（MUST）双生产者对齐

watch-plan 与 compile-cache 不得维持两套互不相干的 stage 选择词汇；须共用单源阶段序/集合（收口 S4）及同一增量契约形状。

## R-IT3（MUST）结构判据

- session `PIPELINE_OPTION_KEYS`（或后继）不得继续把「仅供管线重派生的碎片字段」锁成长期契约而不经形态层；
- pipeline 内 `filterPagesByEntries` 的增量语义须可指认地属于 derive / 增量 API，而非组装闭包私算。

## R-IT4（MUST）范围切割

不碰 Listr 剥离、TS-2、真 web target、renderer 扩展、PS3。

## Non-requirements

- 增量图 applyChanges（PS3）
- 第二 renderer / 模板 IR
- sourcemapStrategy 真消费（真 web）
