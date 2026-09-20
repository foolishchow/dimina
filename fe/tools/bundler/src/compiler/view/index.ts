import fs from 'node:fs'
import path from 'node:path'
import { parseSync } from 'oxc-parser'
import type { Program } from 'oxc-parser'
import { walk } from 'oxc-walker'
import MagicString from 'magic-string'
import { compileTemplate } from '@vue/compiler-sfc'
import { getTemplateDirectiveName } from '../core/compatibility.ts'
import { collectAssets, getAbsolutePath, isCollectableImageAsset, resolveAssetSourcePath } from '../../shared/utils.ts'
import { getAppId, getComponent, getContentByPath, getDependencyGraph, getTargetPath, getViewScriptExts, getViewScriptTags, getWorkPath, resetStoreInfo } from '../core/env.ts'
import { defineEngine } from '../worker-runtime/define-engine.ts'  // P-WR02
import type { CompileOptions } from '../worker-runtime/define-engine.ts'
import type { WxmlNode } from './wxml/common/document.ts'
import { concatSourcemap, createLineSourcemap, createOriginsSourcemap, remapSourcemap } from '../core/sourcemap.ts'
import { getWxmlRenderer, registerWxmlRenderer } from './wxml/renderer/registry.ts'
import { vueWxmlRenderer, VUE_RENDERER_ID } from './wxml/renderer/vue/index.ts'
import {
	getAttr,
	queryAll,
	removeAll,
	serializeChildren,
	setAttr,
} from './wxml/common/document-ops.ts'
import { stripViewScriptExt } from './wxml/load/paths.ts'
import { toCompileTemplate } from './wxml/compile.ts'
import { processIncludeConditionalAttrs } from './wxml/load/include.ts'
import { bindTransformOrchestrator } from './wxml/load/orchestrator-live.ts'
import {
	normalizeTemplateSyntax,
	generateSlotDirective,
	generateVModelTemplate,
	getTemplateCompilerOptions,
	compileTemplateModuleRender,
} from './wxml/renderer/vue/tools.ts'
import { bindVueToolsLive } from './wxml/renderer/vue/live.ts'
import { enableSourcemap, setEnableSourcemap, templateRenderCache } from './wxml/renderer/vue/state.ts'
import { emitEntry } from '../pipeline/emit.ts'
import type { EmitModule } from '../pipeline/emit.ts'
import { errorMessage } from '../../shared/utils.ts'
import type { EnhancedError } from '../../shared/utils.ts'

// TS-2（fe-tools-wxml-ir）：wxml renderer₀ 注册（registry 同 id 抛错；测例可先 unregister）
if (!getWxmlRenderer(VUE_RENDERER_ID)) {
	registerWxmlRenderer(vueWxmlRenderer)
}


/**
 * 解析 JavaScript 代码
 * @param {string} code
 * @param {string} filename
 * @param {'module'|'script'} sourceType
 * @returns {*} Oxc Program AST
 */
function parseJs(code: string, filename = 'view-compiler.js', sourceType = 'module') {
	return parseSync(filename, code, {
		sourceType: sourceType as 'module',
		lang: 'js',
	}).program
}

/**
 * 如果顶层是单个表达式语句，则只返回表达式源码
 * @param {string} code
 * @param {*} ast - Oxc Program AST
 * @returns {string} Program code or the source of the single top-level expression.
 */
function getProgramCode(code: string, ast: Program): string {
	const statement = ast.body?.[0]
	if (ast.body?.length === 1 && statement?.type === 'ExpressionStatement') {
		const expr = statement.expression!
		return code.slice(expr.start, expr.end)
	}
	return code
}
function isStringLiteral(node: unknown): boolean {
	if (!node || typeof node !== 'object') return false
	const n = node as { type?: string; value?: unknown }

	return n.type === 'StringLiteral' || (n.type === 'Literal' && typeof n.value === 'string')
}
function getStringLiteralRawValue(node: unknown): string {
	if (!isStringLiteral(node)) {
		return ''
	}
	const n = node as { raw?: unknown; value?: unknown }

	if (typeof n.raw === 'string') {
		return n.raw.slice(1, -1)
	}
	return String(n.value)
}
function getSource(code: string, node: { start: number; end: number }): string {
	return code.slice(node.start, node.end)
}
function applyCodeReplacements(source: string, replacements: Array<{ start: number; end: number; newValue?: string; value?: string; type?: string }>) {
	if (replacements.length === 0) {
		return source
	}
	const selected: Array<{ start: number; end: number; newValue?: string; value?: string; type?: string }> = []
	const byLargestRange = [...replacements].sort((a, b) => {
		const lengthDiff = (b.end - b.start) - (a.end - a.start)
		return lengthDiff || b.start - a.start
	})

	for (const replacement of byLargestRange) {
		const overlaps = selected.some(item =>
			replacement.start < item.end && item.start < replacement.end
		)
		if (!overlaps) {
			selected.push(replacement)
		}
	}

	const s = new MagicString(source)
	for (const replacement of selected.sort((a, b) => b.start - a.start)) {
		if (replacement.type === 'insert') {
			s.appendLeft(replacement.start, replacement.value!)
		}
		else {
			s.overwrite(replacement.start, replacement.end, replacement.value!)
		}
	}

	return s.toString()
}

/**
 * 为模板表达式中的成员访问补充空值保护，避免生成的 render 函数直接访问 null/undefined 属性
 * 例如: stickyProps.zIndex -> stickyProps?.zIndex
 * @param {string} expression
 * @returns {string} 添加了可选链操作符的表达式字符串
 */
// addOptionalChaining 是纯函数（输出只由表达式字符串决定），共享模板（如 Taro 的 base.wxml）
// 被每个页面各 import 一次时，同一批表达式会被重复解析/重写，用字符串 key 缓存结果去重。
const optionalChainingCache = new Map()
function addOptionalChaining(expression: string): string {
	if (!expression || typeof expression !== 'string') {
		return expression
	}

	const cached = optionalChainingCache.get(expression)
	if (cached !== undefined) {
		return cached
	}

	try {
		const code = `(${expression})`
		const ast = parseJs(code)
		const insertions: Array<{ type: string; start: number; end: number; value: string }> = []

		walk(ast, {
			enter(node) {
				if (node.type !== 'MemberExpression' || node.optional) {
					return
				}

				if (node.computed) {
					const bracketIndex = code.lastIndexOf('[', node.property.start)
					if (bracketIndex >= 0) {
						insertions.push({
							type: 'insert',
							start: bracketIndex,
							end: bracketIndex,
							value: '?.',
						})
					}
				}
				else {
					const dotIndex = code.lastIndexOf('.', node.property.start)
					if (dotIndex >= 0) {
						insertions.push({
							type: 'insert',
							start: dotIndex,
							end: dotIndex,
							value: '?',
						})
					}
				}
			}
		})
		const result = applyCodeReplacements(code, insertions).slice(1, -1)
		optionalChainingCache.set(expression, result)
		return result
	} catch (error) {
		optionalChainingCache.set(expression, expression)
		return expression
	}
}
function parseSafeBraceExp(exp: string): string {
	return addOptionalChaining(parseBraceExp(exp))
}
function transformTextInterpolation(text: string): string {
	if (!text || typeof text !== 'string' || !isWrappedByBraces(text)) {
		return text
	}

	return text.replace(braceRegex, (match, bracePart) => {
		if (!bracePart) {
			return match
		}
		const matchResult = bracePart.match(noBraceRegex)
		if (!matchResult) {
			return match
		}
		return `{{${addOptionalChaining(matchResult[1].trim())}}}`
	})
}

// 页面文件编译内容缓存
interface ErrorShape {
	message?: string
	name?: string
	stack?: string
	file?: string
	line?: number
	column?: number
	[key: string]: unknown
}

const compileResCache = new Map<string, unknown>()

// wxs 模块注册表，用于记录确定的 wxs 模块
const wxsModuleRegistry = new Set()

// wxs 文件路径映射表，用于快速查找模块对应的文件路径
const wxsFilePathMap = new Map()
let wxsScannedWorkPath: string | null = null

// enableSourcemap / templateRenderCache: see wxml/renderer/vue/state.js
/** @type {{ minify: boolean, sourcemap: boolean, esTarget: { logic: string, view: string } }} */
let activeCompileConfig = {
	minify: true,
	sourcemap: false,
	esTarget: { logic: 'es2023', view: 'es2020' },
}


/**
 * 编译页面视图文件
 */
interface ViewModule {
	path: string
	id: string
	component?: boolean
	componentPlaceholder?: Record<string, unknown>
	usingComponents?: Record<string, string>
	appStyleScopeId?: string
	sharedStyleScopeIds?: string[]
	styleIsolation?: string
	customTabBar?: unknown
	[key: string]: unknown
}
interface Progress {
	completedTasks: number
}
async function compileML(pages: ViewModule[], root: string | null, progress: Progress): Promise<void> {
	const workPath = getWorkPath()

	// 主包和所有分包共享同一 npm WXS 索引；一次 Worker 任务只扫描一次。
	if (wxsScannedWorkPath !== workPath) {
		initWxsFilePathMap(workPath)
		wxsScannedWorkPath = workPath
	}

	for (const page of pages) {
		// D-ET-9：viewParseWalk 编排 + 一次编译（替代 buildCompileView 二次编译）
		const modules = viewParseWalk(page, { sourcemap: enableSourcemap })
		const filename = `${page.path.replace(/\//g, '_')}`
		// 相对发布根的物化路径前缀（D-P2）：主包 → main/，分包 → {root}/
		const relPrefix = root ? `${root}` : 'main'

		await emitEntry({
			entryId: page.path,
			kind: 'view',
			modules,
			transform: {
				strategy: 'bundle',
				minify: activeCompileConfig.minify,
				target: activeCompileConfig.esTarget.view,
				platform: 'browser',
			},
			sourcemap: enableSourcemap,
			sourcemapTargetPath: null,
			filename,
			relPrefix,
		})

		progress.completedTasks++
	}
}

interface ViewParseWalkOptions {
	sourcemap: boolean
}

/**
 * view parse+walk：预 walk 组件树（toCompileTemplate only）→ 收集全部 wxs → 一次编译 → EmitModule[]
 * 编排接管原 buildCompileView 的 activePaths / inheritedTemplatePaths / MC1 error caching。
 */
function viewParseWalk(pageModule: ViewModule, options: ViewParseWalkOptions): EmitModule[] {
	void options // sourcemap flag consumed via enableSourcemap in inner functions
	const scriptRes = new Map<string, string>()
	const sourceMapRes = new Map<string, string>()
	compileViewTree(pageModule, false, scriptRes, new Set(), new Set(), sourceMapRes)
	return [...scriptRes.entries()].map(([modulePath, code]) => ({
		moduleId: modulePath,
		code,
		map: sourceMapRes.get(modulePath) || null,
	}))
}

/**
 * 初始化 wxs 文件路径映射
 * @param {string} workPath - 工作路径
 */
function initWxsFilePathMap(workPath: string): void {
	// 清空现有映射
	wxsFilePathMap.clear()

	// 扫描 miniprogram_npm 目录下的所有 wxs 文件
	const npmDir = path.join(workPath, 'miniprogram_npm')
	if (fs.existsSync(npmDir)) {
		scanWxsFiles(npmDir, workPath)
	}
}

/**
 * 递归扫描目录下的所有 wxs 文件
 * @param {string} dir - 目录路径
 * @param {string} workPath - 工作路径
 */
function scanWxsFiles(dir: string, workPath: string): void {
	try {
		const items = fs.readdirSync(dir)

		for (const item of items) {
			const fullPath = path.join(dir, item)
			const stat = fs.statSync(fullPath)

			if (stat.isDirectory()) {
				// 递归扫描子目录
				scanWxsFiles(fullPath, workPath)
			} else if (stat.isFile() && getViewScriptExts().some(ext => item.endsWith(ext))) {
				// 处理 wxs 文件
				const relativePath = stripViewScriptExt(fullPath.replace(workPath, ''))
				const moduleName = relativePath.replace(/[\/\\@\-]/g, '_').replace(/^_/, '')

				// 建立模块名到文件路径的映射
				wxsFilePathMap.set(moduleName, fullPath)
			}
		}
	} catch (error) {
		// 忽略无法读取的目录
	}
}

/**
 * 注册 wxs 模块
 * @param {string} modulePath - 模块路径
 */
function registerWxsModule(modulePath: string): void {
	wxsModuleRegistry.add(modulePath)
}


function isRegisteredWxsModule(modulePath: string): boolean {
	return wxsModuleRegistry.has(modulePath)
}
function compileViewTree(module: ViewModule, isComponent = false, scriptRes: Map<string, string>, activePaths: Set<string> = new Set(), inheritedTemplatePaths: Set<string> = new Set(), sourceMapRes: Map<string, string> = new Map()): Record<string, unknown> | null {
	const currentPath = module.path

	// Recursive component declarations are valid. Stop only the duplicate edge
	// on the current traversal path; the runtime keeps the recursive mapping.
	if (activePaths.has(currentPath)) {
		return null
	}
	activePaths.add(currentPath)

	// 收集所有 wxs 模块（包括组件的）
	const allScriptModules: Array<{ path: string; code: string; [key: string]: unknown }> = []

	// 首先编译当前模块（MC1/R-MC3：失败也缓存，同 stage 内同模块不再重复失败编译）
	// F2：write 无条件（组件+页面都记）；read 端仅 canUseCache=true（页面）触发——组件场景 read 不到，
	// 无行为影响（单 stage 首错中止 + activePaths 防递归），记录覆盖面不对称。
	let currentInstruction
	try {
		currentInstruction = compileModule(module, isComponent, scriptRes, {
			skipTemplatePaths: isComponent ? inheritedTemplatePaths : new Set(),
			sourceMapRes,
		})
	}
	catch (error) {
		const err = error as EnhancedError
		compileResCache.set(module.path, {
			failed: true,
			errorShape: {
				message: err.message,
				stack: err.stack,
				name: err.name,
				file: err.file,
				line: err.line,
				column: err.column,
				stage: err.stage,
			},
		})
		throw error
	}
	if (currentInstruction && currentInstruction.scriptModule) {
		allScriptModules.push(...(currentInstruction.scriptModule as Array<{ path: string; code: string }>))
	}
	const childInheritedTemplatePaths = new Set(inheritedTemplatePaths)
	for (const tm of (currentInstruction?.templateModule as unknown[]) || []) {
		childInheritedTemplatePaths.add((tm as { path: string }).path)
	}

	if (module.usingComponents) {
		const graphDependencies = getDependencyGraph().getDirectDependencies(module.path, 'component')
		const componentDependencies = graphDependencies.length > 0
			? graphDependencies
			: Object.values(module.usingComponents)
		for (const componentInfo of componentDependencies) {
			const componentModule = getComponent(componentInfo)
			if (!componentModule) {
				continue
			}
			// 检查自依赖：当前模块已经完成本轮编译，只跳过重复编译；
			// render runtime 仍会保留该递归组件映射。
			if ((componentModule as ViewModule).path === module.path) {
				continue
			}
			// 递归编译组件，并收集其 wxs 模块
			const componentInstruction = compileViewTree(componentModule as ViewModule, true, scriptRes, activePaths, childInheritedTemplatePaths, sourceMapRes)
			if (componentInstruction && componentInstruction.scriptModule) {
				// 将组件的 wxs 模块添加到当前模块的 wxs 模块列表中
				for (const sm of (componentInstruction.scriptModule as unknown[])) {
					// 避免重复添加相同的模块
					if (!allScriptModules.find(existing => existing.path === (sm as { path: string }).path)) {
						allScriptModules.push(sm as { path: string; code: string })
					}
				}
			}
		}
	}

	// 如果这是页面（不是组件），需要重新编译以包含所有 wxs 模块
	if (!isComponent && allScriptModules.length > 0) {
		// 在重新编译之前，确保所有依赖模块都已添加到 scriptRes 中
		for (const sm of allScriptModules) {
			if (!scriptRes.has((sm as { path: string }).path)) {
				scriptRes.set((sm as { path: string }).path, (sm as { code: string }).code)
			}
		}

		// 重新编译页面，包含所有收集到的 wxs 模块
		// F3：此二次编译失败不进失败缓存（不在 MC1 try 内）——无行为影响（页面同 stage 不二次编译）
		// D-ET-9：compileModuleWithAllWxs 合并进 compileModule（allScriptModules 参数）
		compileModule(module, false, scriptRes, { skipTemplatePaths: new Set(), sourceMapRes, allScriptModules })
	}

	activePaths.delete(currentPath)
	// 返回当前模块的指令信息（包含 wxs 模块）
	return { scriptModule: allScriptModules, templateModule: currentInstruction?.templateModule || [] }
}

/**
 * 编译页面及自定义组件，自定义组件可认为是特殊的页面
 * https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/
 * @param {*} module
 */
function compileModule(module: ViewModule, isComponent: boolean, scriptRes: Map<string, string>, options: { skipTemplatePaths?: Set<string>; sourceMapRes?: Map<string, string>; allScriptModules?: Array<{ path: string; code: string; originalName?: string }> } = {}): Record<string, unknown> | null {
	const skipTemplatePaths = options.skipTemplatePaths || new Set()
	const sourceMapRes = options.sourceMapRes as Map<string, string> || new Map<string, string>()
	const { tpl, instruction, sourceInfo, origins, sourceContents } = toCompileTemplate(isComponent, module.path, module.usingComponents, module.componentPlaceholder)
	if (!tpl) {
		return null
	}
	const templateModule = instruction.templateModule || []
	const templateModuleForCompile = (templateModule as Array<{ path: string }>).filter(tm => !(skipTemplatePaths as Set<string>).has(tm.path))
	const compileInstruction = {
		...instruction,
		templateModule: templateModuleForCompile,
		scriptModule: options.allScriptModules || instruction.scriptModule,
	}

	// 检查是否有缓存的模板编译结果
	let useCache = false
	let cachedCode = null
	const canUseCache = (skipTemplatePaths as Set<string>).size === 0

	if (canUseCache && !scriptRes.has(module.path) && compileResCache.has(module.path)) {
		const cacheData = compileResCache.get(module.path) as (Record<string, unknown> & { errorShape?: ErrorShape; code?: string; instruction?: { scriptModule?: Array<{ path: string; code: string }> }; map?: string; failed?: boolean }) | undefined
		// MC1/R-MC3：失败缓存——同模块上次编译失败，直接重抛等价错误（避免同 stage 内重复失败编译）
		// F1：重建完整字段（含 file/line/column/stage，供上层 stage-channel 错误重建消费）
		if (cacheData && cacheData.failed) {
			const err = new Error(cacheData.errorShape?.message || 'module compilation failed (cached)') as EnhancedError
			if (cacheData.errorShape?.name) err.name = cacheData.errorShape.name
			if (cacheData.errorShape?.stack) err.stack = cacheData.errorShape.stack
			if (cacheData.errorShape?.file) err.file = cacheData.errorShape.file
			if (cacheData.errorShape?.line != null) err.line = cacheData.errorShape.line
			if (cacheData.errorShape?.column != null) err.column = cacheData.errorShape.column
			if (cacheData.errorShape?.stage) err.stage = cacheData.errorShape.stage
			throw err
		}
		// 如果缓存数据包含完整的编译信息，则使用缓存
		if (cacheData && typeof cacheData === 'object' && cacheData.code && cacheData.instruction) {
			cachedCode = cacheData.code!
			useCache = true
			// 将缓存的 wxs 模块添加到当前页面的 scriptRes 中
			for (const sm of cacheData.instruction!.scriptModule!) {
				if (!scriptRes.has((sm as { path: string }).path)) {
					scriptRes.set((sm as { path: string }).path, (sm as { code: string }).code)
				}
			}
		} else if (typeof cacheData === 'string') {
			// 兼容旧的缓存格式（只有代码字符串）
			cachedCode = cacheData
			useCache = true
		}
	}

	if (useCache && cachedCode) {
		scriptRes.set(module.path, cachedCode)
		const cachedMap = (compileResCache.get(module.path) as { map?: string } | undefined)?.map
		if (enableSourcemap && cachedMap) {
			sourceMapRes.set(module.path, cachedMap!)
		}

		// 即使使用缓存，也需要确保返回的 instruction 包含最新的 wxs 模块信息
		// 收集所有在 scriptRes 中的 wxs 模块（包括依赖模块）
		const allWxsModules = collectAllWxsModules(scriptRes, new Set(), instruction.scriptModule as object[] || [])

		// 将收集到的 wxs 模块添加到 instruction 中
		if (allWxsModules.length > 0) {
			// 合并现有的 scriptModule 和新收集的 wxs 模块
			const existingModules = instruction.scriptModule || []
			const mergedModules = [...existingModules]

			for (const wxsModule of allWxsModules) {
				// 避免重复添加相同的模块
				if (!mergedModules.find(existing => (existing as { path: string }).path === (wxsModule as { path: string }).path)) {
					mergedModules.push(wxsModule)
				}
			}

			instruction.scriptModule = mergedModules
		}

		// 返回更新后的 instruction，包含所有 wxs 模块
		return {
			...instruction,
			scriptModule: allWxsModules
		}
	}

	// 在编译前预处理模板，将 this. 替换为 _ctx.
	const processedTpl = tpl.replace(/\bthis\./g, '_ctx.')
	// https://play.vuejs.org/
	const tplCode = compileTemplate({
		source: processedTpl,
		filename: module.path, // 用于错误提示
		id: `data-v-${module.id}`,
		scoped: true,
		inMap: enableSourcemap
			? (isComponent || !options.allScriptModules
				? (((origins as unknown[]) || []).length
					? createOriginsSourcemap(origins as Array<{ source: string; line: number }>, sourceContents as Map<string, string>)
					: createLineSourcemap(processedTpl, sourceInfo.path, sourceInfo.content))
				: createLineSourcemap(processedTpl, sourceInfo.path, sourceInfo.content))
			: undefined,
		compilerOptions: getTemplateCompilerOptions(`data-v-${module.id}`),
	})

	const templateResults = []
	for (const tm of compileInstruction.templateModule) {
		templateResults.push(compileTemplateModuleRender(tm as { path: string; tpl: string; sourceInfo?: { path: string; content: string; startLine?: number } | null }, module.id, compileInstruction.scriptModule as Array<{ path: string; code: string; originalName?: string }>, scriptRes))
	}
	const renderResult = insertWxsToRenderResult(tplCode.code, compileInstruction.scriptModule as unknown[], scriptRes, module.path, tplCode.map)

	// 通过 component 字段标记该页面 以 Component 形式进行渲染或着以 Page 形式进行渲染
	// https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/page.html
	// https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/component.html
	const moduleChunks = [`Module({
		path: '${module.path}',
		id: '${module.id}',
		appStyleScopeId: ${JSON.stringify(module.appStyleScopeId || null)},
		sharedStyleScopeIds: ${JSON.stringify(module.sharedStyleScopeIds || [])},
		styleIsolation: ${JSON.stringify(module.styleIsolation || 'isolated')},
		render: `, renderResult, `,
		usingComponents: ${JSON.stringify(module.usingComponents)},
		componentPlaceholder: ${JSON.stringify(module.componentPlaceholder || {})},
		customTabBar: ${JSON.stringify(module.customTabBar || null)},
		tplComponents: {`]
	for (const templateResult of templateResults) {
		moduleChunks.push(`'${templateResult.path}':`, templateResult, ',')
	}
	moduleChunks.push('},\n\t\t});')
	const { code, sourcemap: moduleMap } = concatSourcemap(moduleChunks, module.path)

	// 收集所有在 scriptRes 中的 wxs 模块（包括依赖模块）
	const allWxsModules = collectAllWxsModules(scriptRes, new Set(), compileInstruction.scriptModule as object[] || [])

	// 将收集到的 wxs 模块添加到 instruction 中
	if (allWxsModules.length > 0) {
		// 合并现有的 scriptModule 和新收集的 wxs 模块
		const existingModules = compileInstruction.scriptModule || []
		const mergedModules = [...existingModules]

		for (const wxsModule of allWxsModules) {
			// 避免重复添加相同的模块
			if (!mergedModules.find(existing => (existing as { path: string }).path === (wxsModule as { path: string }).path)) {
				mergedModules.push(wxsModule)
			}
		}

		compileInstruction.scriptModule = mergedModules
	}

	// 缓存编译结果，包含代码和更新后的指令信息
	const cacheData = {
		code,
		instruction: compileInstruction,
		map: enableSourcemap ? moduleMap : null,
	}
	if (canUseCache) {
		compileResCache.set(module.path, cacheData)
	}
	scriptRes.set(module.path, code)
	if (enableSourcemap) {
		sourceMapRes.set(module.path, moduleMap!)
	}

	return {
		...compileInstruction,
		templateModule,
	}
}

/**
 * 处理 wxs 内容，包括注入全局方法、转换 constructor、处理 require 等
 * @param {string} wxsContent - wxs 代码内容
 * @param {string} wxsFilePath - wxs 文件路径（用于处理 require）
 * @param {Array} scriptModule - 脚本模块数组
 * @param {string} workPath - 工作路径
 * @param {string} filePath - 当前处理的文件路径
 * @returns {string} 处理后的 wxs 代码
 */
function processWxsContent(wxsContent: string, wxsFilePath: string, scriptModule: unknown[], workPath: string, filePath: string, graphOwnerPath = filePath): unknown {
	if (wxsFilePath && graphOwnerPath) {
		getDependencyGraph().addFile(graphOwnerPath, wxsFilePath, 'view')
	}
	let wxsAst
	try {
		wxsAst = parseJs(wxsContent, wxsFilePath || 'inline.wxs', 'script')
	} catch (error) {
		console.error(`[view] 解析 wxs 文件失败: ${wxsFilePath}`, errorMessage(error))
		return wxsContent // 返回原始内容
	}
	const replacements: Array<{ start: number; end: number; value: string }> = []

	// 遍历并处理各种转换
	walk(wxsAst, {
		enter(node) {
			if (node.type === 'CallExpression') {
				const calleeName = (node.callee as { name?: string })?.name

				// https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/06datatype.html#regexp
				// getRegExp -> 正则表达式字面量或 new RegExp 调用
				if (calleeName === 'getRegExp') {
					const args = node.arguments

					if (args.length > 0) {
						// 如果参数都是字符串字面量，直接转换为正则表达式字面量
						if (isStringLiteral(args[0]) && (!args[1] || isStringLiteral(args[1]))) {
							const pattern = getStringLiteralRawValue(args[0])
							const flags = args.length > 1 ? getStringLiteralRawValue(args[1]) : ''

							replacements.push({
								start: node.start,
								end: node.end,
								value: `/${pattern}/${flags}`,
							})
						}
						else {
							// 对于变量参数，转换为 new RegExp(pattern, flags) 调用
							const newRegExpArgs = args.map(arg => getSource(wxsContent, arg)).join(', ')
							replacements.push({
								start: node.start,
								end: node.end,
								value: `new RegExp(${newRegExpArgs})`,
							})
						}
					}
				}
				else if (calleeName === 'getDate') {
					// getDate -> new Date
					const args = node.arguments.map(arg => getSource(wxsContent, arg)).join(', ')
					replacements.push({
						start: node.start,
						end: node.end,
						value: `new Date(${args})`,
					})
				}
				// 处理 wxs 文件内部的 require 调用（仅对外部文件）
				else if (calleeName === 'require' && node.arguments.length > 0 && wxsFilePath) {
					const requirePath = (node.arguments[0] as { value: string }).value

					if (requirePath && typeof requirePath === 'string') {
						// 解析 wxs 内部的相对路径 require
						let resolvedWxsPath

						if (filePath && filePath.includes('/miniprogram_npm/')) {
							// 对于 npm 组件中的 wxs，需要特殊处理相对路径
							const currentWxsDir = path.dirname(wxsFilePath)
							resolvedWxsPath = path.resolve(currentWxsDir, requirePath)

							// 转换为相对于工作目录的路径，并移除视图脚本扩展名
							const relativePath = stripViewScriptExt(resolvedWxsPath.replace(workPath, ''))

							// 生成唯一的模块名（移除特殊字符）
							const moduleName = relativePath.replace(/[\/\\@\-]/g, '_').replace(/^_/, '')

							// 递归处理依赖的 wxs 文件
							processWxsDependency(resolvedWxsPath, moduleName, scriptModule, workPath, filePath, graphOwnerPath)

							// 替换 require 路径
							replacements.push({
								start: node.arguments[0]!.start,
								end: node.arguments[0]!.end,
								value: JSON.stringify(moduleName),
							})
						}
						else {
							// 对于普通组件，使用原有逻辑
							const currentWxsDir = path.dirname(wxsFilePath)
							resolvedWxsPath = path.resolve(currentWxsDir, requirePath)
							const relativePath = stripViewScriptExt(resolvedWxsPath.replace(workPath, ''))
							const depModuleName = relativePath.replace(/[\/\\@\-]/g, '_').replace(/^_/, '')

							// 递归处理依赖
							processWxsDependency(resolvedWxsPath, depModuleName, scriptModule, workPath, filePath, graphOwnerPath)

							// 替换 require 路径
							replacements.push({
								start: node.arguments[0]!.start,
								end: node.arguments[0]!.end,
								value: JSON.stringify(depModuleName),
							})
						}
					}
				}
			}

			if (node.type === 'MemberExpression') {
				// 处理 constructor 属性访问，模拟微信小程序 wxs 中 constructor 返回字符串的行为
				if ((node.property as { name?: string })?.name === 'constructor' && !node.computed) {
					const objectCode = getSource(wxsContent, node.object)
					replacements.push({
						start: node.start,
						end: node.end,
						value: `Object.prototype.toString.call(${objectCode}).slice(8, -1)`,
					})
				}
			}
		}
	})
	return applyCodeReplacements(wxsContent, replacements)
}

// 递归处理 wxs 依赖
function processWxsDependency(wxsFilePath: string, moduleName: string, scriptModule: unknown[], workPath: string, filePath: string, graphOwnerPath = filePath): void {
	if (!fs.existsSync(wxsFilePath)) {
		console.warn(`[view] wxs 依赖文件不存在: ${wxsFilePath}`)
		return
	}

	// 检查是否已经处理过这个模块
	if ((scriptModule as Array<{ path: string }>).find(sm => sm.path === moduleName)) {
		return
	}

	const wxsContent = getContentByPath(wxsFilePath).trim()
	if (!wxsContent) {
		return
	}

	// 使用公共的处理函数
	const wxsCode = processWxsContent(wxsContent, wxsFilePath, scriptModule, workPath, filePath, graphOwnerPath)

	// 注册为 wxs 模块（因为这是 wxs 依赖，一定是 wxs 脚本）
	registerWxsModule(moduleName)

	scriptModule.push({
		path: moduleName,
		code: wxsCode,
	})
}


/**
 * 递归处理被引入文件中的组件 wxs 依赖
 * @param {Set<string>} componentTags 被引入文件中使用的组件标签
 * @param {*} includePath 被引入文件的路径
 * @param {*} scriptModule 用于收集 wxs 模块的数组
 * @param {*} components 当前可用的组件映射
 * @param {Set} processedPaths 已处理的路径集合，防止循环引用和栈溢出
 */
function processIncludedFileWxsDependencies(componentTags: unknown, includePath: string, scriptModule: unknown[], components: Record<string, unknown>, processedPaths: Set<string> = new Set()): void {
	// 如果当前路径已经处理过，直接返回避免循环引用
	if (processedPaths.has(includePath)) {
		return
	}

	// 将当前路径添加到已处理集合中
	processedPaths.add(includePath)

	// 对每个组件，直接处理其 wxs 依赖（避免递归调用 buildCompileView）
	for (const tagName of componentTags as Iterable<string>) {
		const componentPath = String(components[tagName!])
		const componentModule = getComponent(componentPath)
		if (componentModule) {
			// 检查组件路径是否已经处理过，避免循环引用
			if (processedPaths.has((componentModule as { path: string }).path)) {
				continue
			}

			// 直接获取组件的模板和 wxs 依赖，避免递归调用
			const componentTemplate = toCompileTemplate(true, (componentModule as ViewModule).path, (componentModule as ViewModule).usingComponents, (componentModule as ViewModule).componentPlaceholder, processedPaths)

			if (componentTemplate && componentTemplate.instruction && componentTemplate.instruction.scriptModule) {
				// 将组件的 wxs 模块添加到当前的 scriptModule 中
				for (const sm of componentTemplate.instruction.scriptModule) {
					// 避免重复添加相同的模块
					if (!(scriptModule as Array<{ path: string }>).find(existing => existing.path === (sm as { path: string }).path)) {
						scriptModule.push(sm)
					}
				}
			}
		}
	}
}
function transAsses(document: WxmlNode, imageNodes: WxmlNode[], path: string, graphOwnerPath = path): void {
	const nodes = Array.isArray(imageNodes) ? imageNodes : queryAll(document, 'image')
	for (const elem of nodes) {
		const srcRaw = getAttr(elem, 'src')
		if (srcRaw == null) {
			continue
		}
		const imgSrc = String(srcRaw).trim()
		if (!imgSrc.startsWith('{{')) {
			if (!imgSrc.startsWith('http')
				&& !imgSrc.startsWith('//')
				&& isCollectableImageAsset(imgSrc)) {
				getDependencyGraph().addFile(
					graphOwnerPath,
					resolveAssetSourcePath(getWorkPath(), path, imgSrc),
					'view',
				)
			}
			setAttr(elem, 'src', collectAssets(getWorkPath(), path, imgSrc, getTargetPath(), getAppId()!))
		}
	}
}


/**
 * 兼容 :key="{{ index }}" 或 :key="{{ item.index }}"的情况
 */
function parseKeyExpression(exp: string, itemName = 'item', indexName = 'index'): string {
	// 去除首尾空格
	exp = exp.trim()

	// https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/list.html#wx:key
	// 保留关键字 *this 代表在 for 循环中的 item 本身，这种表示需要 item 本身是一个唯一的字符串或者数字
	if (/\*this/.test(exp) || /\*item/.test(exp)) {
		return `${itemName}.toString()`
	}

	// 处理简单无表达式的情况
	if (!exp.includes('{{')) {
		// 检查是否为纯数字（包括负数）
		if (/^-?\d+(\.\d+)?$/.test(exp)) {
			return exp
		}
		// 特殊处理索引变量名 - 直接返回索引变量名，不添加 item 前缀
		if (exp === indexName) {
			return indexName
		}
		return exp.startsWith(itemName) ? `${exp}` : `${itemName}.${exp}`
	}

	// 处理 '{{xxx}}' 的情况
	if (exp.startsWith('{{') && exp.endsWith('}}')) {
		const content = exp.slice(2, -2).trim()
		if (content === 'this') {
			return `${itemName}.toString()`
		} else if (content === indexName) {
			// 特殊处理索引变量名 - 直接返回索引变量名
			return indexName
		} else {
			return content.startsWith(itemName) ? `${content}` : `${itemName}.${content}`
		}
	}

	// 处理 '1-{{xxx}}' 的情况
	const parts = exp.split(/(\{\{.*?\}\})/)
	const result = parts.map((part) => {
		if (part.startsWith('{{') && part.endsWith('}}')) {
			const content = part.slice(2, -2).trim()
			if (content === indexName) {
				return indexName
			}
			return content.startsWith(itemName) ? content : `${itemName}.${content}`
		}
		return `'${part}'`
	}).join('+')

	// 移除结果末尾的 +''（如果存在）
	return result.endsWith('+\'\'') ? result.slice(0, -3) : result
}


/**
 * 将字符串内部的双引号进行替换
 * @param {*} input
 */
function escapeQuotes(input: string): string {
	return input.replace(/"/g, '\'')
}

/**
 * 判断字符串是不是被{{}}包裹
 * @param {*} str
 */
function isWrappedByBraces(str: string): boolean {
	return /\{\{.*\}\}/.test(str)
}
function splitWithBraces(str: string): string[] {
	const result = []
	let temp = ''
	let inBraces = false

	for (let i = 0; i < str.length; i++) {
		const char = str[i]

		// 如果遇到左大括号'{{'，进入大括号模式
		if (char === '{' && i + 1 < str.length && str[i + 1] === '{') {
			inBraces = true
			temp += '{{' // 添加'{{'到temp
			i++ // 跳过下一个字符（即另一个'{'）
		}
		// 如果遇到右大括号'}}'，退出大括号模式
		else if (char === '}' && i + 1 < str.length && str[i + 1] === '}') {
			inBraces = false
			temp += '}}' // 添加'}}'到temp
			i++ // 跳过下一个字符（即另一个'}'）
		}
		// 如果不在大括号内且遇到空格，则当前temp是一个分割部分
		else if (!inBraces && char === ' ') {
			if (temp) {
				result.push(temp)
				temp = '' // 重置temp以开始新的单词
			}
		}
		// 否则，将字符添加到temp
		else {
			temp += char
		}
	}

	// 如果temp还有剩余内容（即最后一个单词或在大括号内的内容），则将其添加到结果中
	if (temp) {
		result.push(temp)
	}

	return result
}
function parseClassRules(cssRule: string): string {
	let list = splitWithBraces(cssRule)
	list = list.map((item) => {
		return parseSafeBraceExp(item)
	})

	if (list.length === 1) {
		return list[0]!
	}
	return `[${list.join(',')}]`
}

/**
 * https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/list.html#wx-for
 * 使用 :for-item 可以指定数组当前元素的变量名
 * @param {*} attrs
 */
function getForItemName(attrs: Record<string, unknown>): string {
	for (const key in attrs) {
		if (getTemplateDirectiveName(key) === 'for-item') {
			const value = attrs[key]
			if (typeof value === 'string') return value
		}
	}
	return 'item'
}

/**
 * 使用 :for-index 可以指定数组当前下标的变量名
 * @param {*} attrs
 */
function getForIndexName(attrs: Record<string, unknown>): string {
	for (const key in attrs) {
		if (getTemplateDirectiveName(key) === 'for-index') {
			const value = attrs[key]
			if (typeof value === 'string') return value
		}
	}
	return 'index'
}

/**
 * 解析 for 表达式的值
 * @param {*} exp
 * @param {*} attrs
 */
function parseForExp(exp: string, attrs: Record<string, unknown>): string {
	const item = getForItemName(attrs)
	const index = getForIndexName(attrs)
	const listVariableName = parseSafeBraceExp(exp)
	return `(${item}, ${index}) in ${listVariableName}`
}

// 使用正则表达式匹配{{}}内的内容，并放入第一个分组
// 使用正则表达式匹配非{{}}内的内容，并放入第二个分组
// 使用全局标志g，表示匹配所有符合条件的部分
const braceRegex = /(\{\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}\})|([^{}]+)/g
const noBraceRegex = /\{\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}\}/
const ternaryRegex = /[^?]+\?.+:.+/
const RESERVED_TEMPLATE_CONTEXT_ALIASES = new Map([
	['class', '__dimina_reserved_class'],
])
const RESERVED_TEMPLATE_CONTEXT_NAMES = new Map(
	[...RESERVED_TEMPLATE_CONTEXT_ALIASES].map(([name, alias]) => [alias, name]),
)
function encodeReservedTemplateContextIdentifier(expression: string): string {
	return RESERVED_TEMPLATE_CONTEXT_ALIASES.get(expression) || expression
}

/**
 * 解析 {{}} 表达式的值
 * @param {*} exp
 */
function parseBraceExp(exp: string): string {
	// 定义两个数组，分别存放两个分组的匹配结果
	// 使用exec方法，循环执行正则表达式，直到返回null为止
	let result
	const group = []
	// eslint-disable-next-line no-cond-assign
	while ((result = braceRegex.exec(exp))) {
		// 如果第一个分组有匹配结果，移除 {{}}
		if (result[1]) {
			const matchResult = result[1].match(noBraceRegex)

			if (matchResult) {
				const statement = encodeReservedTemplateContextIdentifier(matchResult[1]!.trim())
				if (ternaryRegex.test(statement)) {
					// 三目表达式用 () 包裹，防止影响优先级
					group.push(`(${statement})`)
				}
				else {
					group.push(statement)
				}
			}
		}
		// 如果第二个分组有匹配结果，内联字符串拼接
		if (result[2]) {
			group.push(`+'${result[2].replace(/'/g, '\\\'')}'+`)
		}
	}
	// 去掉字符串首尾的加号，返回转换后的字符串
	return group.join('').replace(/^\+|\+$/g, '')
}

/**
 * 解析 template 的 data 对象表达式，保留对象字面量和内部三元表达式
 * @param {string} exp
 * @returns {string} 解析后的对象表达式字符串
 */
function parseTemplateDataExp(exp: string): string {
	const matchResult = exp.trim().match(/^\{\{([\s\S]*)\}\}$/)
	if (matchResult) {
		return addOptionalChaining(`{${matchResult[1]!.trim()}}`)
	}
	return `{${parseSafeBraceExp(exp)}}`
}
function transTagWxs(document: WxmlNode, scriptModule: unknown[], filePath: string, graphOwnerPath = filePath): void {
	// 同时处理所有视图脚本标签（wxs、dds 及自定义标签），避免同一文件混用多种标签时漏编译。
	const wxsNodes = queryAll(document, getViewScriptTags().join(','))

	for (const elem of wxsNodes.slice()) {
		const smName = getAttr(elem, 'module')

		if (smName) {
			let wxsContent
			let uniqueModuleName = smName
			let cacheKey = smName

			const src = getAttr(elem, 'src')
			let wxsFilePath = null
			const workPath = getWorkPath()

			if (src) {
				// 检查是否是 npm 组件路径
				if (filePath.includes('/miniprogram_npm/')) {
					// 对于 npm 组件，需要特殊处理相对路径
					// filePath 格式: /miniprogram_npm/@vant/weapp/radio-group/index
					// src 格式: ../wxs/utils.wxs 或 ./index.wxs

					// 获取组件所在目录的完整路径
					const componentDir = filePath.split('/').slice(0, -1).join('/')
					const componentFullPath = workPath + componentDir

					// 使用 Node.js path.resolve 来正确解析相对路径
					wxsFilePath = path.resolve(componentFullPath, src)
				} else {
					// 对于普通组件，使用原有逻辑
					wxsFilePath = getAbsolutePath(workPath, filePath, src)
				}

				if (wxsFilePath) {
					getDependencyGraph().addFile(graphOwnerPath, wxsFilePath, 'view')
					// 为外部 wxs 文件生成唯一的模块名和缓存键
					const relativePath = stripViewScriptExt(wxsFilePath.replace(workPath, ''))
					uniqueModuleName = relativePath.replace(/[\/\\@\-]/g, '_').replace(/^_/, '')
					cacheKey = wxsFilePath // 使用文件路径作为缓存键确保唯一性
				}
			}

			if (compileResCache.has(cacheKey)) {
				wxsContent = compileResCache.get(cacheKey)
			}
			else {
				if (src && wxsFilePath) {
					if (fs.existsSync(wxsFilePath)) {
						wxsContent = getContentByPath(wxsFilePath).trim()
					} else {
						console.warn(`[view] wxs 文件不存在: ${wxsFilePath}`)
						continue
					}
				}
				else {
					wxsContent = serializeChildren(elem)
				}

				if (!wxsContent) {
					continue
				}

				// 使用公共的处理函数
				wxsContent = processWxsContent(wxsContent, wxsFilePath!, scriptModule, workPath, filePath, graphOwnerPath)

				compileResCache.set(cacheKey, wxsContent)
			}
			if (wxsContent) {
				// 注册为 wxs 模块（因为这是从 wxs 节点加载的，一定是 wxs 脚本）
				registerWxsModule(uniqueModuleName)

				scriptModule.push({
					path: uniqueModuleName,
					code: wxsContent,
					originalName: smName, // 保存原始模块名用于模板中的引用
				})
			}
		}
	}
	removeAll(wxsNodes)
}

/**
 * 尝试从文件系统加载 wxs 模块
 * @param {string} modulePath - 模块路径
 * @param {string} workPath - 工作路径
 * @param {Array} scriptModule - 脚本模块数组
 * @returns {Object|null} 加载的模块对象或 null
 */
function loadWxsModule(modulePath: string, workPath: string, scriptModule: unknown[]): unknown {
	// wxsFilePathMap 记录 miniprogram_npm 下使用任意已配置扩展名的视图脚本文件，
	// 用于判断并定位模块。不能依赖 '_wxs_' 路径片段，否则会漏掉自定义扩展名
	// （如 .qds），以及路径中不含 wxs 目录的 .wxs 文件。
	const wxsFilePath = wxsFilePathMap.get(modulePath)

	if (!wxsFilePath) {
		return null
	}

	try {
		const wxsContent = getContentByPath(wxsFilePath).trim()
		if (!wxsContent) {
			return null
		}

		// 使用公共的处理函数
		const processedContent = processWxsContent(wxsContent, wxsFilePath, scriptModule, workPath, '')

		// 注册为 wxs 模块
		registerWxsModule(modulePath)

		return {
			path: modulePath,
			code: processedContent
		}
	} catch (error) {
		console.warn(`[view] 加载 wxs 模块失败: ${modulePath}`, errorMessage(error))
		return null
	}
}

function isWxsModuleByContent(moduleCode: string, modulePath = ''): boolean {
	if (!moduleCode || typeof moduleCode !== 'string') {
		return false
	}

	if (modulePath && isRegisteredWxsModule(modulePath)) {
		return true
	}
	return false
}


function collectAllWxsModules(scriptRes: Map<string, string>, collectedPaths = new Set<string>(), scriptModule: object[] = []): Array<{ path: string; code: string }> {
	const allWxsModules: Array<{ path: string; code: string }> = []
	const workPath = getWorkPath()

	for (const [modulePath, moduleCode] of scriptRes.entries()) {
		// 避免重复处理
		if (collectedPaths.has(modulePath)) {
			continue
		}

		// 检查是否是 wxs 模块
		if (isWxsModuleByContent(moduleCode, modulePath)) {
			collectedPaths.add(modulePath)
			allWxsModules.push({
				path: modulePath,
				code: moduleCode
			})

			// 递归收集该模块的依赖
			const dependencies = extractWxsDependencies(moduleCode)
			for (const depPath of dependencies) {
				if (!collectedPaths.has(depPath)) {
					if (scriptRes.has(depPath)) {
						// 如果依赖已经在 scriptRes 中，递归处理
						const depModules = collectAllWxsModules(new Map([[depPath, scriptRes.get(depPath)!]]), collectedPaths, scriptModule)
						allWxsModules.push(...depModules)
					} else {
						// 如果依赖不在 scriptRes 中，尝试从文件系统加载
						const loaded = loadWxsModule(depPath, workPath, scriptModule)
						if (loaded) {
							// 将加载的模块添加到 scriptRes 中
							scriptRes.set(depPath, (loaded as { code: string }).code)
							allWxsModules.push(loaded as { path: string; code: string })
							collectedPaths.add(depPath)

							// 递归处理新加载模块的依赖
							const depModules = collectAllWxsModules(new Map([[depPath, (loaded as { code: string }).code]]), collectedPaths, scriptModule)
							allWxsModules.push(...depModules)
						}
					}
				}
			}
		}
	}

	return allWxsModules
}

function extractWxsDependencies(moduleCode: string): string[] {
	const dependencies: string[] = []

	// 匹配 require("模块路径") 或 _("模块路径") 调用
	const requirePattern = /(?:require|_)\s*\(\s*["']([^"']+)["']\s*\)/g
	let match

	// eslint-disable-next-line no-cond-assign
	while ((match = requirePattern.exec(moduleCode)) !== null) {
		const depPath = match[1]
		if (depPath && !dependencies.includes(depPath)) {
			dependencies.push(depPath)
		}
	}

	return dependencies
}

function insertWxsToRenderResult(code: string, scriptModule: unknown[], scriptRes: Map<string, string>, filename = 'render.js', inputMap: unknown = null): { code: string; map: unknown } {
	const wxsBindings: Array<Record<string, unknown>> = []
	const codeReplacements = []
	const ast = parseJs(code, filename)
	const statement = ast.body?.[0]
	const renderExpression = statement?.type === 'ExpressionStatement' ? statement.expression : null
	const renderBody = (renderExpression as { body?: { type?: string; start?: number } })?.body
	const declarations = []

	for (const [index, sm] of scriptModule.entries()) {
		if (!scriptRes.has((sm as { path: string }).path)) {
			scriptRes.set((sm as { path: string }).path, (sm as { code: string }).code)
		}

		// 使用原始模块名作为模板中的属性名，唯一模块名作为 require 的参数
		const templatePropertyName = (sm as { originalName?: string; path: string }).originalName || (sm as { path: string }).path
		const requireModuleName = (sm as { path: string }).path
		const localIdentifier = `__wxs_${index}`

		wxsBindings.push({
			localIdentifier,
			templatePropertyName,
		})

		declarations.push(`const ${localIdentifier} = require(${JSON.stringify(requireModuleName)});`)
	}

	if (wxsBindings.length > 0 && renderBody?.type === 'BlockStatement') {
		codeReplacements.push({
			type: 'insert',
			start: renderBody.start! + 1,
			end: renderBody.start! + 1,
			value: `\n${declarations.join('\n')}`,
		})
	}

	walk(ast, {
		enter(node) {
			if (
				node.type === 'MemberExpression'
				&&
				node.object?.type === 'Identifier'
				&& node.object.name === '_ctx'
				&& !node.computed
				&& node.property?.type === 'Identifier'
			) {
				const reservedName = RESERVED_TEMPLATE_CONTEXT_NAMES.get(node.property.name)
				if (reservedName) {
					codeReplacements.push({
						start: node.property.start,
						end: node.property.end,
						value: reservedName,
					})
					return
				}
				const replacement = wxsBindings.find(item => item.templatePropertyName === node.property.name)
				if (replacement) {
					codeReplacements.push({
						start: node.start,
						end: node.end,
						value: replacement.localIdentifier,
					})
				}
			}
		},
	})
	if (codeReplacements.length === 0) {
		return { code: getProgramCode(code, ast), map: inputMap }
	}

	const transformed = applyCodeReplacements(code, codeReplacements)
	let map = inputMap
	if (enableSourcemap) {
		const generatedMap = new MagicString(code)
		const selected: Array<{ start: number; end: number; newValue?: string; value?: string; type?: string }> = []
		for (const replacement of [...codeReplacements].sort((a, b) => (b.end - b.start) - (a.end - a.start))) {
			if (!selected.some(item => replacement.start < item.end && item.start < replacement.end)) {
				selected.push(replacement)
			}
		}
		for (const replacement of selected.sort((a, b) => b.start - a.start)) {
			if (replacement.type === 'insert') {
				generatedMap.appendLeft(replacement.start, replacement.value!)
			}
			else {
				generatedMap.overwrite(replacement.start, replacement.end, replacement.value!)
			}
		}
		const wxsTransformMap = generatedMap.generateMap({
			file: filename,
			source: filename,
			includeContent: true,
			hires: true,
		}).toString()
		map = inputMap ? remapSourcemap(wxsTransformMap, inputMap) : wxsTransformMap
	}
	const transformedAst = parseJs(transformed, filename)
	return { code: getProgramCode(transformed, transformedAst), map }
}


// W1 live bindings — break index ↔ load / vue renderer tools cycles (bodies stay in modules)
bindVueToolsLive({
	transformTextInterpolation,
	isWrappedByBraces,
	parseBraceExp,
	parseSafeBraceExp,
	parseForExp,
	getForItemName,
	getForIndexName,
	parseKeyExpression,
	parseClassRules,
	parseTemplateDataExp,
	escapeQuotes,
	insertWxsToRenderResult,
})
bindTransformOrchestrator({
	transTagWxs,
	transAsses,
	processIncludedFileWxsDependencies,
})

export {
	compileML,
	viewParseWalk,
	generateVModelTemplate,
	generateSlotDirective,
	initWxsFilePathMap,
	loadWxsModule,
	parseBraceExp,
	parseClassRules,
	parseKeyExpression,
	parseTemplateDataExp,
	normalizeTemplateSyntax,
	processIncludeConditionalAttrs,
	processWxsContent,
	splitWithBraces,
}

// P-WR02: engine export（不动调度，F47；onMessage 旧版保留，compile 函数声明供 export）
async function viewCompile({ msg, progress, config }: CompileOptions): Promise<void> {
	const m = msg as { storeInfo: Parameters<typeof resetStoreInfo>[0]; sourcemap?: boolean; pages: { mainPages: ViewModule[]; subPages: Record<string, { info: ViewModule[]; independent: boolean }> } }
	resetStoreInfo(m.storeInfo)
	setEnableSourcemap(!!m.sourcemap)
	activeCompileConfig = config as { minify: boolean; sourcemap: boolean; esTarget: { logic: string; view: string } }
	wxsScannedWorkPath = null

	await compileML(m.pages.mainPages, null, progress as Progress)
	for (const [root, subPages] of Object.entries(m.pages.subPages)) {
		await compileML(subPages.info as ViewModule[], root, progress as Progress)
	}

	compileResCache.clear()
	templateRenderCache.clear()
	wxsModuleRegistry.clear()
	wxsFilePathMap.clear()
	wxsScannedWorkPath = null
	optionalChainingCache.clear()
}
function viewSuccessPayload({ logger }: { logger: { warn: (msg: string) => void; flush: () => string[] } }): Record<string, unknown> {
	return {
		dependencyGraph: getDependencyGraph().toJSON(),
		compatibilityWarnings: logger.flush(),
	}
}
function viewBuildConfig(msg: Record<string, any>) {
	return {
		sourcemap: !!msg.sourcemap,
		minify: msg.compileConfig?.minify !== false,
		esTarget: {
			logic: msg.compileConfig?.esTarget?.logic || 'es2023',
			view: msg.compileConfig?.esTarget?.view || 'es2020',
		},
	}
}

export const viewEngine = defineEngine({
	name: 'view',
	compile: viewCompile,
	cleanup: () => {},
	successPayload: viewSuccessPayload,
	buildConfig: viewBuildConfig,
})
