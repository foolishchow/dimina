import { expect, it, vi } from 'vitest'
const { handlers, send } = vi.hoisted(() => ({ handlers: {}, send: vi.fn() }))
vi.mock('../src/core/message', () => ({ default: { on: (name, fn) => { handlers[name] = fn }, send } }))
vi.mock('../src/core/env', () => ({ default: {} }))
vi.mock('../src/core/loader', () => ({ default: { loadResource: vi.fn() } }))
vi.mock('../src/core/runtime', () => ({ default: { registerResourceLoad: vi.fn() } }))
it('handles service logs, network and storage in a production render', async () => {
	window.vConsole = { network: { add: vi.fn() } }
	const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
	await import('../src/index')
	expect(handlers.print).toBeTypeOf('function')
	handlers.print({ detail: { group: 'console', type: 'warn', value: ['business', { n: 1 }] } })
	expect(log).toHaveBeenCalledWith('business', { n: 1 })
	const network = { id: '1', status: 200 }
	handlers.print({ detail: { group: 'network', value: network } })
	expect(window.vConsole.network.add).toHaveBeenCalledWith(network)
	const storage = vi.fn(); window.addEventListener('dimina:debug-storage', storage)
	handlers.print({ detail: { group: 'storage', value: [{ key: 'a', data: 1 }] } })
	expect(storage.mock.lastCall[0].detail.value).toEqual([{ key: 'a', data: 1 }])
	handlers.loadResource({ bridgeId: 'page-a' })
	window.dispatchEvent(new Event('dimina:debug-storage-request'))
	expect(send).toHaveBeenCalledWith({ type: 'debugStorage', target: 'service', body: { bridgeId: 'page-a' } })
	window.dispatchEvent(new CustomEvent('dimina:debug-storage-request', { detail: { action: 'set', key: 'key', data: false, encrypted: true, bridgeId: 'spoofed' } }))
	expect(send.mock.lastCall[0].body).toEqual({ action: 'set', key: 'key', data: false, encrypted: true, bridgeId: 'page-a' })
	log.mockRestore(); window.removeEventListener('dimina:debug-storage', storage); delete window.vConsole
})
