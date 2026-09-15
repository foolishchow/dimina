// @ts-check
/**
 * Document 操作面（fe-tools-wxml-refactor · W2 · technical-design §4.2）。
 *
 * 只操作 JS Document 树；禁止 cheerio / _$ / _elem。
 * serialize 为纯 JS HTML 序列化，对齐 cheerio xmlMode + decodeEntities:false。
 */

/**
 * @typedef {import('./wxml-ir.types.js').WxmlDocument} WxmlDocument
 * @typedef {import('./document.js').Document} Document
 */
import {
	attachProjection,
	attrValueRaw,
	attrsFromRecord,
	attrsToRecord,
	createElement,
	deriveLineColumn,
	isElementLike,
	makeAttr,
} from './document.js'

const PARENT = new WeakMap()

/**
 * @param {any} node
 */
export function getParent(node) {
	return PARENT.get(node) ?? null
}

/**
 * @param {any} child
 * @param {any} parent
 */
export function setParent(child, parent) {
	if (child && typeof child === 'object') {
		PARENT.set(child, parent ?? null)
	}
	return child
}

/**
 * @param {any} node
 */
function isDocument(node) {
	return Boolean(node && Array.isArray(node.body) && !node.type)
}

/**
 * 为子树建立 parent 链（parse 投影后 / 挂接后调用） 
 * @param {any} node
 * @param {any} [parent]
 */
export function linkTree(node, parent = null) {
	if (!node || typeof node !== 'object') {
		return node
	}
	if (parent) {
		setParent(node, parent)
	}
	const children = node.children
	if (Array.isArray(children)) {
		for (const child of children) {
			linkTree(child, node)
		}
	}
	return node
}

/**
 * @param {any} container
 */
function childList(container) {
	if (!container) {
		return null
	}
	if (Array.isArray(container.body)) {
		return container.body
	}
	if (Array.isArray(container.children)) {
		return container.children
	}
	return null
}

/**
 * @param {any} node
 */
export function getTagName(node) {
	if (!node) {
		return null
	}
	switch (node.type) {
		case 'include':
			return 'include'
		case 'import':
			return 'import'
		case 'wxs':
			return node.name || 'wxs'
		case 'template-def':
		case 'template-ref':
			return 'template'
		case 'slot':
			return 'slot'
		case 'element':
			return node.name ?? null
		default:
			return node.name ?? null
	}
}

/**
 * @param {any} node
 * @param {any} selector
 * @returns {boolean}
 */
function matchSelector(node, selector) {
	if (!node || !selector) {
		return false
	}
	const sel = String(selector).trim()
	if (!sel) {
		return false
	}
	if (sel.includes(',')) {
		return sel.split(',').some(part => matchSelector(node, part.trim()))
	}
	if (sel === '*') {
		return isElementLike(node)
	}
	const attrMatch = sel.match(/^([A-Za-z_][\w:-]*)\[([^\]]+)\]$/)
	if (attrMatch) {
		const tag = attrMatch[1]
		const attrExpr = attrMatch[2]
		if (getTagName(node) !== tag && node.type !== tag) {
			return false
		}
		const eq = attrExpr.match(/^([^=]+)=["']?(.*?)["']?$/)
		if (eq) {
			return getAttr(node, eq[1].trim()) === eq[2]
		}
		const raw = getAttr(node, attrExpr.trim())
		return raw !== undefined
	}
	if (node.type === sel) {
		return true
	}
	return getTagName(node) === sel
}

/**
 * @param {any} scope
 * @param {any} [typeOrTag]
 */
export function queryAll(scope, typeOrTag = '*') {
	/** @type {any[]} */
	const out = []
	const roots = resolveWalkRoots(scope)
	walk(roots, (/** @type {any} */ node) => {
		if (matchSelector(node, typeOrTag)) {
			out.push(node)
		}
	})
	return out
}

/**
 * @param {any} scope
 * @param {any} [typeOrTag]
 */
export function query(scope, typeOrTag = '*') {
	return queryAll(scope, typeOrTag)[0] ?? null
}

/**
 * @param {any} scope
 */
function resolveWalkRoots(scope) {
	if (!scope) {
		return []
	}
	if (Array.isArray(scope)) {
		return scope
	}
	if (Array.isArray(scope.body)) {
		return scope.body
	}
	return [scope]
}

/**
 * @param {any} nodes
 * @param {any} visitor
 */
export function walk(nodes, visitor) {
	const list = Array.isArray(nodes) ? nodes : resolveWalkRoots(nodes)
	/** @param {any} node */
	const visit = (node) => {
		if (!node) {
			return
		}
		visitor(node)
		const kids = node.children
		if (Array.isArray(kids)) {
			for (const child of kids) {
				visit(child)
			}
		}
	}
	for (const node of list) {
		visit(node)
	}
}

/**
 * @param {any} node
 * @param {any} name
 */
export function getAttr(node, name) {
	if (!node || !name) {
		return undefined
	}
	if (name === 'src' && (node.type === 'include' || node.type === 'import' || node.type === 'wxs') && Object.prototype.hasOwnProperty.call(node, 'src')) {
		return node.src == null ? undefined : node.src
	}
	if (name === 'module' && node.type === 'wxs' && Object.prototype.hasOwnProperty.call(node, 'module')) {
		return node.module == null ? undefined : node.module
	}
	if (name === 'name' && node.type === 'template-def') {
		return node.name
	}
	if (name === 'is' && node.type === 'template-ref') {
		return node.is
	}
	if (!Array.isArray(node.attrs)) {
		return node.attrs?.[name]
	}
	const found = node.attrs.find((/** @type {any} */ a) => a.name === name)
	if (!found) {
		return undefined
	}
	return attrValueRaw(found)
}

/**
 * @param {any} node
 */
export function listAttrs(node) {
	if (!node) {
		return []
	}
	if (Array.isArray(node.attrs)) {
		return node.attrs.slice()
	}
	return attrsFromRecord(node.attrs)
}

/**
 * @param {any} node
 * @param {any} name
 * @param {any} value
 */
export function setAttr(node, name, value) {
	if (!node || !name) {
		return node
	}
	const raw = value == null ? '' : String(value)
	if (name === 'src' && (node.type === 'include' || node.type === 'import' || node.type === 'wxs')) {
		node.src = raw
	}
	if (name === 'module' && node.type === 'wxs') {
		node.module = raw
	}
	if (name === 'name' && node.type === 'template-def') {
		node.name = raw
	}
	if (name === 'is' && node.type === 'template-ref') {
		node.is = raw
	}
	if (!Array.isArray(node.attrs)) {
		node.attrs = attrsFromRecord(node.attrs || {})
	}
	const idx = node.attrs.findIndex((/** @type {any} */ a) => a.name === name)
	const next = makeAttr(name, raw)
	if (idx >= 0) {
		node.attrs[idx] = next
	}
	else {
		node.attrs.push(next)
	}
	return node
}

/**
 * @param {any} node
 * @param {any} name
 */
export function removeAttr(node, name) {
	if (!node || !name) {
		return node
	}
	if (Array.isArray(node.attrs)) {
		node.attrs = node.attrs.filter((/** @type {any} */ a) => a.name !== name)
	}
	else if (node.attrs && typeof node.attrs === 'object') {
		delete node.attrs[name]
	}
	if (name === 'src' && (node.type === 'include' || node.type === 'import' || node.type === 'wxs')) {
		node.src = null
	}
	if (name === 'module' && node.type === 'wxs') {
		node.module = null
	}
	return node
}

/**
 * @param {any} document
 */
export function getRootChildren(document) {
	return Array.isArray(document?.body) ? document.body : []
}

/**
 * @param {any} node
 */
export function getChildren(node) {
	if (!node) {
		return []
	}
	if (Array.isArray(node.body)) {
		return node.body
	}
	return Array.isArray(node.children) ? node.children : []
}

export { createElement }

/**
 * @param {any} parent
 * @param {any} childOrContents
 */
export function append(parent, childOrContents) {
	const list = childList(parent)
	if (!list) {
		throw new TypeError('[wxml] append: parent has no children/body')
	}
	const items = normalizeInsert(childOrContents)
	for (const item of items) {
		if (getParent(item)) {
			removeNode(item)
		}
		list.push(item)
		setParent(item, parent)
		linkTree(item, parent)
	}
	return parent
}

/**
 * @param {any} ref
 * @param {any} node
 */
export function insertBefore(ref, node) {
	const parent = getParent(ref)
	if (!parent) {
		throw new TypeError('[wxml] insertBefore: ref has no parent')
	}
	const list = childList(parent)
	const idx = list.indexOf(ref)
	if (idx < 0) {
		throw new TypeError('[wxml] insertBefore: ref not in parent children')
	}
	const items = normalizeInsert(node)
	for (const item of items) {
		if (getParent(item)) {
			removeNode(item)
		}
	}
	list.splice(idx, 0, ...items)
	for (const item of items) {
		setParent(item, parent)
		linkTree(item, parent)
	}
	return items[0] ?? null
}

/**
 * @param {any} childOrContents
 */
function normalizeInsert(childOrContents) {
	if (childOrContents == null) {
		return []
	}
	if (Array.isArray(childOrContents)) {
		return childOrContents.filter(Boolean)
	}
	if (Array.isArray(childOrContents.body)) {
		return childOrContents.body.slice()
	}
	return [childOrContents]
}

/**
 * @param {any} node
 */
export function removeNode(node) {
	if (!node) {
		return
	}
	const parent = getParent(node)
	if (!parent) {
		return
	}
	const list = childList(parent)
	if (!list) {
		return
	}
	const idx = list.indexOf(node)
	if (idx >= 0) {
		list.splice(idx, 1)
	}
	PARENT.delete(node)
}

/**
 * @param {any} nodes
 */
export function removeAll(nodes) {
	const list = Array.isArray(nodes) ? nodes.slice() : []
	for (const node of list) {
		removeNode(node)
	}
}

/**
 * @param {any} scope
 * @param {any} predicateOrTags
 */
export function removeMatching(scope, predicateOrTags) {
	const nodes = typeof predicateOrTags === 'function'
		? queryAll(scope, '*').filter(predicateOrTags)
		: queryAll(scope, predicateOrTags)
	for (const node of nodes.slice()) {
		removeNode(node)
	}
}

/**
 * @param {any} oldNode
 * @param {any} next
 */
export function replaceNode(oldNode, next) {
	const parent = getParent(oldNode)
	if (!parent) {
		throw new TypeError('[wxml] replaceNode: old node has no parent')
	}
	const list = childList(parent)
	const idx = list.indexOf(oldNode)
	if (idx < 0) {
		throw new TypeError('[wxml] replaceNode: old node not in parent')
	}
	const items = normalizeInsert(next)
	list.splice(idx, 1, ...items)
	PARENT.delete(oldNode)
	for (const item of items) {
		setParent(item, parent)
		linkTree(item, parent)
	}
	return items
}

/**
 * @param {any} document
 * @param {any} [tag]
 */
export function wrapRootIfMulti(document, tag = 'view') {
	const body = getRootChildren(document)
	if (body.filter(isElementLike).length <= 1) {
		return document
	}
	const wrapper = createElement({ name: tag, attrs: [], children: [] })
	const moved = body.splice(0, body.length)
	for (const child of moved) {
		wrapper.children.push(child)
		setParent(child, wrapper)
	}
	body.push(wrapper)
	setParent(wrapper, document)
	return document
}

/**
 * @param {any} node
 * @param {any} [arg]
 */
export function getSourceOrigin(node, { sourceFile, sourceTexts, originKey } = {}) {
	const key = originKey || Symbol.for('db.wxml-bridge.source')
	let entry = null
	let cur = node
	while (cur) {
		entry = cur[key]
		if (entry) {
			break
		}
		const parent = getParent(cur)
		if (!parent || isDocument(parent)) {
			break
		}
		cur = parent
	}
	const file = entry?.source ?? sourceFile
	const text = entry?.text ?? sourceTexts?.get(file)
	const loc = node?.loc || node?.span
	let line = 1
	if (text && loc && typeof loc.start === 'number') {
		line = deriveLineColumn(text, loc.start)?.line ?? 1
	}
	return { source: file, line, entry }
}

/**
 * @param {any} target
 */
export function serialize(target) {
	if (!target) {
		return ''
	}
	if (Array.isArray(target.body)) {
		return target.body.map(serializeNode).join('')
	}
	if (Array.isArray(target) && target.length >= 0 && !(/** @type {any} */ (target)).type) {
		return target.map(serializeNode).join('')
	}
	return serializeNode(target)
}

/**
 * @param {any} node
 */
export function serializeChildren(node) {
	return getChildren(node).map(serializeNode).join('')
}

/**
 * @param {any} node
 */
function serializeNode(node) {
	if (!node) {
		return ''
	}
	if (node.type === 'text') {
		return node.value ?? ''
	}
	if (node.type === 'comment') {
		return `<!--${node.value ?? ''}-->`
	}
	const tag = getTagName(node)
	if (!tag) {
		return ''
	}
	const attrs = serializeAttrs(node)
	const open = attrs ? `<${tag} ${attrs}>` : `<${tag}>`
	const inner = getChildren(node).map(serializeNode).join('')
	return `${open}${inner}</${tag}>`
}

/**
 * @param {any} node
 */
function serializeAttrs(node) {
	const attrs = listAttrs(node)
	if (attrs.length === 0) {
		return ''
	}
	// 不做实体转义：与 cheerio decodeEntities:false 往返保真
	return attrs.map((/** @type {any} */ attr) => `${attr.name}="${attrValueRaw(attr)}"`).join(' ')
}

/**
 * @param {any} node
 */
export function attrsRecord(node) {
	return attrsToRecord(listAttrs(node))
}

/**
 * @param {any} document
 */
export function bindDocument(document) {
	if (!document || !Array.isArray(document.body)) {
		return document
	}
	for (const child of document.body) {
		setParent(child, document)
		linkTree(child, document)
	}
	return document
}

export { attrsToRecord, attrsFromRecord, isDocument, attachProjection }
