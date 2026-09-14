# Validation — fe-tools-incremental-target

Status: **draft（2026-09-14）** — 命令草案；Result 实施时回填

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-IT00 | dist 同步前置 | `node scripts/sync-dist-from-src.js`（tools/bundler） | A-IT1 前置 | pending |
| P-IT01 | 全量回归 | `vitest run --no-file-parallelism` | A-IT1 | pending |
| P-IT02 | 增量行为 0 | watch rebuild + compile-cache 增量既有测例全绿；必要时 `examples/miniprogram/base` 增量路径对照 | A-IT1 | pending |
| P-IT03 | 结构判据 | 源文件锚定（derive 消费 affectedEntries；无双套 stage 序；session 白名单对齐）+ 消融 | A-IT0 / A-IT2 / A-IT3 | pending |
| P-IT04 | 范围 | `git diff --stat` 限 watch / session / compile-target / pipeline / compile-cache / compile-stages / invalidation / 测试 / Action 文档 | A-IT4 | pending |

## 消融纪律

按 Experience-Review §6：只拔最小机制；失败点须落在结构/契约断言；恢复后全绿；消融补丁不入最终提交。
