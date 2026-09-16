import { AsyncLocalStorage } from 'node:async_hooks'

export const abilityContext = new AsyncLocalStorage()
