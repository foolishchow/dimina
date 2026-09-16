import { AsyncLocalStorage } from 'node:async_hooks'

// P-WR07: vitest (vite) 可能实例化本模块多次，用 globalThis 兜底单例
const g = globalThis
export const abilityContext = g.__abilityContext ||= new AsyncLocalStorage()
