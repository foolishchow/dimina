/**
 * WXML Document — 中立 IR 节点约定（fe-tools-wxml-ir · T-IR0）。
 *
 * D-WIR-2：以 docs/wxml/WXML-AST-TYPES.md 为分类指南（字段级可分期）。
 * D-WIR-5：loc = { start, end } 半开区间、JS string 索引；行/列由
 *   deriveLineColumn 从 sourceTexts 派生（禁猜行权威路径，D-WIR-4）。
 * D-WIR-8：Document/节点不携带 platform 概念（R-WIR4）。
 *
 * 投影工具不变量（technical-design F-005）：cheerio/htmlparser2 仅是 parse
 * 的投影工具；节点上的非枚举 `_elem`（cheerio 元素）与文档级 `_$`（工作
 * 实例）为过渡期投影句柄——权威始终是 Document 树本身；backend 消费
 * LoadedGraph，不得以「原始 WXML → cheerio → 产物」为权威路径。
 */

/** 特殊节点名（parse 保留在树上；展开/编译属 load —— D-WIR-3） */
export const SPECIAL_NODE_NAMES = Object.freeze(['include', 'import', 'wxs', 'template'])

/**
 * @typedef {object} WxmlNode
 * @property {'element'|'text'|'comment'} type
 * @property {string} [name]              // element
 * @property {Record<string, string>} [attrs] // element（值为原始字符串；三态见 valueKind）
 * @property {string} [value]             // text/comment
 * @property {WxmlNode[]} [children]      // element
 * @property {{ start: number, end: number }} loc   // 半开；JS string 索引
 * @property {string} [sourceFile]        // 跨文件可追溯（load 后展开来源）
 */

/**
 * @typedef {object} WxmlDocument
 * @property {WxmlNode[]} body
 * @property {string} [sourceFile]
 */

const PROJECTION_KEYS = Object.freeze(['_elem', '_$'])

/** 隐藏投影句柄（非枚举，不进入 JSON/断言面） */
export function attachProjection(target, key, value) {
	Object.defineProperty(target, key, {
		value,
		enumerable: false,
		writable: true,
		configurable: true,
	})
	return target
}

export function createDocument({ body, sourceFile, projection } = {}) {
	const document = { body: body || [], ...(sourceFile !== undefined ? { sourceFile } : {}) }
	if (projection) {
		attachProjection(document, '_$', projection)
	}
	return document
}

export function createElement({ name, attrs, children, loc, sourceFile }) {
	return {
		type: 'element',
		name,
		attrs: attrs || {},
		children: children || [],
		loc: loc || null,
		...(sourceFile !== undefined ? { sourceFile } : {}),
	}
}

export function createTextNode({ value, loc, sourceFile }) {
	return {
		type: 'text',
		value,
		loc: loc || null,
		...(sourceFile !== undefined ? { sourceFile } : {}),
	}
}

export function createCommentNode({ value, loc, sourceFile }) {
	return {
		type: 'comment',
		value,
		loc: loc || null,
		...(sourceFile !== undefined ? { sourceFile } : {}),
	}
}

/** 特殊节点判别（include / import / wxs / template） */
export function isSpecialNode(node) {
	return node?.type === 'element' && SPECIAL_NODE_NAMES.includes(node.name)
}

/** template 定义（带 name）vs 引用（带 is）——R-WIR0「可指认」 */
export function templateNodeKind(node) {
	if (node?.type !== 'element' || node.name !== 'template') {
		return null
	}
	if (typeof node.attrs?.name === 'string' && node.attrs.name) {
		return 'template-def'
	}
	if (typeof node.attrs?.is === 'string' && node.attrs.is) {
		return 'template-ref'
	}
	return 'template'
}

/**
 * 属性值三态（D-WIR-7：表达式体为字符串；Accept/Reject 全量后置）。
 * - static：无插值
 * - expr：含 {{ … }} 插值（body 为插值原文，含花括号）
 * - template：template 引用（is="…"）等模板定位值（body 为原始值）
 */
export function valueKind(raw) {
	if (typeof raw !== 'string') {
		return { kind: 'static', body: raw == null ? '' : String(raw) }
	}
	if (raw.includes('{{') && raw.includes('}}')) {
		return { kind: 'expr', body: raw }
	}
	return { kind: 'static', body: raw }
}

/**
 * loc → { line, column }（1 基；D-WIR-5 行列派生）。
 * sourceText 必须与 parse 输入同源（sourceTexts 可追溯，D-WIR-4）。
 */
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

/** 诊断定位串（R-WIR9：sourceFile + loc 尽量带上） */
export function describeNodeLocation(node) {
	if (!node) {
		return ''
	}
	const file = node.sourceFile ? ` sourceFile=${node.sourceFile}` : ''
	const loc = node.loc ? ` loc=[${node.loc.start},${node.loc.end})` : ''
	return `${file}${loc}`.trim()
}

/** 深拷贝树（剥离投影句柄；供测例/诊断快照） */
export function plainTree(document) {
	const walk = node => {
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
	return { body: (document?.body || []).map(walk), ...(document?.sourceFile !== undefined ? { sourceFile: document.sourceFile } : {}) }
}

export { PROJECTION_KEYS }