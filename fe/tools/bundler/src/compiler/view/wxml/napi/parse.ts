/**
 * napi SpanView → 标准 Document（fe-tools-wxml-refactor · W3）。
 *
 * 直接递归构造 technical-design §2 形状；不做第二套 AST / shape adapter。
 * SpanView span 为 UTF-8 byte 半开偏移；Document loc/span 转为 JS 字符串索引
 *（与 cheerio / deriveLineColumn 对齐）。开标签属性按源码序写入 attrs。
 */
import { parseWxmlSpanView } from '@dimina/wxml-parser-napi'
import type { WxmlDocument } from '../common/wxml-ir.types.ts'
import type { WxmlNode, Attr, Span, Value } from '../common/document.ts'
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
} from '../common/document.ts'
import { bindDocument } from '../common/document-ops.ts'

/**
 * @param {string} source
 * @param {{ sourceFile?: string }} [options]
 * @returns {WxmlDocument}
 */
export function parseWxml(source: string, options: { sourceFile?: string } = {}): WxmlDocument {
	const { sourceFile } = options
	if (typeof source !== 'string') {
		throw new TypeError(`[wxml] parse: source must be a string${sourceFile ? ` (sourceFile=${sourceFile})` : ''}`)
	}
	const view = parseWxmlSpanView(source, sourceFile) as unknown as SpanView
	const ctx = createSourceContext(source)
	const body = fromNodeList(view.body || [], ctx, sourceFile, 0, ctx.buf.length)
	const document = createDocument({
		body,
		sourceFile: view.sourceFile ?? sourceFile,
		span: toCharSpan(ctx, view.span),
	})
	bindDocument(document)
	return document as WxmlDocument
}

/**
 * SpanView Document → 标准 Document（供测例直接对拍）。
 * @param {object} view
 * @param {string} [source]
 */
export function documentFromSpanView(view: SpanView | null | undefined, source: string = ''): WxmlDocument {
	const sourceFile = view?.sourceFile
	const ctx = createSourceContext(source)
	const body = fromNodeList(view?.body || [], ctx, sourceFile, 0, ctx.buf.length)
	const document = createDocument({
		body,
		sourceFile,
		span: toCharSpan(ctx, view?.span),
	})
	bindDocument(document)
	return document as WxmlDocument
}

interface ByteSpan { start: number; end: number }
interface SpanViewAttr { name: string; value: { raw?: string | null } | null; span?: ByteSpan | null }
interface SpanViewNode {
	type: string
	tag?: string
	name?: string
	src?: string | null
	module?: string | null
	is?: string
	attrs?: SpanViewAttr[]
	children?: SpanViewNode[]
	body?: SpanViewNode[]
	span?: ByteSpan | null
	value?: string | null
	directives?: unknown[]
	slot?: { name?: string | null; span?: ByteSpan | null } | null
	selfClosing?: boolean
	[key: string]: unknown
}
interface SpanView {
	body?: SpanViewNode[]
	span?: ByteSpan | null
	sourceFile?: string | null
}
export interface SourceContext {
	source: string
	buf: Buffer
	byteToChar: Int32Array
}

function createSourceContext(source: string): SourceContext {
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

function toCharSpan(ctx: SourceContext, span: ByteSpan | null | undefined): null | Span {
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

function sliceBytes(ctx: SourceContext, span: ByteSpan | null | undefined): string {
	if (!span || typeof span.start !== 'number' || typeof span.end !== 'number') {
		return ''
	}
	return ctx.buf.subarray(span.start, span.end).toString('utf8')
}

function fromNodeList(nodes: SpanViewNode[] | null | undefined, ctx: SourceContext, sourceFile: string | null | undefined, rangeStart: number, rangeEnd: number): WxmlNode[] {
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

function fromSpanNode(node: SpanViewNode | null | undefined, ctx: SourceContext, sourceFile: string | null | undefined): WxmlNode | null {
	if (!node || typeof node !== 'object') {
		return null
	}
	switch (node.type) {
		case 'text':
			return fromText(node, ctx, sourceFile)
		case 'comment':
			return createCommentNode({
				value: String((node as Record<string, unknown>).text ?? node.value ?? ''),
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

function fromText(node: SpanViewNode, ctx: SourceContext, sourceFile: string | null | undefined): WxmlNode | null {
	const span = node.span ?? null
	const value = textContent(node, ctx)
	if (value === '') {
		return null
	}
	return createTextNode({ value, loc: toCharSpan(ctx, span), sourceFile })
}

function textContent(node: SpanViewNode, ctx: SourceContext): string {
	if (node.span && ctx?.buf) {
		return sliceBytes(ctx, node.span)
	}
	const v = node.value
	if (typeof v === 'string') {
		return String(v ?? '')
	}
	if (!v || typeof v !== 'object') {
		return (node as { raw?: string | null }).raw ?? ''
	}
	if ((v as { kind?: string }).kind === 'expr') {
		const raw = (v as { raw?: string | null })?.raw ?? ''
		return raw.includes('{{') ? raw : `{{${raw}}}`
	}
	return (v as { raw?: string | null })?.raw ?? (v as { value?: string | null })?.value ?? (node as { raw?: string | null }).raw ?? ''
}

function fromElement(node: SpanViewNode, ctx: SourceContext, sourceFile: string | null | undefined): WxmlNode {
	const span = node.span ?? null
	const attrs = attrsFromOpeningTag(ctx, span) ?? convertSpanAttrs(node.attrs, ctx)
	const childRangeStart = openingTagEndByte(ctx, span) ?? (span?.start ?? 0)
	const childRangeEnd = closingTagStartByte(ctx, span, node.selfClosing) ?? (span?.end ?? 0)
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
		slot: slot as unknown as null | string,
	})
}

function fromInclude(node: SpanViewNode, ctx: SourceContext, sourceFile: string | null | undefined): WxmlNode {
	const span = node.span ?? null
	const attrs = attrsFromOpeningTag(ctx, span) ?? attrsFromPathField((node.src ?? '') as string, 'src', ctx)
	const src = pathFieldValue(node.src ?? '') ?? findAttrRaw(attrs as Attr[], 'src')
	return createInclude({
		attrs,
		children: [],
		loc: toCharSpan(ctx, span),
		sourceFile,
		selfClosing: Boolean(node.selfClosing),
		src,
	})
}

function fromImport(node: SpanViewNode, ctx: SourceContext, sourceFile: string | null | undefined): WxmlNode {
	const span = node.span ?? null
	const attrs = attrsFromOpeningTag(ctx, span) ?? attrsFromPathField((node.src ?? '') as string, 'src', ctx)
	const src = pathFieldValue(node.src ?? '') ?? findAttrRaw(attrs as Attr[], 'src')
	return createImport({
		attrs,
		children: [],
		loc: toCharSpan(ctx, span),
		sourceFile,
		selfClosing: Boolean(node.selfClosing),
		src,
	})
}

function fromWxs(node: SpanViewNode, ctx: SourceContext, sourceFile: string | null | undefined): WxmlNode {
	const span = node.span ?? null
	const attrs = attrsFromOpeningTag(ctx, span) ?? [
		...attrsFromNamedField((node.module ?? '') as string, 'module', ctx),
		...attrsFromPathField((node.src ?? '') as string, 'src', ctx),
	]
	const children = []
	if ((node.content as { raw?: string | null } | null)?.raw) {
		children.push(createTextNode({
			value: (node.content as { raw?: string | null } | null)?.raw ?? '',
			loc: toCharSpan(ctx, (node.content as { span?: ByteSpan | null } | null)?.span),
			sourceFile,
		}))
	}
	return createWxs({
		attrs,
		children,
		loc: toCharSpan(ctx, span),
		sourceFile,
		selfClosing: Boolean(node.selfClosing),
		module: pathFieldValue(node.module) ?? findAttrRaw(attrs as Attr[], 'module'),
		src: pathFieldValue(node.src ?? '') ?? findAttrRaw(attrs as Attr[], 'src'),
		tagName: 'wxs',
	})
}

function fromTemplateDef(node: SpanViewNode, ctx: SourceContext, sourceFile: string | null | undefined): WxmlNode {
	const span = node.span ?? null
	const attrs = attrsFromOpeningTag(ctx, span) ?? attrsFromNamedField((node.name ?? '') as string, 'name', ctx)
	const childRangeStart = openingTagEndByte(ctx, span) ?? (span?.start ?? 0)
	const childRangeEnd = closingTagStartByte(ctx, span, node.selfClosing) ?? (span?.end ?? 0)
	const children = fromNodeList(node.body || node.children || [], ctx, sourceFile, childRangeStart, childRangeEnd)
	const name = pathFieldValue(node.name) ?? findAttrRaw(attrs as Attr[], 'name') ?? ''
	return createTemplateDef({
		attrs,
		children,
		loc: toCharSpan(ctx, span),
		sourceFile,
		selfClosing: Boolean(node.selfClosing),
		name,
	})
}

function fromTemplateRef(node: SpanViewNode, ctx: SourceContext, sourceFile: string | null | undefined): WxmlNode {
	const span = node.span ?? null
	const attrs = attrsFromOpeningTag(ctx, span) ?? [
		...attrsFromValueField((node.target ?? '') as string, 'is', ctx),
		...(node.data ? [makeAttr('data', dataAttrRaw(node.data), toCharSpan(ctx, (node.data as { span?: ByteSpan | null } | null)?.span))] : []),
	]
	const is = valueFieldRaw(node.target) ?? findAttrRaw(attrs as Attr[], 'is') ?? ''
	return createTemplateRef({
		attrs,
		children: [],
		loc: toCharSpan(ctx, span),
		sourceFile,
		selfClosing: Boolean(node.selfClosing),
		is,
	})
}

function fromSlot(node: SpanViewNode, ctx: SourceContext, sourceFile: string | null | undefined): WxmlNode {
	const span = node.span ?? null
	const attrs = attrsFromOpeningTag(ctx, span) ?? attrsFromNamedField((node.name ?? '') as string, 'name', ctx)
	const childRangeStart = openingTagEndByte(ctx, span) ?? (span?.start ?? 0)
	const childRangeEnd = closingTagStartByte(ctx, span, node.selfClosing) ?? (span?.end ?? 0)
	const children = fromNodeList(node.children || [], ctx, sourceFile, childRangeStart, childRangeEnd)
	const directives = convertDirectives(node.directives, ctx)
	const name = pathFieldValue(node.name) ?? findAttrRaw(attrs as Attr[], 'name')
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
function openingTagEndByte(ctx: SourceContext, span: ByteSpan | null | undefined): number {
	if (!ctx?.buf || !span || typeof span.start !== 'number') {
		return 0
	}
	const buf = ctx.buf
	let i = span.start
	if (buf[i] !== 0x3c) {
		return 0
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
	return 0
}

/** 闭标签起始字节；自闭合则返回 span.end */
function closingTagStartByte(ctx: SourceContext, span: ByteSpan | null | undefined, selfClosing: boolean | undefined): number {
	if (!span || typeof span.end !== 'number') {
		return 0
	}
	if (selfClosing ?? false) {
		return span.end
	}
	if (!ctx?.buf) {
		return 0
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

function convertSpanAttrs(attrs: SpanViewAttr[] | null | undefined, ctx: SourceContext): Attr[] {
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

function convertValue(v: { raw?: string | null; span?: ByteSpan | null; kind?: string; value?: { raw?: string | null } | null; parts?: unknown[] } | null | undefined, ctx: SourceContext): Value {
	if (!v || typeof v !== 'object') {
		return makeValue(v == null ? '' : String(v))
	}
	const span = toCharSpan(ctx, v.span)
	if (v.kind === 'static') {
		return { kind: 'static', raw: (v as { raw?: string | null })?.raw ?? String((v as { value?: { raw?: string | null } | null })?.value ?? ''), span }
	}
	if ((v as { kind?: string }).kind === 'expr') {
		const raw = (v as { raw?: string | null })?.raw ?? ''
		const withBraces = raw.includes('{{') ? raw : `{{${raw}}}`
		return { kind: 'expr', raw: withBraces, span }
	}
	if (v.kind === 'template') {
		return {
			kind: 'template',
			raw: (v as { raw?: string | null })?.raw ?? '',
			span,
			parts: Array.isArray(v.parts) ? v.parts.map(p => convertTemplatePart(p, ctx)) : undefined,
		}
	}
	return makeValue((v as { raw?: string | null })?.raw ?? '', span)
}

function convertTemplatePart(part: unknown, ctx: SourceContext): unknown {
	if (!part) {
		return part
	}
	const span = toCharSpan(ctx, (part as { span?: ByteSpan | null } | null)?.span)
	if ((part as { kind?: string }).kind === 'expr') {
		return { kind: 'expr', raw: (part as { raw?: string | null }).raw ?? '', span }
	}
	return { kind: 'static', raw: (part as { raw?: string | null }).raw ?? String((part as { value?: unknown }).value ?? ''), span, value: (part as { value?: unknown }).value }
}

function convertDirectives(dirs: unknown[] | null | undefined, ctx: SourceContext): unknown[] {
	if (!Array.isArray(dirs)) {
		return []
	}
	return dirs.map((d: unknown) => {
		const dd = d as { kind?: string; span?: ByteSpan | null; test?: { raw?: string | null; span?: ByteSpan | null } | null; item?: unknown; index?: unknown; value?: unknown }
		const out: Record<string, unknown> = {
			kind: dd.kind,
			span: toCharSpan(ctx, dd.span),
			test: dd.test
				? { raw: dd.test?.raw, span: toCharSpan(ctx, dd.test?.span) }
				: null,
		}
		if (dd.item !== undefined) {
			out.item = dd.item
		}
		if (dd.index !== undefined) {
			out.index = dd.index
		}
		if (dd.value !== undefined) {
			out.value = dd.value
		}
		return out
	})
}

function convertSlot(slot: SpanViewNode['slot'] | null | undefined, ctx: SourceContext): { name: string | null; span: Span | null } | null {
	if (!slot) {
		return null
	}
	return {
		name: typeof slot.name === 'string' ? slot.name : (slot.name as { value?: string | null; raw?: string | null } | null)?.value ?? (slot.name as { value?: string | null; raw?: string | null } | null)?.raw ?? null,
		span: toCharSpan(ctx, slot.span),
	}
}

/**
 * 从源码开标签解析属性（byte 扫描；保序；含 wx:* / hidden）。
 * @param {SourceContext} ctx
 * @param {{start:number,end:number}|null} span byte span
 * @returns {Attr[] | null}
 */
export function attrsFromOpeningTag(ctx: SourceContext, span: ByteSpan | null): Attr[] | null {
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
	return attrs as Attr[]
}

function isNameByte(b: number): boolean {
	return (b >= 0x41 && b <= 0x5a)
		|| (b >= 0x61 && b <= 0x7a)
		|| (b >= 0x30 && b <= 0x39)
		|| b === 0x5f
		|| b === 0x2d
}

function isAttrNameByte(b: number): boolean {
	return isNameByte(b) || b === 0x3a /* : */ || b === 0x40 /* @ */ || b === 0x2e /* . */
}

function isSpaceByte(b: number): boolean {
	return b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09
}

function attrsFromPathField(field: string, name: string, ctx: SourceContext): Attr[] {
	const value = pathFieldValue(field)
	if (value == null || value === '') {
		return []
	}
	return [makeAttr(name, value, toCharSpan(ctx, (field as { span?: ByteSpan | null })?.span))]
}

function attrsFromNamedField(field: string, name: string, ctx: SourceContext): Attr[] {
	return attrsFromPathField(field, name, ctx)
}

function attrsFromValueField(field: unknown, name: string, ctx: SourceContext): Attr[] {
	const raw = valueFieldRaw(field)
	if (raw == null || raw === '') {
		return []
	}
	return [makeAttr(name, raw, toCharSpan(ctx, (field as { span?: ByteSpan | null })?.span))]
}

function pathFieldValue(field: unknown): string {
	if (field == null) {
		return ''
	}
	if (typeof field === 'string') {
		return field
	}
	return (field as { value?: string | null; raw?: string | null })?.value ?? (field as { raw?: string | null })?.raw ?? ''
}

function valueFieldRaw(field: unknown): string {
	if (field == null) {
		return ''
	}
	if (typeof field === 'string') {
		return field
	}
	if ((field as { kind?: string }).kind === 'expr') {
		const raw = (field as { raw?: string | null }).raw ?? ''
		return raw.includes('{{') ? raw : `{{${raw}}}`
	}
	return (field as { value?: string | null; raw?: string | null })?.value ?? (field as { raw?: string | null })?.raw ?? ''
}

function dataAttrRaw(data: unknown): string {
	if (!data) {
		return ''
	}
	const raw = (data as { raw?: string | null })?.raw ?? ''
	return raw.includes('{{') ? raw : `{{${raw}}}`
}

function findAttrRaw(attrs: Attr[], name: string): string | undefined {
	const found = attrs.find((a: Attr) => a.name === name)
	if (!found) {
		return undefined
	}
	if ((found as Attr).value == null) {
		return ''
	}
	return typeof found.value === 'string' ? found.value : (found.value?.raw ?? '')
}
