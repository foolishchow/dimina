import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
	vi.useRealTimers()
	vi.doUnmock('@dimina/common')
	vi.resetModules()
})

it('uses one Worker MessageChannel and ignores cancelled task packets across quick hide/show', async () => {
	vi.resetModules()
	vi.useFakeTimers()
	vi.doMock('@dimina/common', () => ({ isWebWorker: true }))
	const { installBackgroundScheduler } = await import('../src/core/background-scheduler')
	const nativeTimeout = setTimeout
	const userTimer = vi.fn(nativeTimeout)
	let channels = 0
	class TestMessageChannel {
		port1 = { onmessage: undefined }
		port2 = { postMessage: data => nativeTimeout(() => this.port1.onmessage?.({ data }), 0) }
		constructor() { channels++ }
	}
	const target = { setTimeout: userTimer, clearTimeout, MessageChannel: TestMessageChannel }
	const runtime = installBackgroundScheduler(target)
	const events = []
	runtime.pause()
	runtime.dispatch(() => {
		events.push('callback')
		Promise.resolve().then(() => events.push('promise'))
	})
	runtime.dispatch(() => events.push('complete'))
	runtime.resume()
	runtime.pause()
	runtime.resume()
	await vi.runAllTimersAsync()
	expect(events).toEqual(['callback', 'promise', 'complete'])
	expect(channels).toBe(1)
	expect(userTimer).not.toHaveBeenCalled()
})
