import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BackgroundScheduler } from '../src/core/background-scheduler'

let scheduler
beforeEach(() => {
	vi.useFakeTimers()
	scheduler = new BackgroundScheduler({ now: () => Date.now(), setTimeout, clearTimeout })
})
afterEach(() => vi.useRealTimers())

it('freezes remaining timer time, preserves arguments and does not catch up intervals', () => {
	const events = []
	scheduler.set(value => events.push(value), 100, false, ['timeout'])
	scheduler.set(() => events.push('interval'), 100, true)
	vi.advanceTimersByTime(40)
	scheduler.pause()
	vi.advanceTimersByTime(5000)
	expect(events).toEqual([])
	expect(vi.getTimerCount()).toBe(0)
	scheduler.resume()
	vi.advanceTimersByTime(59)
	expect(events).toEqual([])
	vi.advanceTimersByTime(1)
	expect(events).toEqual(['timeout', 'interval'])
	vi.advanceTimersByTime(100)
	expect(events).toEqual(['timeout', 'interval', 'interval'])
})

it('supports cancelling and creating timers while suspended and repeated visibility signals', () => {
	const callback = vi.fn()
	scheduler.pause()
	const cancelled = scheduler.set(callback, 1)
	scheduler.clear(cancelled)
	scheduler.set(callback, 80)
	scheduler.pause()
	vi.advanceTimersByTime(1000)
	scheduler.resume()
	scheduler.resume()
	vi.advanceTimersByTime(79)
	expect(callback).not.toHaveBeenCalled()
	vi.advanceTimersByTime(1)
	expect(callback).toHaveBeenCalledTimes(1)
})

it('defers business callbacks in FIFO order until resume without replaying cancelled timers', async () => {
	const events = []
	scheduler.pause()
	scheduler.dispatch(() => events.push('network'))
	scheduler.dispatch(() => events.push('animation'))
	vi.runOnlyPendingTimers()
	expect(events).toEqual([])
	scheduler.resume()
	await vi.runAllTimersAsync()
	expect(events).toEqual(['network', 'animation'])
})

it('an interval cancelled from its callback is not rearmed', () => {
	const callback = vi.fn(() => scheduler.clear(id))
	const id = scheduler.set(callback, 1, true)
	vi.advanceTimersByTime(100)
	expect(callback).toHaveBeenCalledTimes(1)
	expect(vi.getTimerCount()).toBe(0)
})


it('retains FIFO order when a resumed callback dispatches another callback synchronously', async () => {
	const events = []
	scheduler.pause()
	scheduler.dispatch(() => {
		events.push('first')
		scheduler.dispatch(() => events.push('nested'))
	})
	scheduler.dispatch(() => events.push('second'))
	scheduler.resume()
	await vi.runAllTimersAsync()
	expect(events).toEqual(['first', 'second', 'nested'])
})

it('finishes the full Promise chain of one message before delivering the next message', async () => {
	const events = []
	scheduler.pause()
	scheduler.dispatch(() => {
		events.push('success')
		Promise.resolve().then(() => events.push('then')).then(() => events.push('chained'))
	})
	scheduler.dispatch(() => events.push('complete'))
	scheduler.resume()
	await vi.runAllTimersAsync()
	expect(events).toEqual(['success', 'then', 'chained', 'complete'])
})

it('does not run the rest of the backlog when a Promise callback hides the app again', async () => {
	const events = []
	scheduler.pause()
	scheduler.dispatch(() => Promise.resolve().then(() => scheduler.pause()))
	scheduler.dispatch(() => events.push('later'))
	scheduler.resume()
	await vi.runAllTimersAsync()
	expect(events).toEqual([])
	scheduler.resume()
	await vi.runAllTimersAsync()
	expect(events).toEqual(['later'])
})

it('ignores an already queued native timer callback from before suspension', () => {
	const queued = []
	const clock = { now: () => 0, setTimeout: fn => { queued.push(fn); return queued.length }, clearTimeout() {} }
	const runtime = new BackgroundScheduler(clock)
	const callback = vi.fn()
	runtime.set(callback, 10, true)
	runtime.pause()
	runtime.resume()
	queued[0]() // Already submitted by native before clearTimeout; it cannot be withdrawn.
	expect(callback).not.toHaveBeenCalled()
	queued[1]()
	expect(callback).toHaveBeenCalledTimes(1)
	expect(queued).toHaveLength(3)
})


it('restores a large backlog in order with at most one pending host task', async () => {
	const events = []
	scheduler.pause()
	for (let index = 0; index < 257; index++) scheduler.dispatch(() => events.push(index))
	expect(vi.getTimerCount()).toBe(0)
	scheduler.resume()
	for (let index = 0; index < 257; index++) {
		expect(vi.getTimerCount()).toBe(1)
		await vi.advanceTimersToNextTimerAsync()
	}
	expect(events).toEqual(Array.from({ length: 257 }, (_, index) => index))
	expect(vi.getTimerCount()).toBe(0)
})

it('an exception in one pending callback does not discard following messages', () => {
	const events = []
	scheduler.pause()
	scheduler.dispatch(() => { throw new Error('business callback') })
	scheduler.dispatch(() => events.push('next'))
	scheduler.resume()
	expect(() => vi.advanceTimersToNextTimer()).toThrow('business callback')
	vi.runAllTimers()
	expect(events).toEqual(['next'])
})
