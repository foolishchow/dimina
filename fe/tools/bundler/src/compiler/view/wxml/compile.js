import { toMiniProgramModuleId } from '../../../shared/path-utils.ts'
import { checkTemplateCompatibility } from '../../core/compatibility.ts'
import {
	getContentByPath,
	getDependencyGraph,
	getTemplateExts,
	getViewScriptTags,
	getWorkPath,
} from '../../core/env.ts'
import { attachProjection } from './common/document.ts'
import { parseWxml } from './parse.js'
import { loadTemplates } from './load/index.js'
import { getWxmlRenderer } from './renderer/registry.ts'
import { VUE_RENDERER_ID } from './renderer/vue/index.js'
import { normalizeTemplateDom, transHtmlTag } from './renderer/vue/tools.js'
import { buildExtStripRegex, getViewPath, resolveTemplateDependencyPath } from './load/paths.js'
import {
	transTagWxs,
	transAsses,
	processIncludedFileWxsDependencies,
} from './load/orchestrator-live.js'
import {
	collectIncludedComponentTags,
	processIncludeConditionalAttrs,
} from './load/include.js'
import { transTagTemplate } from './load/template.js'

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

	const renderer = getWxmlRenderer(VUE_RENDERER_ID)
	if (!renderer) {
		throw new Error(`[wxml] view wxml renderer '${VUE_RENDERER_ID}' is not registered`)
	}
	const { code, meta } = renderer.render({ loaded }, {
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
