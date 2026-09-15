/**
 * parseWxml — WXML 源 → Document 投影（fe-tools-wxml-ir · T-IR0）。
 *
 * D-WIR-6：首版 parse = cheerio/htmlparser2 → Document 投影（真扫描后置）。
 * R-WIR1：parse 不读盘、不展开 import/include、不做 Wxs 编译——特殊节点
 *   （include/import/wxs/template）原样保留在树上（D-WIR-3）；展开与 Wxs
 *   编译属 load（wxml/load.js）。
 * D-WIR-5：loc 来自 htmlparser2 startIndex/endIndex（半开归一：end = endIndex + 1）。
 * R-WIR9：失败路径带 `[wxml]` 前缀 + sourceFile。
 *
 * 投影句柄：返回的 Document 挂非枚举 `_$`（本实例即「工作实例」，load 与
 * backend 的过渡期投影均经它进行——同实例操作保证行为 0；cheerio 仅投影工具）。
 */
import * as cheerio from 'cheerio'
import {
	attachProjection,
	createCommentNode,
	createDocument,
	createElement,
	createTextNode,
} from './document.js'

/** 与今日 view-compiler 主解析一致的 cheerio 选项（保真投影） */
const PARSE_OPTIONS = Object.freeze({
	xmlMode: true,
	decodeEntities: false,
	_useHtmlParser2: true,
	lowerCaseTags: false,
	lowerCaseAttributeNames: false,
	withStartIndices: true,
	withEndIndices: true,
})

export { PARSE_OPTIONS }

/**
 * @param {string} source WXML 源串
 * @param {{ sourceFile?: string }} [options]
 * @returns {import('./document.js').WxmlDocument}
 */
export function parseWxml(source, options = {}) {
	const { sourceFile } = options
	if (typeof source !== 'string') {
		throw new TypeError(`[wxml] parse: source must be a string${sourceFile ? ` (sourceFile=${sourceFile})` : ''}`)
	}
	let $
	try {
		$ = cheerio.load(source, PARSE_OPTIONS)
	}
	catch (error) {
		throw new Error(`[wxml] parse failed: ${error?.message || error}${sourceFile ? ` (sourceFile=${sourceFile})` : ''}`, { cause: error })
	}
	return projectDocument($, { source, sourceFile })
}

/**
 * cheerio 实例 → Document 投影（含 loc；特殊节点保留）。
 * load 阶段结构变更后经本函数重投影（同实例 → 保真）。
 */
export function projectDocument($, { sourceFile } = {}) {
	const body = projectChildren($.root().contents().toArray(), sourceFile)
	const document = createDocument({ body, sourceFile, projection: $ })
	return document
}

function projectChildren(elems, sourceFile) {
	const out = []
	for (const elem of elems) {
		const node = projectNode(elem, sourceFile)
		if (node) {
			out.push(node)
		}
	}
	return out
}

function projectNode(elem, sourceFile) {
	if (!elem || elem.type === 'root') {
		return null
	}
	const loc = nodeLoc(elem)
	if (elem.type === 'text') {
		const value = elem.data ?? ''
		if (value === '') {
			return null
		}
		return createTextNode({ value, loc, sourceFile })
	}
	if (elem.type === 'comment') {
		return createCommentNode({ value: elem.data ?? '', loc, sourceFile })
	}
	if (elem.type === 'directive' || elem.type === 'script' || elem.type === 'style') {
		// xmlMode 下罕见；保真起见按文本留痕（不丢节点数）
		return createTextNode({ value: elem.data ?? '', loc, sourceFile })
	}
	// element / tag
	const node = createElement({
		name: elem.tagName ?? elem.name,
		attrs: elementAttrs(elem),
		children: projectChildren(elem.children || [], sourceFile),
		loc,
		sourceFile,
	})
	attachProjection(node, '_elem', elem)
	return node
}

function elementAttrs(elem) {
	const attrs = {}
	if (elem.attribs) {
		for (const [key, value] of Object.entries(elem.attribs)) {
			attrs[key] = value
		}
	}
	return attrs
}

/** htmlparser2 startIndex/endIndex（闭）→ D-WIR-5 半开 loc */
function nodeLoc(elem) {
	const start = typeof elem.startIndex === 'number' ? elem.startIndex : null
	const end = typeof elem.endIndex === 'number' ? elem.endIndex + 1 : null
	if (start === null || end === null) {
		return null
	}
	return { start, end }
}