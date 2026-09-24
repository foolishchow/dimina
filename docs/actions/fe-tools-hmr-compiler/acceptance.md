# Acceptance — fe-tools-hmr-compiler

Status: **draft（2026-10-09）**

## 伞级 Acceptance（子门交付后填实）

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-HMR1 | R-HMR-1 load/compile 分离 | compile-target 拆 load 与 compile；HMR 能单模块 recompile（不重 load 全图） | 子门 H1 acceptance + 行为 0 | pending |
| A-HMR2 | R-HMR-2 deriveFromGraph 接线 | production emit 路径走 deriveFromGraph（非 emitBuckets） | 子门 H2 acceptance + diff=0 | pending |
| A-HMR3 | R-HMR-3 registry 实体化 | orchestrator emptyRegistry → real Loader/Compiler/Emitter | 子门 H3 acceptance + diff=0 | pending |
| A-HMR4 | R-HMR-4 per-module HMR push | dev server 消费增量 payload（非全量 reload） | 子门 H4 acceptance + dev server 验 | pending |
| A-HMR5 | R-HMR-5 行为 0 | one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿（各子门） | 各子门 validation | pending |
| A-HMR6 | R-HMR-6 目录 cycle 消解 | core⇄packer + pipeline⇄domain + model→pipeline 缺口消解 | 目录 import 矩阵 0 cycle + architecture-notes | pending |

## 伞级门

| 门 | 内容 | 验收 |
| --- | --- | --- |
| HMR0 | 词汇与子门顺序冻结 | D-HMR-1..N 在档；roadmap 一致 |
| HMR1+ | 子门交付 | 伞只跟踪，不替代子门 acceptance |

## Non-acceptance（显式排除）

- runtime HMR API（运行时侧——非本伞实施）
- 整包 Packer extraction（packer-research 已否决）
- dev server WebSocket 协议重写（H4 消费增量，不重写传输层）

## Traceability

- R-HMR-1..6 ↔ A-HMR1..6
- 子门 H1（load/compile 分离）↔ A-HMR1
- 子门 H2（deriveFromGraph 接线）↔ A-HMR2
- 子门 H3（registry 实体化）↔ A-HMR3
- 子门 H4（per-module HMR push）↔ A-HMR4
- 各子门行为 0 ↔ A-HMR5
- 目录 cycle 消解 ↔ A-HMR6（load/compile 分离副产品）
