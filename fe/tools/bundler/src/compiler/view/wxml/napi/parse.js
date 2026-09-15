/**
 * napi SpanView → 标准 Document（fe-tools-wxml-refactor · W3）。
 *
 * 直接递归构造 technical-design §2 形状；不做第二套 AST / shape adapter。
 * SpanView span 为 UTF-8 byte 半开偏移；Document loc/span 转为 JS 字符串索引
 *（与 cheerio / deriveLineColumn 对齐）。开标签属性按源码序写入 attrs。
 */
import { parseWxmlSpanView } from '@dimina/wxml-parser-napi'
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
	makeAttr,
	makeValue,
} from '../common/document.js'
import { bindDocument } from '../common/document-ops.js'

/**
 * @param {string} source
 * @param {{ sourceFile?: string }} [options]
 * @returns {import('../common/document.js').WxmlDocument}
 */
export function parseWxml(source, options = {}) {
	const { sourceFile } = options
	if (typeof source !== 'string') {
		throw new TypeError(`[wxml] parse: source must be a string${sourceFile ? ` (sourceFile=${sourceFile})` : ''}`)
	}
	const view = parseWxmlSpanView(source, sourceFile)
	const ctx = createSourceContext(source)
	const body = fromNodeList(view.body || [], ctx, sourceFile, 0, ctx.buf.length)
	const document = createDocument({
		body,
		sourceFile: view.sourceFile ?? sourceFile,
		span: toCharSpan(ctx, view.span),
	})
	bindDocument(document)
	return document
}

/**
 * SpanView Document → 标准 Document（供测例直接对拍）。
 * @param {object} view
 * @param {string} [source]
 */
export function documentFromSpanView(view, source = '') {
	const sourceFile = view?.sourceFile
	const ctx = createSourceContext(source)
	const body = fromNodeList(view?.body || [], ctx, sourceFile, 0, ctx.buf.length)
	const document = createDocument({
		body,
		sourceFile,
		span: toCharSpan(ctx, view?.span),
	})
	bindDocument(document)
	return document
}

/** @typedef {{ source: string, buf: Buffer, byteToChar: Int32Array }} SourceContext */

function createSourceContext(source) {
	const buf = Buffer.from(source, 'utf8')
	const byteToChar = new Int32Array(buf.length + 1)
	let charIndex = 0
	let byteIndex = 0
	while (byteIndex < buf.length) {
		byteToChar[byteIndex] = charIndex
		const lead = buf[byteIndex]
		let byteLen = 1
		if (lead >= 0xf0) {
			byteLen = 4
		}
		else if (lead >= 0xe0) {
			byteLen = 3
		}
		else if (lead >= 0xc0) {
			byteLen = 2
		}
		// UTF-16: BMP = 1 code unit；补充平面 = surrogate pair
		charIndex += byteLen === 4 ? 2 : 1
		byteIndex += byteLen
	}
	byteToChar[buf.length] = charIndex
	return { source, buf, byteToChar }
}

function toCharSpan(ctx, span) {
	if (!span || typeof span.start !== 'number' || typeof span.end !== 'number') {
		return null
	}
	const start = ctx.byteToChar[span.start]
	const end = ctx.byteToChar[span.end]
	if (typeof start !== 'number' || typeof end !== 'number') {
		return null
	}
	return { start, end }
}

function sliceBytes(ctx, span) {
	if (!span || typeof span.start !== 'number' || typeof span.end !== 'number') {
		return ''
	}
	return ctx.buf.subarray(span.start, span.end).toString('utf8')
}

function fromNodeList(nodes, ctx, sourceFile, rangeStart, rangeEnd) {
	const out = []
	let cursor = typeof rangeStart === 'number' ? rangeStart : 0
	const endLimit = typeof rangeEnd === 'number' ? rangeEnd : ctx.buf.length
	for (const node of nodes || []) {
		const span = node?.span
		if (span && typeof span.start === 'number' && span.start > cursor) {
			const gap = sliceBytes(ctx, { start: cursor, end: span.start })
			if (gap !== '') {
				out.push(createTextNode({
					value: gap,
					loc: toCharSpan(ctx, { start: cursor, end: span.start }),
					sourceFile,
				}))
			}
		}
		const converted = fromSpanNode(node, ctx, sourceFile)
		if (converted) {
			out.push(converted)
		}
		if (span && typeof span.end === 'number') {
			cursor = span.end
		}
	}
	if (cursor < endLimit) {
		const gap = sliceBytes(ctx, { start: cursor, end: endLimit })
		if (gap !== '') {
			out.push(createTextNode({
				value: gap,
				loc: toCharSpan(ctx, { start: cursor, end: endLimit }),
				sourceFile,
			}))
		}
	}
	return out.filter(n => !(n.type === 'text' && n.value === ''))
}

function fromSpanNode(node, ctx, sourceFile) {
	if (!node || typeof node !== 'object') {
		return null
	}
	switch (node.type) {
		case 'text':
			return fromText(node, ctx, sourceFile)
		case 'comment':
			return createCommentNode({
				value: node.text ?? node.value ?? '',
				loc: toCharSpan(ctx, node.span),
				sourceFile,
			})
		case 'element':
			return fromElement(node, ctx, sourceFile)
		case 'include':
			return fromInclude(node, ctx, sourceFile)
		case 'import':
			return fromImport(node, ctx, sourceFile)
		case 'wxs':
			return fromWxs(node, ctx, sourceFile)
		case 'templateDef':
		case 'template-def':
			return fromTemplateDef(node, ctx, sourceFile)
		case 'templateRef':
		case 'template-ref':
			return fromTemplateRef(node, ctx, sourceFile)
		case 'slot':
			return fromSlot(node, ctx, sourceFile)
		default:
			throw new Error(`[wxml] napi: unknown SpanView type=${node.type}${sourceFile ? ` sourceFile=${sourceFile}` : ''}`)
	}
}

function fromText(node, ctx, sourceFile) {
	const span = node.span
	const value = textContent(node, ctx)
	if (value === '') {
		return null
	}
	return createTextNode({ value, loc: toCharSpan(ctx, span), sourceFile })
}

function textContent(node, ctx) {
	if (node.span && ctx?.buf) {
		return sliceBytes(ctx, node.span)
	}
	const v = node.value
	if (typeof v === 'string') {
		return v
	}
	if (!v || typeof v !== 'object') {
		return node.raw ?? ''
	}
	if (v.kind === 'expr') {
		const raw = v.raw ?? ''
		return raw.includes('{{') ? raw : `{{${raw}}}`
	}
	return v.raw ?? v.value ?? node.raw ?? ''
}

function fromElement(node, ctx, sourceFile) {
	const span = node.span
	const attrs = attrsFromOpeningTag(ctx, span) ?? convertSpanAttrs(node.attrs, ctx)
	const childRangeStart = openingTagEndByte(ctx, span) ?? span?.start
	const childRangeEnd = closingTagStartByte(ctx, span, node.selfClosing) ?? span?.end
	const children = fromNodeList(node.children || [], ctx, sourceFile, childRangeStart, childRangeEnd)
	const directives = convertDirectives(node.directives, ctx)
	const slot = convertSlot(node.slot, ctx)
	return createElement({
		name: node.name,
		attrs,
		children,
		loc: toCharSpan(ctx, span),
		sourceFile,
		selfClosing: Boolean(node.selfClosing),
		directives,
		slot,
	})
}

function fromInclude(node, ctx, sourceFile) {
	const span = node.span
	const attrs = attrsFromOpeningTag(ctx, span) ?? attrsFromPathField(node.src, 'src', ctx)
	const src = pathFieldValue(node.src) ?? findAttrRaw(attrs, 'src')
	return createInclude({
		attrs,
		children: [],
		loc: toCharSpan(ctx, span),
		sourceFile,
		selfClosing: Boolean(node.selfClosing),
		src,
	})
}

function fromImport(node, ctx, sourceFile) {
	const span = node.span
	const attrs = attrsFromOpeningTag(ctx, span) ?? attrsFromPathField(node.src, 'src', ctx)
	const src = pathFieldValue(node.src) ?? findAttrRaw(attrs, 'src')
	return createImport({
		attrs,
		children: [],
		loc: toCharSpan(ctx, span),
		sourceFile,
		selfClosing: Boolean(node.selfClosing),
		src,
	})
}

function fromWxs(node, ctx, sourceFile) {
	const span = node.span
	const attrs = attrsFromOpeningTag(ctx, span) ?? [
		...attrsFromNamedField(node.module, 'module', ctx),
		...attrsFromPathField(node.src, 'src', ctx),
	]
	const children = []
	if (node.content?.raw) {
		children.push(createTextNode({
			value: node.content.raw,
			loc: toCharSpan(ctx, node.content.span),
			sourceFile,
		}))
	}
	return createWxs({
		attrs,
		children,
		loc: toCharSpan(ctx, span),
		sourceFile,
		selfClosing: Boolean(node.selfClosing),
		module: pathFieldValue(node.module) ?? findAttrRaw(attrs, 'module'),
		src: pathFieldValue(node.src) ?? findAttrRaw(attrs, 'src'),
		tagName: 'wxs',
	})
}

function fromTemplateDef(node, ctx, sourceFile) {
	const span = node.span
	const attrs = attrsFromOpeningTag(ctx, span) ?? attrsFromNamedField(node.name, 'name', ctx)
	const childRangeStart = openingTagEndByte(ctx, span) ?? span?.start
	const childRangeEnd = closingTagStartByte(ctx, span, node.selfClosing) ?? span?.end
	const children = fromNodeList(node.body || node.children || [], ctx, sourceFile, childRangeStart, childRangeEnd)
	const name = pathFieldValue(node.name) ?? findAttrRaw(attrs, 'name') ?? ''
	return createTemplateDef({
		attrs,
		children,
		loc: toCharSpan(ctx, span),
		sourceFile,
		selfClosing: Boolean(node.selfClosing),
		name,
	})
}

function fromTemplateRef(node, ctx, sourceFile) {
	const span = node.span
	const attrs = attrsFromOpeningTag(ctx, span) ?? [
		...attrsFromValueField(node.target, 'is', ctx),
		...(node.data ? [makeAttr('data', dataAttrRaw(node.data), toCharSpan(ctx, node.data.span))] : []),
	]
	const is = valueFieldRaw(node.target) ?? findAttrRaw(attrs, 'is') ?? ''
	return createTemplateRef({
		attrs,
		children: [],
		loc: toCharSpan(ctx, span),
		sourceFile,
		selfClosing: Boolean(node.selfClosing),
		is,
	})
}

function fromSlot(node, ctx, sourceFile) {
	const span = node.span
	const attrs = attrsFromOpeningTag(ctx, span) ?? attrsFromNamedField(node.name, 'name', ctx)
	const childRangeStart = openingTagEndByte(ctx, span) ?? span?.start
	const childRangeEnd = closingTagStartByte(ctx, span, node.selfClosing) ?? span?.end
	const children = fromNodeList(node.children || [], ctx, sourceFile, childRangeStart, childRangeEnd)
	const directives = convertDirectives(node.directives, ctx)
	const name = pathFieldValue(node.name) ?? findAttrRaw(attrs, 'name')
	const slotNode = createSlot({
		attrs,
		children,
		loc: toCharSpan(ctx, span),
		sourceFile,
		selfClosing: Boolean(node.selfClosing),
		name,
	})
	slotNode.directives = directives
	return slotNode
}

/** 开标签结束字节（`>` 之后） */
function openingTagEndByte(ctx, span) {
	if (!ctx?.buf || !span || typeof span.start !== 'number') {
		return null
	}
	const buf = ctx.buf
	let i = span.start
	if (buf[i] !== 0x3c) {
		return null
	}
	i += 1
	while (i < buf.length && i < span.end) {
		if (buf[i] === 0x3e /* > */) {
			return i + 1
		}
		if (buf[i] === 0x22 || buf[i] === 0x27) {
			const q = buf[i]
			i += 1
			while (i < buf.length && buf[i] !== q) {
				i += 1
			}
		}
		i += 1
	}
	return null
}

/** 闭标签起始字节；自闭合则返回 span.end */
function closingTagStartByte(ctx, span, selfClosing) {
	if (!span || typeof span.end !== 'number') {
		return null
	}
	if (selfClosing) {
		return span.end
	}
	if (!ctx?.buf) {
		return null
	}
	const buf = ctx.buf
	// 从末尾回找 </
	let i = span.end - 1
	while (i > span.start) {
		if (buf[i] === 0x3e /* > */) {
			// 向前找 <
			let j = i
			while (j > span.start && buf[j] !== 0x3c) {
				j -= 1
			}
			if (buf[j] === 0x3c && buf[j + 1] === 0x2f) {
				return j
			}
			break
		}
		i -= 1
	}
	return span.end
}

function convertSpanAttrs(attrs, ctx) {
	if (!Array.isArray(attrs)) {
		return []
	}
	return attrs.map((attr) => {
		const span = toCharSpan(ctx, attr.span)
		if (attr.value == null) {
			return makeAttr(attr.name, '', span)
		}
		const value = convertValue(attr.value, ctx)
		return { span, name: attr.name, value }
	})
}

function convertValue(v, ctx) {
	if (!v || typeof v !== 'object') {
		return makeValue(v == null ? '' : String(v))
	}
	const span = toCharSpan(ctx, v.span)
	if (v.kind === 'static') {
		return { kind: 'static', raw: v.raw ?? v.value ?? '', span }
	}
	if (v.kind === 'expr') {
		const raw = v.raw ?? ''
		const withBraces = raw.includes('{{') ? raw : `{{${raw}}}`
		return { kind: 'expr', raw: withBraces, span }
	}
	if (v.kind === 'template') {
		return {
			kind: 'template',
			raw: v.raw ?? '',
			span,
			parts: Array.isArray(v.parts) ? v.parts.map(p => convertTemplatePart(p, ctx)) : undefined,
		}
	}
	return makeValue(v.raw ?? '', span)
}

function convertTemplatePart(part, ctx) {
	if (!part) {
		return part
	}
	const span = toCharSpan(ctx, part.span)
	if (part.kind === 'expr') {
		return { kind: 'expr', raw: part.raw ?? '', span }
	}
	return { kind: 'static', raw: part.raw ?? part.value ?? '', span, value: part.value }
}

function convertDirectives(dirs, ctx) {
	if (!Array.isArray(dirs)) {
		return []
	}
	return dirs.map((d) => {
		const out = {
			kind: d.kind,
			span: toCharSpan(ctx, d.span),
			test: d.test
				? { raw: d.test.raw, span: toCharSpan(ctx, d.test.span) }
				: null,
		}
		if (d.item !== undefined) {
			out.item = d.item
		}
		if (d.index !== undefined) {
			out.index = d.index
		}
		if (d.value !== undefined) {
			out.value = d.value
		}
		return out
	})
}

function convertSlot(slot, ctx) {
	if (!slot) {
		return null
	}
	return {
		name: typeof slot.name === 'string' ? slot.name : slot.name?.value ?? slot.name?.raw ?? null,
		span: toCharSpan(ctx, slot.span),
	}
}

/**
 * 从源码开标签解析属性（byte 扫描；保序；含 wx:* / hidden）。
 * @param {SourceContext} ctx
 * @param {{start:number,end:number}|null} span byte span
 * @returns {import('../common/document.js').Attr[]|null}
 */
export function attrsFromOpeningTag(ctx, span) {
	if (!ctx?.buf || !span || typeof span.start !== 'number') {
		return null
	}
	const buf = ctx.buf
	let i = span.start
	if (buf[i] !== 0x3c /* < */) {
		return null
	}
	i += 1
	while (i < buf.length && isNameByte(buf[i])) {
		i += 1
	}
	const attrs = []
	while (i < buf.length) {
		while (i < buf.length && isSpaceByte(buf[i])) {
			i += 1
		}
		if (i >= buf.length) {
			break
		}
		if (buf[i] === 0x3e /* > */) {
			break
		}
		if (buf[i] === 0x2f /* / */ && buf[i + 1] === 0x3e /* > */) {
			break
		}
		const nameStart = i
		while (i < buf.length && isAttrNameByte(buf[i])) {
			i += 1
		}
		if (i === nameStart) {
			break
		}
		const name = buf.subarray(nameStart, i).toString('utf8')
		const attrSpanStart = nameStart
		while (i < buf.length && isSpaceByte(buf[i])) {
			i += 1
		}
		let rawValue = ''
		if (buf[i] === 0x3d /* = */) {
			i += 1
			while (i < buf.length && isSpaceByte(buf[i])) {
				i += 1
			}
			if (buf[i] === 0x22 /* " */ || buf[i] === 0x27 /* ' */) {
				const q = buf[i]
				i += 1
				const valueStart = i
				while (i < buf.length && buf[i] !== q) {
					i += 1
				}
				rawValue = buf.subarray(valueStart, i).toString('utf8')
				if (buf[i] === q) {
					i += 1
				}
			}
			else {
				const valueStart = i
				while (i < buf.length && !isSpaceByte(buf[i]) && buf[i] !== 0x3e && buf[i] !== 0x2f) {
					i += 1
				}
				rawValue = buf.subarray(valueStart, i).toString('utf8')
			}
		}
		attrs.push(makeAttr(name, rawValue, {
			start: ctx.byteToChar[attrSpanStart],
			end: ctx.byteToChar[i],
		}))
	}
	return attrs
}

function isNameByte(b) {
	return (b >= 0x41 && b <= 0x5a)
		|| (b >= 0x61 && b <= 0x7a)
		|| (b >= 0x30 && b <= 0x39)
		|| b === 0x5f
		|| b === 0x2d
}

function isAttrNameByte(b) {
	return isNameByte(b) || b === 0x3a /* : */ || b === 0x40 /* @ */ || b === 0x2e /* . */
}

function isSpaceByte(b) {
	return b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09
}

function attrsFromPathField(field, name, ctx) {
	const value = pathFieldValue(field)
	if (value == null || value === '') {
		return []
	}
	return [makeAttr(name, value, toCharSpan(ctx, field?.span))]
}

function attrsFromNamedField(field, name, ctx) {
	return attrsFromPathField(field, name, ctx)
}

function attrsFromValueField(field, name, ctx) {
	const raw = valueFieldRaw(field)
	if (raw == null || raw === '') {
		return []
	}
	return [makeAttr(name, raw, toCharSpan(ctx, field?.span))]
}

function pathFieldValue(field) {
	if (field == null) {
		return null
	}
	if (typeof field === 'string') {
		return field
	}
	return field.value ?? field.raw ?? null
}

function valueFieldRaw(field) {
	if (field == null) {
		return null
	}
	if (typeof field === 'string') {
		return field
	}
	if (field.kind === 'expr') {
		const raw = field.raw ?? ''
		return raw.includes('{{') ? raw : `{{${raw}}}`
	}
	return field.value ?? field.raw ?? null
}

function dataAttrRaw(data) {
	if (!data) {
		return ''
	}
	const raw = data.raw ?? ''
	return raw.includes('{{') ? raw : `{{${raw}}}`
}

function findAttrRaw(attrs, name) {
	const found = attrs.find(a => a.name === name)
	if (!found) {
		return undefined
	}
	if (found.value == null) {
		return ''
	}
	return typeof found.value === 'string' ? found.value : found.value.raw
}
