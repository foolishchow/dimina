import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RetentionManager, resolveRetentionPolicy } from '../src/core/retention.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('evicts least recently hidden apps and refreshes recency only after a show', () => {
	let now = 0
	const manager = new RetentionManager<string>(() => {}, () => now)
	manager.configure({ maxBackgroundApps: 2, backgroundTimeoutMs: 0 })
	manager.hide('a'); now++
	manager.hide('b'); now++
	manager.hide('a') // duplicate hide cannot refresh the lease
	manager.hide('c')
	expect(manager.collect(() => true)).toEqual(['a'])
	manager.forget('b'); now++
	manager.hide('b'); now++
	manager.hide('d')
	expect(manager.collect(() => true)).toEqual(['c'])
})

it('arms one nearest deadline, expires at the boundary, and cancels it after release', () => {
	let now = 0
	const changed = vi.fn()
	const manager = new RetentionManager<string>(changed, () => now)
	manager.configure({ maxBackgroundApps: 3, backgroundTimeoutMs: 100 })
	manager.hide('a'); now = 50; manager.hide('b')
	expect(manager.collect(() => true)).toEqual([])
	expect(vi.getTimerCount()).toBe(1)
	now = 100
	expect(manager.collect(() => true)).toEqual(['a'])
	manager.forget('b')
	expect(vi.getTimerCount()).toBe(0)
})

it('pressure clears eligible background apps while a presentation chain stays pinned', () => {
	const manager = new RetentionManager<string>(() => {})
	manager.hide('active'); manager.hide('a'); manager.hide('b')
	manager.memoryPressure()
	expect(manager.collect(app => app !== 'active')).toEqual(['a', 'b'])
	manager.configure({ maxBackgroundApps: 0 })
	expect(manager.collect(() => true)).toEqual(['active'])
})

it.each([-1, 1.5, Number.NaN, Infinity])('rejects invalid host limits %s', value => {
	expect(() => resolveRetentionPolicy({ maxBackgroundApps: value })).toThrow(RangeError)
	expect(() => resolveRetentionPolicy({ backgroundTimeoutMs: value })).toThrow(RangeError)
})
