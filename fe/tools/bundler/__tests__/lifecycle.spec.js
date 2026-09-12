import { describe, expect, it, vi } from 'vitest'
import { createLifecycle, LIFECYCLE_EVENTS } from '../src/shared/lifecycle.js'

describe('lifecycle event constants', () => {
	it('freezes the event name table', () => {
		expect(Object.isFrozen(LIFECYCLE_EVENTS)).toBe(true)
		expect(LIFECYCLE_EVENTS.BUILD_START).toBe('build:start')
		expect(LIFECYCLE_EVENTS.STAGE_AFTER).toBe('stage:after')
		expect(LIFECYCLE_EVENTS.BUILD_ERROR).toBe('build:error')
	})
})

describe('createLifecycle registration', () => {
	it('runs listeners in registration order and awaits async listeners sequentially', async () => {
		const lifecycle = createLifecycle()
		const calls = []

		lifecycle.on('build:start', async () => {
			await new Promise(resolve => setTimeout(resolve, 5))
			calls.push('first-async')
		})
		lifecycle.on('build:start', () => {
			calls.push('second-sync')
		})

		await lifecycle.emit('build:start', {})

		expect(calls).toEqual(['first-async', 'second-sync'])
	})

	it('passes the same payload to all listeners of an event', async () => {
		const lifecycle = createLifecycle()
		const seen = []
		lifecycle.on('stage:after', payload => seen.push(payload))
		lifecycle.on('stage:after', payload => seen.push(payload))

		const payload = { stage: 'view' }
		await lifecycle.emit('stage:after', payload)

		expect(seen).toEqual([payload, payload])
	})

	it('isolates listeners per event and ignores unknown events', async () => {
		const lifecycle = createLifecycle()
		const calls = []
		lifecycle.on('build:end', () => calls.push('end'))
		lifecycle.on('bundle:published', () => calls.push('published'))

		await lifecycle.emit('build:end', {})
		await lifecycle.emit('unknown:event', {})

		expect(calls).toEqual(['end'])
	})

	it('rejects invalid registrations', () => {
		const lifecycle = createLifecycle()
		expect(() => lifecycle.on('', () => {})).toThrow(TypeError)
		expect(() => lifecycle.on('build:start', 'not-a-function')).toThrow(TypeError)
	})
})

describe('lifecycle listener error isolation', () => {
	it('continues the event flow and records the error when a listener throws', async () => {
		const lifecycle = createLifecycle()
		const calls = []
		lifecycle.on('build:start', () => {
			throw new Error('boom-sync')
		})
		lifecycle.on('build:start', async () => {
			throw new Error('boom-async')
		})
		lifecycle.on('build:start', payload => calls.push(payload.after))

		await expect(lifecycle.emit('build:start', { after: 'ok' })).resolves.toBeUndefined()

		expect(calls).toEqual(['ok'])
		expect(lifecycle.isolatedListenerErrors).toHaveLength(2)
		expect(lifecycle.isolatedListenerErrors[0]).toMatchObject({ event: 'build:start' })
		expect(lifecycle.isolatedListenerErrors[0].error).toBeInstanceOf(Error)
		expect(lifecycle.isolatedListenerErrors[1].error.message).toBe('boom-async')
	})

	it('prints isolated errors with the unified diagnostic prefix', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			const lifecycle = createLifecycle()
			lifecycle.on('npm:built', () => {
				throw new Error('npm listener failed')
			})
			await lifecycle.emit('npm:built', {})
			expect(errorSpy).toHaveBeenCalledTimes(1)
			expect(errorSpy.mock.calls[0][0]).toContain('[lifecycle] listener error on npm:built')
			expect(errorSpy.mock.calls[0][0]).toContain('npm listener failed')
		}
		finally {
			errorSpy.mockRestore()
		}
	})

	it('isolates per instance across concurrent lifecycles', async () => {
		const first = createLifecycle()
		const second = createLifecycle()
		first.on('build:end', () => {
			throw new Error('first-only')
		})

		await first.emit('build:end', {})
		await second.emit('build:end', {})

		expect(first.isolatedListenerErrors).toHaveLength(1)
		expect(second.isolatedListenerErrors).toHaveLength(0)
	})
})

describe('lifecycle payload freezing', () => {
	it('freezes object payloads shallowly', async () => {
		const lifecycle = createLifecycle()
		let received
		lifecycle.on('config:collected', (payload) => {
			received = payload
		})

		await lifecycle.emit('config:collected', { fileTypes: {}, pagesCount: 3 })

		expect(Object.isFrozen(received)).toBe(true)
	})

	it('freezes array payloads and passes primitives as-is', async () => {
		const lifecycle = createLifecycle()
		const seen = []
		lifecycle.on('stage:before', payload => seen.push(payload))

		await lifecycle.emit('stage:before', ['view', 'logic'])
		await lifecycle.emit('stage:before', 42)
		await lifecycle.emit('stage:before', undefined)

		expect(Object.isFrozen(seen[0])).toBe(true)
		expect(seen).toEqual([['view', 'logic'], 42, undefined])
	})

	it('keeps downstream listeners unaffected by upstream mutation attempts', async () => {
		const lifecycle = createLifecycle()
		const downstream = []

		lifecycle.on('build:start', (payload) => {
			// ESM 严格模式下对冻结对象的写入会抛 TypeError；此处吞掉以覆盖
			// 「改动不产生构建影响」的验收口径（与是否抛错无关）。
			try {
				payload.workPath = '/mutated'
			}
			catch {
				// 忽略：冻结生效
			}
		})
		lifecycle.on('build:start', (payload) => {
			downstream.push(payload.workPath)
		})

		await lifecycle.emit('build:start', { workPath: '/original' })

		expect(downstream).toEqual(['/original'])
		expect(lifecycle.isolatedListenerErrors).toHaveLength(0)
	})

	it('isolates a listener that throws from mutating a frozen payload', async () => {
		const lifecycle = createLifecycle()
		let observed = null
		lifecycle.on('dist:prepared', payload => {
			observed = payload
			payload.seedPath = '/mutated' // 严格模式下抛 TypeError -> 被隔离
		})

		await expect(lifecycle.emit('dist:prepared', { seedPath: null })).resolves.toBeUndefined()

		expect(observed.seedPath).toBe(null)
		expect(lifecycle.isolatedListenerErrors).toHaveLength(1)
	})
})
