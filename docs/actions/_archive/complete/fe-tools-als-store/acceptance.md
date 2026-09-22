# Acceptance — fe-tools-als-store

## A-AS-1 — AsyncContextStore 通用类（R-AS-1）

- [x] `src/compiler/worker-runtime/async-context-store.ts` 含 `export class AsyncContextStore<T>`
- [x] 实现 `run<R>(context: T, callback: () => R): R`
- [x] 实现 `get(): T`（无上下文时 throw）
- [x] 实现 `tryGet(): T | undefined`
- [x] 实现 `readonly name: string`
- [x] 支持 `legacyKey?` 向后兼容（旧 key 名查找）
- [x] globalThis 兜底单例（同一 name 复用同一 ALS 实例）

## A-AS-2 — abilityContext 改用 AsyncContextStore（R-AS-2）

- [x] `worker-runtime/context.ts` `abilityContext` 改用 `AsyncContextStore`
- [x] 类型从 `unknown` 改为 `AbilityContext`
- [x] `runtime.ts` 调用方兼容（`abilityALS.run()` 替换 `abilityContext.run()`）
- [x] `emit.ts` 调用方兼容（`abilityALS.tryGet()?.sink` 替换 `getStore() as ...`）
- [x] `compatibility.ts` 调用方兼容（`abilityALS.tryGet()?.logger` 替换 `getStore() as ...`）
- [x] `style/index.ts` 调用方兼容（`abilityALS.get().sink` 替换 `getStore() as ...`）

## A-AS-3 — compilerContextStorage 改用 AsyncContextStore（R-AS-3）

- [x] `env.ts` `compilerContextStorage` 改用 `AsyncContextStore`
- [x] 加 globalThis 兜底
- [x] `runWithCompilerContext` / `getCompilerContext` 签名不变

## A-AS-4 — 行为 0（R-AS-4）

- [x] `git diff --stat` 产物 diff=0
- [x] tsc 0 错
- [x] vitest 全绿

## A-AS-5 — 类型约束（R-AS-5）

- [x] 无 `any` / `as any` / `@ts-nocheck`
- [x] 无 `[key: string]: unknown` 索引签名
- [x] `abilityContext` 从 `unknown` 改为有类型（非 `any`）
