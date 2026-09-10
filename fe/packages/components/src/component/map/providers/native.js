import { isAndroid, isHarmonyOS, uuid } from '@dimina/common'
import { ensureNativeLayerTouchBridge } from '@/common/nativeLayerTouchBridge'
import { acquireNativePageBackground } from '@/common/nativePageBackground'
import { nativeMapLayout } from './native-layout'
import { arcPoints } from '../map-command'

// This adapter transports the common map contract only. Vendor SDKs live in the native host.
export async function createNativeMap({ element, props, emit, signal, bridgeId }) {
	const id = `dimina-map-${uuid()}`
	const pending = new Map()
	let destroyed = false
	let frame = 0
	let resizeObserver
	let mutationObserver
	let pageBackground
	const placeholder = element.ownerDocument.createElement(isAndroid || isHarmonyOS ? 'embed' : 'div')
	placeholder.id = id
	placeholder.style.cssText = 'display:block;width:100%;height:100%'
	placeholder.setAttribute('type', isHarmonyOS ? 'native/map' : 'application/view')
	if (isAndroid) {
		placeholder.setAttribute('comp_type', 'native/map')
		placeholder.dataset.diminaNativeType = 'native/map'
		placeholder.dataset.diminaNativeId = id
		placeholder.style.opacity = '0'
		ensureNativeLayerTouchBridge()
	}
	element.appendChild(placeholder)
	const layout = () => ({ ...nativeMapLayout(element), pageBackgroundColors: pageBackground?.snapshot() })
	const send = (name, data = {}) => window.__message.invoke({ type: 'invokeAPI', target: 'container',
		body: { name, bridgeId, params: { ...data, id, type: 'native/map' } } })
	const request = (name, data) => new Promise((resolve, reject) => {
		if (destroyed) { reject(new Error('map destroyed')); return }
		const requestId = uuid()
		pending.set(requestId, { resolve, reject })
		try { send(name, { ...data, requestId }) }
		catch (error) { pending.delete(requestId); reject(error) }
	})
	const onResult = (result) => {
		if (result.id !== id) return
		const call = pending.get(result.requestId)
		if (!call) return
		pending.delete(result.requestId)
		if (result.ok) call.resolve(result.data || {})
		else call.reject(new Error(result.data?.errMsg || 'native map operation failed'))
	}
	const onEvent = (event) => { if (!destroyed && event.id === id) emit(event.event, event.detail || {}) }
	window.__message.on('mapResult', onResult)
	window.__message.on('mapEvent', onEvent)
	const syncLayout = () => {
		if (frame || destroyed) return
		frame = requestAnimationFrame(() => {
			frame = 0
			if (!destroyed) send('mapUpdate', { ...layout(), layoutOnly: true })
		})
	}
	const destroy = () => {
		if (destroyed) return
		destroyed = true
		if (frame) cancelAnimationFrame(frame)
		resizeObserver?.disconnect()
		mutationObserver?.disconnect()
		window.removeEventListener('resize', syncLayout)
		window.removeEventListener('scroll', syncLayout, true)
		window.__message.off('mapResult', onResult)
		window.__message.off('mapEvent', onEvent)
		signal.removeEventListener('abort', destroy)
		pending.forEach(call => call.reject(new Error('map destroyed')))
		pending.clear()
		try { send('mapUnmount') } catch { /* The container may already be gone. */ }
		placeholder.remove()
		pageBackground?.release()
	}
	signal.addEventListener('abort', destroy, { once: true })
	try {
		const mounted = await request('mapMount', { props, ...layout() })
		if (destroyed) throw new Error('map destroyed')
		if (isAndroid && mounted.nativeComponentBackend?.supportsPageBackground === true) {
			pageBackground = acquireNativePageBackground(element.ownerDocument, syncLayout)
			await request('mapUpdate', { ...layout(), layoutOnly: true })
		}
		window.addEventListener('resize', syncLayout)
		window.addEventListener('scroll', syncLayout, true)
		if (window.ResizeObserver) {
			resizeObserver = new ResizeObserver(syncLayout)
			resizeObserver.observe(element)
		}
		if (window.MutationObserver) {
			mutationObserver = new MutationObserver(syncLayout)
			for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
				mutationObserver.observe(ancestor, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] })
			}
		}
	}
	catch (error) { destroy(); throw error }
	return {
		update: next => request('mapUpdate', { props: next, ...layout() }),
		invoke: (command, params) => request('mapContext', { command, args: {
			...params,
			...(command === 'addArc' ? { arcPoints: arcPoints(params) } : {}),
			viewport: { width: element.clientWidth, height: element.clientHeight },
		} }),
		destroy,
	}
}
