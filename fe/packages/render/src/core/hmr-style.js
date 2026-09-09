/**
 * dev-only L2 CSS hot swap（dmcc A3 契约，technical-design §2）。
 *
 * style registry 按 { scope: 'app' | 'page', pagePath? } 管理已加载的
 * `<link rel="stylesheet">`；dmcc dev 的 hmr 指令（level=L2）到达后，
 * 以 buildId cache-bust 重载同一 URL，新 link onload 后原子移除旧 link；
 * 加载失败时移除新 link、保留旧 link（在售样式不变）。
 *
 * 实现决策：pageFrame iframe 为单 app 渲染帧，registry key 不含 appId
 * （scope+pagePath 已唯一）；meta.appId 仅作诊断记录。
 * L2 对 app 与受影响页面资源做最终一致重载——重载未变更的资源无害。
 */

const HMR_CACHE_BUST_PARAM = '__dmcc_hmr'
const DEFAULT_LOAD_TIMEOUT_MS = 10000

export function createStyleRegistry() {
	return new Map()
}

/** 默认 registry 单例（loader 与 hmr 分发共享同一实例）。 */
const styleRegistry = createStyleRegistry()

export function styleKey({ scope, pagePath }) {
	return scope === 'app' ? 'style:app' : `style:page:${pagePath}`
}

/**
 * 登记（或更新）一个样式资源。loader 加载 app.css / 页面 css 时调用。
 * @param {Map} registry
 * @param {{ scope: 'app'|'page', pagePath?: string, appId?: string,
 *           url: string, el: HTMLLinkElement }} entry
 */
export function registerStyle(registry, { scope, pagePath, appId, url, el }) {
	registry.set(styleKey({ scope, pagePath }), { scope, pagePath, appId, url, el })
}

function bustUrl(url, buildId) {
	const joiner = url.includes('?') ? '&' : '?'
	return `${url}${joiner}${HMR_CACHE_BUST_PARAM}=${buildId}`
}

function loadLink(href, timeoutMs) {
	return new Promise((resolve, reject) => {
		const link = document.createElement('link')
		link.rel = 'stylesheet'
		link.href = href
		const finish = (ok) => {
			clearTimeout(timer)
			link.onload = null
			link.onerror = null
			if (ok) {
				resolve(link)
			}
			else {
				link.remove()
				reject(new Error(`stylesheet load failed: ${href}`))
			}
		}
		link.onload = () => finish(true)
		link.onerror = () => finish(false)
		const timer = setTimeout(() => finish(false), timeoutMs)
		document.head.append(link)
	})
}

/**
 * 替换单个样式资源（事务：新 link 加载成功才移除旧 link）。
 * @param {Map} registry
 * @param {{ scope: 'app'|'page', pagePath?: string, buildId: number }} target
 * @returns {Promise<{ applied: boolean, reason?: string }>} 事务结果：applied 为
 *   true 时旧 link 已移除、registry 已指向新 link；失败时在售样式保持不变。
 */
export async function applyStyleReload(registry, { scope, pagePath, buildId }) {
	const key = styleKey({ scope, pagePath })
	const entry = registry.get(key)
	if (!entry) {
		// 只热替换首次加载即登记的资源；未知资源不盲目插入（避免凭空造 URL）。
		return { applied: false, reason: 'unknown-style-resource' }
	}

	let fresh
	try {
		fresh = await loadLink(bustUrl(entry.url, buildId), DEFAULT_LOAD_TIMEOUT_MS)
	}
	catch (error) {
		// 失败：新 link 已移除，旧 link 与在售样式保持不变。
		return { applied: false, reason: 'style-load-failed' }
	}

	entry.el?.remove()
	registerStyle(registry, { scope, pagePath, appId: entry.appId, url: entry.url, el: fresh })
	return { applied: true }
}

/**
 * L2 指令批量执行：app 全局样式 + 每个受影响页面的样式全部最终一致重载。
 * 单个资源失败不影响其余资源；返回逐项结果供诊断。
 * @param {Map} registry
 * @param {{ buildId: number, affectedPages: string[] }} payload hmr 指令体
 * @returns {Promise<Array<{ scope: string, pagePath?: string, applied: boolean, reason?: string }>>}
 *   逐项结果（app 先、页面后），供诊断。
 */
export async function applyStyleReloadBatch(registry, { buildId, affectedPages }) {
	const targets = [
		{ scope: 'app' },
		...affectedPages.map(pagePath => ({ scope: 'page', pagePath })),
	]
	const results = []
	for (const target of targets) {
		const result = await applyStyleReload(registry, { ...target, buildId })
		results.push({ ...target, ...result })
	}
	return results
}

export { styleRegistry }