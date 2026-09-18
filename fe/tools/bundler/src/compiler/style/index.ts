import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileStyle } from '@vue/compiler-sfc'
import type { RawSourceMap } from 'source-map-js'
import autoprefixer from 'autoprefixer'
import { transform } from 'esbuild'
import postcss from 'postcss'
import type { Attribute as SelectorAttribute, AttributeOptions } from 'postcss-selector-parser'
import selectorParser from 'postcss-selector-parser'
import { collectAssets, isCollectableImageAsset, resolveAssetSourcePath, tagWhiteList, transformRpx } from '../../shared/utils.ts'
import { getAppId, getComponent, getContentByPath, getDependencyGraph, getStyleExts, getTargetPath, getWorkPath, resetStoreInfo } from '../core/env.ts'
import { defineEngine } from '../worker-runtime/define-engine.ts'  // P-WR02
import type { CompileOptions } from '../worker-runtime/define-engine.ts'
import { abilityContext } from '../worker-runtime/context.ts'  // P-WR03
import { concatSourcemap, createLineSourcemap, remapSourcemap } from '../core/sourcemap.ts'
const compileRes = new Map<string, { code: string; map: string | null }>()
const builtInTagNames = new Set(tagWhiteList)
const autoprefixerPlugin = autoprefixer({ overrideBrowserslist: ['cover 99.5%'] })
let cssnanoLoader: Promise<typeof import('cssnano')['default']> | undefined
let lessLoader: Promise<any> | undefined
let sassLoader: Promise<typeof import('sass')> | undefined

function loadCssnano() {
	cssnanoLoader ||= import('cssnano').then(module => module.default)
	return cssnanoLoader
}

function loadLess() {
	lessLoader ||= import('less' as never).then((module: Record<string, unknown>) => module.default)
	return lessLoader
}

function loadSass() {
	sassLoader ||= import('sass')
	return sassLoader
}


/**
 *  编译样式文件
 */
interface StyleModule {
	path: string
	absolutePath?: string
	id?: string
	ownerPath?: string
	usingComponents?: Record<string, string>
}
interface StyleOptions {
	sourcemap?: boolean
	minify?: boolean
}
interface StyleCompileResult {
	code: string
	map: string | null
}
interface Progress {
	completedTasks: number
}
async function compileSS(pages: StyleModule[], root: string | null, progress: Progress, options: StyleOptions = {}): Promise<void> {
	// page 样式
	for (const page of pages) {
		const result = await buildCompileCss(page, new Set(), options)
		let code = result.code
		const filename = `${page.path.replace(/\//g, '_')}`
		const outputDir = root
			? `${getTargetPath()}/${root}`
			: `${getTargetPath()}/main`
		// 相对发布根的物化路径前缀（D-P2）
		const relPrefix = root ? `${root}` : 'main'
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true })
		}
		if (options.sourcemap) {
			const mapFileName = `${filename}.css.map`
			const map = JSON.parse(result.map as string)
			map.file = `${filename}.css`
			code += `\n/*# sourceMappingURL=${mapFileName} */\n`
			const { sink } = abilityContext.getStore() as { sink: { write: (data: Record<string, unknown>) => void } }
			sink.write({
				entryId: page.path,
				kind: 'style',
				files: [{ path: `${relPrefix}/${filename}.css`, code }],
				sourcemaps: [{ path: `${relPrefix}/${mapFileName}`, map: JSON.stringify(map) }],
			})
		}
		else {
			const { sink } = abilityContext.getStore() as { sink: { write: (data: Record<string, unknown>) => void } }
			sink.write({
				entryId: page.path,
				kind: 'style',
				files: [{ path: `${relPrefix}/${filename}.css`, code }],
			})
		}

		progress.completedTasks++
	}
}
async function buildCompileCss(module: StyleModule, compiledPaths: Set<string> = new Set(), options: StyleOptions = {}): Promise<StyleCompileResult> {
	const chunks: StyleCompileResult[] = []
	const pendingModules = [module]

	while (pendingModules.length > 0) {
		const currentModule = pendingModules.pop()!
		const currentPath = currentModule.path || currentModule.absolutePath || ''

		// A component stylesheet only needs to be emitted once per page traversal.
		// Mark it before visiting children so self and mutual references close
		// naturally without a fixed depth limit.
		if (compiledPaths.has(currentPath)) {
			continue
		}
		compiledPaths.add(currentPath)
		const result = await enhanceCSS(currentModule, options)
		if (result.code) {
			chunks.push(result)
		}

		// Preserve the original depth-first, declaration-order traversal while
		// using an explicit stack instead of the JavaScript call stack.
		const graphDependencies = getDependencyGraph().getDirectDependencies(currentPath, 'component')
		const componentPaths: string[] = graphDependencies.length > 0
			? graphDependencies
			: Object.values(currentModule.usingComponents || {})
		for (let index = componentPaths.length - 1; index >= 0; index--) {
			const componentModule = getComponent(componentPaths[index]) as StyleModule | null
			if (componentModule) {
				pendingModules.push(componentModule as StyleModule)
			}
		}
	}
	if (options.sourcemap) {
		const { code, sourcemap: map } = concatSourcemap(chunks)
		return { code, map }
	}
	return { code: chunks.map(chunk => chunk.code).join(''), map: null }
}
function createExternalClassPlugin(moduleId: string): { postcssPlugin: string; Rule: (rule: postcss.Rule) => void } {
	const scopeAttribute = `data-v-${moduleId}`
	const externalScopeAttribute = 'data-dd-external-class-scope'
	const processedRules = new WeakSet()
	const selectorProcessor = selectorParser((selectors) => {
		for (const selector of [...selectors.nodes]) {
			const boostedSelector = selector.clone()
			const scopeNodes: SelectorAttribute[] = []
			boostedSelector.walkAttributes((attribute) => {
				if (attribute.attribute === scopeAttribute) {
					scopeNodes.push(attribute)
				}
			})
			const targetScope = scopeNodes.at(-1)
			if (!targetScope) {
				continue
			}
			targetScope.parent!.insertAfter(targetScope, selectorParser.attribute({
				attribute: externalScopeAttribute,
				operator: '~=',
				quoteMark: '"',
				value: scopeAttribute,
			} as AttributeOptions))
			selectors.append(boostedSelector)
		}
	})
	return {
		postcssPlugin: 'dimina-external-class',
		Rule(rule) {
			if (processedRules.has(rule) || !moduleId || !rule.selector.includes(`[${scopeAttribute}]`)) {
				return
			}
			processedRules.add(rule)

			try {
				rule.selector = selectorProcessor.processSync(rule.selector)
			}
			catch (error) {
				throw rule.error((error as Error).message, { plugin: 'dimina-external-class' })
			}
		},
	}
}
function boostExternalClassSelectors(cssCode: string, moduleId: string): string {
	if (!moduleId || !cssCode) {
		return cssCode
	}

	return postcss([createExternalClassPlugin(moduleId)])
		.process(cssCode, { from: undefined }).css
}
function getStyleSourcePath(absolutePath: string): string {
	const workPath = getWorkPath()
	if (absolutePath === workPath || absolutePath.startsWith(`${workPath}${path.sep}`)) {
		return `/${path.relative(workPath, absolutePath).split(path.sep).join('/')}`
	}
	return absolutePath.split(path.sep).join('/')
}
function createStyleCompileError(stage: string, absolutePath: string, cause: unknown): Error & { file?: string; line?: number; column?: number; stage?: string } {
	if ((cause as { name?: string })?.name === 'StyleCompileError') {
		return cause as Error & { file?: string; line?: number; column?: number; stage?: string }
	}

	const causeObj = cause as { line?: number; span?: { start?: { line?: number; column?: number } }; column?: number; reason?: string; sassMessage?: string; message?: string }
	const line = causeObj.line ?? (Number.isInteger(causeObj.span?.start?.line) ? (causeObj.span!.start!.line! + 1) : undefined)
	const column = causeObj.column ?? (Number.isInteger(causeObj.span?.start?.column) ? (causeObj.span!.start!.column! + 1) : undefined)
	const file = getStyleSourcePath(absolutePath)
	const location = line == null
		? file
		: `${file}:${line}${column == null ? '' : `:${column}`}`
	const reason = causeObj.reason || causeObj.sassMessage || causeObj.message || String(cause)
	const error = new Error(`[style:${stage}] ${location} ${reason}`, { cause }) as Error & { file?: string; line?: number; column?: number; stage?: string }
	error.name = 'StyleCompileError'
	error.file = file
	error.line = line
	error.column = column
	error.stage = stage
	return error
}
function normalizePreprocessorMap(inputMap: string | Record<string, unknown>, absolutePath: string, inputCSS: string): Record<string, unknown> {
	const map = (typeof inputMap === 'string' ? JSON.parse(inputMap) : structuredClone(inputMap)) as Record<string, unknown> & { sources: string[]; sourcesContent?: unknown[] }
	const sourcePaths = map.sources.map((source) => {
		let resolvedPath = source
		if (source.startsWith('file:')) {
			resolvedPath = fileURLToPath(source)
		}
		else if (!path.isAbsolute(source)) {
			resolvedPath = path.resolve(path.dirname(absolutePath), source)
		}
		return resolvedPath
	})

	map.sources = sourcePaths.map(getStyleSourcePath)
	map.sourcesContent = map.sources.map((_, index) => {
		if (sourcePaths[index] === absolutePath) {
			return inputCSS
		}
		return map.sourcesContent?.[index] ?? null
	})
	return map
}
function getPostcssMapOptions(sourcemap: boolean, prev: unknown): boolean | Record<string, unknown> {
	if (!sourcemap) {
		return false
	}
	return {
		inline: false,
		annotation: false,
		sourcesContent: true,
		prev,
	}
}
function createStyleTransformPlugin(module: StyleModule, absolutePath: string, importResults: Promise<StyleCompileResult>[], options: StyleOptions): { postcssPlugin: string; AtRule: (node: postcss.AtRule) => void; Rule: (rule: postcss.Rule) => void; Comment: (comment: postcss.Comment) => void; Declaration: (declaration: postcss.Declaration) => void } {
	const processedRules = new WeakSet()
	const selectorProcessor = selectorParser((selectors) => {
		selectors.walkTags((tag) => {
			if (builtInTagNames.has(tag.value)) {
				tag.value = `.dd-${tag.value}`
			}
		})
	})
	return {
		postcssPlugin: 'dimina-style-transform',
		AtRule(node) {
			if (node.name !== 'import') {
				return
			}

			const importPath = node.params.replace(/^['"]|['"]$/g, '')
			const importFullPath = resolveStyleImportPath(absolutePath, importPath)
			node.remove()
			importResults.push(buildCompileCss({
				path: '',
				absolutePath: importFullPath,
				id: module.id,
				ownerPath: module.ownerPath || module.path,
			}, new Set(), options))
		},
		Rule(rule) {
			if (processedRules.has(rule)) {
				return
			}
			processedRules.add(rule)

			if (rule.selector.includes('::v-deep')) {
				rule.selector = rule.selector.replace(/::v-deep\s+(\S[^{]*)/g, ':deep($1)')
			}

			if (rule.selector.includes(':host')) {
				rule.selector = processHostSelector(rule.selector, module.id as string)
			}

			try {
				rule.selector = selectorProcessor.processSync(rule.selector)
			}
			catch (error) {
				throw rule.error((error as Error).message, { plugin: 'dimina-style-transform' })
			}
		},
		Comment(comment) {
			comment.remove()
		},
		Declaration(declaration) {
			declaration.value = normalizeCssUrlValue(
				declaration.value,
				absolutePath,
				module.ownerPath || module.path,
			)
			declaration.value = transformRpx(declaration.value)
		},
	}
}
async function enhanceCSS(module: StyleModule, options: StyleOptions = {}): Promise<StyleCompileResult> {
	const absolutePath = module.absolutePath ? module.absolutePath : getAbsolutePath(module.path)
	if (!absolutePath) {
		// 样式文件不存在
		return { code: '', map: null }
	}
	const graphOwnerPath = module.ownerPath || module.path
	if (graphOwnerPath) {
		getDependencyGraph().addFile(graphOwnerPath, absolutePath, 'style')
	}
	const cacheKey = `${absolutePath}::${module.id || ''}::${options.sourcemap ? 'map' : 'plain'}::minify:${options.minify !== false}`

	const inputCSS = getContentByPath(absolutePath)
	if (!inputCSS) {
		return { code: '', map: null }
	}

	if (compileRes.has(cacheKey)) {
		return compileRes.get(cacheKey) as StyleCompileResult
	}

	// 预处理器编译
	let processedCSS = normalizeRootStyleImports(inputCSS)
	let processedMap: Record<string, unknown> | string | null = options.sourcemap
		? createLineSourcemap(processedCSS, getStyleSourcePath(absolutePath), inputCSS)
		: null
	const ext = path.extname(absolutePath).toLowerCase()

	try {
		if (ext === '.less') {
			const less = await loadLess()
			const result = await less.render(processedCSS, {
				filename: absolutePath,
				paths: [path.dirname(absolutePath), getWorkPath()],
				sourceMap: options.sourcemap
					? {
						outputSourceFiles: true,
						disableSourcemapAnnotation: true,
					}
					: undefined,
			})
			processedCSS = result.css
			if (options.sourcemap) {
				processedMap = normalizePreprocessorMap(result.map as string, absolutePath, inputCSS)
			}
		}
		else if (ext === '.scss' || ext === '.sass') {
			const sass = await loadSass()
			const result = sass.compileString(processedCSS, {
				loadPaths: [path.dirname(absolutePath), getWorkPath()],
				syntax: ext === '.sass' ? 'indented' : 'scss',
				url: options.sourcemap ? pathToFileURL(absolutePath) : undefined,
				sourceMap: !!options.sourcemap,
				sourceMapIncludeSources: !!options.sourcemap,
			})
			processedCSS = result.css
			if (options.sourcemap) {
				processedMap = normalizePreprocessorMap(result.sourceMap as unknown as string, absolutePath, inputCSS)
			}
		}
	}
	catch (error) {
		throw createStyleCompileError('preprocess', absolutePath, error)
	}

	const fixedCSS = ensureImportSemicolons(processedCSS)
	if (options.sourcemap && fixedCSS !== processedCSS) {
		const normalizeMap = createLineSourcemap(fixedCSS, absolutePath, processedCSS)
		processedMap = remapSourcemap(normalizeMap, processedMap) as Record<string, unknown>
	}
	const importResults: Promise<StyleCompileResult>[] = []
	// 把基础转换交给 compileStyle 的同一条 PostCSS 管线，避免作用域处理前重复解析 CSS。
	const moduleId = module.id
	let scopedResult
	try {
		scopedResult = compileStyle({
			source: fixedCSS,
			filename: getStyleSourcePath(absolutePath),
			id: moduleId as string,
			scoped: !!moduleId,
			inMap: options.sourcemap ? (processedMap as unknown as RawSourceMap) : undefined,
			postcssPlugins: [
				createStyleTransformPlugin(module, absolutePath, importResults, options),
			],
		})
		if (scopedResult.errors.length > 0) {
			throw scopedResult.errors[0]
		}
	}
	catch (error) {
		const stage = (error as { plugin?: string })?.plugin === 'vue-sfc-vars' || (error as { plugin?: string })?.plugin === 'vue-sfc-scoped'
			? 'scope'
			: 'transform'
		throw createStyleCompileError(stage, absolutePath, error)
	}

	// external-class 与 autoprefixer/cssnano 共享一次 PostCSS 解析。
	let finalResult
	try {
		const postcssPlugins = [createExternalClassPlugin(moduleId as string), autoprefixerPlugin] as postcss.Plugin[]
		const shouldMinify = options.minify !== false
		if (options.sourcemap) {
			if (shouldMinify) {
				const cssnano = await loadCssnano()
				postcssPlugins.push(cssnano() as unknown as postcss.Plugin)
			}
			finalResult = await postcss(postcssPlugins).process(scopedResult.code, {
				from: undefined,
				map: getPostcssMapOptions(true, scopedResult.map as unknown as Record<string, unknown>),
			})
		}
		else {
			const prefixedResult = await postcss(postcssPlugins).process(scopedResult.code, { from: undefined })
			if (shouldMinify) {
				const minifiedResult = await transform(prefixedResult.css, {
					loader: 'css',
					minify: true,
				})
				finalResult = { css: minifiedResult.code, map: null }
			}
			else {
				finalResult = { css: prefixedResult.css, map: null }
			}
		}
	}
	catch (error) {
		const stage = (error as { plugin?: string })?.plugin === 'dimina-external-class' ? 'external-class' : 'postprocess'
		throw createStyleCompileError(stage, absolutePath, error)
	}

	// 处理导入的样式
	const importedChunks = (await Promise.all(importResults)).filter(result => result.code)
	let result
	if (options.sourcemap) {
		const { code, sourcemap: map } = concatSourcemap([
			...importedChunks,
			{ code: finalResult.css, map: (finalResult.map as { toString: () => string }).toString() },
		])
		result = { code, map }
	}
	else {
		result = {
			code: importedChunks.map(chunk => chunk.code).join('') + finalResult.css,
			map: null,
		}
	}

	compileRes.set(cacheKey, result)

	return result
}
function normalizeCssUrlValue(value: string, absolutePath: string, graphOwnerPath: string | undefined): string {
	return value.replace(/url\(([^)]+)\)/g, (fullMatch, rawUrl) => {
		const cleanedUrl = rawUrl.trim().replace(/^['"]|['"]$/g, '')

		if (!cleanedUrl || cleanedUrl.startsWith('data:image')) {
			return fullMatch
		}

		if (cleanedUrl.startsWith('//')) {
			return `url(https:${cleanedUrl})`
		}

		if (/^(https?:|blob:|data:)/.test(cleanedUrl)) {
			return fullMatch
		}

		if (graphOwnerPath && isCollectableImageAsset(cleanedUrl)) {
			getDependencyGraph().addFile(
				graphOwnerPath,
				resolveAssetSourcePath(getWorkPath(), absolutePath, cleanedUrl),
				'style',
			)
		}
		const realSrc = collectAssets(getWorkPath(), absolutePath, cleanedUrl, getTargetPath(), getAppId()!)
		return `url(${realSrc})`
	})
}
function getAbsolutePath(modulePath: string): string | undefined {
	const workPath = getWorkPath()
	const src = modulePath.startsWith('/') ? modulePath : `/${modulePath}`

	for (const ssType of getStyleExts()) {
		const ssFullPath = `${workPath}${src}${ssType}`
		if (fs.existsSync(ssFullPath)) {
			return ssFullPath
		}

		const indexSsFullPath = `${workPath}${src}/index${ssType}`
		if (fs.existsSync(indexSsFullPath)) {
			return indexSsFullPath
		}
	}
}
function resolveStyleImportPath(absolutePath: string, importPath: string, workPath: string = getWorkPath()): string {
	if (importPath.startsWith('/')) {
		return path.join(workPath, importPath)
	}
	return path.resolve(path.dirname(absolutePath), importPath)
}
function normalizeRootStyleImports(source: string, workPath: string = getWorkPath()): string {
	return source.replace(/(@import\s+(?:\(.*?\)\s*)?(?:url\()?['"])(\/[^'")]+)(['"]\)?)/g, (_, prefix, importPath, suffix) => {
		return `${prefix}${path.join(workPath, importPath)}${suffix}`
	})
}

/**
 * Ensures that all @import statements in CSS end with semicolons
 * @param {string} css - The CSS content to process
 * @returns {string} - The processed CSS with semicolons added to @import statements as needed
 */
function ensureImportSemicolons(css: string): string {
	// 查找所有未以分号结尾的@import语句，并在它们后面添加分号
	return css.replace(/@import[^;\n]*$/gm, (match) => {
		// Check if the match already ends with a semicolon
		return match.endsWith(';') ? match : `${match};`
	})
}

/**
 * 处理 :host 选择器，将其转换为适合组件根节点的选择器
 * @param {string} selector - 包含 :host 的选择器
 * @param {string} moduleId - 组件的模块ID
 * @returns {string} - 转换后的选择器
 */
function processHostSelector(selector: string, moduleId: string): string {
	const hostSelector = `[data-dd-style-host~="${moduleId}"]`

	return selector
		// :host(.class) 选择带有特定类的组件根节点
		.replace(/:host\(([^)]+)\)/g, `${hostSelector}$1`)
		// 宿主标记与 data-v 样式作用域分离，避免 shared 作用域扩散后 :host 误命中页面节点。
		.replace(/:host(?![\w-])/g, hostSelector)
}

export { boostExternalClassSelectors, compileSS, ensureImportSemicolons, normalizeCssUrlValue, normalizeRootStyleImports, processHostSelector, resolveStyleImportPath }

// P-WR02: engine export（不动调度，F47）
async function styleCompile({ msg, progress, config }: CompileOptions): Promise<void> {
	const m = msg as { storeInfo: Parameters<typeof resetStoreInfo>[0]; sourcemap?: boolean; pages: { mainPages: StyleModule[]; subPages: Record<string, { info: StyleModule[]; independent: boolean }> } }
	resetStoreInfo(m.storeInfo)

	const styleOptions: StyleOptions = { sourcemap: m.sourcemap, minify: (config as { minify?: boolean }).minify }
	await compileSS(m.pages.mainPages, null, progress as Progress, styleOptions)
	for (const [root, subPages] of Object.entries(m.pages.subPages)) {
		await compileSS(subPages.info, root, progress as Progress, styleOptions)
	}

	compileRes.clear()
}
function styleNormalizeError(e: Error): Record<string, unknown> {
	const err = e as Error & Record<string, unknown>
	return { message: err.message, stack: err.stack, name: err.name, file: err.file, line: err.line, column: err.column, stage: err.stage }
}

export const styleEngine = defineEngine({
	name: 'style',
	compile: styleCompile,
	cleanup: () => {},
	normalizeError: styleNormalizeError,
})
