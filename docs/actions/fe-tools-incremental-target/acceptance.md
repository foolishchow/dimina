# Acceptance — fe-tools-incremental-target

Status: **draft（2026-09-14）** — 拍板后填 Evidence

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-IT0 | R-IT0 | 增量权威契约成文；watch/cache 生产者与 session 白名单对齐该契约 | design 冻结 + 源码审查 | pending |
| A-IT1 | R-IT1 | 行为 0：全量 vitest 绿；watch / cache 增量路径阶段集与过滤语义等价 | P-IT01 / P-IT02 | pending |
| A-IT2 | R-IT2 | 双生产者共用阶段词汇；无平行 `compile-stages` vs watch 私有序拷贝（S4 收口） | P-IT03 | pending |
| A-IT3 | R-IT3 | 结构锚定：pipeline 无平行 `filterPagesByEntries` 私算；回灌不再「仅提示重派生」 | P-IT03 消融 | pending |
| A-IT4 | R-IT4 | diff 不含 Listr 剥离 / TS-2 / 真 web / renderer 扩展 / PS3 | P-IT04 | pending |

## Notes

- 升 `ready` / `in_progress` 需明确授权。
- 消融 MUST：拔增量→derive 显式消费后回落碎片重解释 → 结构锚定失败。
