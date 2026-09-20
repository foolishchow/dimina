# FE Tools — 旁路 toolchain 真源

私有 toolchain（`fe/tools/*`）的**项目级**架构与同步文档。不是 Action。

旁路战略伞 Action 已归档：[`fe-tools-sidecar`](../actions/_archive/complete/fe-tools-sidecar/README.md)。

| 文件 | 用途 |
| --- | --- |
| [architecture-notes.md](./architecture-notes.md) | Packer/Scheme、session、CompileTarget、焊点、回流不变量 |
| [sync-rhythm.md](./sync-rhythm.md) | 终态 B / 与 upstream 同步节奏（原 TS-4） |
| [session-scheduling.draft.md](./session-scheduling.draft.md) | 会话调度草案（L1–L4 / W1–W4 历史确认） |
| [compiler-symptom-inventory.md](./compiler-symptom-inventory.md) | 病症地图（梳理用，不授权实施） |

近端正式 Action：[`fe-tools-emit-relocate`](../actions/fe-tools-emit-relocate/README.md)（emit 搬迁，`ready`；MC3b）。候选池见 [`docs/actions/TODO.md`](../actions/TODO.md)。
