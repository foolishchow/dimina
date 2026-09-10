import { afterEach, describe, expect, it, vi } from 'vitest'
import { MiniApp } from '../src/pages/miniApp/miniApp.js'

const navigatorDescriptors = new Map<string, PropertyDescriptor | undefined>()
const documentDescriptors = new Map<string, PropertyDescriptor | undefined>()

function stubProperty(target: object, descriptors: Map<string, PropertyDescriptor | undefined>, key: string, value: unknown): void {
	if (!descriptors.has(key)) descriptors.set(key, Object.getOwnPropertyDescriptor(target, key))
	Object.defineProperty(target, key, { configurable: true, value })
}

function restoreProperties(target: object, descriptors: Map<string, PropertyDescriptor | undefined>): void {
	for (const [key, descriptor] of descriptors) {
		if (descriptor) Object.defineProperty(target, key, descriptor)
		else Reflect.deleteProperty(target, key)
	}
	descriptors.clear()
}

function createBareApp(): MiniApp {
	const app = Object.create(MiniApp.prototype) as MiniApp
	app.el = document.createElement('div')
	app.jscore = { postMessage: vi.fn() } as unknown as MiniApp['jscore']
	app._tempObjectUrls = new Set()
	app._wakeLockSentinel = null
	app._wakeLockRequest = null
	app._keepScreenOnRequested = false
	app._wakeLockVisibilityHandler = null
	app._destroyed = false
	return app
}

afterEach(() => {
	restoreProperties(navigator, navigatorDescriptors)
	restoreProperties(document, documentDescriptors)
})

describe('MiniApp media and device APIs', () => {
	it('reports wifi from the physical connection type even when effectiveType is 4g', () => {
		stubProperty(navigator, navigatorDescriptors, 'onLine', true)
		stubProperty(navigator, navigatorDescriptors, 'connection', { type: 'wifi', effectiveType: '4g' })
		const app = createBareApp()

		app.getNetworkType({ success: 'success-id' })

		expect(app.jscore.postMessage).toHaveBeenCalledWith({
			type: 'triggerCallback',
			body: {
				id: 'success-id',
				args: { networkType: 'wifi', errMsg: 'getNetworkType:ok' },
			},
		})
	})

	it('settles chooseVideo when the browser file picker is cancelled', () => {
		vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
		const app = createBareApp()

		app.chooseVideo({ fail: 'fail-id', complete: 'complete-id' })
		const input = app.el.querySelector('input[type="file"]') as HTMLInputElement
		input.dispatchEvent(new Event('cancel'))

		expect(app.jscore.postMessage).toHaveBeenNthCalledWith(1, {
			type: 'triggerCallback',
			body: { id: 'fail-id', args: { errMsg: 'chooseVideo:fail cancel' } },
		})
		expect(app.jscore.postMessage).toHaveBeenNthCalledWith(2, {
			type: 'triggerCallback',
			body: { id: 'complete-id', args: { errMsg: 'chooseVideo:fail cancel' } },
		})
		expect(input.isConnected).toBe(false)
	})

	it('reacquires a released screen wake lock when the document becomes visible', async () => {
		stubProperty(document, documentDescriptors, 'visibilityState', 'visible')
		const first = createWakeLockSentinel()
		const second = createWakeLockSentinel()
		const request = vi.fn()
			.mockResolvedValueOnce(first)
			.mockResolvedValueOnce(second)
		stubProperty(navigator, navigatorDescriptors, 'wakeLock', { request })
		const app = createBareApp()

		app.setKeepScreenOn({ keepScreenOn: true })
		await vi.waitFor(() => {
			expect(request).toHaveBeenCalledTimes(1)
			expect(app._wakeLockSentinel).toBe(first)
			expect(app._wakeLockRequest).toBeNull()
		})
		first.released = true
		first.dispatchEvent(new Event('release'))
		document.dispatchEvent(new Event('visibilitychange'))
		await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))

		app.setKeepScreenOn({ keepScreenOn: false })
		await vi.waitFor(() => expect(second.release).toHaveBeenCalledTimes(1))
	})

	it('clears the screen-on intent after wake lock acquisition fails', async () => {
		stubProperty(document, documentDescriptors, 'visibilityState', 'visible')
		stubProperty(navigator, navigatorDescriptors, 'wakeLock', {
			request: vi.fn().mockRejectedValue(new Error('denied')),
		})
		const app = createBareApp()

		app.setKeepScreenOn({ keepScreenOn: true, fail: 'fail-id' })
		await vi.waitFor(() => expect(app.jscore.postMessage).toHaveBeenCalled())

		expect(app._keepScreenOnRequested).toBe(false)
		expect(app._wakeLockVisibilityHandler).toBeNull()
	})
})

function createWakeLockSentinel(): EventTarget & { released: boolean, release: ReturnType<typeof vi.fn> } {
	const sentinel = new EventTarget() as EventTarget & { released: boolean, release: ReturnType<typeof vi.fn> }
	sentinel.released = false
	sentinel.release = vi.fn(async () => {
		sentinel.released = true
		sentinel.dispatchEvent(new Event('release'))
	})
	return sentinel
}
