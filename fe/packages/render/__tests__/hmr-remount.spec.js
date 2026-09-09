import { beforeEach, describe, expect, it, vi } from 'vitest'
import runtime from '../src/core/runtime'
import { reactive } from 'vue'

describe('runtime.remountPage — P-004 page-scoped remount prototype', () => {
	beforeEach(() => {
		runtime.app = null
		runtime.pageId = null
		runtime.pageRenderVersion.value = 0
		runtime.setupData = new Map()
		runtime.hmrRemountQueues = new Map()
	})

	it('remounts only the current page by advancing its root key', () => {
		runtime.app = { unmount: () => { throw new Error('whole-app unmount must not run') } }
		runtime.pageId = 'page-1'

		expect(runtime.remountPage('page-1')).toEqual({ remounted: true })
		expect(runtime.pageRenderVersion.value).toBe(1)
		expect(runtime.app).toBeTruthy()
	})

	it('rejects an unmounted app or a non-current page safely', () => {
		expect(runtime.remountPage('page-1')).toEqual({ remounted: false, reason: 'app-not-mounted' })
		runtime.app = {}
		runtime.pageId = 'page-2'

		expect(runtime.remountPage('page-1')).toEqual({ remounted: false, reason: 'page-not-current' })
		expect(runtime.pageRenderVersion.value).toBe(0)
	})

	it('captures a deep snapshot while preserving dataFunction/function identity and cycles', () => {
		const dataFunction = vi.fn()
		const cyclic = { value: 1 }
		cyclic.self = cyclic
		runtime.setupData.set('page-1', reactive({ nested: { value: 2 }, dataFunction, cyclic }))

		const snapshot = runtime.capturePageSnapshot('page-1')

		expect(snapshot).not.toBe(runtime.setupData.get('page-1'))
		expect(snapshot.nested).not.toBe(runtime.setupData.get('page-1').nested)
		expect(snapshot.nested.value).toBe(2)
		expect(snapshot.dataFunction).toBe(dataFunction)
		expect(snapshot.cyclic.self).toBe(snapshot.cyclic)
	})

	it('replays snapshot without touching service or firstRender', () => {
		const data = reactive({ value: 0, removed: true })
		runtime.setupData.set('page-1', data)
		const firstRender = vi.spyOn(runtime, 'firstRender')

		expect(runtime.replayPageSnapshot('page-1', { value: 3 })).toBe(true)
		expect(data).toEqual({ value: 3 })
		expect(firstRender).not.toHaveBeenCalled()
	})

	it('captures and replays snapshot through the remount transaction', async () => {
		const data = reactive({ value: 1 })
		runtime.setupData.set('page-1', data)
		runtime.app = {}
		runtime.pageId = 'page-1'

		const result = await runtime.remountPageWithSnapshot('page-1')

		expect(result).toEqual({ remounted: true, replayed: true })
		expect(data.value).toBe(1)
		expect(runtime.hmrRemountQueues.has('page-1')).toBe(false)
	})

	it('queues updateModule calls during remount and replays them in order', () => {
		const data = reactive({ value: 0 })
		runtime.setupData.set('page-1', data)
		runtime.beginHmrRemount('page-1')
		runtime.updateModule({ moduleId: 'page-1', data: { value: 1 } })
		runtime.updateModule({ moduleId: 'page-1', data: { value: 2 } })

		expect(data.value).toBe(0)
		runtime.endHmrRemount('page-1')
		expect(data.value).toBe(2)
		expect(runtime.hmrRemountQueues.has('page-1')).toBe(false)
	})
})
