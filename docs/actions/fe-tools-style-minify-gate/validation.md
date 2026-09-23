# Validation — fe-tools-style-minify-gate

Status: **draft（2026-10-07）**

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-SM01 | env var gate 生效 | `DIMINA_COMPILER_DIFF_VERIFY=1` 构建 → parse-walk minify；不设 → parse-walk 不 minify | R-SM-1 / A-SM1 | pending |
| P-SM02 | emitStyle 激活 minify | 审阅 `emitStyle`：`minify && !isDiffVerifyMode()` → 调 minifyCss | R-SM-2 / A-SM2 | pending |
| P-SM03 | 行为 0（验证模式） | `DIMINA_COMPILER_DIFF_VERIFY=1`；全量 7 项目 diff=0；vitest；tsc 0 | R-SM-3 / A-SM3 | pending |
| P-SM04 | cssnano 不变 | `git diff` 确认 sourcemap=true 路径 cssnano 代码不变 | R-SM-4 / A-SM4 | pending |
| P-SM05 | 生产模式可跑 | 不设 `DIMINA_COMPILER_DIFF_VERIFY`；vitest 全绿；tsc 0 | R-SM-5 / A-SM5 | pending |

## Uncovered

- cssnano 迁移（sourcemap=true，另门）
- 删除 env var 开关（收口，另门）

## Actual

| When | What |
| --- | --- |
| 2026-10-07 | 立项 `draft`。 |
