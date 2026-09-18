/**
 * Document 操作面（fe-tools-wxml-refactor · W2 · technical-design §4.2）。
 *
 * 只操作 JS Document 树；禁止 cheerio / _$ / _elem。
 * serialize 为纯 JS HTML 序列化，对齐 cheerio xmlMode + decodeEntities:false。
 */

export type { WxmlDocument } from './wxml-ir.types.ts'
export type { Document } from './document.ts'

import {
	attachProjection,
	attrValueRaw,
	attrsFromRecord,
	attrsToRecord,
	createElement,
	deriveLineColumn,
	isElementLike,
	makeAttr,
} from './document.ts'
import type { WxmlNode, Attr, Document, Span } from './document.ts'

const PARENT = new WeakMap<object, WxmlNode | null>()

/**
 * @param {any} node
 */
export function getParent(node: WxmlNode | null | undefined) {
	return node ? PARENT.get(node) ?? null : null
}

/**
 * @param {any} child
 * @param {any} parent
 */
export function setParent(child: WxmlNode | null | undefined, parent: WxmlNode | null | undefined) {
	if (child && typeof child === 'object') {
		PARENT.set(child, parent ?? null)
	}
	return child
}

/**
 * @param {any} node
 */
function isDocument(node: WxmlNode | null | undefined): boolean {
	return Boolean(node && Array.isArray(node.body) && !node.type)
}

/**
 * 为子树建立 parent 链（parse 投影后 / 挂接后调用） 
 * @param {any} node
 * @param {any} [parent]
 */
export function linkTree(node: WxmlNode | null | undefined, parent: WxmlNode | null | undefined = null): WxmlNode | null | undefined {
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
function childList(container: WxmlNode | null | undefined): WxmlNode[] | null {
	if (!container) {
		return null
	}
	if (Array.isArray(container.body)) {
		return container.body as WxmlNode[]
	}
	if (Array.isArray(container.children)) {
		return container.children
	}
	return null
}

/**
 * @param {any} node
 */
export function getTagName(node: WxmlNode | null | undefined): string | null {
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
function matchSelector(node: WxmlNode | null | undefined, selector: string): boolean {
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
export function queryAll(scope: WxmlNode | null | undefined, typeOrTag: string = '*'): WxmlNode[] {
	/** @type {any[]} */
	const out: WxmlNode[] = []
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
export function query(scope: WxmlNode | null | undefined, typeOrTag: string = '*'): WxmlNode | null {
	return queryAll(scope, typeOrTag)[0] ?? null
}

/**
 * @param {any} scope
 */
function resolveWalkRoots(scope: WxmlNode | null | undefined): WxmlNode[] {
	if (!scope) {
		return []
	}
	if (Array.isArray(scope)) {
		return scope
	}
	if (Array.isArray(scope.body)) {
		return scope.body as WxmlNode[]
	}
	return [scope]
}

/**
 * @param {any} nodes
 * @param {any} visitor
 */
export function walk(nodes: WxmlNode[] | WxmlNode | null | undefined, visitor: (node: WxmlNode) => void): void {
	const list = Array.isArray(nodes) ? nodes : resolveWalkRoots(nodes)
	/** @param {any} node */
	const visit = (node: WxmlNode | null | undefined) => {
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
export function getAttr(node: WxmlNode | null | undefined, name: string): string | undefined {
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
		return node.name ?? undefined
	}
	if (name === 'is' && node.type === 'template-ref') {
		return node.is
	}
	if (!Array.isArray(node.attrs)) {
		return node.attrs?.[name]
	}
	const found = node.attrs.find((a: Attr) => a.name === name)
	if (!found) {
		return undefined
	}
	return attrValueRaw(found)
}

/**
 * @param {any} node
 */
export function listAttrs(node: WxmlNode | null | undefined): Attr[] {
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
export function setAttr(node: WxmlNode | null | undefined, name: string, value: unknown): WxmlNode | null | undefined {
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
	const idx = node.attrs.findIndex((a: Attr) => a.name === name)
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
export function removeAttr(node: WxmlNode | null | undefined, name: string): WxmlNode | null | undefined {
	if (!node || !name) {
		return node
	}
	if (Array.isArray(node.attrs)) {
		node.attrs = node.attrs.filter((a: Attr) => a.name !== name)
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
export function getRootChildren(document: Document | WxmlNode | null | undefined): WxmlNode[] {
	return Array.isArray(document?.body) ? document.body as WxmlNode[] : []
}

/**
 * @param {any} node
 */
export function getChildren(node: WxmlNode | null | undefined): WxmlNode[] {
	if (!node) {
		return []
	}
	if (Array.isArray(node.body)) {
		return node.body as WxmlNode[]
	}
	return Array.isArray(node.children) ? node.children : []
}

export { createElement }

/**
 * @param {any} parent
 * @param {any} childOrContents
 */
export function append(parent: WxmlNode | null | undefined, childOrContents: WxmlNode | null | undefined): WxmlNode | null | undefined {
	const list = childList(parent)
	if (!list) {
		throw new TypeError('[wxml] append: parent has no children/body')
	}
	const items = normalizeInsert(childOrContents)
	for (const item of items) {
		if (getParent(item)) {
			removeNode(item)
		}
		list!.push(item)
		if (item) setParent(item, parent)
		if (item) linkTree(item, parent)
	}
	return parent
}

/**
 * @param {any} ref
 * @param {any} node
 */
export function insertBefore(ref: WxmlNode | null | undefined, node: WxmlNode | null | undefined): WxmlNode | null {
	const parent = getParent(ref)
	if (!parent) {
		throw new TypeError('[wxml] insertBefore: ref has no parent')
	}
	const list = childList(parent)
	const idx = list!.indexOf(ref!)
	if (idx < 0) {
		throw new TypeError('[wxml] insertBefore: ref not in parent children')
	}
	const items = normalizeInsert(node)
	for (const item of items) {
		if (getParent(item)) {
			removeNode(item)
		}
	}
	list!.splice(idx, 0, ...items)
	for (const item of items) {
		if (item) setParent(item, parent)
		if (item) linkTree(item, parent)
	}
	return items[0] ?? null
}

/**
 * @param {any} childOrContents
 */
function normalizeInsert(childOrContents: WxmlNode | WxmlNode[] | null | undefined): WxmlNode[] {
	if (childOrContents == null) {
		return []
	}
	if (Array.isArray(childOrContents)) {
		return childOrContents.filter(Boolean)
	}
	if (childOrContents && typeof childOrContents === 'object' && Array.isArray(childOrContents.body)) {
		return childOrContents.body.slice() as WxmlNode[]
	}
	return [childOrContents]
}

/**
 * @param {any} node
 */
export function removeNode(node: WxmlNode | null | undefined): void {
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
	const idx = list!.indexOf(node)
	if (idx >= 0) {
		list!.splice(idx, 1)
	}
	PARENT.delete(node)
}

/**
 * @param {any} nodes
 */
export function removeAll(nodes: WxmlNode[] | WxmlNode | null | undefined): void {
	const list = Array.isArray(nodes) ? nodes.slice() : []
	for (const node of list) {
		removeNode(node)
	}
}

/**
 * @param {any} scope
 * @param {any} predicateOrTags
 */
export function removeMatching(scope: WxmlNode | null | undefined, predicateOrTags: string | ((node: WxmlNode) => boolean)): void {
	const nodes = typeof predicateOrTags === 'function'
		? queryAll(scope, '*').filter(predicateOrTags as (node: WxmlNode) => boolean)
		: queryAll(scope, predicateOrTags as string)
	for (const node of nodes.slice()) {
		removeNode(node)
	}
}

/**
 * @param {any} oldNode
 * @param {any} next
 */
export function replaceNode(oldNode: WxmlNode | null | undefined, next: WxmlNode | WxmlNode[] | null | undefined): WxmlNode[] {
	const parent = getParent(oldNode)
	if (!parent) {
		throw new TypeError('[wxml] replaceNode: old node has no parent')
	}
	const list = childList(parent)
	const idx = list!.indexOf(oldNode!)
	if (idx < 0) {
		throw new TypeError('[wxml] replaceNode: old node not in parent')
	}
	const items = normalizeInsert(next)
	list!.splice(idx, 1, ...items)
	if (oldNode) PARENT.delete(oldNode)
	for (const item of items) {
		if (item) setParent(item, parent)
		if (item) linkTree(item, parent)
	}
	return items
}

/**
 * @param {any} document
 * @param {any} [tag]
 */
export function wrapRootIfMulti(document: Document | WxmlNode | null | undefined, tag: string = 'view'): Document | WxmlNode | null | undefined {
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
	setParent(wrapper, document as WxmlNode)
	return document
}

/**
 * @param {any} node
 * @param {any} [arg]
 */
export function getSourceOrigin(node: WxmlNode | null | undefined, { sourceFile, sourceTexts, originKey }: { sourceFile?: string; sourceTexts?: Map<string, string>; originKey?: string | symbol } = {}): { source: string | undefined; line: number; entry: unknown } {
	const key = originKey || Symbol.for('db.wxml-bridge.source')
	let entry: { source?: string; text?: string } | null = null
	let cur = node
	while (cur) {
		entry = (cur as Record<string | symbol, unknown>)[key] as { source?: string; text?: string } | null
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
	const text = entry?.text ?? (file ? sourceTexts?.get(file) : undefined)
	const loc = node?.loc || node?.span
	let line = 1
	if (text && loc && typeof loc.start === 'number') {
		line = loc && typeof loc.start === 'number' ? deriveLineColumn(text, loc.start)?.line ?? 1 : 1
	}
	return { source: file, line, entry }
}

/**
 * @param {any} target
 */
export function serialize(target: WxmlNode | null | undefined): string {
	if (!target) {
		return ''
	}
	if (Array.isArray(target.body)) {
		return (target.body as WxmlNode[]).map(serializeNode).join('')
	}
	if (Array.isArray(target) && target.length >= 0 && !(/** @type {any} */ (target)).type) {
		return (target as unknown[] as WxmlNode[]).map(serializeNode).join('')
	}
	return serializeNode(target)
}

/**
 * @param {any} node
 */
export function serializeChildren(node: WxmlNode | null | undefined): string {
	return getChildren(node).map(serializeNode).join('')
}

/**
 * @param {any} node
 */
function serializeNode(node: WxmlNode | null | undefined): string {
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
function serializeAttrs(node: WxmlNode | null | undefined): string {
	const attrs = listAttrs(node)
	if (attrs.length === 0) {
		return ''
	}
	// 不做实体转义：与 cheerio decodeEntities:false 往返保真
	return attrs.map((attr: Attr) => `${attr.name}="${attrValueRaw(attr)}"`).join(' ')
}

/**
 * @param {any} node
 */
export function attrsRecord(node: WxmlNode | null | undefined): Record<string, string> {
	return attrsToRecord(listAttrs(node))
}

/**
 * @param {any} document
 */
export function bindDocument(document: Document | WxmlNode | null | undefined): Document | WxmlNode | null | undefined {
	if (!document || !Array.isArray(document.body)) {
		return document
	}
	for (const child of document.body as WxmlNode[]) {
		setParent(child, document as WxmlNode)
		linkTree(child, document as WxmlNode)
	}
	return document
}

export { attrsToRecord, attrsFromRecord, isDocument, attachProjection }
