// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@dimina/common', () => ({ isAndroid: true, isHarmonyOS: false, uuid: () => String(++sequence) }))
let sequence = 0
const { createNativeMap } = await import('../src/component/map/providers/native')
const { nativeMapLayout } = await import('../src/component/map/providers/native-layout')
let element, controller, handlers, sent
function bounds(node, left, top, width, height) {
	node.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height })
	Object.defineProperties(node, { clientWidth: { configurable: true, value: width }, clientHeight: { configurable: true, value: height } })
}
function reply(message, ok = true, data = {}) {
	handlers.get('mapResult')?.({ id: message.body.params.id, requestId: message.body.params.requestId, ok, data })
}
async function mount() {
	const promise = createNativeMap({ element, props: { scale: 12 }, emit: vi.fn(), signal: controller.signal, bridgeId: 'page-a' })
	const message = sent.find(item => item.body.name === 'mapMount')
	reply(message)
	return promise
}
beforeEach(() => {
	document.body.innerHTML = '<div class="dd-map"><div id="surface"></div><button>overlay</button></div>'
	element = document.querySelector('#surface')
	bounds(element, 20, 40, 300, 200)
	controller = new AbortController()
	handlers = new Map(); sent = []
	window.__message = { invoke: message => sent.push(message), on: (type, handler) => handlers.set(type, handler), off: type => handlers.delete(type) }
	vi.stubGlobal('requestAnimationFrame', callback => setTimeout(callback, 0))
	vi.stubGlobal('cancelAnimationFrame', clearTimeout)
})
afterEach(() => { controller.abort(); vi.unstubAllGlobals(); delete window.DiminaNativeComponentBridge })

describe('Android native map composition', () => {
	it('only transfers page backgrounds after backend negotiation and restores them on abort', async () => {
		const style = document.createElement('style')
		style.textContent = 'body {background-color:#f8f8f8}'
		document.head.append(style)
		try {
			const promise = createNativeMap({ element, props: {}, emit: vi.fn(), signal: controller.signal, bridgeId: 'page-a' })
			expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(248, 248, 248)')
			reply(sent.at(-1), true, { nativeComponentBackend: { supportsPageBackground: true } })
			await Promise.resolve()
			const update = sent.at(-1)
			expect(update.body.name).toBe('mapUpdate')
			expect(update.body.params.pageBackgroundColors).toEqual([0, -460552])
			expect(update.body.params.layoutOnly).toBe(true)
			reply(update)
			await promise
			expect(getComputedStyle(document.body).backgroundColor).toBe('rgba(0, 0, 0, 0)')
			style.textContent = 'body {background-color:red}'
			await vi.waitFor(() => expect(sent.at(-1).body.params.pageBackgroundColors).toEqual([0, -65536]))
			controller.abort()
			expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(255, 0, 0)')
		} finally { style.remove() }
	})
	it('clips to scrolling ancestors without resizing the SDK view and hides clipped maps', () => {
		const parent = element.parentElement
		parent.style.overflowX = 'hidden'
		parent.style.overflowY = 'hidden'
		bounds(parent, 0, 70, 200, 100)
		const value = nativeMapLayout(element)
		expect(value.rect).toMatchObject({ width: 300, height: 200 })
		expect(value.clip).toEqual({ left: 0, top: 30, right: 180, bottom: 130 })
		expect(value.hidden).toBe(false)
		Object.defineProperty(parent, 'offsetWidth', { configurable: true, value: 100 })
		expect(nativeMapLayout(element).clip.right).toBe(300) // ancestor scaled to twice its layout width
		bounds(parent, 0, 300, 200, 100)
		expect(nativeMapLayout(element).hidden).toBe(true)
		parent.style.visibility = 'hidden'
		expect(nativeMapLayout(element).hidden).toBe(true)
	})
	it('uses the existing Android placeholder and correlates results before accepting commands', async () => {
		const adapter = await mount()
		const embed = element.querySelector('embed')
		expect(embed.type).toBe('application/view')
		expect(embed.getAttribute('comp_type')).toBe('native/map')
		expect(embed.dataset.diminaNativeId).toBe(sent[0].body.params.id)
		expect(embed.style.opacity).toBe('0')
		const result = adapter.invoke('getScale', {})
		const message = sent.at(-1)
		const resolved = vi.fn(); result.then(resolved)
		handlers.get('mapResult')({ id: 'other-map', requestId: message.body.params.requestId, ok: true })
		await Promise.resolve(); expect(resolved).not.toHaveBeenCalled()
		reply(message, true, { scale: 15 })
		expect(await result).toEqual({ scale: 15 })
		expect(message.body.bridgeId).toBe('page-a')
	})
	it('forwards a multi-touch gesture but leaves an overlaid DOM button to the page', async () => {
		await mount()
		const dispatchTouch = vi.fn()
		window.DiminaNativeComponentBridge = { dispatchTouch }
		let target = document.querySelector('button')
		document.elementFromPoint = () => target
		const touch = id => ({ identifier: id, clientX: 30, clientY: 50, pageX: 30, pageY: 50 })
		const fire = (name, changed, touches) => {
			const event = new Event(name, { bubbles: true, cancelable: true })
			Object.defineProperties(event, { changedTouches: { value: changed }, touches: { value: touches } })
			target.dispatchEvent(event)
			return event
		}
		expect(fire('touchstart', [touch(10)], [touch(10)]).defaultPrevented).toBe(false)
		expect(dispatchTouch).not.toHaveBeenCalled()
		target = element.querySelector('embed')
		expect(fire('touchstart', [touch(10)], [touch(10)]).defaultPrevented).toBe(true)
		fire('touchstart', [touch(20)], [touch(10), touch(20)])
		fire('touchmove', [touch(10), touch(20)], [touch(10), touch(20)])
		fire('touchend', [touch(20)], [touch(10)])
		fire('touchend', [touch(10)], [])
		const events = dispatchTouch.mock.calls.map(([value]) => JSON.parse(value))
		expect(events.map(event => event.action)).toEqual(['down', 'pointerDown', 'move', 'pointerUp', 'up'])
		expect(events[2].pointers.map(pointer => pointer.id)).toEqual([0, 1])
		expect(events.every(event => event.targetType === 'native/map')).toBe(true)
	})
	it('rejects inflight work and removes subscriptions and the placeholder on disposal', async () => {
		const adapter = await mount()
		const request = adapter.invoke('getRegion', {})
		const rejection = expect(request).rejects.toThrow('destroyed')
		controller.abort(); adapter.destroy()
		await rejection
		expect(element.children).toHaveLength(0)
		expect(handlers.size).toBe(0)
		expect(sent.filter(message => message.body.name === 'mapUnmount')).toHaveLength(1)
	})
})

it('sends one sampled arc command with the local CSS viewport and preserves public arguments', async () => {
	const adapter = await mount()
	const args = { id: 0, start: { longitude: 1, latitude: 2 }, end: { longitude: 3, latitude: 2 }, angle: 45 }
	const pending = adapter.invoke('addArc', args)
	const message = sent.at(-1)
	expect(message.body.params.args).toMatchObject({ ...args, viewport: { width: 300, height: 200 } })
	expect(message.body.params.args.arcPoints[0]).toEqual(args.start)
	expect(message.body.params.args.arcPoints.at(-1)).toEqual(args.end)
	expect(args).not.toHaveProperty('arcPoints')
	reply(message)
	await pending
})
