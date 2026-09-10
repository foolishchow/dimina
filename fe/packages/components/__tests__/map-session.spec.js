import { createMapSession } from '../src/component/map/map-session'

function deferred() {
	let resolve
	const promise = new Promise(r => { resolve = r })
	return { promise, resolve }
}
function fixture(extra = {}) {
	const adapter = { update: vi.fn(), invoke: vi.fn(() => ({ scale: 16 })), destroy: vi.fn() }
	const emit = vi.fn()
	const createMap = vi.fn(async () => adapter)
	const session = createMapSession({ element: {}, props: {}, emit, config: { authorize: async () => true, provider: 'test', ...extra, providers: { test: { create: extra.createMap || createMap } } } })
	return { session, adapter, createMap, emit }
}
afterEach(() => vi.useRealTimers())

describe('map provider lifecycle', () => {
	it('never loads a provider without host privacy authorization', async () => {
		const { session, createMap, emit } = fixture({ authorize: async () => false })
		await expect(session.ready).rejects.toThrow('authorization denied')
		expect(createMap).not.toHaveBeenCalled()
		expect(emit).toHaveBeenCalledWith('error', { errMsg: expect.stringContaining('authorization denied') })
	})
	it('fails missing configuration without a network request', async () => {
		const session = createMapSession({ element: {}, props: {}, emit: vi.fn(), config: null })
		await expect(session.ready).rejects.toThrow('not configured')
	})
	it('keeps calls and prop updates in order while loading', async () => {
		const consent = deferred()
		const { session, adapter } = fixture({ authorize: () => consent.promise })
		const update = session.update({ scale: 18 })
		const call = session.invoke('getScale', {})
		expect(adapter.invoke).not.toHaveBeenCalled()
		consent.resolve(true)
		await update
		await expect(call).resolves.toEqual({ scale: 16 })
		expect(adapter.update.mock.invocationCallOrder[0]).toBeLessThan(adapter.invoke.mock.invocationCallOrder[0])
		session.destroy()
	})
	it('disposes a late factory result after unmount without emitting events', async () => {
		const factory = deferred()
		const { session, emit } = fixture({ createMap: () => factory.promise })
		await Promise.resolve()
		session.destroy()
		await expect(session.ready).rejects.toThrow('destroyed')
		const adapter = { destroy: vi.fn() }
		factory.resolve(adapter)
		await Promise.resolve()
		await Promise.resolve()
		expect(adapter.destroy).toHaveBeenCalledTimes(1)
		expect(emit).not.toHaveBeenCalled()
	})
	it('settles a pending call on destruction and disposes once', async () => {
		const { session, adapter } = fixture()
		await session.ready
		adapter.invoke.mockReturnValue(new Promise(() => {}))
		const pending = session.invoke('getScale', {})
		await Promise.resolve()
		session.destroy()
		session.destroy()
		await expect(pending).rejects.toThrow('destroyed')
		expect(adapter.destroy).toHaveBeenCalledTimes(1)
	})
	it('bounds initialization and disposes a late adapter after timeout', async () => {
		vi.useFakeTimers()
		const factory = deferred()
		const { session } = fixture({ createMap: () => factory.promise, timeout: 20 })
		const rejection = expect(session.ready).rejects.toThrow('timed out')
		await vi.advanceTimersByTimeAsync(21)
		await rejection
		const destroy = vi.fn()
		factory.resolve({ destroy })
		await Promise.resolve()
		await Promise.resolve()
		expect(destroy).toHaveBeenCalledTimes(1)
	})
	it('recovers the queue after an unsupported command', async () => {
		const { session, adapter } = fixture()
		adapter.invoke.mockImplementationOnce(() => { throw new Error('unsupported') })
		await expect(session.invoke('addArc', {})).rejects.toThrow('unsupported')
		await expect(session.invoke('getScale', {})).resolves.toEqual({ scale: 16 })
		session.destroy()
	})
})

it('allows updates and removal while a long marker animation is running', async () => {
    vi.useFakeTimers()
    const { session, adapter } = fixture()
    await session.ready
    const motion = deferred()
    adapter.invoke.mockImplementation(command => command === 'moveAlong' ? motion.promise : {})
    const pending = session.invoke('moveAlong', { markerId: 0, path: [{ longitude: 0, latitude: 0 }, { longitude: 1, latitude: 1 }], duration: 30000 })
    await session.invoke('getScale', {})
    await session.update({ scale: 18 })
    await session.invoke('removeMarkers', { markerIds: [0] })
    expect(adapter.invoke.mock.calls.map(([command]) => command)).toEqual(['moveAlong', 'getScale', 'removeMarkers'])
    await vi.advanceTimersByTimeAsync(16000)
    expect(adapter.destroy).not.toHaveBeenCalled()
    motion.resolve({}); await pending
    session.destroy()
})
it('rejects an in-flight animation on destruction even if its provider never settles', async () => {
    const { session, adapter } = fixture()
    await session.ready
    adapter.invoke.mockReturnValue(new Promise(() => {}))
    const pending = session.invoke('translateMarker', { markerId: 0, destination: { longitude: 1, latitude: 2 }, duration: 30000 })
    const rejected = expect(pending).rejects.toThrow('destroyed')
    await Promise.resolve(); await Promise.resolve()
    session.destroy(); await rejected
})

it('removes per-operation abort listeners after completed commands', async () => {
	const add = vi.spyOn(AbortSignal.prototype, 'addEventListener')
	const remove = vi.spyOn(AbortSignal.prototype, 'removeEventListener')
	try {
		const { session } = fixture()
		await session.ready
		for (let i = 0; i < 20; i++) await session.invoke('getScale', {})
		const listeners = add.mock.calls.filter(([name]) => name === 'abort').map(([, listener]) => listener)
		for (const listener of listeners) expect(remove).toHaveBeenCalledWith('abort', listener)
		session.destroy()
	} finally { add.mockRestore(); remove.mockRestore() }
})

it('starts later commands before animation completion without retaining expired callbacks', async () => {
	vi.useFakeTimers()
	const { session, adapter } = fixture({ timeout: 20 })
	await session.ready
	const motion = deferred()
	adapter.invoke.mockImplementation(command => command === 'moveAlong' ? motion.promise : {})
	const pending = session.invoke('moveAlong', { markerId: 0, path: [{ longitude: 0, latitude: 0 }, { longitude: 1, latitude: 1 }], duration: 2000 })
	pending.catch(() => {})
	const read = session.invoke('getScale', {})
	read.catch(() => {})
	try {
		await vi.advanceTimersByTimeAsync(0)
		expect(adapter.invoke.mock.calls.map(([command]) => command)).toEqual(['moveAlong', 'getScale'])
		await vi.advanceTimersByTimeAsync(21)
		expect(adapter.destroy).not.toHaveBeenCalled()
		motion.resolve({}); await pending; await read
	} finally { motion.resolve({}); session.destroy() }
})
