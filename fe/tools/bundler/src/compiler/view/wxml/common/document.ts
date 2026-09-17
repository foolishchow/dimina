/**
 * WXML Document — 标准 IR 节点约定（fe-tools-wxml-refactor · W2）。
 *
 * 真源：docs/wxml/WXML-AST-TYPES.md + technical-design §2。
 * 契约字段始终存在；null = parser 暂不可提供；[] = 空集合。
 * cheerio 仅作 parse 投影工具，不得经 Document 向 load/renderer/tools 泄漏。
 */

export interface Span {
	start: number
	end: number
}

export interface Document {
	span?: null | Span
	body: object[]
	sourceFile?: null | string
	_source?: string
}

export interface Value {
	kind: 'static' | 'expr' | 'template'
	raw: string
	span: null | Span
	parts?: unknown[]
}

export interface Attr {
	span: null | Span
	name: string
	value: null | Value
}

export type WxmlNode = {
	type: string
	span?: null | Span
	loc?: null | Span
	name?: null | string
	attrs?: Attr[]
	children?: WxmlNode[]
	directives?: unknown[]
	slot?: null | string
	selfClosing?: boolean
	sourceFile?: null | string
	value?: string
	body?: object[]
	module?: null | string
	src?: null | string
	is?: string
	[key: string]: unknown
}

export type ElementNode = WxmlNode & {
	type: 'element'
	name: string
	attrs: Attr[]
	children: WxmlNode[]
	directives: unknown[]
	slot: null | string
	selfClosing: boolean
}

export type CreateDocumentOpts = {
	body?: object[]
	sourceFile?: null | string
	span?: null | Span
}

export type CreateElementOpts = {
	name?: null | string
	attrs?: Attr[] | Record<string, unknown>
	children?: WxmlNode[]
	loc?: null | Span
	span?: null | Span
	sourceFile?: null | string
	selfClosing?: boolean
	directives?: unknown[]
	slot?: null | string
}

export type CreateTextNodeOpts = {
	value?: string
	loc?: null | Span
	span?: null | Span
	sourceFile?: null | string
}

export type CreateCommentNodeOpts = {
	value?: string
	loc?: null | Span
	span?: null | Span
	sourceFile?: null | string
}

export type BaseSpecialFieldsOpts = {
	attrs?: Attr[] | Record<string, unknown>
	children?: WxmlNode[]
	loc?: null | Span
	span?: null | Span
	sourceFile?: null | string
	selfClosing?: boolean
}

export type CreateSpecialOpts = BaseSpecialFieldsOpts & {
	src?: string
	module?: string
	tagName?: string
	name?: string
	is?: string
}

/** 特殊节点 type 枚举（语义判别用 type，不用 name-string） */
export const SPECIAL_NODE_TYPES = Object.freeze([
	'include',
	'import',
	'wxs',
	'template-def',
	'template-ref',
	'slot',
])

/** @deprecated 保留给旧测例；新代码用 SPECIAL_NODE_TYPES / node.type */
export const SPECIAL_NODE_NAMES = Object.freeze(['include', 'import', 'wxs', 'template'])

/**
 * @param {string|null|undefined} raw
 * @param {null|Span} [span]
 * @returns {Value}
 */
export function makeValue(raw: string | null | undefined, span: null | Span = null): Value {
	if (raw == null) {
		return { kind: 'static', raw: '', span }
	}
	const text = String(raw)
	if (text.includes('{{') && text.includes('}}')) {
		return { kind: 'expr', raw: text, span }
	}
	return { kind: 'static', raw: text, span }
}

/**
 * @param {string} name
 * @param {string|null|undefined} raw
 * @param {null|Span} [span]
 * @returns {Attr}
 */
export function makeAttr(name: string, raw: string | null | undefined, span: null | Span = null): Attr {
	if (raw == null) {
		return { span, name, value: null }
	}
	return { span, name, value: makeValue(raw, null) }
}

/**
 * Record / 元组列表 → Attr[] 
 * @param {any} record
 */
export function attrsFromRecord(record: Record<string, unknown> | null | undefined): Attr[] {
	if (!record || typeof record !== 'object') {
		return []
	}
	return Object.entries(record).map(([name, raw]) => makeAttr(name, raw as string | null | undefined))
}

/**
 * Attr[] → Record<string,string>（空值属性 → ''） 
 * @param {any} attrs
 */
export function attrsToRecord(attrs: Attr[] | Record<string, unknown> | null | undefined): Record<string, string> {
	if (!attrs) {
		return {}
	}
	if (!Array.isArray(attrs)) {
		return { ...attrs } as Record<string, string>
	}
	/** @type {Record<string, any>} */
	const out: Record<string, string> = {}
	for (const attr of attrs) {
		if (!attr || typeof attr.name !== 'string') {
			continue
		}
		out[attr.name] = attrValueRaw(attr)
	}
	return out
}

/**
 * @param {any} attr
 */
export function attrValueRaw(attr: Attr | null | undefined): string {
	if (!attr || attr.value == null) {
		return ''
	}
	if (typeof attr.value === 'string') {
		return attr.value
	}
	return attr.value.raw ?? ''
}

/**
 * @param {any} [arg]
 */
export function createDocument({ body, sourceFile, span }: CreateDocumentOpts = {}) {
	return {
		span: span ?? null,
		body: body || [],
		...(sourceFile !== undefined ? { sourceFile } : {}),
	}
}

/**
 * @param {any} [opts]
 */
export function createElement({
	name,
	attrs,
	children,
	loc,
	span,
	sourceFile,
	selfClosing = false,
	directives,
	slot = null,
}: CreateElementOpts = {}): ElementNode {
	const resolvedSpan = span ?? loc ?? null
	const attrList = Array.isArray(attrs) ? attrs : attrsFromRecord(attrs)
	return {
		type: 'element',
		span: resolvedSpan,
		loc: resolvedSpan,
		name: name ?? '',
		attrs: attrList,
		directives: directives || [],
		slot: slot ?? null,
		children: children || [],
		selfClosing: Boolean(selfClosing),
		...(sourceFile !== undefined ? { sourceFile } : {}),
	}
}

/**
 * @param {any} [arg]
 */
export function createTextNode({ value, loc, span, sourceFile }: CreateTextNodeOpts = {}): WxmlNode {
	const resolvedSpan = span ?? loc ?? null
	return {
		type: 'text',
		span: resolvedSpan,
		loc: resolvedSpan,
		value: value ?? '',
		...(sourceFile !== undefined ? { sourceFile } : {}),
	} as WxmlNode
}

/**
 * @param {any} [arg]
 */
export function createCommentNode({ value, loc, span, sourceFile }: CreateCommentNodeOpts = {}): WxmlNode {
	const resolvedSpan = span ?? loc ?? null
	return {
		type: 'comment',
		span: resolvedSpan,
		loc: resolvedSpan,
		value: value ?? '',
		...(sourceFile !== undefined ? { sourceFile } : {}),
	} as WxmlNode
}

/**
 * @param {any} arg
 */
function baseSpecialFields({ attrs, children, loc, span, sourceFile, selfClosing = false }: BaseSpecialFieldsOpts) {
	const resolvedSpan = span ?? loc ?? null
	const attrList = Array.isArray(attrs) ? attrs : attrsFromRecord(attrs)
	return {
		span: resolvedSpan,
		loc: resolvedSpan,
		attrs: attrList,
		directives: [],
		slot: null,
		children: children || [],
		selfClosing: Boolean(selfClosing),
		...(sourceFile !== undefined ? { sourceFile } : {}),
	}
}

/**
 * @param {any} [opts]
 */
export function createInclude(opts: CreateSpecialOpts = {}): WxmlNode {
	const base = baseSpecialFields(opts)
	const srcRaw = opts.src !== undefined ? opts.src : findAttrRaw(base.attrs, 'src')
	return {
		type: 'include',
		src: srcRaw == null || srcRaw === '' ? null : srcRaw,
		...base,
	}
}

/**
 * @param {any} [opts]
 */
export function createImport(opts: CreateSpecialOpts = {}): WxmlNode {
	const base = baseSpecialFields(opts)
	const srcRaw = opts.src !== undefined ? opts.src : findAttrRaw(base.attrs, 'src')
	return {
		type: 'import',
		src: srcRaw == null || srcRaw === '' ? null : srcRaw,
		...base,
	}
}

/**
 * @param {any} [opts]
 */
export function createWxs(opts: CreateSpecialOpts = {}): WxmlNode {
	const base = baseSpecialFields(opts)
	const moduleName = opts.module !== undefined ? opts.module : findAttrRaw(base.attrs, 'module')
	const srcRaw = opts.src !== undefined ? opts.src : findAttrRaw(base.attrs, 'src')
	return {
		type: 'wxs',
		name: opts.tagName || 'wxs',
		module: moduleName == null || moduleName === '' ? null : moduleName,
		src: srcRaw == null || srcRaw === '' ? null : srcRaw,
		...base,
	}
}

/**
 * @param {any} [opts]
 */
export function createTemplateDef(opts: CreateSpecialOpts = {}): WxmlNode {
	const base = baseSpecialFields(opts)
	const tplName = opts.name !== undefined ? opts.name : findAttrRaw(base.attrs, 'name')
	return {
		type: 'template-def',
		name: tplName || '',
		...base,
	}
}

/**
 * @param {any} [opts]
 */
export function createTemplateRef(opts: CreateSpecialOpts = {}): WxmlNode {
	const base = baseSpecialFields(opts)
	const isName = opts.is !== undefined ? opts.is : findAttrRaw(base.attrs, 'is')
	return {
		type: 'template-ref',
		name: 'template',
		is: isName || '',
		...base,
	}
}

/**
 * @param {any} [opts]
 */
export function createSlot(opts: CreateSpecialOpts = {}): WxmlNode {
	const base = baseSpecialFields(opts)
	const slotName = opts.name !== undefined ? opts.name : findAttrRaw(base.attrs, 'name')
	return {
		type: 'slot',
		name: slotName == null || slotName === '' ? null : slotName ?? null,
		...base,
	}
}

/**
 * @param {any} attrs
 * @param {any} name
 */
function findAttrRaw(attrs: Attr[] | Record<string, unknown> | null | undefined, name: string): string | undefined {
	if (!Array.isArray(attrs)) {
		return (attrs as Record<string, unknown>)?.[name] as string | undefined
	}
	const found = attrs.find(a => a.name === name)
	return found ? attrValueRaw(found) : undefined
}

/**
 * 隐藏非枚举字段（parent / 过渡句柄） 
 * @param {any} target
 * @param {any} key
 * @param {any} value
 */
export function attachProjection(target: object, key: string | symbol, value: unknown): void {
	Object.defineProperty(target, key, {
		value,
		enumerable: false,
		writable: true,
		configurable: true,
	})
}

/**
 * @param {any} node
 */
export function isElementLike(node: unknown): node is WxmlNode {
	if (!node || typeof node !== 'object') {
		return false
	}
	const wxmlNode = node as WxmlNode
	if (wxmlNode.type === 'element' || SPECIAL_NODE_TYPES.includes(wxmlNode.type)) {
		return true
	}
	return false
}

/**
 * 特殊节点判别（type 优先；兼容旧 element+name） 
 * @param {any} node
 */
export function isSpecialNode(node: WxmlNode | null | undefined): boolean {
	if (!node) {
		return false
	}
	if (SPECIAL_NODE_TYPES.includes(node.type)) {
		return true
	}
	return node.type === 'element' && node.name != null && SPECIAL_NODE_NAMES.includes(node.name)
}

/**
 * template 定义 vs 引用 
 * @param {any} node
 */
export function templateNodeKind(node: WxmlNode | null | undefined): 'template-def' | 'template-ref' | 'template' | null {
	if (!node) {
		return null
	}
	if (node.type === 'template-def') {
		return 'template-def'
	}
	if (node.type === 'template-ref') {
		return 'template-ref'
	}
	if (node.type !== 'element' || node.name !== 'template') {
		return null
	}
	const attrs = attrsToRecord(node.attrs)
	if (typeof attrs.name === 'string' && attrs.name) {
		return 'template-def'
	}
	if (typeof attrs.is === 'string' && attrs.is) {
		return 'template-ref'
	}
	return 'template'
}

/**
 * 属性值三态（D-WIR-7）。
 * 返回 Value 形：{ kind, raw, span }；保留 body 别名兼容旧断言。
 * @param {any} raw
 */
export function valueKind(raw: string | null | undefined): Value & { body: string } {
	const value = makeValue(raw)
	return { ...value, body: value.raw }
}

/**
 * @param {any} sourceText
 * @param {any} offset
 */
export function deriveLineColumn(sourceText: string, offset: number): { line: number; column: number } | null {
	if (typeof sourceText !== 'string' || typeof offset !== 'number' || offset < 0) {
		return null
	}
	let line = 1
	let lineStart = 0
	const limit = Math.min(offset, sourceText.length)
	for (let i = 0; i < limit; i++) {
		if (sourceText.charCodeAt(i) === 10) {
			line++
			lineStart = i + 1
		}
	}
	return { line, column: offset - lineStart + 1 }
}

/**
 * @param {any} node
 */
export function describeNodeLocation(node: WxmlNode | null | undefined): string {
	if (!node) {
		return ''
	}
	const file = node.sourceFile ? ` sourceFile=${node.sourceFile}` : ''
	const loc = node.loc || node.span
	const locStr = loc ? ` loc=[${loc.start},${loc.end})` : ''
	return `${file}${locStr}`.trim()
}

/**
 * 深拷贝树（剥离非枚举；供测例/诊断快照） 
 * @param {any} document
 */
export function plainTree(document: Document | null | undefined): Record<string, unknown> {
	/** @param {any} node */
	const walk = (node: unknown): unknown => {
		if (!node || typeof node !== 'object') {
			return node
		}
		/** @type {Record<string, any>} */
		const out: Record<string, unknown> = {}
		for (const key of Object.keys(node as Record<string, unknown>)) {
			const value = (node as Record<string, unknown>)[key]
			if (Array.isArray(value)) {
				out[key] = value.map(walk)
			}
			else if (value && typeof value === 'object') {
				out[key] = { ...value }
			}
			else {
				out[key] = value
			}
		}
		return out
	}
	return {
		body: (document?.body || []).map(walk),
		...(document?.sourceFile !== undefined ? { sourceFile: document.sourceFile } : {}),
		...(document?.span !== undefined ? { span: document.span } : {}),
	}
}

/** @type {readonly string[]} */
export const PROJECTION_KEYS = Object.freeze(/** @type {string[]} */ ([]))
