/**
 * WxmlBackend 注册表（fe-tools-wxml-ir · T-IR3）。
 *
 * R-WIR2：registerBackend / getBackend；同 id **抛错**（禁静默覆盖）；
 * 生产路径默认且仅使用 'vue'（backend₀）；其它 id 仅测例 / 消融注册。
 * R-WIR9：registry 配置错误带 `[wxml]` 前缀。
 */

/** @type {Map<string, import('./vue.js').WxmlBackend>} */
const registry = new Map()

function assertBackendShape(backend, label = 'registerBackend') {
	if (!backend || typeof backend !== 'object') {
		throw new TypeError(`[wxml] ${label}: backend must be an object`)
	}
	if (typeof backend.id !== 'string' || !backend.id) {
		throw new TypeError(`[wxml] ${label}: backend.id must be a non-empty string`)
	}
	if (typeof backend.render !== 'function') {
		throw new TypeError(`[wxml] ${label}: backend.render must be a function`)
	}
}

export function registerBackend(backend) {
	assertBackendShape(backend)
	if (registry.has(backend.id)) {
		throw new Error(`[wxml] registerBackend: backend id '${backend.id}' already registered (silent overwrite forbidden)`)
	}
	registry.set(backend.id, backend)
}

export function unregisterBackend(id) {
	return registry.delete(id)
}

export function getBackend(id) {
	return registry.get(id) ?? null
}

export function listBackends() {
	return [...registry.keys()]
}

/** 测试清理（非公开契约） */
export const _registryForTest = registry