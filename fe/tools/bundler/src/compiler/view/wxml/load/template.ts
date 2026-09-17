import { getViewScriptTags } from '../../../core/env.ts'
import {
	getAttr,
	queryAll,
	removeMatching,
	removeNode,
	serializeChildren,
} from '../common/document-ops.ts'
import { transAsses } from './orchestrator-live.ts'
import { normalizeTemplateDom, transHtmlTag } from '../renderer/vue/tools.ts'

// @ts-expect-error P-TM05: type narrowing needed
export function transTagTemplate(document, templateModule, path, components, componentPlaceholder, sourceInfo, graphOwnerPath = path) {
	const templateNodes = queryAll(document, 'template-def')
	const newlineOffsets = sourceInfo ? collectNewlineOffsets(sourceInfo.content) : null
	for (const elem of templateNodes.slice()) {
		const name = getAttr(elem, 'name') || elem.name
		removeMatching(elem, 'import')
		removeMatching(elem, 'include')
		removeMatching(elem, getViewScriptTags().join(','))
		transAsses(document, queryAll(elem, 'image'), path, graphOwnerPath)
		// @ts-expect-error P-TM05: type narrowing needed
		const res = []
		// @ts-expect-error P-TM05: type narrowing needed
		normalizeTemplateDom(elem, components)
		// @ts-expect-error P-TM05: type narrowing needed
		transHtmlTag(serializeChildren(elem), res, components, componentPlaceholder)

		const firstChild = (elem.children || []).find(Boolean)
		const startOffset = firstChild?.loc?.start ?? firstChild?.span?.start ?? elem.loc?.start ?? elem.span?.start

		templateModule.push({
			path: `tpl-${name}`,
			// @ts-expect-error P-TM05: type narrowing needed
			tpl: res.join(''),
			sourceInfo: sourceInfo
				? {
					...sourceInfo,
					startLine: getSourceLine(newlineOffsets, startOffset),
				}
				: null,
		})
		removeNode(elem)
	}
}

// @ts-expect-error P-TM05: type narrowing needed
export function collectNewlineOffsets(content) {
	const offsets = []
	for (let i = 0; i < content.length; i++) {
		if (content.charCodeAt(i) === 10) {
			offsets.push(i)
		}
	}
	return offsets
}

// @ts-expect-error P-TM05: type narrowing needed
export function getSourceLine(newlineOffsets, index = 0) {
	if (!newlineOffsets) {
		return 1
	}
	const target = Math.max(0, index)
	let lo = 0
	let hi = newlineOffsets.length
	while (lo < hi) {
		const mid = (lo + hi) >>> 1
		if (newlineOffsets[mid] < target) {
			lo = mid + 1
		}
		else {
			hi = mid
		}
	}
	return lo + 1
}
