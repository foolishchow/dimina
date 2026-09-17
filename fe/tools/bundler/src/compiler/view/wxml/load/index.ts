/**
 * loadTemplates — load 阶段（fe-tools-wxml-refactor · W2）。
 *
 * 只经 Document 操作面访问树；投影工具句柄不得进入本模块。
 * include 内联节点经 Symbol(WIR_SRC) 标记源文件，供 vue 行源表使用。
 */
import { attachProjection } from '../common/document.ts'
import {
	bindDocument,
	getAttr,
	getRootChildren,
	queryAll,
	removeMatching,
	removeNode,
	replaceNode,
	serialize,
	wrapRootIfMulti,
} from '../common/document-ops.ts'
import { parseWxml } from '../parse.ts'

/**
 * @param {any} tools
 */
// @ts-expect-error P-TM05: type narrowing needed
function requireTools(tools) {
	const missing = ['transTagTemplate', 'transTagWxs', 'transAsses', 'resolveTemplateDependencyPath', 'collectIncludedComponentTags', 'processIncludedFileWxsDependencies', 'processIncludeConditionalAttrs', 'checkTemplateCompatibility']
		.filter(name => typeof tools?.[name] !== 'function')
	if (missing.length > 0) {
		throw new TypeError(`[wxml] load: ctx.tools missing ${missing.join(', ')} (transitional injection)`)
	}
}

/**
 * @param {any} node
 */
// @ts-expect-error P-TM05: type narrowing needed
function nodeLocSuffix(node) {
	const loc = node?.loc || node?.span
	if (loc && typeof loc.start === 'number' && typeof loc.end === 'number') {
		return ` loc=[${loc.start},${loc.end})`
	}
	return ''
}

/**
 * @param {any} env
 */
// @ts-expect-error P-TM05: type narrowing needed
function requireEnv(env) {
	const missing = ['getContentByPath', 'getDependencyGraph', 'getViewScriptTags']
		.filter(name => typeof env?.[name] !== 'function')
	if (missing.length > 0) {
		throw new TypeError(`[wxml] load: ctx.env missing ${missing.join(', ')}`)
	}
}

/**
 * @param {import('../common/wxml-ir.types.ts').WxmlDocument} document parse 产物（标准 Document；可挂 `_source` 原文）
 * @param {import('../common/wxml-ir.types.ts').LoadTemplatesCtx} ctx
 * @returns {import('../common/wxml-ir.types.ts').LoadedGraph} LoadedGraph：展开后 Document + templateModule + scriptModule + sourceTexts
 */
// @ts-expect-error P-TM05: type narrowing needed
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
	if (!document || !Array.isArray(document.body)) {
		throw new TypeError('[wxml] load: document body is required — load consumes a parsed Document, not raw source')
	}

	bindDocument(document)

	const sourceFile = document.sourceFile
	const originalContent = document._source ?? ''
	const sourceTexts = new Map()
	if (sourceFile !== undefined) {
		sourceTexts.set(sourceFile, originalContent)
	}

	/** @type {any[]} */
	// @ts-expect-error P-TM05: type narrowing needed
	const templateModule = []
	/** @type {any[]} */
	// @ts-expect-error P-TM05: type narrowing needed
	const scriptModule = []
	const WIR_SRC = Symbol.for('db.wxml-bridge.source')

	// —— 多根包装（页） ——
	if (!isComponent && hasOriginalContent) {
		wrapRootIfMulti(document, 'view')
	}

	// —— include 展开 ——
	const includeNodes = queryAll(document, 'include')
	for (const includeNode of includeNodes) {
		const src = getAttr(includeNode, 'src') ?? includeNode.src
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
				const err = /** @type {any} */ (error)
				// @ts-expect-error P-TM05: type narrowing needed
				throw new Error(`[wxml] load: include read failed src=${src} sourceFile=${includeDiagnosticSource}${nodeLocSuffix(includeNode)} (${err?.message || error})`, { cause: error })
			}
			if (includeContent.trim()) {
				sourceTexts.set(includeDiagnosticSource, includeContent)
				tools.checkTemplateCompatibility(includeContent, includeDiagnosticSource, components)
				const includeDoc = parseWxml(includeContent, { sourceFile: includeDiagnosticSource })
				const componentTags = tools.collectIncludedComponentTags(includeDoc, components)

				tools.transTagTemplate(
					includeDoc,
					// @ts-expect-error P-TM05: type narrowing needed
					templateModule,
					includePath,
					components,
					componentPlaceholder,
					{ path: includeDiagnosticSource, content: includeContent },
					modulePath,
				)

				tools.transTagWxs(
					includeDoc,
					// @ts-expect-error P-TM05: type narrowing needed
					scriptModule,
					includePath,
					modulePath,
				)

				// @ts-expect-error P-TM05: type narrowing needed
				tools.processIncludedFileWxsDependencies(componentTags, includePath, scriptModule, components, processedPaths)

				// @ts-expect-error P-TM05: type narrowing needed
				removeMatching(includeDoc, 'template-def')
				// @ts-expect-error P-TM05: type narrowing needed
				removeMatching(includeDoc, 'template-ref')
				// @ts-expect-error P-TM05: type narrowing needed
				removeMatching(includeDoc, 'template')
				// @ts-expect-error P-TM05: type narrowing needed
				removeMatching(includeDoc, env.getViewScriptTags().join(','))

				const nodes = tools.processIncludeConditionalAttrs(includeNode, includeDoc)
				// @ts-expect-error P-TM05: type narrowing needed
				const processedContent = typeof nodes === 'string' ? nodes : serialize({ body: nodes })
				const inserted = typeof nodes === 'string'
					// @ts-expect-error P-TM05: type narrowing needed
					? replaceNode(includeNode, parseWxml(nodes).body)
					: replaceNode(includeNode, nodes)
				for (const node of inserted) {
					markOriginTree(node, WIR_SRC, { source: includeDiagnosticSource, text: processedContent })
				}
			}
			else {
				removeNode(includeNode)
			}
		}
		else {
			removeNode(includeNode)
		}
	}

	// —— 主文档 template 收集 ——
	tools.transTagTemplate(
		document,
		// @ts-expect-error P-TM05: type narrowing needed
		templateModule,
		sourcePath,
		components,
		componentPlaceholder,
		{ path: sourceFile ?? modulePath, content: originalContent },
		modulePath,
	)

	// —— 主文档 wxs 收集 ——
	// @ts-expect-error P-TM05: type narrowing needed
	tools.transTagWxs(document, scriptModule, sourcePath, modulePath)

	// —— import 展开：只收集 template/wxs ——
	const importNodes = queryAll(document, 'import')
	for (const importNode of importNodes) {
		const src = getAttr(importNode, 'src') ?? importNode.src
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
				const err = /** @type {any} */ (error)
				// @ts-expect-error P-TM05: type narrowing needed
				throw new Error(`[wxml] load: import read failed src=${src} sourceFile=${importDiagnosticSource}${nodeLocSuffix(importNode)} (${err?.message || error})`, { cause: error })
			}
			if (importContent.trim()) {
				sourceTexts.set(importDiagnosticSource, importContent)
				tools.checkTemplateCompatibility(importContent, importDiagnosticSource, components)
				const importDoc = parseWxml(importContent, { sourceFile: importDiagnosticSource })
				const componentTags = tools.collectIncludedComponentTags(importDoc, components)
				tools.transTagTemplate(
					importDoc,
					// @ts-expect-error P-TM05: type narrowing needed
					templateModule,
					importPath,
					components,
					componentPlaceholder,
					{ path: importDiagnosticSource, content: importContent },
					modulePath,
				)

				tools.transTagWxs(
					importDoc,
					// @ts-expect-error P-TM05: type narrowing needed
					scriptModule,
					importPath,
					modulePath,
				)

				// @ts-expect-error P-TM05: type narrowing needed
				tools.processIncludedFileWxsDependencies(componentTags, importPath, scriptModule, components, processedPaths)
			}
		}
		removeNode(importNode)
	}

	// —— 图片 assets ——
	tools.transAsses(document, queryAll(document, 'image'), sourcePath, modulePath)

	attachProjection(document, '_source', originalContent)
	attachProjection(document, '_WIR_SRC', WIR_SRC)

	const loaded = /** @type {import('../common/wxml-ir.types.ts').LoadedGraph} */ (document)
	// @ts-expect-error P-TM05: type narrowing needed
	loaded.templateModule = templateModule
	// @ts-expect-error P-TM05: type narrowing needed
	loaded.scriptModule = scriptModule
	loaded.sourceTexts = sourceTexts
	return loaded
}

/**
 * @param {any} node
 * @param {any} key
 * @param {any} entry
 */
// @ts-expect-error P-TM05: type narrowing needed
function markOriginTree(node, key, entry) {
	if (!node || typeof node !== 'object') {
		return
	}
	node[key] = entry
	const kids = node.children
	if (Array.isArray(kids)) {
		for (const child of kids) {
			markOriginTree(child, key, entry)
		}
	}
}

export { getRootChildren }
