# Acceptance — fe-tools-emit-w1-parameterize

## A-W1-1 — emit.ts 不 import env.ts

- [ ] `pipeline/emit.ts` 不含 `from '../core/env.ts'`（`grep -c "from.*env.ts" emit.ts` = 0）
- [ ] `pipeline/emit.ts` 不含 `getWorkPath` 调用（`grep -c 'getWorkPath' emit.ts` = 0）

## A-W1-2 — `EmitEntryParams` 含 `workPath`

- [ ] `pipeline/emit.ts` 含 `workPath: string` 在 `EmitEntryParams` interface 中

## A-W1-3 — `bundle` 策略参数化

- [ ] `pipeline/emit.ts` 的 `bundle.apply` 解构含 `workPath`
- [ ] `pipeline/emit.ts` L142 用 `workPath` 替代 `getWorkPath()`（`grep -c 'resolve(workPath' emit.ts` ≥ 1）

## A-W1-4 — `view/index.ts` 传入 `workPath`

- [ ] `view/index.ts` 的 `emitEntry` 调用含 `workPath: getWorkPath()`（`grep -c 'workPath.*getWorkPath' view/index.ts` ≥ 1）

## A-W1-5 — `build-pipeline.ts` 传入 `workPath`

- [ ] `build-pipeline.ts` 的 emit task 含 `workPath`（`grep -c 'workPath' build-pipeline.ts` ≥ 1）

## A-W1-6 — 行为 0

- [ ] tsc 0 错
- [ ] 全量 vitest 绿（608/608）
- [ ] nomap 产物 diff=0
- [ ] sourcemap 产物 diff=0

## A-W1-7 — 无 `any` / `@ts-nocheck` / `as any`

- [ ] `pipeline/emit.ts` 不含 `: any` / `as any` / `@ts-nocheck`（`grep -c ': any\b\|as any\b\|@ts-nocheck' emit.ts` = 0）

## A-W1-8 — 不新增文件

- [ ] `pipeline/` 目录下不新增 `.ts` 文件（`git diff --name-only` 中仅 emit.ts 改动）
