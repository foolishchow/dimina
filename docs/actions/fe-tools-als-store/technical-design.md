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

  constructor(options: { name: string; legacyKey?: string }) {
    this.name = options.name
    const key = `__als_${this.name}`
    const g = globalThis as { [k: string]: unknown } & typeof globalThis
    // globalThis 兜底：vitest 可能多实例化本模块，同一 name 复用
    // backward compat：先查 legacyKey（旧 key 名），再查新 key，最后新建
    this.als = (options.legacyKey ? g[options.legacyKey] as AsyncLocalStorage<T> | undefined : undefined)
      ?? (g[key] as AsyncLocalStorage<T> | undefined)
      ?? new AsyncLocalStorage<T>()
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

// 结构类型——不引用 class（PostMessageSink / BufferingLogger 是实现，不是接口）
export interface AbilityContext {
	sink: { write: (entry: unknown) => void }
	logger: { warn: (msg: string) => void }
}

export const abilityALS = new AsyncContextStore<AbilityContext>({ name: 'ability', legacyKey: '__abilityContext' })
//
// run<R> 支持泛型返回值——AsyncLocalStorage.run 本身返回 callback 返回值，直接透传
//
// 调用方迁移（4 处）：
//   runtime.ts:23       abilityContext.run({ sink, logger }, ...) → abilityALS.run({ sink, logger }, ...)
//   emit.ts:230         abilityContext.getStore() as { sink?: ... } → abilityALS.tryGet()?.sink
//   compatibility.ts:310  abilityContext.getStore() as { logger?: ... } → abilityALS.tryGet()?.logger ?? consoleFallback
//   style/index.ts:26    abilityContext.getStore() as { sink: ... } → abilityALS.get().sink
//
// tryGet() 用于有 fallback 的场景（emit / compatibility）
// get() 用于必须存在上下文的场景（style/index.ts）
//
// 好处：消除 3 处 `as` 结构断言——tryGet()/get() 返回有类型，不需 cast
```

方案 A——`runtime.ts` 直接改用 `abilityALS.run()`。共 4 处 call site 改动（见上方注释）。

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
| `compilerContextStorage` → `packerALS` | API 相同（run/get），加 globalThis 兜底。production 行为不变（单例 no-op）。vitest 新行为：原 `compilerContextStorage` 无 globalThis 兜底，vitest 多实例化时每次新建 ALS；加兜底后复用单例。由 V-AS-2 vitest 验证兜底。 |
| globalThis key 从 `__abilityContext` → `__als_ability` | key 变了但 legacyKey 兼容查找——vitest 重实例化时先查旧 key `__abilityContext`，找到旧 ALS 实例复用。新 key 写入供后续查找。 |

行为 0 风险低——只改封装方式，不改数据流。

## §4 替代方案

### §4.1 直接用 AsyncLocalStorage（否决）

否决理由：两处重复，无类型安全，globalThis 兜底散在调用方。

### §4.2 工具类管序列化/快照（否决）

否决理由：函数不能 structured clone，每个消费方重建逻辑不同。通用工具不该知道消费方的序列化逻辑。以后有需要再考虑。
