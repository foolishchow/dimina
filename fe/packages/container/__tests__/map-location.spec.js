import { afterEach, expect, it, vi } from 'vitest'
import { getMapLocation } from '../src/mapLocation'
import { installDemoMapConfig } from '../src/mapConfig'

function fixture() {
	let pluginReady; let located; let options
	const AMap = {
		plugin: vi.fn((name, callback) => { pluginReady = callback }),
		Geolocation: class {
			constructor(value) { options = value }
			getCurrentPosition(callback) { located = callback }
		},
	}
	const controller = new AbortController()
	const frame = { AMap, DiminaRenderBridge: { mapRenderer: 'web' } }
	installDemoMapConfig(frame, {})
	return { AMap, controller, start: () => frame.__DIMINA_MAP_CONFIG__.getLocation({ type: 'gcj02', signal: controller.signal }),
		ready: () => pluginReady(), result: (...args) => located(...args), options: () => options }
}
afterEach(() => vi.useRealTimers())

it('connects the demo location callback and returns AMap-converted coordinates', async () => {
	const f = fixture(); const result = f.start()
	f.ready()
	expect(f.options()).toMatchObject({ convert: true, noIpLocate: 3, enableHighAccuracy: true })
	f.result('complete', { position: { getLng: () => 0, getLat: () => 0 } })
	await expect(result).resolves.toEqual({ longitude: 0, latitude: 0 })
})
it('reports location failure without returning a fabricated position', async () => {
	const f = fixture(); const result = f.start(); f.ready()
	f.result('error', { message: 'permission denied' })
	await expect(result).rejects.toThrow('permission denied')
})
it('rejects invalid coordinates', async () => {
	const f = fixture(); const result = f.start(); f.ready()
	f.result('complete', { position: { getLng: () => Number.NaN, getLat: () => 200 } })
	await expect(result).rejects.toThrow('无效坐标')
})
it('does not start positioning when aborted before the plugin arrives', async () => {
	const f = fixture(); const result = f.start(); f.controller.abort(); f.ready()
	expect(f.options()).toBeUndefined()
	await expect(result).rejects.toThrow('已取消')
})
it('ignores a position arriving after cancellation', async () => {
	const f = fixture(); const result = f.start(); f.ready(); f.controller.abort()
	f.result('complete', { position: { getLng: () => 116, getLat: () => 39 } })
	await expect(result).rejects.toThrow('已取消')
})
it('bounds plugin loading as well as positioning with a timeout', async () => {
	vi.useFakeTimers()
	const f = fixture(); const result = f.start()
	const check = expect(result).rejects.toThrow('定位超时')
	await vi.advanceTimersByTimeAsync(10000)
	await check
	f.ready(); expect(f.options()).toBeUndefined()
})
it('rejects unsupported coordinate types', async () => {
	await expect(getMapLocation({}, { type: 'wgs84' })).rejects.toThrow('GCJ-02')
})
