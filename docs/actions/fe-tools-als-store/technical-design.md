# Technical Design — fe-tools-als-store

## §1 AsyncContextStore 设计

```typescript
// src/compiler/worker-runtime/async-context-store.ts
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * 通用异步上下文存储——封装 AsyncLocalStorage。
 *
 * 主线程 / worker 都用 run() 启动上下文，get() / tryGet() 读取。
 * globalThis 兜底单例——vitest 多实例兼容（同一 name 复用同一实例）。
 *
 * 不管序列化/快照——消费方自己处理跨线程数据传递。
 */
export class AsyncContextStore<T> {
  private readonly als: AsyncLocalStorage<T>
  readonly name: string

  constructor(options: { name: string }) {
    this.name = options.name
    const key = `__als_${this.name}`
    const g = globalThis as { [k: string]: unknown } & typeof globalThis
    // globalThis 兜底：vitest 可能多实例化本模块，同一 name 复用
    this.als = (g[key] as AsyncLocalStorage<T> | undefined) ?? new AsyncLocalStorage<T>()
    g[key] = this.als
  }

  run<R>(context: T, callback: () => R): R {
    return this.als.run(context, callback)
  }

  get(): T {
    const store = this.als.getStore()
    if (!store) {
      throw new Error(`[${this.name}] no active context`)
    }
    return store
  }

  tryGet(): T | undefined {
    return this.als.getStore() ?? undefined
  }
}
```

## §2 现有改造

### §2.1 worker-runtime/context.ts

```typescript
// 改前
import { AsyncLocalStorage } from 'node:async_hooks'
const g = globalThis
export const abilityContext = (g as ...).__abilityContext ||= new AsyncLocalStorage<unknown>()

// 改后
import { AsyncContextStore } from './async-context-store.ts'

export interface AbilityContext {
  sink: import('./sinks.ts').Sink
  logger: import('./loggers.ts').Logger
}

export const abilityALS = new AsyncContextStore<AbilityContext>({ name: 'ability' })

// 兼容旧 API（runtime.ts 用 abilityContext.run / .getStore）
// 方案 A: 导出 abilityALS，runtime.ts 改用 abilityALS
// 方案 B: 导出 abilityContext 包装（转发到 abilityALS）
//
// run<R> 支持泛型返回值——AsyncLocalStorage.run 本身返回 callback 返回值，直接透传
```

倾向方案 A——`runtime.ts` 直接改用 `abilityALS.run()` / `abilityALS.get()`。改动小（一处）。

### §2.2 compiler/core/env.ts

```typescript
// 改前
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

// 改后
import { AsyncContextStore } from '../worker-runtime/async-context-store.ts'

const packerALS = new AsyncContextStore<CompilerContext>({ name: 'packer' })

function runWithCompilerContext<T>(callback: () => T): T {
  return packerALS.run(createCompilerContext(), callback)
}

function getCompilerContext(): CompilerContext {
  return packerALS.get()
}
```

## §3 行为 0 分析

| 改动 | 行为变化？ |
|---|---|
| `abilityContext` → `abilityALS` | API 相同（run/get），类型从 unknown → AbilityContext。运行时行为不变。 |
| `compilerContextStorage` → `packerALS` | API 相同（run/get），加 globalThis 兜底。运行时行为不变（单例仍复用）。 |
| globalThis key 从 `__abilityContext` → `__als_ability` | key 变了但功能相同——vitest 兜底仍在。 |

行为 0 风险低——只改封装方式，不改数据流。

## §4 替代方案

### §4.1 直接用 AsyncLocalStorage（否决）

否决理由：两处重复，无类型安全，globalThis 兜底散在调用方。

### §4.2 工具类管序列化/快照（否决）

否决理由：函数不能 structured clone，每个消费方重建逻辑不同。通用工具不该知道消费方的序列化逻辑。以后有需要再考虑。
