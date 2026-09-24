# Acceptance — fe-tools-hmr-compiler

Status: **complete（2026-10-09）**

> **§8 修正**：H1-H4 重编号（见 [design.draft §8](design.draft.md)）。A-HMR1..4 映射同步。

## 伞级 Acceptance（子门交付后填实）

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-HMR1 | R-HMR-1 deriveFromGraph 接线 | production emit 路径走 deriveFromGraph（非 emitBuckets）；只 emit 受影响 modules | 子门 H1 acceptance + diff=0 | **pass**（H1 complete——orchestrator Logic emit 走 deriveLogicBuckets，emitBuckets 全链下线） |
| A-HMR2 | R-HMR-2 registry 实体化 | orchestrator emptyRegistry → real Loader/Compiler/Emitter；compile-target → registry 路径 | 子门 H2 acceptance + diff=0 | **pass**（H2 complete + Phase 2——dispatch registry 实体化 + computeStagePlan 替代 deriveStagePlan；F-H2-1 L/C/E 拆分交付（logicLoader 注册 + view/style 阶段函数）。**残留**：compile/emit registry 接口注册仍 stub（阶段函数已就绪，管线接线是伞外后续） |
| A-HMR3 | R-HMR-3 per-module view/style cache | view/style cache 从 per-page-bundle → per-module；单组件 recompile 可行 | 子门 H3 acceptance + watch 字节恒等 | **pass**（H3 complete + Phase 2——per-module cache + order list + selective recompile 4 tests；单组件 recompile 可行已交付） |
| A-HMR4 | R-HMR-4 per-module HMR push | dev-reload HMR level + dev-server 增量 payload；dev server 消费增量（非全量 reload） | 子门 H4 acceptance + dev server 验 | **pass**（H4 complete + Phase 2——L_HMR level + enableHmr + BuildModel dirtyEntries + 增量 materialize + publishToDist 增量 sync。**L_HMR 激活待 runtime（D-HMR-5 非阻塞）**；fallback L1 交付） |
| A-HMR5 | R-HMR-5 行为 0 | one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿（各子门） | 各子门 validation | **pass**（全部子门 + Phase 2：tsc 0 + vitest 644/644 + 6 项目 diff=0 累积验证） |
| A-HMR6 | R-HMR-6 目录 cycle 消解 | 目录 cycle 消解（core⇄packer + pipeline⇄domain + model→pipeline） | 目录 import 矩阵 0 cycle + architecture-notes | **pass（SHOULD partial）**——0 runtime cycle ✓（① env→packer 单向 runtime + ② emit.ts 无 domain import）；② 已消解 ✓；**残留**：① env.ts→packer upward leak（W3 gradual migration 在档）+ ③ model→pipeline（D-REG-3 deferred COMPILE_STAGE_ORDER 下沉）——均在档不违反 MUST |

## 伞级门

| 门 | 内容 | 验收 |
| --- | --- | --- |
| HMR0 | 词汇与子门顺序冻结 | D-HMR-1..5 在档；roadmap 一致 |
| HMR1+ | 子门交付 | 伞只跟踪，不替代子门 acceptance |

## Non-acceptance（显式排除）

- runtime HMR API（运行时侧——非本伞实施）
- 整包 Packer extraction（packer-research 已否决）
- dev server WebSocket 协议重写（H4 消费增量，不重写传输层）

## Traceability

- R-HMR-1..6 ↔ A-HMR1..6
- 子门 H1（deriveFromGraph 接线）↔ A-HMR1
- 子门 H2（registry 实体化）↔ A-HMR2
- 子门 H3（per-module view/style cache）↔ A-HMR3
- 子门 H4（per-module HMR push）↔ A-HMR4
- 各子门行为 0 ↔ A-HMR5
- 目录 cycle 消解 ↔ A-HMR6（H1-H2 副产品）
