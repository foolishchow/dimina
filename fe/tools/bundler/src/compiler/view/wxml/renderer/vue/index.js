/**
 * vue wxml renderer（wxml renderer₀ · fe-tools-wxml-refactor · W2）。
 *
 * 消费标准 Document / LoadedGraph；经 Document 操作面 normalize + serialize。
 * 不得经投影工具句柄访问树。
 */
import { getRootChildren, getSourceOrigin, serialize } from '../../common/document-ops.js'

export const VUE_RENDERER_ID = 'vue'

/**
 * 展开后 Document → 行源表（html 行 → {source, line}；跨文件归位）。
 */
function buildLineOrigins(document, { sourceFile, sourceTexts }) {
	const html = serialize(document)
	const totalLines = html.split('\n').length
	const origins = new Array(totalLines)
	const WIR_SRC = Symbol.for('db.wxml-bridge.source')

	const originFor = (node) => {
		const { source, line } = getSourceOrigin(node, {
			sourceFile,
			sourceTexts,
			originKey: WIR_SRC,
		})
		return { source, line }
	}

	const lineOfOffset = (offset) => {
		let line = 1
		for (let i = 0; i < offset && i < html.length; i++) {
			if (html.charCodeAt(i) === 10) line++
		}
		return line
	}

	const walkElems = (elems, searchPos) => {
		for (const elem of elems) {
			if (!elem || elem.type === 'text' || elem.type === 'comment') {
				continue
			}
			let serialized = ''
			try {
				serialized = serialize(elem) ?? ''
			}
			catch {
				serialized = ''
			}
			if (!serialized) continue
			const idx = html.indexOf(serialized, searchPos)
			if (idx >= 0) {
				const startLine = lineOfOffset(idx)
				const lineCount = serialized.split('\n').length
				const origin = originFor(elem)
				for (let l = startLine; l < startLine + lineCount && l <= totalLines; l++) {
					origins[l - 1] = origin
				}
				const children = elem.children || []
				if (children.length > 0) {
					walkElems(children, idx)
				}
			}
		}
	}
	walkElems(getRootChildren(document), 0)

	for (let i = 0; i < totalLines; i++) {
		if (!origins[i]) {
			origins[i] = { source: sourceFile, line: 1 }
		}
	}
	return origins
}

function buildSourceContents(sourceTexts) {
	const out = new Map()
	if (!sourceTexts) {
		return out
	}
	for (const [src, content] of sourceTexts) {
		if (typeof content === 'string') {
			out.set(src, content)
		}
	}
	return out
}

/**
 * @param {{ loaded: object }} input LoadedGraph（标准 Document + sourceTexts）
 * @param {object} ctx WxmlRendererContext（components / componentPlaceholder / tools）
 */
function render({ loaded }, ctx = {}) {
	const { components = {}, componentPlaceholder, tools } = ctx
	if (!loaded || !Array.isArray(loaded.body)) {
		throw new TypeError('[wxml] vue wxml renderer: LoadedGraph document body is missing — render must consume a LoadedGraph, not raw WXML source')
	}
	if (!tools || typeof tools.transHtmlTag !== 'function') {
		throw new TypeError('[wxml] vue wxml renderer: ctx.tools.transHtmlTag is required (transitional injection)')
	}
	const { normalizeTemplateDom } = tools
	if (typeof normalizeTemplateDom === 'function') {
		normalizeTemplateDom(loaded, components)
	}

	const html = serialize(loaded)
	const lineOrigins = buildLineOrigins(loaded, {
		sourceFile: loaded.sourceFile ?? 'index.wxml',
		sourceTexts: loaded.sourceTexts,
	})

	const res = []
	tools.transHtmlTag(html, res, components, componentPlaceholder)
	const code = res.join('')

	const hasCrossFile = lineOrigins.some(o => o.source !== (loaded.sourceFile ?? 'index.wxml'))
	let shifted = false
	let alignedOrigins = null
	if (hasCrossFile) {
		alignedOrigins = lineOrigins
		const codeLines = code.split('\n').length
		const htmlLines = html.split('\n').length
		if (codeLines !== htmlLines) {
			shifted = true
			if (codeLines < htmlLines) {
				alignedOrigins = lineOrigins.slice(0, codeLines)
			}
			else {
				const last = lineOrigins[lineOrigins.length - 1] ?? { source: loaded.sourceFile ?? 'index.wxml', line: 1 }
				while (alignedOrigins.length < codeLines) {
					alignedOrigins.push({ ...last })
				}
			}
		}
	}

	return {
		code,
		map: null,
		meta: {
			backend: VUE_RENDERER_ID,
			lineOrigins: alignedOrigins,
			sourceContents: buildSourceContents(loaded.sourceTexts),
			shifted,
		},
	}
}

export const vueWxmlRenderer = Object.freeze({
	id: VUE_RENDERER_ID,
	render,
})
