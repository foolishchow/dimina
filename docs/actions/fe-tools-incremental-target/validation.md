# Validation — fe-tools-incremental-target

权威参考：[Experience-Review.md](../../Experience-Review.md)

Status: **ready（2026-09-19）**

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-IT00 | tsc 前置 | `cd fe/tools/bundler && pnpm exec tsc -p tsconfig.build.json 2>&1 \| grep 'error TS' \| wc -l` = 0 | A-IT1 前置 | pending |
| P-IT01 | 全量回归 | `cd fe/tools/bundler && pnpm exec vitest run` → 584/584（compile-cli-cache flaky timeout 单独重跑 pass） | A-IT1 | pending |
| P-IT02 | 增量行为 0 | watch rebuild + compile-cache 增量既有测例全绿；4 组 diff=0（nomap/min-nomap/sm/sm-min） | A-IT1 | pending |
| P-IT03 | 结构判据 | `grep -n 'filterPagesByEntries' src/compiler/pipeline/build-pipeline.ts` = 0（函数已搬走）；`grep -rn 'const COMPILE_STAGE_ORDER' src/` 仅 compile-target.ts 命中；`grep -n 'filteredPages' src/compiler/pipeline/compile-target.ts` 命中（derive 返回）+ build-pipeline `ctx.pages = plan.filteredPages` | A-IT0 / A-IT2 / A-IT3 | pending |
| P-IT04 | 范围 | `git diff --stat` 限 compile-target.ts / compile-target.types.ts / build-pipeline.ts / compile-stages.ts / invalidation.ts / 测试 / Action 文档 | A-IT4 | pending |
| P-IT05 | dev-reload 不改 | `git diff --name-only` 不含 `src/dev/dev-reload.ts`；`pnpm exec vitest run __tests__/bundler-session.spec.js` 全绿 | A-IT5 | pending |

## 消融纪律

按 Experience-Review §6：
- I1 消融：拔 `deriveStagePlan` 内 `filterPagesByEntries` → 回落 pipeline 私算 → 结构锚定失败
- I2 消融：拔 `compile-stages.ts` import → 回落本地拷贝 → grep 双拷贝 → 失败
- 消融补丁不入最终提交
