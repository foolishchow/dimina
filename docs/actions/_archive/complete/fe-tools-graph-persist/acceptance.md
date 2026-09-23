# Acceptance — fe-tools-graph-persist

Status: **complete（2026-10-07）** — A-GP1..4 全部 ✅。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-GP1 | R-GP-1 | `storeInfo` 在 `options.graph` 传入时调 `reconcile` 而非 `build` | P-GP01 | ✅ done |
| A-GP2 | R-GP-2 | 首次 build 修正后与修正前全量 7 项目 diff=0 | P-GP02 | ✅ done |
| A-GP3 | R-GP-3 | watch rebuild 后 `state.graph` 保留旧 source edges；vitest 全绿（回归）。注意：watch-runner.spec.js mock 了 `store.load` → 不直接验证 reconcile 路径；watch rebuild 图完整性由代码审阅（A-GP1）+ 首次 build diff=0（A-GP2）间接验证 | P-GP03 | ✅ done |
| A-GP4 | R-GP-4 | 旧路径（`options.dependencyGraph` 无 `options.graph`）走 restoreFromSnapshot + reconcile 不变 | P-GP04 | ✅ done |

## Non-acceptance

- 首次 build diff≠0（reconcile on empty 不等价于 build）
- watch-runner.spec.js D-OS-3 测试失败
- 旧路径（无 state）行为变化
- 加了 `any` / `as any` / `@ts-nocheck`
