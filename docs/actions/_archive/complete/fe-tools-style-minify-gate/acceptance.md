# Acceptance — fe-tools-style-minify-gate

Status: **complete（2026-10-07）** — A-SM1..5 全部 [x]。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-SM1 | R-SM-1 | `DIMINA_COMPILER_DIFF_VERIFY` 设置时 minifyCss 在 parse-walk 执行；未设置时 parse-walk 不调 minifyCss | P-SM01 ✅ | [x] |
| A-SM2 | R-SM-2 | `emitStyle` 在 `minify=true && !sourcemap && !isDiffVerifyMode()` 时调 minifyCss | P-SM02 ✅ | [x] |
| A-SM3 | R-SM-3 | `DIMINA_COMPILER_DIFF_VERIFY` 设置时全量 7 项目 diff=0 + vitest + tsc 0 | P-SM03 ✅ | [x] |
| A-SM4 | R-SM-4 | cssnano（sourcemap=true 路径）代码不变 | P-SM04 ✅ | [x] |
| A-SM5 | R-SM-5 | `DIMINA_COMPILER_DIFF_VERIFY` 未设置时 vitest 全绿 + tsc 0 errors | P-SM05 ✅ | [x] |

## Non-acceptance

- `DIMINA_COMPILER_DIFF_VERIFY` 未设置但 parse-walk 仍 minify（gate 未生效）
- 验证模式 diff≠0
- 改了 cssnano 逻辑
- 改了 minifyCss 函数参数
- 加了 `any` / `as any` / `@ts-nocheck`
