/**
 * cheerio 投影 parser（fe-tools-wxml-refactor · W3）。
 *
 * cheerio 仅在本模块内使用；返回的 Document 不含 `_$` / `_elem`。
 * 特殊节点按 type 分类；attrs 为 Attr[]；契约字段始终存在。
 */
import * as cheerio from 'cheerio'
import {
	createCommentNode,
	createDocument,
	createElement,
	createImport,
	createInclude,
	createSlot,
	createTemplateDef,
	createTemplateRef,
	createTextNode,
	createWxs,
	attrsFromRecord,
} from '../common/document.ts'
import { bindDocument } from '../common/document-ops.ts'
import type { WxmlDocument } from '../common/wxml-ir.types.ts'
import type { WxmlNode } from '../common/document.ts'

/** 与今日 view-compiler 主解析一致的 cheerio 选项（保真投影） */
export const PARSE_OPTIONS = Object.freeze({
	xmlMode: true,
	decodeEntities: false,
	_useHtmlParser2: true,
	lowerCaseTags: false,
	lowerCaseAttributeNames: false,
	withStartIndices: true,
	withEndIndices: true,
})

/**
 * @param {string} source WXML 源串
 * @param {{ sourceFile?: string }} [options]
 * @returns {import('../common/wxml-ir.types.ts').WxmlDocument}
 */
export function parseWxml(source: string, options: { sourceFile?: string } = {}): WxmlDocument {
	const { sourceFile } = options
	if (typeof source !== 'string') {
		throw new TypeError(`[wxml] parse: source must be a string${sourceFile ? ` (sourceFile=${sourceFile})` : ''}`)
	}
	let $: unknown
	try {
		$ = cheerio.load(source, PARSE_OPTIONS)
	}
	catch (error) {
		throw new Error(`[wxml] parse failed: ${(error as Error)?.message || error}${sourceFile ? ` (sourceFile=${sourceFile})` : ''}`, { cause: error as Error })
	}
	return projectDocument($, { sourceFile })
}

/**
 * cheerio 实例 → 标准 Document（投影后丢弃 cheerio 句柄）。
 */
export function projectDocument($: unknown, { sourceFile }: { sourceFile?: string } = {}): WxmlDocument {
	const body = projectChildren(($ as { root: () => { contents: () => { toArray: () => unknown[] } } }).root().contents().toArray(), sourceFile)
	const document = createDocument({ body, sourceFile, span: null }) as WxmlDocument
	bindDocument(document)
	return document
}
function projectChildren(elems: unknown[], sourceFile?: string): WxmlNode[] {
	const out: WxmlNode[] = []
	for (const elem of elems) {
		const node = projectNode(elem, sourceFile)
		if (node) {
			out.push(node)
		}
	}
	return out
}
function projectNode(elem: unknown, sourceFile?: string): WxmlNode | null {
	if (!elem || (elem as { type?: string }).type === 'root') {
		return null
	}
	const loc = nodeLoc(elem)
	if ((elem as { type?: string }).type === 'text') {
		const value = (elem as { data?: string }).data ?? ''
		if (value === '') {
			return null
		}
		return createTextNode({ value, loc, sourceFile })
	}
	if ((elem as { type?: string }).type === 'comment') {
		return createCommentNode({ value: (elem as { data?: string }).data ?? '', loc, sourceFile })
	}
	if ((elem as { type?: string }).type === 'directive' || (elem as { type?: string }).type === 'script' || (elem as { type?: string }).type === 'style') {
		return createTextNode({ value: (elem as { data?: string }).data ?? '', loc, sourceFile })
	}

	const name = (elem as { tagName?: string; name?: string }).tagName ?? (elem as { name?: string }).name
	const attrRecord = elementAttrs(elem)
	const attrs = attrsFromRecord(attrRecord)
	const children = projectChildren((elem as { children?: unknown[] }).children || [], sourceFile)
	const selfClosing = Boolean((elem as { selfClosing?: boolean }).selfClosing)

	return classifyElement({
		name,
		attrs,
		attrRecord,
		children,
		loc,
		sourceFile,
		selfClosing,
	})
}
function classifyElement({ name, attrs, attrRecord, children, loc, sourceFile, selfClosing }: { name: string | undefined; attrs: ReturnType<typeof attrsFromRecord>; attrRecord: Record<string, string>; children: WxmlNode[]; loc: { start: number; end: number } | null; sourceFile?: string; selfClosing: boolean }): WxmlNode {
	const common = { attrs, children, loc, span: loc, sourceFile, selfClosing } 
	if (name === 'include') {
		return createInclude({ ...common, src: attrRecord.src })
	}
	if (name === 'import') {
		return createImport({ ...common, src: attrRecord.src })
	}
	if (name === 'wxs') {
		return createWxs({ ...common, module: attrRecord.module, src: attrRecord.src, tagName: 'wxs' })
	}
	if (name === 'slot') {
		return createSlot({ ...common, name: attrRecord.name })
	}
	if (name === 'template') {
		if (typeof attrRecord.name === 'string' && attrRecord.name) {
			return createTemplateDef({ ...common, name: attrRecord.name })
		}
		if (typeof attrRecord.is === 'string' && attrRecord.is) {
			return createTemplateRef({ ...common, is: attrRecord.is })
		}
		// 无法判别时仍以 template-def 空名保留（少见）
		return createTemplateDef({ ...common, name: attrRecord.name || '' })
	}
	return createElement({
		name,
		attrs,
		children,
		loc,
		sourceFile,
		selfClosing,
		directives: [],
		slot: null,
	})
}
function elementAttrs(elem: unknown): Record<string, string> {
	const attrs: Record<string, string> = {}
	const attribs = (elem as { attribs?: Record<string, string> }).attribs
	if (attribs) {
		for (const [key, value] of Object.entries(attribs)) {
			attrs[key] = value
		}
	}
	return attrs
}

/** htmlparser2 startIndex/endIndex（闭）→ 半开 loc/span */
function nodeLoc(elem: unknown): { start: number; end: number } | null {
	const start = typeof (elem as { startIndex?: number }).startIndex === 'number' ? (elem as { startIndex?: number }).startIndex! : null
	const end = typeof (elem as { endIndex?: number }).endIndex === 'number' ? (elem as { endIndex?: number }).endIndex! + 1 : null
	if (start === null || end === null) {
		return null
	}
	return { start, end }
}
