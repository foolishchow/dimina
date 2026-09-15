/**
 * WXML Document — 标准 IR 节点约定（fe-tools-wxml-refactor · W2）。
 *
 * 真源：docs/wxml/WXML-AST-TYPES.md + technical-design §2。
 * 契约字段始终存在；null = parser 暂不可提供；[] = 空集合。
 * cheerio 仅作 parse 投影工具，不得经 Document 向 load/renderer/tools 泄漏。
 */

/** @typedef {{ start: number, end: number }} Span */

/**
 * @typedef {object} Value
 * @property {'static'|'expr'|'template'} kind
 * @property {string} raw
 * @property {null|Span} span
 * @property {unknown[]} [parts]
 */

/**
 * @typedef {object} Attr
 * @property {null|Span} span
 * @property {string} name
 * @property {null|Value} value
 */

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
export function makeValue(raw, span = null) {
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
export function makeAttr(name, raw, span = null) {
	if (raw == null) {
		return { span, name, value: null }
	}
	return { span, name, value: makeValue(raw, null) }
}

/** Record / 元组列表 → Attr[] */
export function attrsFromRecord(record) {
	if (!record || typeof record !== 'object') {
		return []
	}
	return Object.entries(record).map(([name, raw]) => makeAttr(name, raw))
}

/** Attr[] → Record<string,string>（空值属性 → ''） */
export function attrsToRecord(attrs) {
	if (!attrs) {
		return {}
	}
	if (!Array.isArray(attrs)) {
		return { ...attrs }
	}
	const out = {}
	for (const attr of attrs) {
		if (!attr || typeof attr.name !== 'string') {
			continue
		}
		out[attr.name] = attrValueRaw(attr)
	}
	return out
}

export function attrValueRaw(attr) {
	if (!attr || attr.value == null) {
		return ''
	}
	if (typeof attr.value === 'string') {
		return attr.value
	}
	return attr.value.raw ?? ''
}

export function createDocument({ body, sourceFile, span } = {}) {
	return {
		span: span ?? null,
		body: body || [],
		...(sourceFile !== undefined ? { sourceFile } : {}),
	}
}

/**
 * @param {object} opts
 * @param {string} opts.name
 * @param {Attr[]|Record<string,string>} [opts.attrs]
 * @param {object[]} [opts.children]
 * @param {null|Span} [opts.loc]
 * @param {null|Span} [opts.span]
 * @param {string} [opts.sourceFile]
 * @param {boolean} [opts.selfClosing]
 * @param {object[]} [opts.directives]
 * @param {null|object} [opts.slot]
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
} = {}) {
	const resolvedSpan = span ?? loc ?? null
	const attrList = Array.isArray(attrs) ? attrs : attrsFromRecord(attrs)
	return {
		type: 'element',
		span: resolvedSpan,
		loc: resolvedSpan,
		name,
		attrs: attrList,
		directives: directives || [],
		slot: slot ?? null,
		children: children || [],
		selfClosing: Boolean(selfClosing),
		...(sourceFile !== undefined ? { sourceFile } : {}),
	}
}

export function createTextNode({ value, loc, span, sourceFile } = {}) {
	const resolvedSpan = span ?? loc ?? null
	return {
		type: 'text',
		span: resolvedSpan,
		loc: resolvedSpan,
		value: value ?? '',
		...(sourceFile !== undefined ? { sourceFile } : {}),
	}
}

export function createCommentNode({ value, loc, span, sourceFile } = {}) {
	const resolvedSpan = span ?? loc ?? null
	return {
		type: 'comment',
		span: resolvedSpan,
		loc: resolvedSpan,
		value: value ?? '',
		...(sourceFile !== undefined ? { sourceFile } : {}),
	}
}

function baseSpecialFields({ attrs, children, loc, span, sourceFile, selfClosing = false }) {
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

export function createInclude(opts = {}) {
	const base = baseSpecialFields(opts)
	const srcRaw = opts.src !== undefined ? opts.src : findAttrRaw(base.attrs, 'src')
	return {
		type: 'include',
		src: srcRaw == null || srcRaw === '' ? null : srcRaw,
		...base,
	}
}

export function createImport(opts = {}) {
	const base = baseSpecialFields(opts)
	const srcRaw = opts.src !== undefined ? opts.src : findAttrRaw(base.attrs, 'src')
	return {
		type: 'import',
		src: srcRaw == null || srcRaw === '' ? null : srcRaw,
		...base,
	}
}

export function createWxs(opts = {}) {
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

export function createTemplateDef(opts = {}) {
	const base = baseSpecialFields(opts)
	const tplName = opts.name !== undefined ? opts.name : findAttrRaw(base.attrs, 'name')
	return {
		type: 'template-def',
		name: tplName || '',
		...base,
	}
}

export function createTemplateRef(opts = {}) {
	const base = baseSpecialFields(opts)
	const isName = opts.is !== undefined ? opts.is : findAttrRaw(base.attrs, 'is')
	return {
		type: 'template-ref',
		name: 'template',
		is: isName || '',
		...base,
	}
}

export function createSlot(opts = {}) {
	const base = baseSpecialFields(opts)
	const slotName = opts.name !== undefined ? opts.name : findAttrRaw(base.attrs, 'name')
	return {
		type: 'slot',
		name: slotName == null || slotName === '' ? null : slotName,
		...base,
	}
}

function findAttrRaw(attrs, name) {
	if (!Array.isArray(attrs)) {
		return attrs?.[name]
	}
	const found = attrs.find(a => a.name === name)
	return found ? attrValueRaw(found) : undefined
}

/** 隐藏非枚举字段（parent / 过渡句柄） */
export function attachProjection(target, key, value) {
	Object.defineProperty(target, key, {
		value,
		enumerable: false,
		writable: true,
		configurable: true,
	})
	return target
}

export function isElementLike(node) {
	if (!node || typeof node !== 'object') {
		return false
	}
	if (node.type === 'element' || SPECIAL_NODE_TYPES.includes(node.type)) {
		return true
	}
	return false
}

/** 特殊节点判别（type 优先；兼容旧 element+name） */
export function isSpecialNode(node) {
	if (!node) {
		return false
	}
	if (SPECIAL_NODE_TYPES.includes(node.type)) {
		return true
	}
	return node.type === 'element' && SPECIAL_NODE_NAMES.includes(node.name)
}

/** template 定义 vs 引用 */
export function templateNodeKind(node) {
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
 */
export function valueKind(raw) {
	const value = makeValue(raw)
	return { ...value, body: value.raw }
}

export function deriveLineColumn(sourceText, offset) {
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

export function describeNodeLocation(node) {
	if (!node) {
		return ''
	}
	const file = node.sourceFile ? ` sourceFile=${node.sourceFile}` : ''
	const loc = node.loc || node.span
	const locStr = loc ? ` loc=[${loc.start},${loc.end})` : ''
	return `${file}${locStr}`.trim()
}

/** 深拷贝树（剥离非枚举；供测例/诊断快照） */
export function plainTree(document) {
	const walk = (node) => {
		if (!node || typeof node !== 'object') {
			return node
		}
		const out = {}
		for (const key of Object.keys(node)) {
			const value = node[key]
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

export const PROJECTION_KEYS = Object.freeze([])
