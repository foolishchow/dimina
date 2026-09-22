# Acceptance — fe-tools-als-store

## A-AS-1 — AsyncContextStore 通用类（R-AS-1）

- [ ] `src/compiler/worker-runtime/async-context-store.ts` 含 `export class AsyncContextStore<T>`
- [ ] 实现 `run<R>(context: T, callback: () => R): R`
- [ ] 实现 `get(): T`（无上下文时 throw）
- [ ] 实现 `tryGet(): T | undefined`
- [ ] 实现 `readonly name: string`
- [ ] globalThis 兜底单例（同一 name 复用同一 ALS 实例）

## A-AS-2 — abilityContext 改用 AsyncContextStore（R-AS-2）

- [ ] `worker-runtime/context.ts` `abilityContext` 改用 `AsyncContextStore`
- [ ] 类型从 `unknown` 改为 `AbilityContext`
- [ ] `runtime.ts` 调用方兼容（`abilityALS.run()` 替换 `abilityContext.run()`）
- [ ] `emit.ts` 调用方兼容（`abilityALS.tryGet()?.sink` 替换 `getStore() as ...`）
- [ ] `compatibility.ts` 调用方兼容（`abilityALS.tryGet()?.logger` 替换 `getStore() as ...`）
- [ ] `style/index.ts` 调用方兼容（`abilityALS.get().sink` 替换 `getStore() as ...`）

## A-AS-3 — compilerContextStorage 改用 AsyncContextStore（R-AS-3）

- [ ] `env.ts` `compilerContextStorage` 改用 `AsyncContextStore`
- [ ] 加 globalThis 兜底
- [ ] `runWithCompilerContext` / `getCompilerContext` 签名不变

## A-AS-4 — 行为 0（R-AS-4）

- [ ] `git diff --stat` 产物 diff=0
- [ ] tsc 0 错
- [ ] vitest 全绿

## A-AS-5 — 类型约束（R-AS-5）

- [ ] 无 `any` / `as any` / `@ts-nocheck`
- [ ] 无 `[key: string]: unknown` 索引签名
- [ ] `abilityContext` 从 `unknown` 改为有类型（非 `any`）
