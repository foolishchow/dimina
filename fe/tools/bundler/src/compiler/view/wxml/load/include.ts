import { getTemplateDirectiveName } from '../../../../packer/aspect/compatibility.ts'
import { createElement, type WxmlNode } from '../common/document.ts'
import {
	append,
	attrsRecord,
	getTagName,
	queryAll,
	setAttr,
} from '../common/document-ops.ts'

/**
 * 处理 include 节点的条件属性。
 * - 第二参为 string：返回处理后的 HTML（测例）
 * - 第二参为 Document：返回要插入的节点数组（load 主路径，零二次 parse）
 */
export function processIncludeConditionalAttrs(includeNode: WxmlNode | null | undefined, includeContentOrDoc: WxmlNode | string | null | undefined): WxmlNode[] | string | WxmlNode {
	const allAttrs = attrsRecord(includeNode)
	const conditionAttrs: Record<string, string> = {}
	let hasCondition = false

	for (const attrName in allAttrs) {
		if (['if', 'elif', 'else'].includes(getTemplateDirectiveName(attrName)!)) {
			conditionAttrs[attrName] = allAttrs[attrName]!
			hasCondition = true
		}
	}

	const isDoc = includeContentOrDoc && typeof includeContentOrDoc === 'object' && Array.isArray(includeContentOrDoc.body)

	if (isDoc) {
		if (!hasCondition) {
			return (includeContentOrDoc.body as WxmlNode[]).splice(0, (includeContentOrDoc.body as WxmlNode[]).length)
		}
		const block = createElement({ name: 'block', attrs: [] })
		for (const attrName in conditionAttrs) {
			setAttr(block, attrName, conditionAttrs[attrName])
		}
		const moved = (includeContentOrDoc.body as WxmlNode[]).splice(0, (includeContentOrDoc.body as WxmlNode[]).length)
		for (const child of moved) {
			append(block, child)
		}
		return [block]
	}

	const includeContent = includeContentOrDoc ?? ''
	if (hasCondition) {
		let blockAttrs = ''
		for (const attrName in conditionAttrs) {
			const attrValue = conditionAttrs[attrName]
			if (attrValue !== undefined && attrValue !== '') {
				blockAttrs += ` ${attrName}="${attrValue}"`
			}
			else {
				blockAttrs += ` ${attrName}`
			}
		}
		return `<block${blockAttrs}>${includeContent}</block>`
	}
	return includeContent
}
export function collectIncludedComponentTags(document: WxmlNode | null | undefined, components: Record<string, unknown> | null | undefined) {
	const componentTags = new Set()
	if (!components) {
		return componentTags
	}

	for (const elem of queryAll(document, '*')) {
		const name = getTagName(elem)
		if (name && components[name]) {
			componentTags.add(name)
		}
	}
	return componentTags
}
