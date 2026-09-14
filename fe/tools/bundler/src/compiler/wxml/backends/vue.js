/**
 * vue backend（backend₀ · fe-tools-wxml-ir · T-IR2）。
 *
 * 归属（technical-design 阶段归属表）：slot 分组、dimina-slot-group、
 * 标签→Vue、指令改写、compileTemplate 属 Vue 侧。v1（先切缝，再迁语义）：
 * - render 消费 **LoadedGraph**（投影句柄 `_$`），驱动
 *   normalizeTemplateDom / transHtmlTag（经 ctx.tools 注入，算法仍在
 *   view-compiler 工具袋）产出 Vue 模板串（code）；
 * - compileTemplate + 缓存/打包/sourcemap 组装留在 view-compiler
 *   「既有缓存/打包壳」（technical-design 模块落点注）；compileTemplate
 *   整体迁入 backend 属语义迁移期。
 * - 不得以「原始 WXML 字符串 → cheerio → 产物」为权威路径（投影仅来自
 *   Document/LoadedGraph —— cheerio 不变量 F-005）。
 */

export const VUE_BACKEND_ID = 'vue'

/**
 * @param {{ loaded: import('../document.js').WxmlDocument & { templateModule?: object[], scriptModule?: object[] }, document?: object }} input
 * @param {object} ctx BackendContext（含 components / componentPlaceholder / tools）
 * @returns {{ code: string, map: null, meta: object }}
 */
function render({ loaded }, ctx = {}) {
	const { components = {}, componentPlaceholder, tools } = ctx
	const $ = loaded?._$
	if (!$) {
		throw new TypeError('[wxml] vue backend: LoadedGraph projection handle (_$) is missing — render must consume a LoadedGraph, not raw WXML source')
	}
	if (!tools || typeof tools.transHtmlTag !== 'function') {
		throw new TypeError('[wxml] vue backend: ctx.tools.transHtmlTag is required (transitional injection)')
	}
	const { normalizeTemplateDom } = tools
	if (typeof normalizeTemplateDom === 'function') {
		normalizeTemplateDom($, $.root(), components)
	}
	const res = []
	tools.transHtmlTag($.html(), res, components, componentPlaceholder)
	return {
		code: res.join(''),
		map: null,
		meta: {
			backend: VUE_BACKEND_ID,
		},
	}
}

export const vueBackend = Object.freeze({
	id: VUE_BACKEND_ID,
	render,
})
