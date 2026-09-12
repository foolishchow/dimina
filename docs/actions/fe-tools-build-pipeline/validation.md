# Validation — fe-tools-build-pipeline

Status: **BP1 已交付（2026-09-12）** — Result 列已填；审查后可归档

**基线（RR3）：** `aa6b6508`（升 in_progress 时 HEAD = PS1 提交）。

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-BP01 | 全量回归 | `vitest run --no-file-parallelism`（tools/bundler） | A-BP01 / A-BP02 | **pass** — 481 tests / 72 suites 全绿 |
| P-BP02 | 字节等价 | baseline worktree(`aa6b6508`) vs 当前，base 工程双模式 `diff -rq` | A-BP02 | **pass** — nomap 94 / sourcemap 185 文件 diff=0（含 CLI 冒烟：base 工程 build 成功） |
| P-BP03 | exports | `node scripts/check-package-exports.js` | A-BP03 | **pass** — Validated 6 ESM exports + dimina-cli CLI；无 Pipeline 子路径 |
| P-BP04 | Store 注入 / M-A 保持 | 注入 store build 成功 + 无 store 临时路径 build 成功（ma-check.mjs） | A-BP04 | **pass** — 注入与缺省两路径均绿（同引用由 PS1 M-A 保证 + 全量回归覆盖） |
| P-BP05 | diff 范围 | `git diff --stat` | A-BP05 | **pass** — 仅 `src/compiler/build-pipeline.js`（新，334 行）+ `src/index.js`（委托化，20 行）+ STATUS；无 PS 主实现/PS2/cache 混入 |
| P-BP06 | CLI 冒烟（SHOULD） | base 工程 build（nomap + sourcemap） | A-BP02 | **pass** — 双模式构建成功（P-BP02 内完成） |
| P-BP07 | Listr 仍在（审查） | build-pipeline.js 源码 | A-BP01 | **pass** — `new Listr(...)` 仍在，阶段表（init/concurrent/publish）+ skip 条件（seedPath/prepare*）与原 runBuild 一致 |

消融：非必须。  
**RR1：** stages 权威见 [stages.md](./stages.md)（已迁；非本表 Result）。
