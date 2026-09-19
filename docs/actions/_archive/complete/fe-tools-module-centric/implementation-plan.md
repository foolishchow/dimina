# Implementation Plan — fe-tools-module-centric

Status: **complete（2026-09-21）** — 伞级规划完成；子门 M1+M2 complete 归档。

## 纪律

- 本伞不直接改 `fe/tools/bundler/src`。
- D-MF-1 **已封口**；M1 实施稿须遵守封口条款，不得猜改 emit/runtime id。
- 不得恢复整包 Packer 抽取为目标。

## 步骤

| Step | 动作 | 状态 |
| --- | --- | --- |
| 1 | 侦察：图 node / CompileInfo.path / emit；确认 Entry≠Module、page.js 债 | **done**（2026-09-19） |
| 2 | 讨论并封口 D-MF-1；补 architecture-notes | **done**（2026-09-19） |
| 3 | 伞升 `ready`；formalize 子门 M1 `fe-tools-module-invalidation` draft | **done**（M1 → [fe-tools-module-invalidation](../../../_archive/complete/fe-tools-module-invalidation/README.md) complete） |
| 4 | M1 完成后再 formalize M2 `fe-tools-module-result-cache` | **done**（M2 → [fe-tools-module-result-cache](../../../_archive/complete/fe-tools-module-result-cache/README.md) complete） |
| 5 | 可选：M0 emit W1 独立小 Action | **deferred**（S 级，不阻塞伞级关闭；另门可独立先行） |
| 6 | 子门回流后更新本伞 roadmap；伞 close 条件见 README | **done**（2026-09-21 伞级 complete） |
| 7 | review findings（2026-09-19）：条款 3→M1 TD；TODO §C 对齐；A-MF0..3 文档对拍 | **done** |

## 子门依赖

```text
D-MF-1 ──► M1 invalidation ──► M2 result-cache
                │
                └──►（可选并行）M0 emit W1
```
