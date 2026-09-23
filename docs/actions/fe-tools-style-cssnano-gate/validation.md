# Validation — fe-tools-style-cssnano-gate

Status: **ready（2026-10-07）**

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-CN01 | env var gate 生效 | 审阅代码：`DIMINA_COMPILER_DIFF_VERIFY=1` → parse-walk 加 cssnano + emit 不加；不设 → parse-walk 不加 + emit 加 | R-CN-1 / A-CN1 | pending |
| P-CN02 | loader 归置 emit | 审阅：`loadCssnano` + `cssnanoLoader` 在 `style/emit.ts`；`parse-walk.ts` import 自 `./emit.ts` | R-CN-2 / A-CN2 | pending |
| P-CN03 | 行为 0（验证模式） | `DIMINA_COMPILER_DIFF_VERIFY=1`；全量 7 项目 diff=0；vitest；tsc 0 | R-CN-3 / A-CN3 | pending |
| P-CN04 | style-sourcemap 双模式 | `DIMINA_COMPILER_DIFF_VERIFY=1` vitest `style-sourcemap.spec.js`；不设 vitest `style-sourcemap.spec.js` | R-CN-4 / A-CN4 | pending |
| P-CN05 | cssnano 配置不变 | `git diff` 确认 `cssnano()` 调用方式不变；external-class/autoprefixer 不变 | R-CN-5 / A-CN5 | pending |

## Uncovered

- 删除 `DIMINA_COMPILER_DIFF_VERIFY` 开关（收口，另门）
- cssnano 输出与 parse-walk 字节一致（per-module vs aggregated）

## Actual

| When | What |
| --- | --- |
| 2026-10-07 | 立项 `draft`。 |
| 2026-10-07 | 3 轮 review：R1(1M+2L→F1/F2/F3 修正) R2(clean) R3(clean)。升 `ready`。 |
