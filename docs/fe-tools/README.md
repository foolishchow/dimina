# FE Tools — 旁路 toolchain 真源

私有 toolchain（`fe/tools/*`）的**项目级**架构与同步文档。不是 Action。

旁路战略伞 Action 已归档：[`fe-tools-sidecar`](../actions/_archive/complete/fe-tools-sidecar/README.md)。

| 文件 | 用途 |
| --- | --- |
| [architecture-notes.md](./architecture-notes.md) | Packer/Scheme、session、CompileTarget、焊点、回流不变量 |
| [sync-rhythm.md](./sync-rhythm.md) | 终态 B / 与 upstream 同步节奏（原 TS-4） |
| [session-scheduling.draft.md](./session-scheduling.draft.md) | 会话调度草案（L1–L4 / W1–W4 历史确认） |
| [compiler-symptom-inventory.md](./compiler-symptom-inventory.md) | 病症地图（梳理用，不授权实施） |
| [2026-09-24-packer-incremental-retrospect.md](./2026-09-24-packer-incremental-retrospect.md) | Packer 脊柱 + 增量 G1–G5 回顾检查（只读；含 G5 生产接线缺口） |

近端 Packer / 增量链（G1–G5 + residual closeout，全 `complete`）：[`fe-tools-packer-context`](../actions/_archive/complete/fe-tools-packer-context/README.md)（路 2）· [`fe-tools-graph-persist`](../actions/_archive/complete/fe-tools-graph-persist/README.md)（G1）· [`fe-tools-fingerprints-persist`](../actions/_archive/complete/fe-tools-fingerprints-persist/README.md)（G2）· [`fe-tools-invalidation-all-kinds`](../actions/_archive/complete/fe-tools-invalidation-all-kinds/README.md)（G3）· [`fe-tools-view-style-compile-res`](../actions/_archive/complete/fe-tools-view-style-compile-res/README.md)（G4）· [`fe-tools-view-style-cache-skip`](../actions/_archive/complete/fe-tools-view-style-cache-skip/README.md)（G5）· [`fe-tools-incremental-chain-residuals-closeout`](../actions/_archive/complete/fe-tools-incremental-chain-residuals-closeout/README.md)（IRC，`complete`）· [`fe-tools-style-minify-path-unify`](../actions/_archive/complete/fe-tools-style-minify-path-unify/README.md)（SMPU，`complete`）。候选池见 [`docs/actions/TODO.md`](../actions/TODO.md)。回顾见上表 retrospect 文档。
