# Acceptance — fe-tools-incremental-target

Status: **ready（2026-09-19）** — D-IT-1..4 全拍板

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-IT0 | R-IT0 | 增量权威契约成文（D-IT-1 方案 A）；`deriveStagePlan` 显式消费 `affectedEntries`；pipeline 无平行 `filterPagesByEntries` 私算 | P-IT03 + 源码审查 | pending |
| A-IT1 | R-IT1 | 行为 0：全量 vitest 584/584；watch / cache 增量路径阶段集与过滤语义等价；4 组 diff=0 | P-IT01 / P-IT02 | pending |
| A-IT2 | R-IT2 | `COMPILE_STAGE_ORDER` 单源（仅 `compile-target.ts` 定义）；`compile-stages.ts` / `invalidation.ts` import；无双套词汇 | P-IT03 grep | pending |
| A-IT3 | R-IT3 | 结构锚定：pipeline 无 `filterPagesByEntries` 函数定义；`deriveStagePlan` 返回 `filteredPages`；pipeline `ctx.pages = plan.filteredPages` | P-IT03 + 消融 | pending |
| A-IT4 | R-IT4 | diff 不含 Listr 剥离 / TS-2 / 真 web / renderer 扩展 / PS3 | P-IT04 | pending |
| A-IT5 | D-IT-4 | dev-reload / preview-adapter 不改代码；专测锁定 `plan.options.stages` / `plan.options.affectedEntries` 字段名读不变 | P-IT05 | pending |

## Notes

- 升 `in_progress` 需明确授权。
- 消融 MUST：I1 拔 derive 内 filter → 回落私算 → 结构锚定失败；I2 拔 import → 回落本地拷贝 → grep 双拷贝 → 失败。
- I1 / I2 可分 PR（D-IT-2），禁混。
