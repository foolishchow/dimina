// Native views cannot inherit DOM overflow/visibility. Send a local clipping rectangle
// without resizing the map camera, so scrolling doesn't change its visible region.
export function nativeMapLayout(element) {
	const rect = element.getBoundingClientRect()
	let left = Math.max(0, rect.left)
	let top = Math.max(0, rect.top)
	let right = Math.min(window.innerWidth, rect.right)
	let bottom = Math.min(window.innerHeight, rect.bottom)
	let hidden = false
	let opacity = 1
	for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
		const style = getComputedStyle(ancestor)
		hidden ||= ancestor.hasAttribute('hidden') || style.display === 'none' || style.visibility === 'hidden'
		opacity *= Number(style.opacity || 1)
		const bounds = ancestor.getBoundingClientRect()
		const scaleX = ancestor.offsetWidth ? bounds.width / ancestor.offsetWidth : 1
		const scaleY = ancestor.offsetHeight ? bounds.height / ancestor.offsetHeight : 1
		if (/hidden|clip|scroll|auto/.test(style.overflowX || style.overflow)) {
			left = Math.max(left, bounds.left + ancestor.clientLeft * scaleX)
			right = Math.min(right, bounds.left + (ancestor.clientLeft + ancestor.clientWidth) * scaleX)
		}
		if (/hidden|clip|scroll|auto/.test(style.overflowY || style.overflow)) {
			top = Math.max(top, bounds.top + ancestor.clientTop * scaleY)
			bottom = Math.min(bottom, bounds.top + (ancestor.clientTop + ancestor.clientHeight) * scaleY)
		}
	}
	return {
		rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height,
			pageLeft: rect.left + window.scrollX, pageTop: rect.top + window.scrollY,
			viewportWidth: window.innerWidth, viewportHeight: window.innerHeight },
		clip: { left: Math.max(0, left - rect.left), top: Math.max(0, top - rect.top),
			right: Math.max(0, right - rect.left), bottom: Math.max(0, bottom - rect.top) },
		hidden: hidden || opacity === 0 || right <= left || bottom <= top,
		opacity,
	}
}
