# Acceptance — fe-tools-style-cssnano-gate

Status: **complete（2026-10-07）** — A-CN1..5 全部 ✅。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-CN1 | R-CN-1 | `DIMINA_COMPILER_DIFF_VERIFY` 设置时 cssnano 在 parse-walk PostCSS pipeline；未设置时 parse-walk 不加 cssnano，emit 单独跑 | P-CN01 | ✅ done |
| A-CN2 | R-CN-2 | `loadCssnano()` + `cssnanoLoader` 定义在 `style/emit.ts`；`parse-walk.ts` import 自 `./emit.ts` | P-CN02 | ✅ done |
| A-CN3 | R-CN-3 | `DIMINA_COMPILER_DIFF_VERIFY` 设置时全量 7 项目 diff=0 + vitest + tsc 0 | P-CN03 | ✅ done |
| A-CN4 | R-CN-4 | `style-sourcemap.spec.js` 双模式全绿（验证模式 + 生产模式） | P-CN04 | ✅ done |
| A-CN5 | R-CN-5 | cssnano 调用方式不变（`cssnano()` 无参数）；external-class/autoprefixer 不变 | P-CN05 | ✅ done |

## Non-acceptance

- `DIMINA_COMPILER_DIFF_VERIFY` 未设置但 parse-walk 仍加 cssnano（gate 未生效）
- 验证模式 diff≠0
- `style-sourcemap.spec.js` 任一模式失败
- 改了 cssnano preset / 配置
- 改了 external-class / autoprefixer
- 加了 `any` / `as any` / `@ts-nocheck`
