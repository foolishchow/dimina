import { toMiniProgramModuleId } from '../../../../shared/path-utils.js'
import { checkTemplateCompatibility, getTemplateDirectiveName } from '../../../core/compatibility.js'
import {
	getContentByPath,
	getDependencyGraph,
	getTemplateExts,
	getViewScriptTags,
	getWorkPath,
} from '../../../core/env.js'
import { attachProjection, createElement } from '../document.js'
import {
	append,
	attrsRecord,
	getAttr,
	getTagName,
	queryAll,
	removeMatching,
	removeNode,
	serializeChildren,
	setAttr,
} from '../document-ops.js'
import { parseWxml } from '../parse.js'
import { loadTemplates } from '../load.js'
import { getBackend } from '../backends/registry.js'
import { VUE_BACKEND_ID } from '../backends/vue.js'
import { normalizeTemplateDom, transHtmlTag } from '../backends/vue-tools.js'
import { buildExtStripRegex, getViewPath, resolveTemplateDependencyPath } from './paths.js'
import {
	transTagWxs,
	transAsses,
	processIncludedFileWxsDependencies,
} from './orchestrator-live.js'

/**
 * 处理 include 节点的条件属性。
 * - 第二参为 string：返回处理后的 HTML（测例）
 * - 第二参为 Document：返回要插入的节点数组（load 主路径，零二次 parse）
 */
export function processIncludeConditionalAttrs(includeNode, includeContentOrDoc) {
	const allAttrs = attrsRecord(includeNode)
	const conditionAttrs = {}
	let hasCondition = false

	for (const attrName in allAttrs) {
		if (['if', 'elif', 'else'].includes(getTemplateDirectiveName(attrName))) {
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

/**
 * 转换成底层框架模板 —— parse → load → vue.render
 */
export function toCompileTemplate(isComponent, path, components, componentPlaceholder, processedPaths = new Set()) {
	const workPath = getWorkPath()
	const fullPath = getViewPath(workPath, path)
	if (!fullPath) {
		return { tpl: undefined }
	}
	getDependencyGraph().addFile(path, fullPath, 'view')
	const sourcePath = toMiniProgramModuleId(fullPath, workPath)
		.replace(buildExtStripRegex(getTemplateExts()), '')
	const diagnosticSource = fullPath.startsWith(workPath)
		? fullPath.slice(workPath.length)
		: path
	const originalContent = getContentByPath(fullPath)
	let content = originalContent
	if (!content.trim()) {
		content = '<block></block>'
	}
	else {
		checkTemplateCompatibility(content, diagnosticSource, components)

		if (isComponent) {
			content = `<component-host name="${path}">${content}</component-host>`
		}
	}

	const document = parseWxml(content, { sourceFile: diagnosticSource })
	attachProjection(document, '_source', originalContent)
	const loaded = loadTemplates(document, {
		isComponent,
		modulePath: path,
		sourcePath,
		components,
		componentPlaceholder,
		processedPaths,
		hasOriginalContent: Boolean(originalContent.trim()),
		workPath,
		stripTemplateExtsRegex: buildExtStripRegex(getTemplateExts()),
		tools: {
			transTagTemplate,
			transTagWxs,
			transAsses,
			resolveTemplateDependencyPath,
			collectIncludedComponentTags,
			processIncludedFileWxsDependencies,
			processIncludeConditionalAttrs,
			checkTemplateCompatibility,
		},
		env: {
			getContentByPath,
			getDependencyGraph,
			getViewScriptTags,
		},
	})

	const backend = getBackend(VUE_BACKEND_ID)
	if (!backend) {
		throw new Error(`[wxml] view backend '${VUE_BACKEND_ID}' is not registered`)
	}
	const { code, meta } = backend.render({ loaded }, {
		components,
		componentPlaceholder,
		tools: { normalizeTemplateDom, transHtmlTag },
	})

	return {
		tpl: code,
		sourceInfo: {
			path: diagnosticSource,
			content: originalContent,
		},
		instruction: {
			templateModule: loaded.templateModule,
			scriptModule: loaded.scriptModule,
		},
		origins: meta?.lineOrigins,
		sourceContents: meta?.sourceContents,
	}
}

export function transTagTemplate(document, templateModule, path, components, componentPlaceholder, sourceInfo, graphOwnerPath = path) {
	const templateNodes = queryAll(document, 'template-def')
	const newlineOffsets = sourceInfo ? collectNewlineOffsets(sourceInfo.content) : null
	for (const elem of templateNodes.slice()) {
		const name = getAttr(elem, 'name') || elem.name
		removeMatching(elem, 'import')
		removeMatching(elem, 'include')
		removeMatching(elem, getViewScriptTags().join(','))
		transAsses(document, queryAll(elem, 'image'), path, graphOwnerPath)
		const res = []
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

export function collectNewlineOffsets(content) {
	const offsets = []
	for (let i = 0; i < content.length; i++) {
		if (content.charCodeAt(i) === 10) {
			offsets.push(i)
		}
	}
	return offsets
}

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
