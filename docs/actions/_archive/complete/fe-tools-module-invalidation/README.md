# FE Tools Module Invalidation（M1 / 刀 2）

- Action: `fe-tools-module-invalidation`
- Status: `complete`
- Updated: 2026-09-20
- Status authority: [Action Status](../../../STATUS.md)
- 伞：[fe-tools-module-centric](../../../fe-tools-module-centric/README.md)（`ready`；D-MF-1 已封口）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`
- 前置：[`boundaries`](../../../_archive/complete/fe-tools-bundler-boundaries/README.md)；[`emit-layer`](../../../_archive/complete/fe-tools-bundler-emit-layer/README.md)；[`incremental-target`](../../../_archive/complete/fe-tools-incremental-target/README.md)（Entry 级 `affectedEntries` 保留）

## 问题陈述

增量失效今天停在 **Entry**：

- `DependencyGraph.getAffectedEntries` / `computeAffectedEntries` → 页级集合
- 无 **logic Module** 级查询；M2 结果缓存缺少上游脏集

伞 D-MF-1 已规定：`entryId` ≠ `moduleId`；刀 2 返回 logic Module 集（方案 A = 今日 `CompileInfo.path`）；不替换 Entry API。

## Goal

交付 **模块级失效查询**（刀 2）：

```text
changed files → getInvalidatedModules / computeInvalidatedModules → string[]  // sorted；logic only
```

- `moduleId` = 今日 logic `CompileInfo.path`（= emit `moduleId`）
- 保留并区分 `getAffectedEntries`（Entry）
- 单测锁定；不改 emit / runtime 字符串

## Non-goals

- Module 结果缓存（M2 / 刀 3）
- view / style Module 图；改 wxml 进本 API 返回集
- page `moduleId` 规范形迁移 / 改 `modDefine`（另门）
- 拆 `DependencyGraph` node 表；PackerContext / 拆 env·logic
- 改 `fe/packages`；在本 Action 未授 `in_progress` 前改 `src`（`draft`/`ready` 仅文档）

## 边界

```text
伞 module-centric:  词汇 + D-MF-1 + 子门顺序
本 Action (M1):     logic 模块级失效查询 API + 单测
M2 result-cache:    消费本 API 的脏集（另立）
Entry 路径:         getAffectedEntries / computeAffectedEntries 保留
```

## 产品门

| 门 | 内容 | 验收 |
| --- | --- | --- |
| **IV0** | 算法与 API 拍板 | D-IV-1..9 冻结 ✓（2026-09-19） |
| **IV1** | 实现 + 单测 | A-\* / P-\* pass；行为 0 |

## Status / 授权

- 当前 **`complete`**（2026-09-20）。**in_progress → complete**：API 实施 + 6 测例全绿 + 行为 0 + 回流。
- 闭合：A-IV0..4 全 pass；P-IV00..04 全 pass；证据入 validation Actual。

## 闭合条件

- IV0+IV1 交付；A-\* 全 pass；证据入 validation Actual
- 持久要点回流 `docs/fe-tools/architecture-notes.md`
- STATUS / 伞 roadmap 一致

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-19 | review findings：Goal=`string[]`；requirements 去「待定」；A-IV0/P-IV00 pass |
| 2026-09-19 | **冻结** T1–T7 → D-IV-1..9；IV0 文档完成；仍 `draft` |
| 2026-09-19 | 立项 `draft`：承接伞 D-MF-1 / 刀 2 |
| 2026-09-20 | review F1–F4 修复：P-IV02/A-IV2 补 component 案（F1）；D-IV-1 注结构类型（F2）；D-IV-9 改 dependency-graph.spec.js（F3）；plan 步 5 IV1 实施序（F4） |
| 2026-09-20 | review R2 F1–F4 修复：R-IV2 补 component + 未知文件案（F1/F4 源头传播）；D-IV-1 参数名 files→changedFiles（F2）；README Updated 日期（F3）；A-IV2/P-IV02 补未知文件案（F4） |
| 2026-09-20 | review R3 F1–F2 修复：plan 步 5 案数 4→5 + 引用补 D-IV-3（F1）；TD §2.1 伪代码删死 owners 行 + 显式定义 file=normalizeFilePath（F2） |
| 2026-09-20 | **升 `ready`**（用户授权）；6 轮 readiness review 收敛（R1–R6: 4→4→2→1→1→0）；文档门全 pass；升 `in_progress` 另授 |
| 2026-09-20 | **升 `in_progress`**（用户授权）：实施 getInvalidatedModules + computeInvalidatedModules + 6 测例 |
| 2026-09-20 | **升 `complete`**：tsc 0 错；vitest 9/9 + 全量 594/595（1 flaky retry pass）；diff scope 仅 model/ + spec；A-IV0..4 / P-IV00..04 全 pass；回流 architecture-notes |
