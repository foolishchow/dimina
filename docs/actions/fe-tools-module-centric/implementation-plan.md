# Implementation Plan — fe-tools-module-centric

Status: **ready（2026-09-19）** — 伞级规划。`ready` 不授权改产品代码；改 src 仅经子门 `in_progress`。

## 纪律

- 本伞不直接改 `fe/tools/bundler/src`。
- D-MF-1 **已封口**；M1 实施稿须遵守封口条款，不得猜改 emit/runtime id。
- 不得恢复整包 Packer 抽取为目标。

## 步骤

| Step | 动作 | 状态 |
| --- | --- | --- |
| 1 | 侦察：图 node / CompileInfo.path / emit；确认 Entry≠Module、page.js 债 | **done**（2026-09-19） |
| 2 | 讨论并封口 D-MF-1；补 architecture-notes | **done**（2026-09-19） |
| 3 | 伞升 `ready`；formalize 子门 M1 `fe-tools-module-invalidation` draft | **done**（M1 → [fe-tools-module-invalidation](../fe-tools-module-invalidation/README.md)） |
| 4 | M1 完成后再 formalize M2 `fe-tools-module-result-cache` | pending |
| 5 | 可选：M0 emit W1 独立小 Action | optional |
| 6 | 子门回流后更新本伞 roadmap；伞 close 条件见 README | pending |
| 7 | review findings（2026-09-19）：条款 3→M1 TD；TODO §C 对齐；A-MF0..3 文档对拍 | **done** |

## 子门依赖

```text
D-MF-1 ──► M1 invalidation ──► M2 result-cache
                │
                └──►（可选并行）M0 emit W1
```
