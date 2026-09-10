# Acceptance — es-target-unification（仅 logic）

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | logic-compiler 无残留 CJS/bundle 硬编码 target；均读 `esTarget.logic` | 源码审查 + 规格 | passed |
| A-002 | R-002 | `DEFAULT_ES_TARGET` 仍为 logic=es2023 / view=es2020 | compile-config.spec | passed |
| A-003 | R-003 | view-compiler target 接线本门 diff 为空（相对实施前） | `git diff` / 审查 | passed |
| A-004 | R-005 | 缺省 build：view/style 产物相对基线 diff=0；logic 差异已记录（含是否为 0） | 产物对照脚本 | passed |
| A-005 | R-005 | `options.esTarget.logic='es2020'` 时 CJS 路径使用 es2020（规格或对照） | 规格 / 抽样 | passed |
| A-006 | R-007 | 「CJS 读 esTarget.logic」规格可消融（恢复硬编码 → 失败 → 恢复再绿） | validation 消融记录 | passed |
| A-007 | R-006 / R-007 | `build()` 契约未破；全量测试全绿 | 全量 vitest | passed |
| A-008 | R-008 | RFC 已回写 logic 收敛与「本切片不含 view 抬升」 | RFC diff | passed |

## Closure evidence rule

- MUST 全部 `passed` 且写入 validation 后方可 `complete`
- 不得将 view 抬升或 WebView 矩阵欠债带入本门 complete
- 消融补丁不入库（Experience-Review §6）

## Status

全部 `passed`：证据见 [validation](validation.md) P-001..P-003（含 CJS 接线消融）。
