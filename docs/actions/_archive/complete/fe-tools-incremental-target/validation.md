# Validation — fe-tools-incremental-target

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

Status: **ready（2026-09-19）**

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-IT00 | tsc 前置 | `cd fe/tools/bundler && pnpm exec tsc -p tsconfig.build.json 2>&1 \| grep 'error TS' \| wc -l` = 0 | A-IT1 前置 | pending |
| P-IT01 | 全量回归 | `cd fe/tools/bundler && pnpm exec vitest run` → 584/584（compile-cli-cache flaky timeout 单独重跑 pass） | A-IT1 | pending |
| P-IT02 | 增量行为 0 | 全量路径：4 组 diff=0（nomap/min-nomap/sm/sm-min）证明改后 derive 产物不变；增量路径：`compile-cache.spec.js`（`affectedEntries`/`stages`/`incremental` 12 处）+ `build-stages.spec.js`（经 `build()` 全链路测 `affectedEntries`/`stages`）+ `compile-target.spec.js`（直接测 `deriveStagePlan` 含过滤语义）既有测例全绿 | A-IT1 | pending |
| P-IT03 | 结构判据 | 反向：`grep -n 'filterPagesByEntries' src/compiler/pipeline/build-pipeline.ts` = 0（函数已搬走）；正向：`grep -n 'filterPagesByEntries' src/compiler/pipeline/compile-target.ts` > 0（函数已迁入）；`grep -n 'affectedEntries' src/compiler/pipeline/compile-target.ts` > 0（签名改道完成）；`grep -rn 'const COMPILE_STAGE_ORDER' src/` 仅 compile-target.ts 命中；`grep -n 'filteredPages' src/compiler/pipeline/compile-target.ts` 命中（derive 返回）+ build-pipeline `ctx.pages = plan.filteredPages` | A-IT0 / A-IT2 / A-IT3 | pending |
| P-IT04 | 范围 | `git diff --stat` 限 compile-target.ts / compile-target.types.ts / build-pipeline.ts / compile-stages.ts / invalidation.ts / compile-target.spec.js / Action 文档 | A-IT4 | pending |
| P-IT05 | dev-reload / preview-adapter 不改 | `git diff --name-only` 不含 `src/dev/dev-reload.ts` 且不含 `src/session/preview-adapter.ts`；`pnpm exec vitest run __tests__/dev-reload.spec.js` 全绿（专测 `synthesizeReloadLevel` 矩阵，含 `plan.options.stages` / `plan.options.affectedEntries` 字段名读） | A-IT5 | pending |

## 消融纪律

按 Experience-Review §6：
- I1 消融：拔 `deriveStagePlan` 内 `filterPagesByEntries` → 回落 pipeline 私算 → 结构锚定失败
- I2 消融：拔 `compile-stages.ts` import → 回落本地拷贝 → grep 双拷贝 → 失败
- 消融补丁不入最终提交
