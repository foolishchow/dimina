# Validation — fe-tools-hmr-compiler

Status: **draft（2026-10-09）**

> **§8 修正**：H1-H4 重编号（见 [design.draft §8](design.draft.md)）。P-HMR1..4 映射同步。

## 伞级 Validation Plan（子门交付后执行）

| ID | 验证项 | 命令/方法 | 状态 |
| --- | --- | --- | --- |
| P-HMR1 | deriveFromGraph 接线（H1） | 子门 H1 validation（emit 路径 graph 派生 + emitBuckets→deriveFromGraph 字节一致 + diff=0） | pending |
| P-HMR2 | registry 实体化（H2） | 子门 H2 validation（emptyRegistry → real + compile-target → registry 路径 + diff=0） | pending |
| P-HMR3 | per-module view/style cache（H3） | 子门 H3 validation（per-page-bundle → per-module + bundle 字节一致 + watch 恒等） | pending |
| P-HMR4 | per-module HMR push（H4） | 子门 H4 validation（dev-reload HMR level + dev-server 增量 payload + dev server 验） | pending |
| P-HMR5 | 行为 0 三件套（各子门） | vitest 全绿 + tsc 0 errors + 6 项目 diff=0 | pending |
| P-HMR6 | 目录 cycle 消解 | 跨目录 import 矩阵 0 cycle + grep 0 upward leak | pending |

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
