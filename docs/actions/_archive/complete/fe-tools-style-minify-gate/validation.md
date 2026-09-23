# Validation — fe-tools-style-minify-gate

Status: **complete（2026-10-07）** — 实施 + 验证完成。

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-SM01 | env var gate 生效 | 审阅代码：`emit.ts` `isDiffVerifyMode()` 定义 + `parse-walk.ts` gate `shouldMinify && isDiffVerifyMode()` + `emitStyle` gate `minify && !sourcemap && !isDiffVerifyMode()` | R-SM-1 / A-SM1 | ✅ pass |
| P-SM02 | emitStyle 激活 minify | 审阅 `emitStyle`：`options.minify && !options.sourcemap && !isDiffVerifyMode()` → 调 `minifyCss(code)` | R-SM-2 / A-SM2 | ✅ pass |
| P-SM03 | 行为 0（验证模式） | `DIMINA_COMPILER_DIFF_VERIFY=1`；全量 7 项目 diff=0（air-battle / base / mpx-demo / subpackages / taro-todo / vant / weui）；vitest 608/608（compile-cli-cache flaky 重跑 pass）；tsc 0 errors | R-SM-3 / A-SM3 | ✅ pass |
| P-SM04 | cssnano 不变 | `git diff` 确认 sourcemap=true 路径 cssnano 代码不变 | R-SM-4 / A-SM4 | ✅ pass |
| P-SM05 | 生产模式可跑 | 不设 `DIMINA_COMPILER_DIFF_VERIFY`；vitest 608/608（flaky 重跑 pass）；tsc 0 errors；style-sourcemap.spec.js 3/3 pass（sourcemap=true + minify=true 不双重 minify） | R-SM-5 / A-SM5 | ✅ pass |

## Uncovered

- cssnano 迁移（sourcemap=true，另门）
- 删除 env var 开关（收口，另门）

## Actual

| When | What |
| --- | --- |
| 2026-10-07 | 立项 `draft`。 |
| 2026-10-07 | 6 轮 formalization review pass（R1-R6，3 consecutive clean）。升 `ready`。 |
| 2026-10-07 | 升 `in_progress`；实施 D-SM-1..4。 |
| 2026-10-07 | `style/emit.ts`：加 `isDiffVerifyMode()` + `emitStyle` 激活 `minify` 参数（`!sourcemap` 守卫）。 |
| 2026-10-07 | `style/parse-walk.ts`：sourcemap=false 路径 minifyCss 调用加 `isDiffVerifyMode()` gate。 |
| 2026-10-07 | tsc 0 errors；vitest 608/608（两种模式均 pass）；全量 7 项目 diff=0（验证模式）。行为 0 三件套 ✓。 |
| 2026-10-07 | D-SM-4 确认：8 CSS 文件 verify vs prod 差 1 byte（inter-module `\n`），均有效 minified。 |
| 2026-10-07 | style-sourcemap.spec.js 3/3 pass（生产模式 sourcemap=true + minify=true → `!sourcemap` 守卫防止双重 minify + sourcemap 失效）。 |

## Type Constraints

| File | `any` | `as any` | `@ts-nocheck` | `[key: string]` | Notes |
| --- | --- | --- | --- | --- | --- |
| `style/emit.ts` (modified) | 0 | 0 | 0 | 0 | 无新增 |
| `style/parse-walk.ts` (modified) | 1 | 0 | 0 | 0 | pre-existing `Promise<any>` line 43；无新增 |
