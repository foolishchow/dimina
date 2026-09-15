/**
 * stub backend（测例桩 · fe-tools-wxml-ir · T-IR3）。
 *
 * 证明挂点真实（A-WIR2）：可注册、可被选择、收到 LoadedGraph（而非原始
 * WXML 字符串）；不要求可产物。仅测例 / 消融使用——生产路径仅 'vue'。
 */

export const STUB_BACKEND_ID = 'stub'

export function createStubBackend({ onRender } = {}) {
	const calls = []
	return {
		id: STUB_BACKEND_ID,
		calls,
		render(input, ctx) {
			const loaded = input?.loaded
			const record = {
				hasProjectionHandle: Boolean(loaded?._$),
				templateModule: loaded?.templateModule ?? null,
				scriptModule: loaded?.scriptModule ?? null,
				ctxKeys: Object.keys(ctx || {}),
			}
			calls.push(record)
			if (typeof onRender === 'function') {
				onRender(record, input, ctx)
			}
			return { code: '', map: null, meta: { backend: STUB_BACKEND_ID, stub: true } }
		},
	}
}
