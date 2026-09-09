import { beforeEach, describe, expect, it } from 'vitest'
import runtime from '../src/core/runtime'

describe('runtime.remountPage — P-004 page-scoped remount prototype', () => {
	beforeEach(() => {
		runtime.app = null
		runtime.pageId = null
		runtime.pageRenderVersion.value = 0
	})

	it('remounts only the current page by advancing its root key', () => {
		runtime.app = { unmount: () => { throw new Error('whole-app unmount must not run') } }
		runtime.pageId = 'page-1'

		expect(runtime.remountPage('page-1')).toEqual({ remounted: true })
		expect(runtime.pageRenderVersion.value).toBe(1)
		expect(runtime.app).toBeTruthy()
	})

	it('does not remount when the app is not mounted or page is not current', () => {
		expect(runtime.remountPage('page-1')).toEqual({ remounted: false, reason: 'app-not-mounted' })
		runtime.app = {}
		runtime.pageId = 'page-2'

		expect(runtime.remountPage('page-1')).toEqual({ remounted: false, reason: 'page-not-current' })
		expect(runtime.pageRenderVersion.value).toBe(0)
	})
})
