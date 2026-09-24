# Design Draft — fe-tools-hmr-compiler

> 本文件是设计草稿，非正式文档。用于规模评估后产出正式子门 design。

Status: **draft（2026-10-09）**

## ⏳ 规模评估待做（step 2 填）

本 design.draft 将在 step 2 评估：

- §1 现状分析（4 缺口的代码实证）
- §2 子门拆分粒度（H1-H4 是否可再拆？依赖序是否线性？）
- §3 行为 0 边界（各子门 production 重构的 diff=0 边界）
- §4 目录 cycle 自然消解路径（load/compile 分离如何 subsume ①②③）
- §5 runtime HMR API 依赖（H4 编译侧 fallback 策略）
- §6 D-HMR design gate（load/compile 分离策略：渐进 vs 一次性）

## 预判 4 子门

| 子门 | 目标 | 预判规模 |
| --- | --- | --- |
| H1 load/compile 分离 | compile-target 拆 load 与 compile | L（compile-target 是核心入口） |
| H2 deriveFromGraph 接线 | emit 从 emitBuckets 改 graph 派生 | M（deriveFromGraph 已定义，接线 + 移 legacy） |
| H3 registry 实体化 | emptyRegistry → real | M（Packer shape 已定义，实体化 + 移 legacy compile-target） |
| H4 per-module HMR push | runtime.ts 增量 payload + dev server 消费 | S-M（runtime 协议依赖） |
