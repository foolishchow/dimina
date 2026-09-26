# Implementation Plan — fe-tools-packer-context-dedup

Status authority: [Action Status](../STATUS.md)

## 分相（行为 0 每相 gate）

### P-PCD-1 — 抽内核 buildPackerContextFromOptions（A 批：添加）

1. 内核放置（D-PCD-5 readiness lock 后定）：config-fixpoint.ts（选项 A）或新建纯工具层（选项 C）
2. 抽 `buildPackerContextFromOptions(workPath, targetPath, compilerOptions) → PackerContext`（readContent/resolveAlias/resolveNpm stub 逐字搬迁 + fileTypes 字段名映射统一）
3. tsc 0

### P-PCD-2 — 三构造点 dedup（B 批：wire）

1. env-compute.ts `buildPackerContext` 改为 `normalizeFileTypes(fileTypes) + 内核`
2. env-compute.ts `toPackerContext` 改为从 CompilerContext 取字段 + 内核
3. config-fixpoint.ts `buildFixpointCtx` 内部 ctx 构造改为调内核 + 包 FixpointCtx 保留
4. config-collector.ts 反向解构去留（D-PCD-6 readiness lock 后定）
5. tsc 0

### P-PCD-3 — 行为 0 全量验证（C 批：验）

1. tsc 0（`node ./node_modules/typescript/bin/tsc --noEmit`）
2. vitest 88/88（flaky solo pass）
3. one-shot 7-diff=0（`node --experimental-strip-types /tmp/dc-build.mjs diff`）
4. grep 三构造点 ctx 构造重复 = 0（逐字搬迁验证）

## 验证点

- P-PCD-1 后：内核函数存在 + tsc 0
- P-PCD-2 后：三构造点全调内核（grep `buildPackerContextFromOptions` caller=3）+ tsc 0
- P-PCD-3：行为 0 三件套绿 + 逐字搬迁验证（readContent/resolveAlias/resolveNpm stub 无重复）

## 风险点

- **D-PCD-5 内核放置**：P-PCD-1 步 1 须 readiness audit 先决（循环依赖）
- **D-PCD-6 字段名差异**：P-PCD-2 步 4 config-collector 反向解构去留须 readiness lock
- **P-PCD-1/P-PCD-2 atomic**：内核 + 三构造点 dedup 须 atomic（否则重复残留）。建议合并单 commit。
