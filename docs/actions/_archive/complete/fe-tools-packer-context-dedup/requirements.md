# Requirements — fe-tools-packer-context-dedup

Status authority: [Action Status](../../../STATUS.md)

## 功能需求

| ID | Title | Requirement |
| --- | --- | --- |
| R-PCD-1 | PackerContext 构造内核 | 抽单一内核函数 `buildPackerContextFromOptions(workPath, targetPath, compilerOptions) → PackerContext`（收已 normalized compilerOptions——readContent/resolveAlias/resolveNpm stub + fileTypes 映射统一） |
| R-PCD-2 | buildPackerContext dedup | `buildPackerContext`(env-compute) 改为 `normalizeFileTypes(fileTypes) + 内核`（收 RAW FileTypesInput 仍 normalize 先——public 签名不变） |
| R-PCD-3 | toPackerContext dedup | `toPackerContext`(env-compute) 改为从 CompilerContext 取字段（workPath/targetPath/compilerOptions）+ 内核 |
| R-PCD-4 | buildFixpointCtx dedup | `buildFixpointCtx`(config-fixpoint) 内部 ctx 构造改为调内核（收已 normalized compilerOptions）+ 包 FixpointCtx 保留 |
| R-PCD-5 | 内核放置 + 循环依赖 | 内核放 config-fixpoint（graph 层——F-R1-1 实证：无循环，store→graph 单向已存在；buildFixpointCtx 同文件就近） |
| R-PCD-6 | 字段名差异统一 | 内核统一正向映射（`templateDirectivePrefixes` → `directivePrefixes`）——F-R1-2/R1-3 实证：正向 3 处 + 反向 1 处 + config-collector:51-58 反向解构保留（最小改动） |
| R-PCD-7 | 行为 0 | tsc 0 + vitest 88/88（flaky solo pass）+ one-shot 7-diff=0（PackerContext 构造全局路径→全量 7 项目） |

## Constraints

- **行为 0**：所有重构保持字节完全相同的输出（代码 + sourcemap diff=0），全 vitest 绿
- **PackerContext 形状不变**：workPath/targetPath/readContent/resolveAlias/resolveNpm/fileTypes 字段全保留
- **normalizeFileTypes 不动**：L1 纯函数保留（env-compute）
- **CompilerContext type 不动**：env-compute L1 形状层保留
- **FixpointCtx 包装保留**：getPagesImpl 收 FixpointCtx 契约不变
- **resolveAlias/resolveNpm stub 不动**：D-PCS-1 deferred（讨论调度器时定）
- **caller public 签名最小改动**：buildPackerContext/buildFixpointCtx 签名尽量不变（测试 fixture 依赖）
- **noUnusedLocals: true** / ESM 后缀 / `as` 窄类型断言允许（非 `as any`）

## Non-scope

- PackerContext 形状改变（字段增删/重命名）
- normalizeFileTypes 重构
- CompilerContext type 改造
- FixpointCtx 包装去除（getPagesImpl 签名改）
- resolveAlias/resolveNpm stub 实体化（D-PCS-1 deferred）
- compiler/* 迁移
- L2/L3 退役（getters/resetStoreInfo/singleton/Proxy——阶段 3）
- compat 写退役（storeInfo wrapper——阶段 3）
