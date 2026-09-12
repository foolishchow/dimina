# Implementation plan — fe-tools-build-pipeline（BP1）

Status: **冻结（FR1 · 2026-09-12）** — 升 `in_progress` 后按序执行；**未**授权实施直至 Action=`in_progress`

## 目标门

**BP1**：按 [stages.md](./stages.md) **等价抽取**阶段表 → `compiler/build-pipeline.js`；仍用 Listr；`build()`/`runBuild` 薄委托；**保持** M-A（若有 `options.store`）；行为 0。

## 触达序

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `src/compiler/build-pipeline.js` | **新建**：`createBuildPipeline` / `run`；搬入今日 `runBuild` 阶段体（init / concurrent / publish）；**仍用 Listr** |
| 2 | `src/index.js` | `runBuild`/`build` → 薄委托 `pipeline.run`；保留公开 `build()`；继续支持 `options.store`（保持 RR4/RR6；**不**在本 PR 实现 ProjectStore 壳） |
| 3 | 审查 | 对照 stages.md：阶段顺序、skip（seedPath/prepare*）、A1 lifecycle **零改（RR9）**；`build:start` 仍剥不可序列化字段（含 `store`） |
| 4 | 测例 | 全量 vitest；nomap；exports 无 Pipeline 子路径 |

## 不做（本 PR）

- `model/project-store.js` 主实现 / 刀 A（兄弟）  
- PS2；cache；插件 / replaceStage；Listr 解耦（BP2）  
- 与 PS1 **同一 PR**

## 验证

升 `in_progress` 时记基线 SHA（RR3）→ [validation.md](./validation.md) P-BP01..07。

## 顺序相对 PS1

PS1 **略先**或平行分 PR（RR7）；本门不硬依赖 PS1 已合并。
