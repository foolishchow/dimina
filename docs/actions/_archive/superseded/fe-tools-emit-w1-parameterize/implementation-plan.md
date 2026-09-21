# Implementation Plan — fe-tools-emit-w1-parameterize

## 步骤

### Step 1: emit.ts 参数化

- `EmitEntryParams` 加 `workPath: string`
- `bundle.apply` 解构加 `workPath`
- L142 `getWorkPath()` → `workPath`（从解构取）
- 删除 `import { getWorkPath } from '../core/env.ts'`
- **验证**：tsc 0 错（会有调用方缺 workPath 报错——预期）
- 对应：R-W1-1 / R-W1-2 / R-W1-3

### Step 2: 调用方传入 workPath

- `view/index.ts` `emitEntry` 调用加 `workPath: getWorkPath()`
- `build-pipeline.ts` emit task 两处（subs + main）加 `workPath: getWorkPath()`
- **验证**：tsc 0 错 + vitest 608/608 + diff=0
- 对应：R-W1-4 / R-W1-5 / R-W1-6

### Step 3: 最终验证

- 全量 tsc 0 错
- 全量 vitest 608/608
- 产物 diff=0（nomap + sourcemap）
- grep 验证：
  - emit.ts 不 import env.ts
  - `EmitEntryParams` 含 `workPath`
  - 无 `any` / `@ts-nocheck` / `as any`
  - 无新文件
- **对应**：R-W1-1..8

## 依赖图

```
Step 1 (emit.ts 参数化) → Step 2 (调用方传入) → Step 3 (验证)
```

单线依赖，无并行。

## 每步验证

每步完成后执行：
1. `cd fe/tools/bundler && npx tsc --noEmit --pretty` — 0 错
2. `cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test` — 608/608
3. 产物 diff=0（basic test project，nomap + sourcemap）
