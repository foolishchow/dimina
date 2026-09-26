# Acceptance — fe-tools-packer-context-dedup

Status authority: [Action Status](../STATUS.md)

| ID | Requirement | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-PCD-1 | R-PCD-1 | PackerContext 构造内核 | 抽 `buildPackerContextFromOptions(workPath, targetPath, compilerOptions) → PackerContext`（readContent/resolveAlias/resolveNpm stub 逐字搬迁 + fileTypes 字段名映射统一）；放置 D-PCD-5 lock；tsc 0 | done |
| A-PCD-2 | R-PCD-2 | buildPackerContext dedup | `buildPackerContext`(env-compute) = `normalizeFileTypes(fileTypes) + 内核`（public 签名不变——收 RAW FileTypesInput）；行为等价；tsc 0 | done |
| A-PCD-3 | R-PCD-3 | toPackerContext dedup | `toPackerContext`(env-compute) = 从 CompilerContext 取字段 + 内核（`!` 窄断言保留）；CompilerContext 依赖保留；tsc 0 | done |
| A-PCD-4 | R-PCD-4 | buildFixpointCtx dedup | `buildFixpointCtx`(config-fixpoint) = 内核 + 包 FixpointCtx（npm: new NpmResolver(workPath) 保留）；FixpointCtx 包装保留；tsc 0 | done |
| A-PCD-5 | R-PCD-7 | 行为 0 | tsc 0 + vitest 88/648（3 flaky solo pass——compile-cli-cache/lifecycle-integration/view-selective-stages）+ one-shot 7-diff=0（air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui） | done |
| A-PCD-6 | R-PCD-5/6 | Non-scope 守 | PackerContext 形状不改 + normalizeFileTypes 不动 + CompilerContext 不动 + FixpointCtx 包装保留 + resolveAlias/resolveNpm stub 不动 + compiler/* 不动 + L2/L3 不动 + compat 写不动 | done |

## backflow（P-PCD-3 后记录）

- 阶段 3（L2+L3 退役）：compiler/* 加 PackerContext + worker 模型调整 + singleton/getters/Proxy/resetStoreInfo 全删
- compat 写保留（storeInfo wrapper——阶段 3 退役）
- resolveAlias/resolveNpm stub 实体化（D-PCS-1——讨论调度器时定）
