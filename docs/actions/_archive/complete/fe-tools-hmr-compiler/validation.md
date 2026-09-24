# Validation — fe-tools-hmr-compiler

Status: **complete（2026-10-09）**

> **§8 修正**：H1-H4 重编号（见 [design.draft §8](design.draft.md)）。P-HMR1..4 映射同步。

## 伞级 Validation Plan（子门交付后执行）

| ID | 验证项 | 命令/方法 | 状态 |
| --- | --- | --- | --- |
| P-HMR1 | deriveFromGraph 接线（H1） | 子门 H1 validation（emit 路径 graph 派生 + emitBuckets→deriveFromGraph 字节一致 + diff=0） | **pass**（H1 archived validation） |
| P-HMR2 | registry 实体化（H2） | 子门 H2 validation（emptyRegistry → real + compile-target → registry 路径 + diff=0） | **pass**（H2 archived validation + Phase 2：logicLoader 6 tests + L/C/E 拆分 diff=0） |
| P-HMR3 | per-module view/style cache（H3） | 子门 H3 validation（per-page-bundle → per-module + bundle 字节一致 + watch 恒等） | **pass**（H3 archived validation + Phase 2：selective recompile 4 tests 字节恒等） |
| P-HMR4 | per-module HMR push（H4） | 子门 H4 validation（dev-reload HMR level + dev-server 增量 payload + dev server 验） | **pass**（H4 archived validation + Phase 2：L_HMR 4 tests + publish-incremental 5 tests） |
| P-HMR5 | 行为 0 三件套（各子门） | vitest 全绿 + tsc 0 errors + 6 项目 diff=0 | **pass**（最终态：tsc 0 + vitest 86/644 + 6 项目 diff=0——跨 H2p2+H4p2+H3p2 累积验证 vs pre-H2p2 baseline） |
| P-HMR6 | 目录 cycle 消解 | 跨目录 import 矩阵 0 cycle + grep 0 upward leak | **pass（partial）**：0 runtime cycle ✓（grep 验证：① env→packer 单向 runtime（graph.ts→env 仅 import type 擦除）+ ② pipeline/emit 无 domain import）；upward leak 残留在档（① env.ts→packer gradual W3 + ③ model→pipeline D-REG-3 deferred——SHOULD 不阻塞） |

## 行为 0 三件套（各子门须过）

- **vitest**：全量 spec 全绿（当前 84 files / 626 tests baseline）
- **tsc**：`tsc --noEmit` 0 errors
- **diff=0**：one-shot 6 项目 production 路径 diff=0 对 baseline（SMPU 后 baseline = production == verify）

## 目录 cycle 验证（A-HMR6）

跨目录 import 矩阵（python 解析）——验 0 runtime cycle + 0 upward leak：
- ① core ⇄ packer（env.ts 反向 import 消解——H2 registry 实体化，load 归 Loader）
- ② pipeline ⇄ domain（emit.ts 归位——H1 emit 路径重构）
- ③ model → pipeline（stage/emit 概念归位——H2 registry 替代 compile-target）

## runtime HMR API 依赖标注

H4 per-module push 依赖 runtime HMR API 协议（运行时侧）。若 runtime 未就绪：
- H4 编译侧增量 payload 可先交付（dev server fallback L1 page-level reload）
- runtime 就绪后激活 L_HMR per-module hot-swap
- architecture-notes 记 runtime 依赖状态
