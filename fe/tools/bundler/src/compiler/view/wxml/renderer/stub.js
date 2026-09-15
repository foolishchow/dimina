// @ts-check
/**
 * stub wxml renderer（测例桩 · fe-tools-wxml-ir · T-IR3）。
 *
 * 证明挂点真实（A-WIR2）：可注册、可被选择、收到 LoadedGraph（而非原始
 * WXML 字符串）；不要求可产物。仅测例 / 消融使用——生产路径仅 'vue'。
 */

/**
 * @typedef {import('../common/wxml-ir.types.js').WxmlRenderer} WxmlRenderer
 * @typedef {import('../common/wxml-ir.types.js').WxmlRenderResult} WxmlRenderResult
 * @typedef {import('../common/wxml-ir.types.js').LoadedGraph} LoadedGraph
 */

export const STUB_RENDERER_ID = 'stub'

/**
 * @param {{ onRender?: (record: object, input: object, ctx: object) => void }} [opts]
 * @returns {WxmlRenderer & { calls: object[] }}
 */
export function createStubWxmlRenderer({ onRender } = {}) {
	/** @type {object[]} */
	const calls = []
	return {
		id: STUB_RENDERER_ID,
		calls,
		/**
		 * @param {{ loaded?: LoadedGraph }} input
		 * @param {object} [ctx]
		 * @returns {WxmlRenderResult}
		 */
		render(input, ctx) {
			const loaded = input?.loaded
			const record = {
				hasDocumentBody: Array.isArray(loaded?.body),
				templateModule: loaded?.templateModule ?? null,
				scriptModule: loaded?.scriptModule ?? null,
				ctxKeys: Object.keys(ctx || {}),
			}
			calls.push(record)
			if (typeof onRender === 'function') {
				onRender(record, input, /** @type {object} */ (ctx))
			}
			return { code: '', map: null, meta: { backend: STUB_RENDERER_ID, stub: true } }
		},
	}
}
