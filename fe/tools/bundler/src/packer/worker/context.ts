import { AsyncContextStore } from './async-context-store.ts'

// P-WR07: vitest (vite) 可能实例化本模块多次，用 globalThis 兜底单例

// 结构类型——不引用 class（PostMessageSink / BufferingLogger 是实现，不是接口）
export interface AbilityContext {
	sink: { write: (entry: unknown) => void }
	logger: { warn: (msg: string) => void }
}

export const abilityALS = new AsyncContextStore<AbilityContext>({ name: 'ability', legacyKey: '__abilityContext' })
