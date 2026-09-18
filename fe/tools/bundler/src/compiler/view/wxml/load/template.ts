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
import type { WxmlNode } from '../common/document.ts'

export interface TemplateModuleEntry { path: string; tpl: string; sourceInfo: { path: string; content: string; startLine?: number } | null }
export function transTagTemplate(document: WxmlNode, templateModule: TemplateModuleEntry[], path: string, components: Record<string, unknown> | null | undefined, componentPlaceholder: Record<string, unknown> | null | undefined, sourceInfo: { path: string; content: string } | null, graphOwnerPath: string = path) {
	const templateNodes = queryAll(document, 'template-def')
	const newlineOffsets = sourceInfo ? collectNewlineOffsets(sourceInfo.content) : null
	for (const elem of templateNodes.slice()) {
		const name = getAttr(elem, 'name') || elem.name
		removeMatching(elem, 'import')
		removeMatching(elem, 'include')
		removeMatching(elem, getViewScriptTags().join(','))
		transAsses!(document, queryAll(elem, 'image'), path, graphOwnerPath)
		const res: string[] = []
		normalizeTemplateDom(elem, components)
		transHtmlTag(serializeChildren(elem), res, components, componentPlaceholder)

		const firstChild = (elem.children || []).find(Boolean)
		const startOffset = firstChild?.loc?.start ?? firstChild?.span?.start ?? elem.loc?.start ?? elem.span?.start

		templateModule.push({
			path: `tpl-${name}`,
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
export function collectNewlineOffsets(content: string): number[] {
	const offsets: number[] = []
	for (let i = 0; i < content.length; i++) {
		if (content.charCodeAt(i) === 10) {
			offsets.push(i)
		}
	}
	return offsets
}
export function getSourceLine(newlineOffsets: number[] | null, index: number = 0): number {
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
