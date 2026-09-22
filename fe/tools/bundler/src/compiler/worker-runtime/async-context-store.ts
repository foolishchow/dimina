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
		this.als = (options.legacyKey ? (g[options.legacyKey] as AsyncLocalStorage<T> | undefined) : undefined)
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
