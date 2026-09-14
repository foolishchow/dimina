/**
 * loadTemplates — load 阶段（fe-tools-wxml-ir · T-IR1）。
 *
 * 归属（technical-design 阶段归属表 · load 行）：
 * - 多根包装（页）；（component-host 包装 v1 过渡注记见 orchestrator——
 *   源级包装保留在编排壳以保 startIndex 偏移与 sourcemap 字节 0；DOM 级
 *   迁移属语义迁移期）；
 * - include/import **展开**：路径解析、读盘、依赖图边、节点替换；
 * - `<template name>` 收集为 templateModule；`<wxs>` 收集（Wxs 编译在
 *   transTagWxs→processWxsContent，属 load——禁止在 parse）；
 * - 图片等 assets 收集（transAsses 主文档行）；
 * - 展开后 Document 重投影 + sourceTexts（sourceFile → 源串）可追溯。
 *
 * 过渡期实现（先切缝，再迁语义）：结构操作在 Document 的投影句柄 `_$`
 * （与 parse 同一 cheerio 工作实例）上进行——同实例、同操作序列保证
 * 行为 0；转换算法经 ctx.tools 注入（view-compiler 工具袋），env 访问
 * 经 ctx.env 注入（无 import 环、可单测）。
 *
 * R-WIR9：展开失败路径带 `[wxml]` + sourceFile + loc（Experience §7）。
 */
import * as cheerio from 'cheerio'
import { attachProjection } from './document.js'
import { projectDocument } from './parse.js'

/** 子文件投影：与今日 include/import 子解析同参（无 lowerCase 显式项；行为 0 保真） */
function loadProjection(content) {
	return cheerio.load(content, {
		xmlMode: true,
		decodeEntities: false,
		_useHtmlParser2: true,
		withStartIndices: true,
		withEndIndices: true,
	})
}

function requireTools(tools) {
	const missing = ['transTagTemplate', 'transTagWxs', 'transAsses', 'resolveTemplateDependencyPath', 'collectIncludedComponentTags', 'processIncludedFileWxsDependencies', 'processIncludeConditionalAttrs', 'checkTemplateCompatibility']
		.filter(name => typeof tools?.[name] !== 'function')
	if (missing.length > 0) {
		throw new TypeError(`[wxml] load: ctx.tools missing ${missing.join(', ')} (transitional injection)`)
	}
}

function requireEnv(env) {
	const missing = ['getContentByPath', 'getDependencyGraph', 'getViewScriptTags']
		.filter(name => typeof env?.[name] !== 'function')
	if (missing.length > 0) {
		throw new TypeError(`[wxml] load: ctx.env missing ${missing.join(', ')}`)
	}
}

/** elem（cheerio）→ loc 诊断串 */
function elemLoc(elem) {
	if (typeof elem?.startIndex === 'number' && typeof elem.endIndex === 'number') {
		return ` loc=[${elem.startIndex},${elem.endIndex + 1})`
	}
	return ''
}

/**
 * @param {import('./document.js').WxmlDocument} document parse 产物（含 `_$` 投影句柄、`_source` 原文）
 * @param {object} ctx
 * @param {boolean} [ctx.isComponent]
 * @param {string} ctx.modulePath 模块路径（依赖图 owner / wxs graphOwner）
 * @param {string} ctx.sourcePath 依赖解析基准（去扩展名）
 * @param {object} [ctx.components] usingComponents
 * @param {object} [ctx.componentPlaceholder]
 * @param {Set<string>} [ctx.processedPaths]
 * @param {boolean} [ctx.hasOriginalContent] 主文档原始内容非空（多根包装条件）
 * @param {string} ctx.workPath
 * @param {RegExp} ctx.stripTemplateExtsRegex 模板扩展名剥离正则
 * @param {object} ctx.tools 转换算法（view-compiler 注入）
 * @param {object} ctx.env env 访问（getContentByPath / getDependencyGraph / getViewScriptTags）
 * @returns {object} LoadedGraph：展开后 Document（重投影，含 `_$`）+ templateModule + scriptModule + sourceTexts
 */
export function loadTemplates(document, ctx) {
	const {
		isComponent = false,
		modulePath,
		sourcePath,
		components = {},
		componentPlaceholder,
		processedPaths = new Set(),
		hasOriginalContent = true,
		workPath,
		stripTemplateExtsRegex,
		tools,
		env,
	} = ctx
	requireTools(tools)
	requireEnv(env)
	if (typeof workPath !== 'string') {
		throw new TypeError('[wxml] load: ctx.workPath is required')
	}
	if (!(stripTemplateExtsRegex instanceof RegExp)) {
		throw new TypeError('[wxml] load: ctx.stripTemplateExtsRegex is required')
	}

	const $ = document?._$
	if (!$) {
		throw new TypeError('[wxml] load: document projection handle (_$) is missing — load consumes a parsed Document, not raw source')
	}

	const sourceFile = document.sourceFile
	const originalContent = document._source ?? ''
	const sourceTexts = new Map()
	if (sourceFile !== undefined) {
		sourceTexts.set(sourceFile, originalContent)
	}

	const templateModule = []
	const scriptModule = []

	// —— 多根包装（页）：今日在主 DOM 上计数包装（load 归属） ——
	if (!isComponent && hasOriginalContent) {
		const root = $.root()
		if (root.children().length > 1) {
			const wrapper = $('<view></view>')
			wrapper.append(root.contents())
			root.append(wrapper)
		}
	}

	// —— include 展开：目标文件除 <template/> <wxs/> 外整体拷贝到 include 位置 ——
	const includeNodes = $('include')
	includeNodes.each((_, elem) => {
		const src = $(elem).attr('src')
		if (src) {
			const includeFullPath = tools.resolveTemplateDependencyPath(workPath, sourcePath, src)
			env.getDependencyGraph().addFile(modulePath, includeFullPath, 'view')
			let includePath = includeFullPath.replace(workPath, '').replace(stripTemplateExtsRegex, '')
			const includeDiagnosticSource = includeFullPath.startsWith(workPath)
				? includeFullPath.slice(workPath.length)
				: includePath

			if (!includePath.startsWith('/')) {
				includePath = '/' + includePath
			}

			let includeContent
			try {
				includeContent = env.getContentByPath(includeFullPath)
			}
			catch (error) {
				throw new Error(`[wxml] load: include read failed src=${src} sourceFile=${includeDiagnosticSource}${elemLoc(elem)} (${error?.message || error})`, { cause: error })
			}
			if (includeContent.trim()) {
				sourceTexts.set(includeDiagnosticSource, includeContent)
				tools.checkTemplateCompatibility(includeContent, includeDiagnosticSource, components)
				const $includeContent = loadProjection(includeContent)
				const componentTags = tools.collectIncludedComponentTags($includeContent, components)

				tools.transTagTemplate(
					$includeContent,
					templateModule,
					includePath,
					components,
					componentPlaceholder,
					{ path: includeDiagnosticSource, content: includeContent },
					modulePath,
				)

				tools.transTagWxs(
					$includeContent,
					scriptModule,
					includePath,
					modulePath,
				)

				tools.processIncludedFileWxsDependencies(componentTags, includePath, scriptModule, components, processedPaths)

				$includeContent('template').remove()
				$includeContent(env.getViewScriptTags().join(',')).remove()

				const processedContent = tools.processIncludeConditionalAttrs($, elem, $includeContent.html())
				$(elem).replaceWith(processedContent)
			}
			else {
				$(elem).remove()
			}
		}
		else {
			$(elem).remove()
		}
	})

	// —— 主文档 template 收集（load 归属） ——
	tools.transTagTemplate(
		$,
		templateModule,
		sourcePath,
		components,
		componentPlaceholder,
		{ path: sourceFile ?? modulePath, content: originalContent },
		modulePath,
	)

	// —— 主文档 wxs 收集（Wxs 编译在此发生：load 归属，禁止 parse） ——
	tools.transTagWxs($, scriptModule, sourcePath, modulePath)

	// —— import 展开：只收集目标文件的 template/wxs，不内联内容 ——
	const importNodes = $('import')
	importNodes.each((_, elem) => {
		const src = $(elem).attr('src')
		if (src) {
			const importFullPath = tools.resolveTemplateDependencyPath(workPath, sourcePath, src)
			env.getDependencyGraph().addFile(modulePath, importFullPath, 'view')
			let importPath = importFullPath.replace(workPath, '').replace(stripTemplateExtsRegex, '')
			const importDiagnosticSource = importFullPath.startsWith(workPath)
				? importFullPath.slice(workPath.length)
				: importPath

			if (!importPath.startsWith('/')) {
				importPath = '/' + importPath
			}

			let importContent
			try {
				importContent = env.getContentByPath(importFullPath)
			}
			catch (error) {
				throw new Error(`[wxml] load: import read failed src=${src} sourceFile=${importDiagnosticSource}${elemLoc(elem)} (${error?.message || error})`, { cause: error })
			}
			if (importContent.trim()) {
				sourceTexts.set(importDiagnosticSource, importContent)
				tools.checkTemplateCompatibility(importContent, importDiagnosticSource, components)
				const $$ = loadProjection(importContent)
				const componentTags = tools.collectIncludedComponentTags($$, components)
				tools.transTagTemplate(
					$$,
					templateModule,
					importPath,
					components,
					componentPlaceholder,
					{ path: importDiagnosticSource, content: importContent },
					modulePath,
				)

				tools.transTagWxs(
					$$,
					scriptModule,
					importPath,
					modulePath,
				)

				tools.processIncludedFileWxsDependencies(componentTags, importPath, scriptModule, components, processedPaths)
			}
		}
	})
	importNodes.remove()

	// —— 图片 assets（load 归属：主文档行） ——
	tools.transAsses($, $('image'), sourcePath, modulePath)

	// —— 展开后重投影：权威 Document 反映结构变更（含 loc；sourceTexts 可追溯） ——
	const expanded = projectDocument($, { sourceFile })
	attachProjection(expanded, '_$', $)
	attachProjection(expanded, '_source', originalContent)

	// 直接挂字段（spread 会丢非枚举投影句柄 _$ / _source）
	expanded.templateModule = templateModule
	expanded.scriptModule = scriptModule
	expanded.sourceTexts = sourceTexts
	return expanded
}