import { getTemplateDirectiveName } from '../../../core/compatibility.ts'
import { createElement } from '../common/document.ts'
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
// @ts-expect-error P-TM05: type narrowing needed
export function processIncludeConditionalAttrs(includeNode, includeContentOrDoc) {
	const allAttrs = attrsRecord(includeNode)
	const conditionAttrs = {}
	let hasCondition = false

	for (const attrName in allAttrs) {
		// @ts-expect-error P-TM05: type narrowing needed
		if (['if', 'elif', 'else'].includes(getTemplateDirectiveName(attrName))) {
			// @ts-expect-error P-TM05: type narrowing needed
			conditionAttrs[attrName] = allAttrs[attrName]
			hasCondition = true
		}
	}

	const isDoc = includeContentOrDoc && typeof includeContentOrDoc === 'object' && Array.isArray(includeContentOrDoc.body)

	if (isDoc) {
		if (!hasCondition) {
			return includeContentOrDoc.body.splice(0, includeContentOrDoc.body.length)
		}
		const block = createElement({ name: 'block', attrs: [] })
		for (const attrName in conditionAttrs) {
			// @ts-expect-error P-TM05: type narrowing needed
			setAttr(block, attrName, conditionAttrs[attrName])
		}
		const moved = includeContentOrDoc.body.splice(0, includeContentOrDoc.body.length)
		for (const child of moved) {
			append(block, child)
		}
		return [block]
	}

	const includeContent = includeContentOrDoc ?? ''
	if (hasCondition) {
		let blockAttrs = ''
		for (const attrName in conditionAttrs) {
			// @ts-expect-error P-TM05: type narrowing needed
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

// @ts-expect-error P-TM05: type narrowing needed
export function collectIncludedComponentTags(document, components) {
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
