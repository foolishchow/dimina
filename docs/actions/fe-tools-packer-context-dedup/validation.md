# Validation — fe-tools-packer-context-dedup

Status authority: [Action Status](../STATUS.md)

| ID | Requirement | Validation | Status |
| --- | --- | --- | --- |
| V-PCD-1 | R-PCD-7 | tsc 0 errors（`node ./node_modules/typescript/bin/tsc --noEmit`） | done |
| V-PCD-2 | R-PCD-7 | vitest 全绿（88 files 648 tests；flaky solo pass——compile-cli-cache/lifecycle-integration/session-unify） | done |
| V-PCD-3 | R-PCD-7 | **one-shot 7 项目 build diff=0**（air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui） | done |
| V-PCD-4 | R-PCD-1 | grep `buildPackerContextFromOptions` 定义非 0 + readContent/resolveAlias/resolveNpm stub 在内核唯一（非三处重复） | done |
| V-PCD-5 | R-PCD-2 | grep `buildPackerContext` 在 env-compute = normalize + 内核（非逐字重复） | done |
| V-PCD-6 | R-PCD-3 | grep `toPackerContext` 在 env-compute = 取字段 + 内核（非逐字重复） | done |
| V-PCD-7 | R-PCD-4 | grep `buildFixpointCtx` 在 config-fixpoint = 内核 + 包 FixpointCtx（非逐字重复 ctx 构造）+ grep `as PackerFileTypes` = 0（F-R9-1：buildFixpointCtx 冗余断言去除） | done |
| V-PCD-8 | R-PCD-5 | 内核放置无循环依赖（config-fixpoint 不 import env-compute——选项 A；或纯工具层无循环——选项 C） | done |
| V-PCD-9 | R-PCD-6 | 字段名映射在内核统一（`templateDirectivePrefixes` → `directivePrefixes`——grep 内核非 0）+ config-collector 反向解构去留 D-PCD-6 lock 后定 | done |
| V-PCD-10 | R-PCD-5 | caller public 签名最小改动（buildPackerContext/buildFixpointCtx 签名不变——测试 fixture 依赖） | done |

## 行为 0 三件套（每相 gate）

- **tsc**：`node ./node_modules/typescript/bin/tsc --noEmit` → 0 errors
- **vitest**：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs exec vitest run` → 全绿（flaky solo pass）
- **7 diff（one-shot）**：`node --experimental-strip-types /tmp/dc-build.mjs diff` → all 7 diff=0

## 不验（Non-scope）

- PackerContext 形状不改——不验字段增删
- normalizeFileTypes 不动——不验
- CompilerContext 不动——不验
- FixpointCtx 包装保留——不验 getPagesImpl 签名
- resolveAlias/resolveNpm stub 不动——不验
- compiler/* 不动——不验
- L2/L3 不动——不验
- compat 写不动——不验
