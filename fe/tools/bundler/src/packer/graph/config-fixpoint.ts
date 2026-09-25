/**
 * config-fixpoint.ts — 配置定点逻辑的共享私有模块。
 *
 * 所有函数从 ALS 全局（pathInfo / configInfo / getCompilerContext）
 * 迁移为显式参数：通过 FixpointCtx 传入 PackerContext（真 I/O）、
 * GraphConfigData（可变目标）、NpmResolver（路径解析）。
 *
 * D-PC-6: config fixpoint 迁入 Graph，关路 1（不再经 ALS Proxy）。
 * D-PC-7: 可选文件存在性由 fs.existsSync（不扩 PackerContext）。
 * D-PC-8: NpmResolver(ctx.workPath) for config fixpoint。
 * D-PC-9: build 局部性；禁止 ALS getter 回环。
 * D-PC-10: 建图 kind/扩展名判定用 ctx.fileTypes。
 * D-PC-11: env.ts store*Config 薄壳委托此模块。
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseSync } from 'oxc-parser'
import { walk } from 'oxc-walker'
import { isObjectEmpty, resolveAssetSourcePath, uuid, errorMessage } from '../../shared/utils.ts'
import { NpmResolver } from './npm-resolver.ts'
import { DependencyGraph } from './dependency-graph.ts'
import type { GraphConfigData } from './graph.ts'
import type { PackerContext, PackerFileTypes, PageConfig, ComponentConfig } from '../types.ts'


// ── 常量（从 env.ts 迁移）──

const MINI_PROGRAM_RUNTIME_TYPE = 'miniProgram'
const MINI_GAME_RUNTIME_TYPE = 'game'
const MINI_GAME_ENTRY_PATH = 'game'
const CUSTOM_TAB_BAR_COMPONENT_PATH = '/custom-tab-bar/index'

const STYLE_ISOLATION_VALUES = new Set([
	'isolated',
	'apply-shared',
	'shared',
])

// ── FixpointCtx: 显式参数包 ──

export interface FixpointCtx {
	ctx: PackerContext
	configData: GraphConfigData
	npm: NpmResolver
}

/**
 * B 切法（PC-B5/B7）：从 storeInfo 产物显式建 FixpointCtx（镜像 env.ts toPackerContext，但非 ALS）。
 * ConfigCollector（PC-B5）+ readLoadBindings（PC-B7）共用——消除 getPages/getComponent 等 ALS getter 回环。
 */
export function buildFixpointCtx(
	workPath: string,
	targetPath: string,
	compilerOptions: { templateExts: string[]; styleExts: string[]; viewScriptExts: string[]; viewScriptTags: string[]; templateDirectivePrefixes: string[] },
	configData: GraphConfigData,
): FixpointCtx {
	const ctx: PackerContext = {
		workPath,
		targetPath,
		readContent: (p: string) => fs.readFileSync(p, { encoding: 'utf-8' }),
		resolveAlias: (_src: string) => null,
		resolveNpm: (src: string) => src,
		fileTypes: {
			templateExts: compilerOptions.templateExts,
			styleExts: compilerOptions.styleExts,
			viewScriptExts: compilerOptions.viewScriptExts,
			viewScriptTags: compilerOptions.viewScriptTags,
			directivePrefixes: compilerOptions.templateDirectivePrefixes,
		} as PackerFileTypes,
	}
	return { ctx, configData, npm: new NpmResolver(workPath) }
}

// ── 导出函数（graph.ts build + env.ts 薄壳共用）──

/**
 * 读取并合并 project.config.json + project.private.config.json。
 * D-PC-9: 直接 fs.existsSync + ctx.readContent，不经 ALS。
 */
export function readProjectConfig(fc: FixpointCtx): void {
	const workPath = fc.ctx.workPath
	const privateConfigPath = `${workPath}/project.private.config.json`
	const defaultConfigPath = `${workPath}/project.config.json`

	let privateConfig: Record<string, unknown> = {}
	let defaultConfig: Record<string, unknown> = {}

	if (fs.existsSync(defaultConfigPath)) {
		try {
			defaultConfig = parseContentByPath(fc, defaultConfigPath)
		}
		catch (e) {
			console.warn('Failed to parse project.config.json:', errorMessage(e))
		}
	}

	if (fs.existsSync(privateConfigPath)) {
		try {
			privateConfig = parseContentByPath(fc, privateConfigPath)
		}
		catch (e) {
			console.warn('Failed to parse project.private.config.json:', errorMessage(e))
		}
	}

	fc.configData.projectInfo = { ...defaultConfig, ...privateConfig }
}

/**
 * 检测运行时类型 + 读取 app.json/game.json。
 * D-PC-9: detectRuntimeType 读 fc.configData.projectInfo（不经 ALS）。
 */
export function readAppConfig(fc: FixpointCtx): void {
	const workPath = fc.ctx.workPath
	const runtimeType = detectRuntimeType(fc)
	const configFileName = runtimeType === MINI_GAME_RUNTIME_TYPE ? 'game.json' : 'app.json'
	const filePath = `${workPath}/${configFileName}`
	const content = parseContentByPath(fc, filePath)
	if (runtimeType === MINI_GAME_RUNTIME_TYPE) {
		fc.configData.runtimeType = MINI_GAME_RUNTIME_TYPE
		fc.configData.appInfo = {
			...content,
			runtimeType: MINI_GAME_RUNTIME_TYPE,
			entryPagePath: MINI_GAME_ENTRY_PATH,
			pages: [MINI_GAME_ENTRY_PATH],
			window: {
				backgroundColor: content.backgroundColor || '#000000',
				navigationStyle: 'custom',
			},
		}
		return
	}

	const newObj: Record<string, unknown> = {}
	for (const key in content) {
		if (Object.prototype.hasOwnProperty.call(content, key)) {
			if (key === 'subpackages') {
				newObj.subPackages = content[key]
			}
			else {
				newObj[key] = content[key]
			}
		}
	}
	fc.configData.runtimeType = MINI_PROGRAM_RUNTIME_TYPE
	newObj.runtimeType = MINI_PROGRAM_RUNTIME_TYPE
	fc.configData.appInfo = newObj
}

/**
 * 收集页面 + 自定义组件配置。
 * D-PC-9: 读 fc.configData.appInfo/pageInfo/componentInfo（不经 ALS）。
 */
export function readPageConfig(fc: FixpointCtx): void {
	if (fc.configData.runtimeType === MINI_GAME_RUNTIME_TYPE) {
		fc.configData.pageInfo = {}
		fc.configData.componentInfo = {}
		return
	}
	const appInfo = fc.configData.appInfo as { pages?: string[]; subPackages?: { root: string; pages: string[]; independent?: boolean }[]; usingComponents?: Record<string, string> } | undefined
	const { pages, subPackages } = appInfo || {}
	fc.configData.pageInfo = {}
	fc.configData.componentInfo = {}

	if (appInfo?.usingComponents) {
		const appFilePath = `${fc.ctx.workPath}/app.json`
		readComponentConfig(fc, fc.configData.appInfo! as PageConfig, appFilePath)
	}

	collectPageJson(fc, pages)

	if (subPackages) {
		subPackages?.forEach((subPkg: { root: string; pages: string[]; independent?: boolean }) => {
			collectPageJson(fc, subPkg.pages, subPkg.root)
		})
	}

	readCustomTabBarConfig(fc)
}

/**
 * 建立初始依赖图（从 fc.configData 读 pages/components）。
 * D-PC-9: 不经 getAppConfigInfo/getPages 等 ALS getter。
 * D-PC-10: 用 fc.ctx.fileTypes 判定扩展名 kind。
 */
export function buildInitialGraph(fc: FixpointCtx): DependencyGraph {
	const graph = new DependencyGraph()
	const workPath = fc.ctx.workPath
	const fileTypes = fc.ctx.fileTypes
	const configData = fc.configData

	if (configData.runtimeType === MINI_GAME_RUNTIME_TYPE) {
		graph.addNode(MINI_GAME_ENTRY_PATH, { type: MINI_GAME_RUNTIME_TYPE, entry: true })
		for (const fileName of [
			'game.json',
			'game.js',
			'game.ts',
			'project.config.json',
			'project.private.config.json',
		]) {
			const filePath = path.resolve(workPath, fileName)
			if (fs.existsSync(filePath)) {
				graph.addFile(MINI_GAME_ENTRY_PATH, filePath, getFileDependencyKind(filePath, fileTypes))
			}
		}
		return graph
	}
	graph.addNode('app', { type: 'app' })
	for (const fileName of [
		'app.json',
		'app.js',
		'app.ts',
		'project.config.json',
		'project.private.config.json',
	]) {
		const filePath = path.resolve(workPath, fileName)
		if (fs.existsSync(filePath)) {
			graph.addFile('app', filePath, getFileDependencyKind(filePath, fileTypes))
		}
	}
	addExistingModuleFiles(fc, graph, 'app')
	const appInfo = configData.appInfo as { tabBar?: { list?: Array<{ iconPath?: string; selectedIconPath?: string }> } } | undefined
	for (const item of appInfo?.tabBar?.list || []) {
		for (const field of ['iconPath', 'selectedIconPath'] as const) {
			if (!item[field]) continue
			const assetPath = resolveAssetSourcePath(workPath, '', item[field]!)
			if (fs.existsSync(assetPath)) {
				graph.addFile('app', assetPath, 'config')
			}
		}
	}

	for (const component of Object.values(configData.componentInfo || {})) {
		graph.addNode(component.path!, { type: 'component' })
		addExistingModuleFiles(fc, graph, component.path!)
	}
	for (const component of Object.values(configData.componentInfo || {})) {
		for (const dependencyPath of Object.values(component.usingComponents || {})) {
			graph.addDependency(component.path!, dependencyPath, 'component')
		}
	}

	const pages = getPagesImpl(fc)
	const addEntry = (page: { path: string; usingComponents?: Record<string, string> }, packageRoot: string | null) => {
		graph.addNode(page.path, {
			type: 'page',
			entry: true,
			packageRoot,
		})
		addExistingModuleFiles(fc, graph, page.path)
		graph.addDependency(page.path, 'app', 'app')
		for (const dependencyPath of Object.values(page.usingComponents || {})) {
			graph.addDependency(page.path, dependencyPath, 'component')
		}
	}
	for (const page of pages.mainPages) {
		addEntry(page, null)
	}
	for (const [packageRoot, subPackage] of Object.entries(pages.subPages)) {
		for (const page of subPackage.info) {
			addEntry(page, packageRoot)
		}
	}
	return graph
}

// ── 内部辅助函数 ──

function parseContentByPath(fc: FixpointCtx, filePath: string): Record<string, unknown> {
	return JSON.parse(fc.ctx.readContent(filePath))
}

function detectRuntimeType(fc: FixpointCtx): string {
	const compileType = (fc.configData.projectInfo as { compileType?: string } | undefined)?.compileType
	const workPath = fc.ctx.workPath
	const hasMiniProgramConfig = fs.existsSync(path.join(workPath, 'app.json'))
	const hasMiniGameConfig = fs.existsSync(path.join(workPath, 'game.json'))
	const hasMiniGameEntry = ['game.js', 'game.ts']
		.some(fileName => fs.existsSync(path.join(workPath, fileName)))

	if (compileType === 'game') {
		return MINI_GAME_RUNTIME_TYPE
	}
	if (compileType === 'miniprogram') {
		return MINI_PROGRAM_RUNTIME_TYPE
	}
	if (!hasMiniProgramConfig && hasMiniGameConfig && hasMiniGameEntry) {
		return MINI_GAME_RUNTIME_TYPE
	}
	return MINI_PROGRAM_RUNTIME_TYPE
}

function collectPageJson(fc: FixpointCtx, pages: string[] | undefined, root?: string): void {
	if (!Array.isArray(pages)) {
		return
	}
	pages.forEach((pagePath) => {
		let np = pagePath
		if (root) {
			if (!root.endsWith('/')) {
				root += '/'
			}
			np = root + np
		}
		const pageFilePath = `${fc.ctx.workPath}/${np}.json`
		if (fs.existsSync(pageFilePath)) {
			const pageJsonContent = parseContentByPath(fc, pageFilePath)
			if (root) {
				(pageJsonContent as { root?: string }).root = transSubDir(root)
			}
			(fc.configData.pageInfo!)[np] = pageJsonContent

			readComponentConfig(fc, pageJsonContent, pageFilePath)
		}
	})
}

function readComponentConfig(fc: FixpointCtx, pageJsonContent: PageConfig, pageFilePath: string): void {
	if (isObjectEmpty(pageJsonContent.usingComponents ?? null)) {
		return
	}
	for (const [componentName, componentPath] of Object.entries(pageJsonContent.usingComponents || {})) {
		const moduleId = getModuleId(fc, componentPath, pageFilePath)
		;(pageJsonContent.usingComponents ?? {})[componentName] = moduleId

		if ((fc.configData.componentInfo!)[moduleId]) {
			continue
		}

		let componentFilePath = path.resolve(fc.ctx.workPath, `./${moduleId}.json`)
		let cContent: Record<string, unknown> | null = null

		if (fs.existsSync(componentFilePath)) {
			cContent = parseContentByPath(fc, componentFilePath)
		} else {
			const indexJsonPath = path.resolve(fc.ctx.workPath, `./${moduleId}/index.json`)
			if (fs.existsSync(indexJsonPath)) {
				componentFilePath = indexJsonPath
				cContent = parseContentByPath(fc, componentFilePath)
			} else {
				if (moduleId.includes('/miniprogram_npm/')) {
					console.log(`[env] 为 npm 组件创建默认配置: ${moduleId}`)
					cContent = {
						component: true,
						usingComponents: {}
					}
				} else {
					console.warn(`[env] 组件配置文件不存在: ${componentFilePath}`)
					continue
				}
			}
		}

		const cUsing = (cContent.usingComponents ?? {}) as Record<string, string>
		const isComponent = cContent.component || false
		const styleIsolation = resolveComponentStyleIsolation(fc, cContent, componentFilePath)
		const cComponents: Record<string, string> = {}
		for (const key of Object.keys(cUsing)) {
			cComponents[key] = getModuleId(fc, cUsing[key]!, componentFilePath)
		}

		(fc.configData.componentInfo!)[moduleId] = {
			id: uuid(moduleId),
			path: moduleId,
			component: isComponent,
			styleIsolation,
			usingComponents: cComponents,
			componentPlaceholder: { ...((cContent as { componentPlaceholder?: Record<string, unknown> }).componentPlaceholder || {}) },
		}

		if (cContent.usingComponents && Object.keys(cContent.usingComponents).length > 0) {
			readComponentConfig(fc, fc.configData.componentInfo![moduleId], componentFilePath)
		}
	}
}

/**
 * 微信会把 custom-tab-bar/index 作为每个 tab 页的直属组件创建。业务页面
 * 不需要在 usingComponents 中显式声明它，因此编译阶段补一个内部组件引用，
 * 让逻辑、视图和样式三个编译器都能沿现有依赖图收集该组件。
 */
function readCustomTabBarConfig(fc: FixpointCtx): void {
	const tabBar = (fc.configData.appInfo as { tabBar?: { custom?: boolean; list?: { pagePath?: string }[] } } | undefined)?.tabBar
	if (tabBar?.custom !== true || !Array.isArray(tabBar.list)) {
		return
	}

	const componentJsonPath = path.join(fc.ctx.workPath, 'custom-tab-bar/index.json')
	if (!fs.existsSync(componentJsonPath)) {
		console.warn('[env] tabBar.custom 已启用，但找不到 custom-tab-bar/index.json')
		return
	}

	const dependencyName = `dimina-${uuid(CUSTOM_TAB_BAR_COMPONENT_PATH)}`
	const internalConfig = {
		usingComponents: {
			[dependencyName]: CUSTOM_TAB_BAR_COMPONENT_PATH,
		},
	}
	readComponentConfig(fc, internalConfig, path.join(fc.ctx.workPath, 'app.json'))
	const componentConfig = (fc.configData.componentInfo!)[CUSTOM_TAB_BAR_COMPONENT_PATH]
	if (componentConfig) {
		componentConfig.customTabBar = true
	}

	for (const item of tabBar.list) {
		const pagePath = typeof item?.pagePath === 'string'
			? item.pagePath.replace(/^\/+/, '')
			: ''
		if (!pagePath || !(fc.configData.appInfo as { pages?: string[] } | undefined)?.pages?.includes(pagePath)) {
			continue
		}
		const pageConfig: Record<string, unknown> = ((fc.configData.pageInfo!)[pagePath] ||= {})
		pageConfig.usingComponents = (pageConfig as { usingComponents?: Record<string, string> }).usingComponents ||= {}
		const declaredComponents = {
			...((fc.configData.appInfo as { usingComponents?: Record<string, string> } | undefined)?.usingComponents || {}),
			...((pageConfig as { usingComponents?: Record<string, string> }).usingComponents || {}),
		}
		const declaredEntry = Object.entries(declaredComponents)
			.find(([, componentPath]) => componentPath === CUSTOM_TAB_BAR_COMPONENT_PATH)
		let componentName = declaredEntry?.[0] || dependencyName
		let suffix = 0
		while (
			declaredComponents[componentName]
			&& declaredComponents[componentName] !== CUSTOM_TAB_BAR_COMPONENT_PATH
		) {
			suffix++
			componentName = `${dependencyName}-${suffix}`
		}
		Object.assign(pageConfig, { usingComponents: { ...(pageConfig.usingComponents || {}), [componentName]: CUSTOM_TAB_BAR_COMPONENT_PATH }, customTabBar: { componentName } })
	}
}

function getModuleId(fc: FixpointCtx, src: string, pageFilePath: string): string {
	const resolvedAlias = resolveAppAlias(src, fc.configData.appInfo)
	if (resolvedAlias) {
		return resolvedAlias
	}
	return fc.npm.resolveComponentPath(src, pageFilePath)
}

/**
 * 解析 app.json 中的 resolveAlias 映射。
 * D-PC-9: 从 fc.configData.appInfo 读（不经 ALS configInfo）。
 * R3-1: env.ts 保留薄壳版本（读 ALS），此为 Graph 私有版本。
 */
export function resolveAppAlias(src: string, appInfo?: Record<string, unknown>): string | null {
	const resolveAlias = (appInfo as { resolveAlias?: Record<string, string> } | undefined)?.resolveAlias
	if (!resolveAlias || typeof src !== 'string') {
		return null
	}

	for (const [alias, target] of Object.entries(resolveAlias)) {
		if (alias.endsWith('/*') && target.endsWith('/*')) {
			const aliasPrefix = alias.slice(0, -1)
			const targetPrefix = target.slice(0, -1)
			if (src.startsWith(aliasPrefix)) {
				return src.replace(aliasPrefix, targetPrefix)
			}
		}
		else if (src === alias) {
			return target
		}
	}

	return null
}

function addExistingModuleFiles(fc: FixpointCtx, graph: DependencyGraph, moduleId: string): void {
	const relativeId = moduleId.replace(/^\/+/, '')
	const basePath = path.resolve(fc.ctx.workPath, relativeId)
	const baseCandidates = [basePath, path.join(basePath, 'index')]
	const extensions = [
		'.json',
		'.js',
		'.ts',
		...fc.ctx.fileTypes.templateExts,
		...fc.ctx.fileTypes.styleExts,
		...fc.ctx.fileTypes.viewScriptExts,
	]
	for (const candidateBase of baseCandidates) {
		for (const extension of extensions) {
			const filePath = `${candidateBase}${extension}`
			if (fs.existsSync(filePath)) {
				graph.addFile(moduleId, filePath, getFileDependencyKind(filePath, fc.ctx.fileTypes))
			}
		}
	}
}

function getFileDependencyKind(filePath: string, fileTypes: PackerFileTypes): string {
	const extension = path.extname(filePath).toLowerCase()
	if (extension === '.json') return 'config'
	if (extension === '.js' || extension === '.ts') return 'logic'
	if (fileTypes.templateExts.includes(extension) || fileTypes.viewScriptExts.includes(extension)) return 'view'
	if (fileTypes.styleExts.includes(extension)) return 'style'
	return 'module'
}

function resolveComponentStyleIsolation(fc: FixpointCtx, componentConfig: Record<string, unknown>, componentJsonPath: string): string {
	const jsonValue = normalizeStyleIsolation((componentConfig as { styleIsolation?: unknown }).styleIsolation)
	if (jsonValue) {
		return jsonValue
	}

	const basePath = componentJsonPath.replace(/\.json$/i, '')
	const scriptPath = ['.js', '.ts']
		.map(ext => `${basePath}${ext}`)
		.find(candidate => fs.existsSync(candidate))
	if (!scriptPath) {
		return 'isolated'
	}

	try {
		const source = fc.ctx.readContent(scriptPath)
		const { program } = parseSync(scriptPath, source, {
			sourceType: 'unambiguous',
		})
		let extractedValue: string | undefined
		walk(program, {
			enter(expression: unknown) {
				if (extractedValue) {
					return
				}
				const expr = expression as { type?: string; callee?: { type?: string; name?: string }; arguments?: unknown[] }
				if (
					expr?.type !== 'CallExpression'
					|| expr.callee?.type !== 'Identifier'
					|| expr.callee?.name !== 'Component'
				) {
					return
				}
				const definition = expr.arguments?.[0] as { type?: string; properties?: Array<{ type?: string; computed?: boolean; key?: { name?: string; value?: string }; value?: unknown }> } | null | undefined
				const options = getStaticProperty(definition, 'options') as { type?: string; properties?: Array<{ type?: string; computed?: boolean; key?: { name?: string; value?: string }; value?: unknown }> } | null | undefined
				const styleIsolation = (getStaticProperty(options, 'styleIsolation') as { value?: unknown } | undefined)?.value
				const normalized = normalizeStyleIsolation(styleIsolation as string)
				if (normalized) {
					extractedValue = normalized
					return
				}
				if ((getStaticProperty(options, 'addGlobalClass') as { value?: unknown } | undefined)?.value === true) {
						extractedValue = 'apply-shared'
				}
			},
		})
		if (extractedValue) {
			return extractedValue
		}
	}
	catch (error) {
		console.warn(`[env] 无法解析组件样式隔离配置 ${scriptPath}: ${errorMessage(error)}`)
	}

	return 'isolated'
}

function getStaticProperty(objectExpression: { type?: string; properties?: Array<{ type?: string; computed?: boolean; key?: { name?: string; value?: string }; value?: unknown }> } | null | undefined, propertyName: string): unknown {
	if (objectExpression?.type !== 'ObjectExpression') {
		return undefined
	}
	return objectExpression.properties?.find((property) => {
		if (property.type !== 'Property' || property.computed) {
			return false
		}
		return property.key?.name === propertyName || property.key?.value === propertyName
	})?.value
}

function normalizeStyleIsolation(value: unknown): string | undefined {
	return typeof value === 'string' && STYLE_ISOLATION_VALUES.has(value) ? value : undefined
}

function transSubDir(name: string): string {
	return `sub_${name.replace(/\/$/, '')}`
}

/**
 * 获取页面及其配置信息，并生成id（输出的 json 文件没有 id)。
 * D-PC-9: 从 fc.configData 读（不经 getAppConfigInfo/getPageConfigInfo）。
 */
export function getPagesImpl(fc: FixpointCtx): { mainPages: Array<{ id: string; path: string; usingComponents?: Record<string, string>; [key: string]: unknown }>; subPages: Record<string, { info: Array<{ path: string; usingComponents?: Record<string, string>; [key: string]: unknown }> }> } {
	if (fc.configData.runtimeType === MINI_GAME_RUNTIME_TYPE) {
		return {
			mainPages: [{
				id: uuid(MINI_GAME_ENTRY_PATH),
				path: MINI_GAME_ENTRY_PATH,
				game: true,
				usingComponents: {},
			}],
			subPages: {},
		}
	}
	const appConfig = fc.configData.appInfo as { pages: string[]; subPackages?: { root: string; pages: string[]; independent?: boolean }[]; usingComponents?: Record<string, string> } | undefined
	const { pages: pageList = [], subPackages = [], usingComponents: globalComponents = {} } = appConfig || {}
	const pageInfo = fc.configData.pageInfo!

	const mainPages = pageList.map(pagePath => {
		const pageComponents = pageInfo[pagePath]?.usingComponents || {}
		const mergedComponents = { ...globalComponents, ...pageComponents }

		return {
			id: uuid(pagePath),
			path: pagePath,
			appStyleScopeId: uuid('app'),
			sharedStyleScopeIds: collectSharedStyleScopeIds(mergedComponents, fc.configData.componentInfo!),
			usingComponents: mergedComponents,
			componentPlaceholder: { ...(pageInfo[pagePath]?.componentPlaceholder || {}) },
			customTabBar: pageInfo[pagePath]?.customTabBar,
		}
	})

	const subPages: Record<string, { independent: boolean; info: Array<{ path: string; usingComponents?: Record<string, string>; [key: string]: unknown }>; [key: string]: unknown }> = {}
	subPackages?.forEach((subPkg: { root: string; pages: string[]; independent?: boolean }) => {
		const rootPath = subPkg.root.endsWith('/') ? subPkg.root : `${subPkg.root}/`
		const independent = subPkg.independent ? subPkg.independent : false
		subPages[transSubDir(rootPath)] = {
			independent,
			info: subPkg.pages.map(pagePath => {
				const fullPath = rootPath + pagePath
				const pageComponents = pageInfo[fullPath]?.usingComponents || {}
				const mergedComponents = { ...globalComponents, ...pageComponents }

				return {
					id: uuid(fullPath),
					path: fullPath,
					appStyleScopeId: uuid('app'),
					sharedStyleScopeIds: collectSharedStyleScopeIds(mergedComponents, fc.configData.componentInfo!),
					usingComponents: mergedComponents,
					componentPlaceholder: { ...(pageInfo[fullPath]?.componentPlaceholder || {}) },
					customTabBar: pageInfo[fullPath]?.customTabBar,
				}
			}),
		}
	})
	return {
		mainPages,
		subPages,
	}
}

function collectSharedStyleScopeIds(usingComponents: Record<string, string> | undefined, componentInfo: Record<string, ComponentConfig>): string[] {
	const result: string[] = []
	const visited = new Set()
	const visit = (componentPath: string) => {
		if (visited.has(componentPath)) {
			return
		}
		visited.add(componentPath)
		const component = componentInfo[componentPath]
		if (!component) {
			return
		}
		if (component.styleIsolation === 'shared') {
			result.push(component.id!)
		}
		for (const childPath of Object.values(component.usingComponents || {})) {
			visit(childPath)
		}
	}
	for (const componentPath of Object.values(usingComponents || {})) {
		visit(componentPath)
	}
	return result
}
