import { toMiniProgramModuleId } from '../../../shared/path-utils.ts'
import type { PackerContext } from '../../../packer/types.ts'
import { checkTemplateCompatibility } from '../../../packer/aspect/compatibility.ts'
import {
	getContentByPath,
	getDependencyGraph,
	getTemplateExts,
	getViewScriptTags,
} from '../../../packer/store/env.ts'
import { attachProjection } from './common/document.ts'
import { parseWxml } from './parse.ts'
import { loadTemplates } from './load/index.ts'
import { getWxmlRenderer } from './renderer/registry.ts'
import { VUE_RENDERER_ID } from './renderer/vue/index.ts'
import { normalizeTemplateDom, transHtmlTag } from './renderer/vue/tools.ts'
import { buildExtStripRegex, getViewPath, resolveTemplateDependencyPath } from './load/paths.ts'
import {
	transTagWxs,
	transAsses,
	processIncludedFileWxsDependencies,
} from './load/orchestrator-live.ts'
import {
	collectIncludedComponentTags,
	processIncludeConditionalAttrs,
} from './load/include.ts'
import { transTagTemplate } from './load/template.ts'

/**
 * 转换成底层框架模板 —— parse → load → vue.render
 */
export function toCompileTemplate(isComponent: boolean, path: string, components: Record<string, unknown> | undefined, componentPlaceholder: Record<string, unknown> | undefined, processedPaths: Set<string> = new Set(), ctx?: PackerContext) {
	const workPath = ctx!.workPath!
	const fullPath = getViewPath(workPath, path)
	if (!fullPath) {
		return { tpl: undefined }
	}
	(ctx!.graph!).addFile(path, fullPath, 'view')
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
			transTagWxs: transTagWxs!,
			transAsses: transAsses!,
			resolveTemplateDependencyPath,
			collectIncludedComponentTags,
			processIncludedFileWxsDependencies: (componentTags: unknown, includePath: string, scriptModule: unknown[], components: Record<string, unknown>, processedPaths: Set<string> = new Set()) => processIncludedFileWxsDependencies!(componentTags, includePath, scriptModule, components, processedPaths, ctx),
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
