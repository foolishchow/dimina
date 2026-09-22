# Requirements — fe-tools-als-store

## 问题

项目中有两处 AsyncLocalStorage，模式相同但各自实现：

### 现状 1: worker-runtime/context.ts

```typescript
import { AsyncLocalStorage } from 'node:async_hooks'

const g = globalThis
export const abilityContext = (g as { __abilityContext?: AsyncLocalStorage<unknown> } & typeof globalThis)
  .__abilityContext ||= new AsyncLocalStorage<unknown>()
```

问题：
- 类型 `unknown`——无类型安全
- globalThis 兜底逻辑内联（散在 5 行代码里）

### 现状 2: compiler/core/env.ts

```typescript
import { AsyncLocalStorage } from 'node:async_hooks'

const compilerContextStorage = new AsyncLocalStorage<CompilerContext>()

function runWithCompilerContext<T>(callback: () => T): T {
  return compilerContextStorage.run(createCompilerContext(), callback)
}

function getCompilerContext(): CompilerContext {
  const ctx = compilerContextStorage.getStore()
  if (!ctx) throw new Error('不在编译上下文内')
  return ctx
}
```

问题：
- 无 globalThis 兜底——vitest 多实例时可能出问题
- run / get 模式与 worker-runtime 重复

## 核心概念

`AsyncContextStore<T>` 封装 AsyncLocalStorage：
- `run(context, callback)` — 启动上下文（主线程 / worker 都用）
- `get()` — 获取当前上下文（必须在 run 内）
- `tryGet()` — 尝试获取（无上下文返回 undefined）
- globalThis 兜底——vitest 多实例兼容

## MUST 需求

### R-AS-1 AsyncContextStore 通用类

MUST 创建 `src/compiler/worker-runtime/async-context-store.ts`，`export class AsyncContextStore<T>`。

MUST 实现：
- `run<R>(context: T, callback: () => R): R` — 启动 ALS 上下文（泛型返回值，透传 callback 返回值）
- `get(): T` — 获取当前上下文（无上下文时 throw）
- `tryGet(): T | undefined` — 尝试获取（无上下文返回 undefined）
- `readonly name: string` — 上下文名称（错误信息可读）

MUST globalThis 兜底单例——vitest 多实例兼容（同一 name 复用同一 ALS 实例）。

### R-AS-2 abilityContext 改用 AsyncContextStore

MUST `worker-runtime/context.ts` 的 `abilityContext` 改用 `AsyncContextStore`。
MUST 类型从 `unknown` 改为正确的 AbilityContext 类型。
MUST 调用方（4 处）不改行为：
- `runtime.ts` `abilityContext.run(...)` → `abilityALS.run(...)`
- `emit.ts` `abilityContext.getStore() as ...` → `abilityALS.tryGet()?.sink`（消除 as cast）
- `compatibility.ts` `abilityContext.getStore() as ...` → `abilityALS.tryGet()?.logger ?? consoleFallback`（消除 as cast）
- `style/index.ts` `abilityContext.getStore() as ...` → `abilityALS.get().sink`（消除 as cast）

### R-AS-3 compilerContextStorage 改用 AsyncContextStore

MUST `env.ts` 的 `compilerContextStorage` 改用 `AsyncContextStore`。
MUST 加 globalThis 兜底（与 abilityContext 一致）。
MUST 调用方（`runWithCompilerContext` / `getCompilerContext`）不改签名。

### R-AS-4 行为 0

MUST diff=0（产物完全相同）。
MUST vitest 全绿。
MUST tsc 0 错。

### R-AS-5 类型约束

MUST 不引入 `any` / `as any` / `@ts-nocheck`。
MUST 不用 `[key: string]: unknown` 索引签名。
MUST `abilityContext` 从 `unknown` 改为有类型（不引入 `any`）。

## SHOULD

- R-AS-6 SHOULD `AsyncContextStore` 构造函数收 `name` 参数（错误信息可读）
- R-AS-7 SHOULD globalThis 兜底 key 用 `__als_${name}` 格式（避免冲突）

## 约束

- tsconfig: `noUnusedLocals` / `strict` / `module: NodeNext` / `allowImportingTsExtensions`
- `worker-runtime/context.ts` 的 globalThis 兜底模式保留（封装进工具类）
- 现有调用方签名不变

## 非范围

- snapshot / 序列化（以后有需要再考虑）
- PackerContext 落地（另开 Action）
- env.ts storeInfo / resetStoreInfo / getter 逻辑改动
- graph 逻辑改动
- worker 执行流程改动
