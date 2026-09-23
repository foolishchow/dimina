# Validation — fe-tools-graph-persist

Status: **draft（2026-10-07）**

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-GP01 | state 路径走 reconcile | 审阅代码：`options.graph` 传入 → `graph.reconcile()`；`else if (options.dependencyGraph)` → restore+reconcile；`else` → build | R-GP-1 / A-GP1 | pending |
| P-GP02 | 首次 build 行为 0 | `DIMINA_COMPILER_DIFF_VERIFY=1`；全量 7 项目 diff=0（stash baseline vs new） | R-GP-2 / A-GP2 | pending |
| P-GP03 | watch rebuild 图完整 + vitest | vitest 全绿（含 watch-runner.spec.js D-OS-3）；tsc 0 | R-GP-3 / A-GP3 | pending |
| P-GP04 | 旧路径不变 | 审阅代码：`else if (options.dependencyGraph)` 分支逻辑不变 | R-GP-4 / A-GP4 | pending |

## Uncovered

- fingerprints 持久化（G2，另门）
- getInvalidatedModules 泛化全 kind（G3，另门）
- view/style 模块级 cache（G4/G5 = incremental-unify，本门完成后重激活）
- stale edge 清理（非 cached 模块 deps 变化后的旧边残留）
- 跨进程持久

## Actual

| When | What |
| --- | --- |
| 2026-10-07 | 立项 `draft`。 |
