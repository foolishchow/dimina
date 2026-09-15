// @ts-check
/**
 * WxmlRenderer 注册表（fe-tools-wxml-ir · T-IR3）。
 *
 * R-WIR2：registerWxmlRenderer / getWxmlRenderer；同 id **抛错**（禁静默覆盖）；
 * 生产路径默认且仅使用 'vue'（wxml renderer₀）；其它 id 仅测例 / 消融注册。
 * R-WIR9：registry 配置错误带 `[wxml]` 前缀。
 */

/**
 * @typedef {import('../common/wxml-ir.types.js').WxmlRenderer} WxmlRenderer
 */

/** @type {Map<string, WxmlRenderer>} */
const registry = new Map()

/**
 * @param {unknown} renderer
 * @param {string} [label]
 */
function assertWxmlRendererShape(renderer, label = 'registerWxmlRenderer') {
	if (!renderer || typeof renderer !== 'object') {
		throw new TypeError(`[wxml] ${label}: renderer must be an object`)
	}
	const r = /** @type {{ id?: unknown, render?: unknown }} */ (renderer)
	if (typeof r.id !== 'string' || !r.id) {
		throw new TypeError(`[wxml] ${label}: renderer.id must be a non-empty string`)
	}
	if (typeof r.render !== 'function') {
		throw new TypeError(`[wxml] ${label}: renderer.render must be a function`)
	}
}

/**
 * @param {WxmlRenderer} renderer
 */
export function registerWxmlRenderer(renderer) {
	assertWxmlRendererShape(renderer)
	if (registry.has(renderer.id)) {
		throw new Error(`[wxml] registerWxmlRenderer: renderer id '${renderer.id}' already registered (silent overwrite forbidden)`)
	}
	registry.set(renderer.id, renderer)
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function unregisterWxmlRenderer(id) {
	return registry.delete(id)
}

/**
 * @param {string} id
 * @returns {WxmlRenderer|null}
 */
export function getWxmlRenderer(id) {
	return registry.get(id) ?? null
}

/**
 * @returns {string[]}
 */
export function listWxmlRenderers() {
	return [...registry.keys()]
}

/** 测试清理（非公开契约） */
export const _registryForTest = registry
