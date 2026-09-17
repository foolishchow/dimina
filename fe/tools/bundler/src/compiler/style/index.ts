import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileStyle } from '@vue/compiler-sfc'
import autoprefixer from 'autoprefixer'
import { transform } from 'esbuild'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { collectAssets, isCollectableImageAsset, resolveAssetSourcePath, tagWhiteList, transformRpx } from '../../shared/utils.ts'
import { getAppId, getComponent, getContentByPath, getDependencyGraph, getStyleExts, getTargetPath, getWorkPath, resetStoreInfo } from '../core/env.ts'
import { defineEngine } from '../worker-runtime/define-engine.ts'  // P-WR02
import { abilityContext } from '../worker-runtime/context.ts'  // P-WR03
import { concatSourcemap, createLineSourcemap, remapSourcemap } from '../core/sourcemap.ts'
const compileRes = new Map()
const builtInTagNames = new Set(tagWhiteList)
const autoprefixerPlugin = autoprefixer({ overrideBrowserslist: ['cover 99.5%'] })
let cssnanoLoader
let lessLoader
let sassLoader

function loadCssnano() {
	cssnanoLoader ||= import('cssnano').then(module => module.default)
	return cssnanoLoader
}

function loadLess() {
	// @ts-expect-error P-TM05: type narrowing needed
	lessLoader ||= import('less').then(module => module.default)
	return lessLoader
}

function loadSass() {
	sassLoader ||= import('sass')
	return sassLoader
}


/**
 *  编译样式文件
 */
// @ts-expect-error P-TM05: type narrowing needed
async function compileSS(pages, root, progress, options = {}) {
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

		// @ts-expect-error P-TM05: type narrowing needed
		if (options.sourcemap) {
			const mapFileName = `${filename}.css.map`
			// @ts-expect-error P-TM05: type narrowing needed
			const map = JSON.parse(result.map)
			map.file = `${filename}.css`
			code += `\n/*# sourceMappingURL=${mapFileName} */\n`
			// @ts-expect-error P-TM05: type narrowing needed
			const { sink } = abilityContext.getStore()
			sink.write({
				entryId: page.path,
				kind: 'style',
				files: [{ path: `${relPrefix}/${filename}.css`, code }],
				sourcemaps: [{ path: `${relPrefix}/${mapFileName}`, map: JSON.stringify(map) }],
			})
		}
		else {
			// @ts-expect-error P-TM05: type narrowing needed
			const { sink } = abilityContext.getStore()
			sink.write({
				entryId: page.path,
				kind: 'style',
				files: [{ path: `${relPrefix}/${filename}.css`, code }],
			})
		}

		progress.completedTasks++
	}
}

// @ts-expect-error P-TM05: type narrowing needed
async function buildCompileCss(module, compiledPaths = new Set(), options = {}) {
	const chunks = []
	const pendingModules = [module]

	while (pendingModules.length > 0) {
		const currentModule = pendingModules.pop()
		const currentPath = currentModule.path || currentModule.absolutePath

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
		const componentPaths = graphDependencies.length > 0
			? graphDependencies
			: Object.values(currentModule.usingComponents || {})
		for (let index = componentPaths.length - 1; index >= 0; index--) {
			// @ts-expect-error P-TM05: type narrowing needed
			const componentModule = getComponent(componentPaths[index])
			if (componentModule) {
				pendingModules.push(componentModule)
			}
		}
	}

	// @ts-expect-error P-TM05: type narrowing needed
	if (options.sourcemap) {
		const { code, sourcemap: map } = concatSourcemap(chunks)
		return { code, map }
	}
	return { code: chunks.map(chunk => chunk.code).join(''), map: null }
}

// @ts-expect-error P-TM05: type narrowing needed
function createExternalClassPlugin(moduleId) {
	const scopeAttribute = `data-v-${moduleId}`
	const externalScopeAttribute = 'data-dd-external-class-scope'
	const processedRules = new WeakSet()
	const selectorProcessor = selectorParser((selectors) => {
		for (const selector of [...selectors.nodes]) {
			const boostedSelector = selector.clone()
			// @ts-expect-error P-TM05: type narrowing needed
			const scopeNodes = []
			boostedSelector.walkAttributes((attribute) => {
				if (attribute.attribute === scopeAttribute) {
					scopeNodes.push(attribute)
				}
			})

			// @ts-expect-error P-TM05: type narrowing needed
			const targetScope = scopeNodes.at(-1)
			if (!targetScope) {
				continue
			}

			// @ts-expect-error P-TM05: type narrowing needed
			targetScope.parent.insertAfter(targetScope, selectorParser.attribute({
				attribute: externalScopeAttribute,
				operator: '~=',
				quoteMark: '"',
				value: scopeAttribute,
			}))
			selectors.append(boostedSelector)
		}
	})
	return {
		postcssPlugin: 'dimina-external-class',
		// @ts-expect-error P-TM05: type narrowing needed
		Rule(rule) {
			if (processedRules.has(rule) || !moduleId || !rule.selector.includes(`[${scopeAttribute}]`)) {
				return
			}
			processedRules.add(rule)

			try {
				rule.selector = selectorProcessor.processSync(rule.selector)
			}
			catch (error) {
				// @ts-expect-error P-TM05: type narrowing needed
				throw rule.error(error.message, { plugin: 'dimina-external-class' })
			}
		},
	}
}

// @ts-expect-error P-TM05: type narrowing needed
function boostExternalClassSelectors(cssCode, moduleId) {
	if (!moduleId || !cssCode) {
		return cssCode
	}

	return postcss([createExternalClassPlugin(moduleId)])
		.process(cssCode, { from: undefined }).css
}

// @ts-expect-error P-TM05: type narrowing needed
function getStyleSourcePath(absolutePath) {
	const workPath = getWorkPath()
	if (absolutePath === workPath || absolutePath.startsWith(`${workPath}${path.sep}`)) {
		return `/${path.relative(workPath, absolutePath).split(path.sep).join('/')}`
	}
	return absolutePath.split(path.sep).join('/')
}

// @ts-expect-error P-TM05: type narrowing needed
function createStyleCompileError(stage, absolutePath, cause) {
	if (cause?.name === 'StyleCompileError') {
		return cause
	}

	const line = cause?.line ?? (Number.isInteger(cause?.span?.start?.line) ? cause.span.start.line + 1 : undefined)
	const column = cause?.column ?? (Number.isInteger(cause?.span?.start?.column) ? cause.span.start.column + 1 : undefined)
	const file = getStyleSourcePath(absolutePath)
	const location = line == null
		? file
		: `${file}:${line}${column == null ? '' : `:${column}`}`
	const reason = cause?.reason || cause?.sassMessage || cause?.message || String(cause)
	const error = new Error(`[style:${stage}] ${location} ${reason}`, { cause })
	error.name = 'StyleCompileError'
	// @ts-expect-error P-TM05: type narrowing needed
	error.file = file
	// @ts-expect-error P-TM05: type narrowing needed
	error.line = line
	// @ts-expect-error P-TM05: type narrowing needed
	error.column = column
	// @ts-expect-error P-TM05: type narrowing needed
	error.stage = stage
	return error
}

// @ts-expect-error P-TM05: type narrowing needed
function normalizePreprocessorMap(inputMap, absolutePath, inputCSS) {
	const map = typeof inputMap === 'string' ? JSON.parse(inputMap) : structuredClone(inputMap)
	// @ts-expect-error P-TM05: type narrowing needed
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
	// @ts-expect-error P-TM05: type narrowing needed
	map.sourcesContent = map.sources.map((_, index) => {
		if (sourcePaths[index] === absolutePath) {
			return inputCSS
		}
		return map.sourcesContent?.[index] ?? null
	})
	return map
}

// @ts-expect-error P-TM05: type narrowing needed
function getPostcssMapOptions(sourcemap, prev) {
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

// @ts-expect-error P-TM05: type narrowing needed
function createStyleTransformPlugin(module, absolutePath, importResults, options) {
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
		// @ts-expect-error P-TM05: type narrowing needed
		AtRule(node) {
			if (node.name !== 'import') {
				return
			}

			const importPath = node.params.replace(/^['"]|['"]$/g, '')
			const importFullPath = resolveStyleImportPath(absolutePath, importPath)
			node.remove()
			importResults.push(buildCompileCss({
				absolutePath: importFullPath,
				id: module.id,
				ownerPath: module.ownerPath || module.path,
			}, new Set(), options))
		},
		// @ts-expect-error P-TM05: type narrowing needed
		Rule(rule) {
			if (processedRules.has(rule)) {
				return
			}
			processedRules.add(rule)

			if (rule.selector.includes('::v-deep')) {
				rule.selector = rule.selector.replace(/::v-deep\s+(\S[^{]*)/g, ':deep($1)')
			}

			if (rule.selector.includes(':host')) {
				rule.selector = processHostSelector(rule.selector, module.id)
			}

			try {
				rule.selector = selectorProcessor.processSync(rule.selector)
			}
			catch (error) {
				// @ts-expect-error P-TM05: type narrowing needed
				throw rule.error(error.message, { plugin: 'dimina-style-transform' })
			}
		},
		// @ts-expect-error P-TM05: type narrowing needed
		Comment(comment) {
			comment.remove()
		},
		// @ts-expect-error P-TM05: type narrowing needed
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

// @ts-expect-error P-TM05: type narrowing needed
async function enhanceCSS(module, options = {}) {
	const absolutePath = module.absolutePath ? module.absolutePath : getAbsolutePath(module.path)
	if (!absolutePath) {
		// 样式文件不存在
		return { code: '', map: null }
	}
	const graphOwnerPath = module.ownerPath || module.path
	if (graphOwnerPath) {
		getDependencyGraph().addFile(graphOwnerPath, absolutePath, 'style')
	}
	// @ts-expect-error P-TM05: type narrowing needed
	const cacheKey = `${absolutePath}::${module.id || ''}::${options.sourcemap ? 'map' : 'plain'}::minify:${options.minify !== false}`

	const inputCSS = getContentByPath(absolutePath)
	if (!inputCSS) {
		return { code: '', map: null }
	}

	if (compileRes.has(cacheKey)) {
		return compileRes.get(cacheKey)
	}

	// 预处理器编译
	let processedCSS = normalizeRootStyleImports(inputCSS)
	// @ts-expect-error P-TM05: type narrowing needed
	let processedMap = options.sourcemap
		? createLineSourcemap(processedCSS, getStyleSourcePath(absolutePath), inputCSS)
		: null
	const ext = path.extname(absolutePath).toLowerCase()

	try {
		if (ext === '.less') {
			const less = await loadLess()
			const result = await less.render(processedCSS, {
				filename: absolutePath,
				paths: [path.dirname(absolutePath), getWorkPath()],
				// @ts-expect-error P-TM05: type narrowing needed
				sourceMap: options.sourcemap
					? {
						outputSourceFiles: true,
						disableSourcemapAnnotation: true,
					}
					: undefined,
			})
			processedCSS = result.css
			// @ts-expect-error P-TM05: type narrowing needed
			if (options.sourcemap) {
				processedMap = normalizePreprocessorMap(result.map, absolutePath, inputCSS)
			}
		}
		else if (ext === '.scss' || ext === '.sass') {
			const sass = await loadSass()
			const result = sass.compileString(processedCSS, {
				loadPaths: [path.dirname(absolutePath), getWorkPath()],
				syntax: ext === '.sass' ? 'indented' : 'scss',
				// @ts-expect-error P-TM05: type narrowing needed
				url: options.sourcemap ? pathToFileURL(absolutePath) : undefined,
				// @ts-expect-error P-TM05: type narrowing needed
				sourceMap: !!options.sourcemap,
				// @ts-expect-error P-TM05: type narrowing needed
				sourceMapIncludeSources: !!options.sourcemap,
			})
			processedCSS = result.css
			// @ts-expect-error P-TM05: type narrowing needed
			if (options.sourcemap) {
				processedMap = normalizePreprocessorMap(result.sourceMap, absolutePath, inputCSS)
			}
		}
	}
	catch (error) {
		throw createStyleCompileError('preprocess', absolutePath, error)
	}

	const fixedCSS = ensureImportSemicolons(processedCSS)
	// @ts-expect-error P-TM05: type narrowing needed
	if (options.sourcemap && fixedCSS !== processedCSS) {
		const normalizeMap = createLineSourcemap(fixedCSS, absolutePath, processedCSS)
		// @ts-expect-error P-TM05: type narrowing needed
		processedMap = remapSourcemap(normalizeMap, processedMap)
	}

	// @ts-expect-error P-TM05: type narrowing needed
	const importResults = []
	// 把基础转换交给 compileStyle 的同一条 PostCSS 管线，避免作用域处理前重复解析 CSS。
	const moduleId = module.id
	let scopedResult
	try {
		scopedResult = compileStyle({
			source: fixedCSS,
			filename: getStyleSourcePath(absolutePath),
			id: moduleId,
			scoped: !!moduleId,
			// @ts-expect-error P-TM05: type narrowing needed
			inMap: options.sourcemap ? processedMap : undefined,
			postcssPlugins: [
				// @ts-expect-error P-TM05: type narrowing needed
				createStyleTransformPlugin(module, absolutePath, importResults, options),
			],
		})
		if (scopedResult.errors.length > 0) {
			throw scopedResult.errors[0]
		}
	}
	catch (error) {
		// @ts-expect-error P-TM05: type narrowing needed
		const stage = error?.plugin === 'vue-sfc-vars' || error?.plugin === 'vue-sfc-scoped'
			? 'scope'
			: 'transform'
		throw createStyleCompileError(stage, absolutePath, error)
	}

	// external-class 与 autoprefixer/cssnano 共享一次 PostCSS 解析。
	let finalResult
	try {
		const postcssPlugins = [createExternalClassPlugin(moduleId), autoprefixerPlugin]
		// @ts-expect-error P-TM05: type narrowing needed
		const shouldMinify = options.minify !== false
		// @ts-expect-error P-TM05: type narrowing needed
		if (options.sourcemap) {
			if (shouldMinify) {
				const cssnano = await loadCssnano()
				postcssPlugins.push(cssnano())
			}
			finalResult = await postcss(postcssPlugins).process(scopedResult.code, {
				from: undefined,
				map: getPostcssMapOptions(true, scopedResult.map),
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
		// @ts-expect-error P-TM05: type narrowing needed
		const stage = error?.plugin === 'dimina-external-class' ? 'external-class' : 'postprocess'
		throw createStyleCompileError(stage, absolutePath, error)
	}

	// 处理导入的样式
	// @ts-expect-error P-TM05: type narrowing needed
	const importedChunks = (await Promise.all(importResults)).filter(result => result.code)
	let result
	// @ts-expect-error P-TM05: type narrowing needed
	if (options.sourcemap) {
		const { code, sourcemap: map } = concatSourcemap([
			...importedChunks,
			// @ts-expect-error P-TM05: type narrowing needed
			{ code: finalResult.css, map: finalResult.map.toString() },
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

// @ts-expect-error P-TM05: type narrowing needed
function normalizeCssUrlValue(value, absolutePath, graphOwnerPath) {
	// @ts-expect-error P-TM05: type narrowing needed
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
		// @ts-expect-error P-TM05: type narrowing needed
		const realSrc = collectAssets(getWorkPath(), absolutePath, cleanedUrl, getTargetPath(), getAppId())
		return `url(${realSrc})`
	})
}

// @ts-expect-error P-TM05: type narrowing needed
function getAbsolutePath(modulePath) {
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

// @ts-expect-error P-TM05: type narrowing needed
function resolveStyleImportPath(absolutePath, importPath, workPath = getWorkPath()) {
	if (importPath.startsWith('/')) {
		return path.join(workPath, importPath)
	}
	return path.resolve(path.dirname(absolutePath), importPath)
}

// @ts-expect-error P-TM05: type narrowing needed
function normalizeRootStyleImports(source, workPath = getWorkPath()) {
	// @ts-expect-error P-TM05: type narrowing needed
	return source.replace(/(@import\s+(?:\(.*?\)\s*)?(?:url\()?['"])(\/[^'")]+)(['"]\)?)/g, (_, prefix, importPath, suffix) => {
		return `${prefix}${path.join(workPath, importPath)}${suffix}`
	})
}

/**
 * Ensures that all @import statements in CSS end with semicolons
 * @param {string} css - The CSS content to process
 * @returns {string} - The processed CSS with semicolons added to @import statements as needed
 */
// @ts-expect-error P-TM05: type narrowing needed
function ensureImportSemicolons(css) {
	// 查找所有未以分号结尾的@import语句，并在它们后面添加分号
	// @ts-expect-error P-TM05: type narrowing needed
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
// @ts-expect-error P-TM05: type narrowing needed
function processHostSelector(selector, moduleId) {
	const hostSelector = `[data-dd-style-host~="${moduleId}"]`

	return selector
		// :host(.class) 选择带有特定类的组件根节点
		.replace(/:host\(([^)]+)\)/g, `${hostSelector}$1`)
		// 宿主标记与 data-v 样式作用域分离，避免 shared 作用域扩散后 :host 误命中页面节点。
		.replace(/:host(?![\w-])/g, hostSelector)
}

export { boostExternalClassSelectors, compileSS, ensureImportSemicolons, normalizeCssUrlValue, normalizeRootStyleImports, processHostSelector, resolveStyleImportPath }

// P-WR02: engine export（不动调度，F47）
// @ts-expect-error P-TM05: type narrowing needed
async function styleCompile({ msg, progress, config }) {
	resetStoreInfo(msg.storeInfo)

	const styleOptions = { sourcemap: msg.sourcemap, minify: config.minify }
	await compileSS(msg.pages.mainPages, null, progress, styleOptions)
	for (const [root, subPages] of Object.entries(msg.pages.subPages)) {
		// @ts-expect-error P-TM05: type narrowing needed
		await compileSS(subPages.info, root, progress, styleOptions)
	}

	compileRes.clear()
}

// @ts-expect-error P-TM05: type narrowing needed
function styleNormalizeError(e) {
	return { message: e.message, stack: e.stack, name: e.name, file: e.file, line: e.line, column: e.column, stage: e.stage }
}

export const styleEngine = defineEngine({
	name: 'style',
	compile: styleCompile,
	cleanup: () => {},
	normalizeError: styleNormalizeError,
})
