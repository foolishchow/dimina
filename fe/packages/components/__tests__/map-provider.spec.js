/** @vitest-environment jsdom */
import { createAMap } from '../src/component/map/providers/amap'
import { resolveMapProvider } from '../src/component/map/providers/registry'
import { loadAMap } from '../src/component/map/providers/amap-loader'

class EventTarget {
	constructor() { this.handlers = new Map() }
	on(type, handler) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(handler) }
	off(type, handler) { this.handlers.get(type)?.delete(handler) }
	emit(type, value) { this.handlers.get(type)?.forEach(handler => handler(value)) }
}
function coordinate([longitude, latitude]) { return { getLng: () => longitude, getLat: () => latitude } }
function sdk() {
	const maps = []
	const windows = []
	class MapSDK extends EventTarget {
		constructor(element, options) {
			super(); this.options = options; this.center = options.center; this.zoom = options.zoom
			this.add = vi.fn()
			this.remove = vi.fn()
			this.destroy = vi.fn()
			this.getFitZoomAndCenterByBounds = vi.fn(() => [12, coordinate([2, 3])])
			this.setZoomAndCenter = vi.fn()
			this.setCenter = vi.fn(center => { this.center = center })
			this.setZoom = vi.fn(zoom => { this.zoom = zoom })
			this.rotation = 0; this.pitch = 0
            this.setZooms = vi.fn(); this.setStatus = vi.fn(); this.setRotation = vi.fn(value => { this.rotation = value })
            this.setPitch = vi.fn(value => { this.pitch = value })
            this.getRotation = () => this.rotation; this.getPitch = () => this.pitch
            this.getSize = () => ({ getWidth: () => 400, getHeight: () => 200 })
            this.panBy = vi.fn()
            this.setLimitBounds = vi.fn()
            this.lngLatToContainer = vi.fn(([x, y]) => ({ getX: () => x * 2, getY: () => y * 3 }))
            this.containerToLngLat = vi.fn(pixel => coordinate([pixel.x / 2, pixel.y / 3]))
			this.addControl = vi.fn(); this.removeControl = vi.fn()
			maps.push(this)
			queueMicrotask(() => this.emit('complete'))
		}
		getCenter() { return coordinate(this.center) }
		getZoom() { return this.zoom }
	}
	class Overlay extends EventTarget {
		constructor(options) {
            super(); this.options = options; this.setMap = vi.fn()
            this.setPosition = vi.fn(position => { this.options.position = position })
            this.setAngle = vi.fn(angle => { this.options.angle = angle })
        }
        getAngle() { return this.options.angle || 0 }
		getPosition() { return coordinate(this.options.position) }
	}
	class InfoWindow {
		constructor(options) { this.options = options; this.open = vi.fn(); this.close = vi.fn(); windows.push(this) }
	}
	class Bounds {
		constructor(southwest, northeast) { this.southwest = southwest; this.northeast = northeast }
	}
	return { maps, windows, AMap: { Map: MapSDK, Bounds, Pixel: class { constructor(x, y) { this.x = x; this.y = y } }, ControlBar: class {}, Marker: Overlay, Circle: Overlay, CircleMarker: Overlay, Polyline: Overlay, Polygon: Overlay, InfoWindow, Scale: class {} } }
}
const base = { longitude: 116.4, latitude: 39.9, scale: 16, minScale: 3, maxScale: 22, enableScroll: true, enableZoom: true, markers: [], polyline: [], circles: [], polygons: [], includePoints: [], showLocation: false, showScale: false }
const fixtures = []
async function fixture(props = {}, getLocation) {
	const mock = sdk()
	const emit = vi.fn()
	const controller = new AbortController()
	const adapter = await createAMap({ element: document.createElement('div'), props: { ...base, ...props }, options: { AMap: mock.AMap }, signal: controller.signal, emit, getLocation })
	fixtures.push(adapter)
	return { ...mock, adapter, emit, controller, map: mock.maps[0] }
}
afterEach(() => { fixtures.splice(0).forEach(adapter => adapter.destroy()); vi.useRealTimers() })

it('selects an external provider with isolated options and preserves its this', () => {
	const provider = { value: 42, create() { return this.value } }
	const result = resolveMapProvider({ provider: 'tencent', providers: { tencent: provider }, providerOptions: { tencent: { key: 'public-web-key' }, amap: { key: 'other' } } })
	expect(result.create()).toBe(42)
	expect(result.options).toEqual({ key: 'public-web-key' })
	expect(() => resolveMapProvider({ provider: 'missing' })).toThrow('not registered')
	expect(() => resolveMapProvider({ provider: 'toString' })).toThrow('not registered')
})
it('creates a map, emits readiness, and forwards taps as coordinates', async () => {
	const { adapter, map, emit } = await fixture()
	expect(adapter.invoke('getCenterLocation', {})).toEqual({ longitude: 116.4, latitude: 39.9 })
	map.emit('click', { lnglat: coordinate([116, 39]) })
	expect(emit).toHaveBeenCalledWith('tap', { longitude: 116, latitude: 39 })
	expect(emit).toHaveBeenCalledWith('rendersuccess', {})
})
it('preserves imperative center, zoom and markers when unrelated props change', async () => {
	const { adapter, map } = await fixture()
	await adapter.invoke('moveToLocation', { longitude: 0, latitude: 0 })
	adapter.invoke('addMarkers', { markers: [{ id: 0, longitude: 0, latitude: 0 }] })
	map.setZoom(18)
	map.setCenter.mockClear(); map.setZoom.mockClear(); map.remove.mockClear()
	adapter.update({ ...base, showScale: true })
	expect(map.setCenter).not.toHaveBeenCalled()
	expect(map.setZoom).not.toHaveBeenCalled()
	expect(map.remove).not.toHaveBeenCalled()
	expect(adapter.invoke('getCenterLocation', {})).toEqual({ longitude: 0, latitude: 0 })
})
it('maps marker ID 0, replaces IDs and removes listeners with removed markers', async () => {
	const { adapter, map, emit } = await fixture({ markers: [{ id: 0, longitude: 1, latitude: 2 }] })
	const first = map.add.mock.calls.find(([item]) => !Array.isArray(item))[0]
	first.emit('click')
	expect(emit).toHaveBeenCalledWith('markertap', { markerId: 0 })
	adapter.invoke('addMarkers', { markers: [{ id: 0, longitude: 2, latitude: 3 }] })
	emit.mockClear(); first.emit('click')
	expect(emit).not.toHaveBeenCalled()
	expect(map.remove).toHaveBeenCalledWith(first)
})
it('rejects invalid replacement data without clearing existing markers', async () => {
	const { adapter, map } = await fixture({ markers: [{ id: 1, longitude: 1, latitude: 2 }] })
	map.remove.mockClear()
	expect(() => adapter.invoke('addMarkers', { clear: true, markers: [{ id: 2, longitude: 200, latitude: 0 }] })).toThrow('invalid')
	expect(map.remove).not.toHaveBeenCalled()
})
it('initializes the legacy subpackage marker without an ID', async () => {
	const marker = { latitude: 23.099994, longitude: 113.324520, name: 'T.I.T 创意园' }
	const { map, emit } = await fixture({ markers: [marker] })
	const overlay = map.add.mock.calls.find(([item]) => !Array.isArray(item))[0]
	expect(overlay.getPosition().getLng()).toBe(marker.longitude)
	overlay.emit('click')
	expect(emit).toHaveBeenCalledWith('markertap', {})
	expect(marker).not.toHaveProperty('id')
})
it('keeps multiple anonymous markers separate from zero and negative IDs', async () => {
	const { adapter, map, emit } = await fixture({ markers: [
		{ longitude: 1, latitude: 1 }, { id: 0, longitude: 2, latitude: 2 },
		{ longitude: 3, latitude: 3 }, { id: -1, longitude: 4, latitude: 4 },
	] })
	const overlays = map.add.mock.calls.map(([item]) => item).filter(item => !Array.isArray(item))
	expect(overlays).toHaveLength(4)
	map.remove.mockClear()
	adapter.invoke('removeMarkers', { markerIds: [0, -1] })
	expect(map.remove.mock.calls.map(([item]) => item)).toEqual([overlays[1], overlays[3]])
	emit.mockClear()
	overlays.forEach(overlay => overlay.emit('click'))
	expect(emit.mock.calls).toEqual([['markertap', {}], ['markertap', {}]])
})
it('appends anonymous markers and removes them on clear without leaving listeners', async () => {
	const { adapter, map, emit } = await fixture({ markers: [{ longitude: 1, latitude: 1 }] })
	const original = map.add.mock.calls.find(([item]) => !Array.isArray(item))[0]
	map.add.mockClear(); map.remove.mockClear()
	adapter.invoke('addMarkers', { markers: [{ longitude: 2, latitude: 2 }, { id: 0, longitude: 3, latitude: 3 }] })
	const appended = map.add.mock.calls.map(([item]) => item)
	expect(appended).toHaveLength(2)
	expect(map.remove).not.toHaveBeenCalled()
	adapter.invoke('addMarkers', { clear: true, markers: [] })
	expect(map.remove.mock.calls.map(([item]) => item)).toEqual([original, ...appended])
	emit.mockClear()
	;[original, ...appended].forEach(overlay => overlay.emit('click'))
	expect(emit).not.toHaveBeenCalled()
})
it('preserves anonymous markers on unrelated props and replaces them on markers changes', async () => {
	const markers = [{ longitude: 1, latitude: 1 }, { longitude: 2, latitude: 2 }]
	const { adapter, map, emit } = await fixture({ markers })
	const originals = map.add.mock.calls.map(([item]) => item).filter(item => !Array.isArray(item))
	map.add.mockClear(); map.remove.mockClear()
	adapter.update({ ...base, markers, showScale: true })
	expect(map.add).not.toHaveBeenCalled()
	expect(map.remove).not.toHaveBeenCalled()
	adapter.update({ ...base, markers: [{ longitude: 3, latitude: 3 }] })
	expect(map.remove.mock.calls.map(([item]) => item)).toEqual(originals)
	expect(map.add).toHaveBeenCalledTimes(1)
	emit.mockClear(); originals.forEach(overlay => overlay.emit('click'))
	expect(emit).not.toHaveBeenCalled()
})
it('emits anonymous callout taps without inventing an ID and disposes them', async () => {
	const { adapter, windows, map, emit } = await fixture({ markers: [
		{ longitude: 1, latitude: 1, callout: { content: 'Anonymous place' } },
	] })
	const overlay = map.add.mock.calls.find(([item]) => !Array.isArray(item))[0]
	overlay.emit('click')
	expect(windows[0].open).toHaveBeenCalled()
	windows[0].options.content.click()
	expect(emit).toHaveBeenCalledWith('callouttap', {})
	adapter.destroy(); emit.mockClear()
	overlay.emit('click'); windows[0].options.content.click()
	expect(emit).not.toHaveBeenCalled()
	expect(windows[0].close).toHaveBeenCalled()
})
it.each([null, '1', 1.5, Number.NaN])('rejects an explicitly invalid ID %s without clearing anonymous markers', async (id) => {
	const { adapter, map } = await fixture({ markers: [{ longitude: 1, latitude: 1 }] })
	const original = map.add.mock.calls.find(([item]) => !Array.isArray(item))[0]
	map.remove.mockClear()
	expect(() => adapter.invoke('addMarkers', { clear: true, markers: [
		{ longitude: 2, latitude: 2 }, { id, longitude: 3, latitude: 3 },
	] })).toThrow('marker id')
	expect(map.remove).not.toHaveBeenCalledWith(original)
})
it('fits only supplied points and translates padding order', async () => {
	const { adapter, map } = await fixture()
	map.add.mockClear(); map.remove.mockClear()
	adapter.invoke('includePoints', { points: [{ longitude: 3, latitude: 2 }, { longitude: 1, latitude: 4 }], padding: [1, 2, 3, 4] })
	const [bounds, padding] = map.getFitZoomAndCenterByBounds.mock.calls[0]
	expect(bounds.southwest).toEqual([1, 2])
	expect(bounds.northeast).toEqual([3, 4])
	expect(padding).toEqual([1, 3, 4, 2])
	expect(map.setZoomAndCenter).toHaveBeenCalledWith(12, map.getFitZoomAndCenterByBounds.mock.results[0].value[1], true)
	expect(map.add).not.toHaveBeenCalled()
	expect(map.remove).not.toHaveBeenCalled()
})
it('does not request location for display or explicit movement', async () => {
	const getLocation = vi.fn(async () => ({ longitude: 1, latitude: 2 }))
	const { adapter } = await fixture({}, getLocation)
	await adapter.invoke('moveToLocation', { longitude: 0, latitude: 0 })
	expect(getLocation).not.toHaveBeenCalled()
	await adapter.invoke('moveToLocation', {})
	expect(getLocation).toHaveBeenCalledTimes(1)
})
it('ignores a late location result after show-location is disabled', async () => {
	let resolve
	const getLocation = () => new Promise(r => { resolve = r })
	const { adapter, map } = await fixture({ showLocation: true }, getLocation)
	adapter.update({ ...base, showLocation: false })
	map.add.mockClear()
	resolve({ longitude: 1, latitude: 2 })
	await Promise.resolve(); await Promise.resolve()
	expect(map.add).not.toHaveBeenCalled()
})
it('rejects unsupported commands and prevents late location mutation after teardown', async () => {
	let resolve
	const { adapter, map, controller } = await fixture({}, () => new Promise(r => { resolve = r }))
	expect(() => adapter.invoke('unknownCommand', {})).toThrow('does not support')
	const pending = adapter.invoke('moveToLocation', {})
	controller.abort(); adapter.destroy()
	map.setCenter.mockClear()
	resolve({ longitude: 1, latitude: 2 })
	await expect(pending).rejects.toThrow('destroyed')
	expect(map.setCenter).not.toHaveBeenCalled()
	expect(map.destroy).toHaveBeenCalledTimes(1)
})
it('treats callout text as text, not executable HTML', async () => {
	const { windows } = await fixture({ markers: [{ id: 1, longitude: 1, latitude: 2, callout: { content: '<img src=x onerror=alert(1)>' } }] })
	expect(windows[0].options.content.textContent).toBe('<img src=x onerror=alert(1)>')
	expect(windows[0].options.content.children).toHaveLength(0)
})
it('loads AMap once per document and rejects a conflicting key', async () => {
	const frame = document.createElement('iframe'); document.body.append(frame)
	const doc = frame.contentDocument
	const first = loadAMap({ key: 'public-a', serviceHost: 'https://maps.example.test/_AMapService' }, doc)
	const second = loadAMap({ key: 'public-a', serviceHost: 'https://maps.example.test/_AMapService' }, doc)
	expect(first).toBe(second)
	expect(doc.querySelectorAll('script')).toHaveLength(1)
	await expect(loadAMap({ key: 'public-b' }, doc)).rejects.toThrow('conflicting')
	doc.defaultView.AMap = {}
	doc.querySelector('script').dispatchEvent(new Event('load'))
	await first
	frame.remove()
})
it('reports a script error without exposing key-bearing URLs', async () => {
	const frame = document.createElement('iframe'); document.body.append(frame)
	const doc = frame.contentDocument
	const pending = loadAMap({ key: 'public-a' }, doc)
	doc.querySelector('script').dispatchEvent(new Event('error'))
	await expect(pending).rejects.toThrow('AMap script load failed')
	frame.remove()
})

it('maps RGBA geometry colors to SDK color and opacity fields', async () => {
	const { map } = await fixture({ circles: [{ longitude: 116, latitude: 39, radius: 100, color: '#ff000080', fillColor: '#00000000' }] })
	const circle = map.add.mock.calls.flatMap(([value]) => Array.isArray(value) ? value : [value]).find(value => value.options.radius === 100)
	expect(circle.options).toMatchObject({ strokeColor: '#ff0000', fillColor: '#000000', fillOpacity: 0 })
	expect(circle.options.strokeOpacity).toBeCloseTo(128 / 255)
})

it('reads live camera angles, converts local coordinates and sets boundaries', async () => {
    const { adapter, map } = await fixture({ rotate: 45, skew: 30 })
    expect(adapter.invoke('getRotate', {})).toEqual({ rotate: 45 })
    expect(adapter.invoke('getSkew', {})).toEqual({ skew: 30 })
    expect(adapter.invoke('toScreenLocation', { longitude: 12, latitude: 30 })).toEqual({ x: 24, y: 90 })
    expect(adapter.invoke('fromScreenLocation', { x: 24, y: 90 })).toEqual({ longitude: 12, latitude: 30 })
    map.setLimitBounds.mockReturnValue(map)
    expect(adapter.invoke('setBoundary', { southwest: { longitude: 1, latitude: 2 }, northeast: { longitude: 3, latitude: 4 } })).toBeUndefined()
    expect(map.setLimitBounds).toHaveBeenCalledWith(expect.objectContaining({ southwest: [1, 2], northeast: [3, 4] }))
    expect(() => adapter.invoke('setBoundary', { southwest: { longitude: 4, latitude: 2 }, northeast: { longitude: 3, latitude: 4 } })).toThrow('boundary')
})
it('applies normalized center offsets to subsequent explicit moves and rejects invalid offsets', async () => {
    const { adapter, map } = await fixture()
    adapter.invoke('setCenterOffset', { offset: [0.25, 0.75] })
    expect(map.panBy).toHaveBeenLastCalledWith(-100, 50, 0)
    await adapter.invoke('moveToLocation', { longitude: 1, latitude: 2 })
    expect(map.panBy).toHaveBeenCalledTimes(2)
    expect(() => adapter.invoke('setCenterOffset', { offset: [1, 0] })).toThrow('offset')
})
it('replaces and removes arcs independently from declarative polylines', async () => {
    const { adapter, map } = await fixture()
    const args = { id: 0, start: { longitude: 1, latitude: 2 }, end: { longitude: 3, latitude: 2 }, angle: 60, color: '#ff000080', width: 4 }
    adapter.invoke('addArc', args)
    const first = map.add.mock.lastCall[0]
    expect(first.options.path[0]).toEqual([1, 2])
    expect(first.options.path.at(-1)).toEqual([3, 2])
    expect(first.options.strokeOpacity).toBeCloseTo(128 / 255)
    adapter.invoke('addArc', args)
    const second = map.add.mock.lastCall[0]
    expect(map.remove).toHaveBeenCalledWith(first)
    adapter.update({ ...base, polyline: [{ points: [{ longitude: 1, latitude: 2 }, { longitude: 3, latitude: 4 }] }] })
    expect(map.remove).not.toHaveBeenCalledWith(second)
    adapter.invoke('removeArc', { id: 0 })
    expect(map.remove).toHaveBeenCalledWith(second)
})
it('runs a distance-weighted route locally, emits interpolation and finishes at its last point', async () => {
    const { adapter, map, emit } = await fixture({ markers: [{ id: 0, longitude: 0, latitude: 0 }] })
    vi.useFakeTimers()
    const marker = map.add.mock.calls.find(([value]) => !Array.isArray(value))[0]
    const pending = adapter.invoke('moveAlong', { markerId: 0, path: [{ longitude: 0, latitude: 0 }, { longitude: 1, latitude: 0 }, { longitude: 4, latitude: 0 }], duration: 1000, autoRotate: true, precision: 1000 })
    await vi.advanceTimersByTimeAsync(512)
    expect(marker.getPosition().getLng()).toBeCloseTo(2.048, 2)
    expect(marker.getAngle()).toBeCloseTo(90)
    expect(emit).toHaveBeenCalledWith('interpolatepoint', expect.objectContaining({ markerId: 0 }))
    await vi.advanceTimersByTimeAsync(520)
    await expect(pending).resolves.toEqual({})
    expect(marker.getPosition().getLng()).toBe(4)
    expect(emit).toHaveBeenLastCalledWith('interpolatepoint', { markerId: 0, longitude: 4, latitude: 0, animationStatus: 'complete' })
})
it('cancels replaced, removed and destroyed marker animations without late mutation', async () => {
    const { adapter } = await fixture({ markers: [{ id: 0, longitude: 0, latitude: 0 }] })
    vi.useFakeTimers()
    const args = { markerId: 0, destination: { longitude: 1, latitude: 1 }, duration: 30000, autoRotate: true }
    const first = adapter.invoke('translateMarker', args)
    const rejected = expect(first).rejects.toThrow('replaced')
    const second = adapter.invoke('translateMarker', args)
    await rejected
    const removed = expect(second).rejects.toThrow('removed')
    adapter.invoke('removeMarkers', { markerIds: [0] })
    await removed
    adapter.invoke('addMarkers', { markers: [{ id: 0, longitude: 0, latitude: 0 }] })
    const third = adapter.invoke('translateMarker', args)
    const destroyed = expect(third).rejects.toThrow('destroyed')
    adapter.destroy()
    await destroyed
    expect(vi.getTimerCount()).toBe(0)
})
it('rejects malformed and missing marker moves and applies zero-duration endpoints', async () => {
    const { adapter, map } = await fixture({ markers: [{ id: 0, longitude: 0, latitude: 0 }] })
    expect(() => adapter.invoke('moveAlong', { markerId: 0, path: [], duration: 1 })).toThrow('path')
    expect(() => adapter.invoke('translateMarker', { markerId: 2, destination: { longitude: 1, latitude: 1 } })).toThrow('not found')
    adapter.invoke('translateMarker', { markerId: 0, destination: { longitude: 1, latitude: 1 }, rotate: 180, duration: 0, moveWithRotate: true })
    const marker = map.add.mock.calls.find(([value]) => !Array.isArray(value))[0]
    expect(marker.getPosition().getLng()).toBe(1)
    expect(Math.abs(marker.getAngle())).toBe(180)
})
