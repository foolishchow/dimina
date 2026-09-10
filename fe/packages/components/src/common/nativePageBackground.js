// System WebView underlays cannot show through a CSS page background. Move only
// the root's solid colors to the native backing layer; descendants remain intact.
const pages = new WeakMap()
const transparentRoots = 'html:root, html:root > body { background-color: transparent !important; }'

function argb(value) {
	if (value === 'transparent' || !value) return 0
	const match = value.match(/^rgba?\(([^)]+)\)$/)
	if (!match) return undefined
	const parts = match[1].split(',').map(Number)
	if (parts.length < 3 || parts.some(n => !Number.isFinite(n))) return undefined
	const [r, g, b, a = 1] = parts
	return (Math.round(a * 255) << 24) | (r << 16) | (g << 8) | b
}

function createPageState(document) {
	const view = document.defaultView
	const style = document.createElement('style')
	document.head.appendChild(style)
	const state = { style, count: 0, dirty: true, colors: undefined, listeners: new Set() }
	const invalidate = () => {
		if (state.dirty) return
		state.dirty = true
		state.listeners.forEach(listener => listener())
	}
	const stylesheetNode = node => node.nodeType === 1 && (node.matches('style, link[rel~="stylesheet"]') || node.querySelector('style, link[rel~="stylesheet"]'))
	const changed = records => records.some(record => {
		if (record.target === style || style.contains(record.target)) return false
		if (record.type === 'attributes' && (record.target === document.body || record.target === document.documentElement)) return true
		if (record.target.parentElement?.closest('style') || record.target.nodeType === 1 && record.target.matches('style, link')) return true
		return [...record.addedNodes, ...record.removedNodes].some(stylesheetNode)
	})
	const observer = new view.MutationObserver(records => { if (changed(records)) invalidate() })
	observer.observe(document.documentElement, { attributes: true })
	observer.observe(document.body, { attributes: true })
	observer.observe(document.head, { subtree: true, childList: true, characterData: true, attributes: true })
	const onLoad = event => { if (event.target.matches?.('link[rel~="stylesheet"]')) invalidate() }
	const theme = view.matchMedia?.('(prefers-color-scheme: dark)')
	view.addEventListener('resize', invalidate)
	document.addEventListener('load', onLoad, true)
	theme?.addEventListener('change', invalidate)
	state.checkChanges = () => { if (changed(observer.takeRecords())) invalidate() }
	state.dispose = () => {
		observer.disconnect()
		view.removeEventListener('resize', invalidate)
		document.removeEventListener('load', onLoad, true)
		theme?.removeEventListener('change', invalidate)
		style.remove()
	}
	return state
}

export function acquireNativePageBackground(document, onChange = () => {}) {
	let state = pages.get(document)
	if (!state) {
		state = createPageState(document)
		pages.set(document, state)
	}
	state.count++
	const listener = () => onChange()
	state.listeners.add(listener)
	let released = false
	return {
		snapshot() {
			if (released) return undefined
			// Drain queued mutations so a synchronous prop update sees the new
			// cascade even before MutationObserver's microtask has run.
			state.checkChanges()
			if (!state.dirty) return state.colors
			state.dirty = false
			state.colors = undefined
			// Remove just our rule while sampling the current cascade. No inline
			// business styles are changed, and both steps occur in one JS task.
			state.style.textContent = ''
			const styles = [document.documentElement, document.body].map(node => document.defaultView.getComputedStyle(node))
			if (styles.some(s => s.backgroundImage && s.backgroundImage !== 'none')) return undefined
			const colors = styles.map(s => argb(s.backgroundColor))
			if (colors.some(color => color === undefined)) return undefined
			state.style.textContent = transparentRoots
			// An inline !important declaration may outrank the compatibility rule.
			if ([document.documentElement, document.body].some(node => argb(document.defaultView.getComputedStyle(node).backgroundColor) !== 0)) {
				state.style.textContent = ''
				return undefined
			}
			state.colors = Object.freeze(colors)
			return state.colors
		},
		release() {
			if (released) return
			released = true
			state.listeners.delete(listener)
			if (--state.count === 0) {
				state.dispose()
				pages.delete(document)
			}
		},
	}
}
