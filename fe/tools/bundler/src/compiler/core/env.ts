import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { AsyncLocalStorage } from 'node:async_hooks'
import { parseSync } from 'oxc-parser'
import { walk } from 'oxc-walker'
import { resolveMiniProgramPath, toMiniProgramModuleId } from '../../shared/path-utils.ts'
import { isObjectEmpty, resolveAssetSourcePath, uuid } from '../../shared/utils.ts'
import { NpmResolver } from './npm-resolver.js'
import { DependencyGraph } from '../../model/dependency-graph.js'

const compilerContextStorage = new AsyncLocalStorage<CompilerContext>()
let defaultCompilerContext: CompilerContext | undefined

type CompilerContext = {
	pathInfo: Record<string, unknown>
	configInfo: Record<string, unknown>
	npmResolver: NpmResolver | null
	dependencyGraph: DependencyGraph
	compilerOptions: ReturnType<typeof normalizeFileTypes>
}

function createCompilerContext(): CompilerContext {
	return {
		pathInfo: {},
		configInfo: {},
		npmResolver: null,
		dependencyGraph: new DependencyGraph(),
		compilerOptions: normalizeFileTypes(),
	}
}

function getCompilerContext(): CompilerContext {
	defaultCompilerContext ||= createCompilerContext()
	return compilerContextStorage.getStore() || defaultCompilerContext
}

// 将现有属性访问路由到当前异步构建上下文。直接调用 storeInfo() 的测试和
// 独立 Worker 没有 AsyncLocalStorage store 时，仍使用各自进程内的默认上下文。
const pathInfo: Record<string, unknown> = new Proxy({}, {
	get: (_, key) => getCompilerContext().pathInfo[key as string],
	set: (_, key, value) => {
		getCompilerContext().pathInfo[key as string] = value
		return true
	},
})
const configInfo: Record<string, unknown> = new Proxy({}, {
	get: (_, key) => getCompilerContext().configInfo[key as string],
	set: (_, key, value) => {
		getCompilerContext().configInfo[key as string] = value
		return true
	},
})

// 小程序自定义文件类型：可扩展的文件扩展名和内联标签。
// 始终保留内置 wx/dd 类型；调用方通过 build() 或 storeInfo() 的 options.fileTypes 追加自定义项。
const DEFAULT_TEMPLATE_EXTS = ['.wxml', '.ddml']
// 保留已有的微信、钉钉与支付宝指令前缀兼容；自定义模板类型会再显式派生前缀。
const DEFAULT_TEMPLATE_DIRECTIVE_PREFIXES = ['wx', 'dd', 'a']
const DEFAULT_STYLE_EXTS = ['.wxss', '.ddss', '.less', '.scss', '.sass']
const DEFAULT_VIEW_SCRIPT_EXTS = ['.wxs']
const DEFAULT_VIEW_SCRIPT_TAGS = ['wxs', 'dds']
// 微信自定义 tabBar 的规范入口只在编译适配层解析；运行时通过产物元数据识别。
const CUSTOM_TAB_BAR_COMPONENT_PATH = '/custom-tab-bar/index'
const STYLE_ISOLATION_VALUES = new Set([
	'isolated',
	'apply-shared',
	'shared',
])
const MINI_PROGRAM_RUNTIME_TYPE = 'miniProgram'
const MINI_GAME_RUNTIME_TYPE = 'game'
const MINI_GAME_ENTRY_PATH = 'game'

// 保留扩展名：所有内置类型 + 逻辑(.js/.ts) + 配置(.json)。自定义项不得占用，
// 否则会跨角色串编（如 template:['js'] 会把页面逻辑文件当成模板解析）。
const RESERVED_EXTS = new Set([
	...DEFAULT_TEMPLATE_EXTS,
	...DEFAULT_STYLE_EXTS,
	...DEFAULT_VIEW_SCRIPT_EXTS,
	'.js',
	'.ts',
	'.json',
])

/**
 * 将单项规范化为扩展名：去除首尾空白、转小写并补一个前导点。
 * 仅接受字母、数字、连字符和下划线；空字符串、路径分隔符或其他元字符
 * 均返回 null，由调用方丢弃。扩展名会用于生成尾部匹配正则和查找文件，
 * 放行元字符可能导致误匹配。
 */
function normalizeExt(raw: unknown): string | null {
	if (typeof raw !== 'string') {
		return null
	}
	const v = raw.trim().toLowerCase().replace(/^\.+/, '')
	if (!/^[a-z0-9_-]+$/.test(v)) {
		return null
	}
	return `.${v}`
}

/**
 * 将单项规范化为内联标签名：去除首尾空白、转小写并移除前导点。
 * 标签名会用于拼接 Cheerio 选择器（如 transTagWxs），因此必须以字母开头，
 * 且只能包含字母、数字、连字符和下划线。拒绝选择器元字符，避免 'qds,view'
 * 误选并删除 <view>，破坏编译产物。
 */
function normalizeTag(raw: unknown): string | null {
	if (typeof raw !== 'string') {
		return null
	}
	const v = raw.trim().toLowerCase().replace(/^\.+/, '')
	if (!/^[a-z][a-z0-9_-]*$/.test(v)) {
		return null
	}
	return v
}

/**
 * 合并并去重内置项和自定义项；内置项在前，顺序即同名文件的查找优先级。
 * 传入 reserved 时，落在其中的自定义项被丢弃（防止占用其他角色/逻辑/配置的扩展名）。
 */
function mergeUnique(builtins: string[], custom: unknown, normalizer: (raw: unknown) => string | null, reserved?: Set<string>): string[] {
	const out = [...builtins]
	const seen = new Set(builtins)
	if (Array.isArray(custom)) {
		for (const raw of custom) {
			const n = normalizer(raw)
			if (n && !seen.has(n) && !reserved?.has(n)) {
				seen.add(n)
				out.push(n)
			}
		}
	}
	return out
}

/**
 * 根据 options.fileTypes 生成本次构建使用的自定义扩展名和标签。
 * viewScript 同时用于生成文件扩展名和内联标签。
 */
interface FileTypesInput { template?: string[]; style?: string[]; viewScript?: string[] }
function normalizeFileTypes(fileTypes: FileTypesInput = {}): { templateExts: string[]; templateDirectivePrefixes: string[]; styleExts: string[]; viewScriptExts: string[]; viewScriptTags: string[] } {
	const ft: FileTypesInput = fileTypes || {}
	const templateExts = mergeUnique(DEFAULT_TEMPLATE_EXTS, ft.template, normalizeExt, RESERVED_EXTS)
	return {
		templateExts,
		templateDirectivePrefixes: [...new Set([...DEFAULT_TEMPLATE_DIRECTIVE_PREFIXES, ...templateExts.map((extension) => {
			const name = extension.slice(1)
			return name.endsWith('ml') ? name.slice(0, -2) : name
		}).filter(Boolean)])],
		styleExts: mergeUnique(DEFAULT_STYLE_EXTS, ft.style, normalizeExt, RESERVED_EXTS),
		viewScriptExts: mergeUnique(DEFAULT_VIEW_SCRIPT_EXTS, ft.viewScript, normalizeExt, RESERVED_EXTS),
		viewScriptTags: mergeUnique(DEFAULT_VIEW_SCRIPT_TAGS, ft.viewScript, normalizeTag),
	}
}

interface StoreInfoOptions { fileTypes?: FileTypesInput; dependencyGraph?: unknown }
function storeInfo(workPath: string, options: StoreInfoOptions = {}): { pathInfo: Record<string, unknown>; configInfo: Record<string, unknown>; compilerOptions: ReturnType<typeof normalizeFileTypes>; dependencyGraph: unknown } {
	const context = getCompilerContext()
	// 依赖图需要知道当前构建的文件类型，因此在扫描项目前先重建选项。
	context.compilerOptions = normalizeFileTypes(options.fileTypes)
	storePathInfo(workPath)
	storeProjectConfig()
	storeAppConfig()
	storePageConfig()
	context.dependencyGraph = createInitialDependencyGraph()
	context.dependencyGraph.merge(options.dependencyGraph as never)

	return {
		pathInfo: context.pathInfo,
		configInfo: context.configInfo,
		compilerOptions: context.compilerOptions,
		dependencyGraph: context.dependencyGraph.toJSON(),
	}
}

function resetStoreInfo(opts: { pathInfo: Record<string, unknown>; configInfo: Record<string, unknown>; compilerOptions?: ReturnType<typeof normalizeFileTypes>; dependencyGraph?: unknown }): void {
	const context = getCompilerContext()
	context.pathInfo = opts.pathInfo
	context.configInfo = opts.configInfo
	// Worker 恢复上下文时使用主线程生成的自定义文件类型配置，缺省时回退到内置配置。
	context.compilerOptions = opts.compilerOptions || normalizeFileTypes()
	context.dependencyGraph = new DependencyGraph(opts.dependencyGraph as never)

	// 重新初始化 npm 解析器
	if (pathInfo.workPath) {
		context.npmResolver = new NpmResolver(pathInfo.workPath)
	}
}

function runWithCompilerContext<T>(callback: () => T): T {
	return compilerContextStorage.run(createCompilerContext(), callback)
}

function getTemplateExts() {
	return getCompilerContext().compilerOptions.templateExts
}

function getTemplateDirectivePrefixes() {
	const compilerOptions = getCompilerContext().compilerOptions
	return compilerOptions.templateDirectivePrefixes
		|| normalizeFileTypes({ template: compilerOptions.templateExts }).templateDirectivePrefixes
}

function getStyleExts() {
	return getCompilerContext().compilerOptions.styleExts
}

function getViewScriptExts() {
	return getCompilerContext().compilerOptions.viewScriptExts
}

function getViewScriptTags() {
	return getCompilerContext().compilerOptions.viewScriptTags
}

function getDependencyGraph() {
	return getCompilerContext().dependencyGraph
}

function storePathInfo(workPath: string): void {
	pathInfo.workPath = workPath
	
	// 优先使用环境变量中的 TARGET_PATH
	if (process.env.TARGET_PATH) {
		pathInfo.targetPath = process.env.TARGET_PATH
		pathInfo.temporaryTargetPath = false
	} else {
		// 使用工作区目录或系统临时目录，确保有写入权限
		const tempDir = process.env.GITHUB_WORKSPACE || os.tmpdir()
		// mkdtemp 的原子分配保证并行构建不会在同一毫秒复用并互相覆盖产物。
		const targetDir = fs.mkdtempSync(path.join(tempDir, 'dimina-fe-dist-'))

		pathInfo.targetPath = targetDir
		pathInfo.temporaryTargetPath = true
	}
	
	// 初始化 npm 解析器
	getCompilerContext().npmResolver = new NpmResolver(workPath)
}

function storeProjectConfig() {
	const privateConfigPath = `${pathInfo.workPath}/project.private.config.json`
	const defaultConfigPath = `${pathInfo.workPath}/project.config.json`

	let privateConfig = {}
	let defaultConfig = {}

	// Load default config if exists
	if (fs.existsSync(defaultConfigPath)) {
		try {
			defaultConfig = parseContentByPath(defaultConfigPath)
		}
		catch (e) {
			console.warn('Failed to parse project.config.json:', (e as Error).message)
		}
	}

	// Load private config if exists
	if (fs.existsSync(privateConfigPath)) {
		try {
			privateConfig = parseContentByPath(privateConfigPath)
		}
		catch (e) {
			console.warn('Failed to parse project.private.config.json:', (e as Error).message)
		}
	}

	// Merge configs with private config taking precedence
	configInfo.projectInfo = { ...defaultConfig, ...privateConfig }
}

function getProjectConfig(): Record<string, unknown> {
	return configInfo.projectInfo as Record<string, unknown>
}

function storeAppConfig() {
	const runtimeType = detectRuntimeType()
	const configFileName = runtimeType === MINI_GAME_RUNTIME_TYPE ? 'game.json' : 'app.json'
	const filePath = `${pathInfo.workPath}/${configFileName}`
	const content = parseContentByPath(filePath)
	if (runtimeType === MINI_GAME_RUNTIME_TYPE) {
		// 小游戏没有页面路由和 app.json。对下游维持统一的 app-config.json
		// 形状，同时保留 game.json 原始字段，入口由 runtimeType 明确区分。
		configInfo.runtimeType = MINI_GAME_RUNTIME_TYPE
		configInfo.appInfo = {
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
			// 兼容 subpackages / subPackages
			if (key === 'subpackages') {
				// 将值复制到新对象中，使用新的键名
				newObj.subPackages = content[key]
			}
			else {
				// 对于其他类型的值，直接复制到新对象中
				newObj[key] = content[key]
			}
		}
	}
	configInfo.runtimeType = MINI_PROGRAM_RUNTIME_TYPE
	newObj.runtimeType = MINI_PROGRAM_RUNTIME_TYPE
	configInfo.appInfo = newObj
}

function detectRuntimeType(): string {
	const compileType = (configInfo.projectInfo as { compileType?: string } | undefined)?.compileType
	const hasMiniProgramConfig = fs.existsSync(path.join(pathInfo.workPath as string, 'app.json'))
	const hasMiniGameConfig = fs.existsSync(path.join(pathInfo.workPath as string, 'game.json'))
	const hasMiniGameEntry = ['game.js', 'game.ts']
		.some(fileName => fs.existsSync(path.join(pathInfo.workPath as string, fileName)))

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

function getRuntimeType(): string {
	return (configInfo.runtimeType as string) || MINI_PROGRAM_RUNTIME_TYPE
}

function isMiniGame(): boolean {
	return getRuntimeType() === MINI_GAME_RUNTIME_TYPE
}

function getContentByPath(path: string): string {
	return fs.readFileSync(path, { encoding: 'utf-8' })
}

function parseContentByPath(path: string): Record<string, unknown> {
	return JSON.parse(getContentByPath(path)) as Record<string, unknown>
}

/**
 * 收集页面 json 信息
 */
function storePageConfig(): void {
	if (isMiniGame()) {
		configInfo.pageInfo = {}
		configInfo.componentInfo = {}
		return
	}
	const appInfo = configInfo.appInfo as { pages?: string[]; subPackages?: { root: string; pages: string[]; independent?: boolean }[]; usingComponents?: Record<string, string> }
	const { pages, subPackages } = appInfo
	configInfo.pageInfo = {}
	configInfo.componentInfo = {}

	// 首先处理 app.json 中的全局 usingComponents
	if (appInfo.usingComponents) {
		const appFilePath = `${pathInfo.workPath}/app.json`
		storeComponentConfig(configInfo.appInfo as Record<string, unknown>, appFilePath)
	}

	collectionPageJson(pages)

	// 处理分包信息
	// https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/basic.html
	if (subPackages) {
		subPackages?.forEach((subPkg: { root: string; pages: string[]; independent?: boolean }) => {
			collectionPageJson(subPkg.pages, subPkg.root)
		})
	}

	storeCustomTabBarConfig()
}

/**
 * 微信会把 custom-tab-bar/index 作为每个 tab 页的直属组件创建。业务页面
 * 不需要在 usingComponents 中显式声明它，因此编译阶段补一个内部组件引用，
 * 让逻辑、视图和样式三个编译器都能沿现有依赖图收集该组件。
 */
function storeCustomTabBarConfig(): void {
	const tabBar = (configInfo.appInfo as { tabBar?: { custom?: boolean; list?: { pagePath?: string }[] } } | undefined)?.tabBar
	if (tabBar?.custom !== true || !Array.isArray(tabBar.list)) {
		return
	}

	const componentJsonPath = path.join(pathInfo.workPath as string, 'custom-tab-bar/index.json')
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
	storeComponentConfig(internalConfig, path.join(pathInfo.workPath as string, 'app.json'))
	const componentConfig = (configInfo.componentInfo as Record<string, Record<string, unknown>>)[CUSTOM_TAB_BAR_COMPONENT_PATH]
	if (componentConfig) {
		componentConfig.customTabBar = true
	}

	for (const item of tabBar.list) {
		const pagePath = typeof item?.pagePath === 'string'
			? item.pagePath.replace(/^\/+/, '')
			: ''
		if (!pagePath || !(configInfo.appInfo as { pages?: string[] } | undefined)?.pages?.includes(pagePath)) {
			continue
		}
		const pageConfig: Record<string, unknown> = ((configInfo.pageInfo as Record<string, Record<string, unknown>>)[pagePath] ||= {})
		pageConfig.usingComponents = (pageConfig as { usingComponents?: Record<string, string> }).usingComponents ||= {}
		const declaredComponents = {
			...((configInfo.appInfo as { usingComponents?: Record<string, string> } | undefined)?.usingComponents || {}),
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
		Object.assign(pageConfig, { usingComponents: { ...(pageConfig.usingComponents as Record<string, string>), [componentName]: CUSTOM_TAB_BAR_COMPONENT_PATH }, customTabBar: { componentName } })
	}
}

function collectionPageJson(pages: string[] | undefined, root?: string): void {
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
		const pageFilePath = `${pathInfo.workPath}/${np}.json`
		if (fs.existsSync(pageFilePath)) {
			const pageJsonContent = parseContentByPath(pageFilePath)
			if (root) {
				(pageJsonContent as { root?: string }).root = transSubDir(root)
			}
			(configInfo.pageInfo as Record<string, unknown>)[np] = pageJsonContent

			// 递归解析自定义组件
			storeComponentConfig(pageJsonContent, pageFilePath)
		}
	})
}

function storeComponentConfig(pageJsonContent: Record<string, unknown>, pageFilePath: string): void {
	if (isObjectEmpty(pageJsonContent.usingComponents as Record<string, unknown>)) {
		return
	}
	// 解析当前页面的自定义组件信息
	for (const [componentName, componentPath] of Object.entries(pageJsonContent.usingComponents as Record<string, string>)) {
		const moduleId = getModuleId(componentPath, pageFilePath)
		;(pageJsonContent.usingComponents as Record<string, string>)[componentName] = moduleId

		if ((configInfo.componentInfo as Record<string, unknown>)[moduleId]) {
			continue
		}

		// 尝试查找组件配置文件
		let componentFilePath = path.resolve(getWorkPath(), `./${moduleId}.json`)
		let cContent = null
		
		if (fs.existsSync(componentFilePath)) {
			cContent = parseContentByPath(componentFilePath)
		} else {
			// 对于 npm 组件，尝试查找 index.json
			const indexJsonPath = path.resolve(getWorkPath(), `./${moduleId}/index.json`)
			if (fs.existsSync(indexJsonPath)) {
				componentFilePath = indexJsonPath
				cContent = parseContentByPath(componentFilePath)
			} else {
				// 如果是 npm 组件，创建一个默认的组件配置
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
		
		const cUsing: Record<string, string> = ((cContent as { usingComponents?: Record<string, string> }).usingComponents) || {}
		const isComponent = (cContent as { component?: boolean }).component || false
		const styleIsolation = resolveComponentStyleIsolation(cContent, componentFilePath)
		const cComponents: Record<string, string> = {}
		for (const key of Object.keys(cUsing)) {
			cComponents[key] = getModuleId(cUsing[key] as string, componentFilePath)
		}
		// (replaced reduce)
		// (old reduce removed)

		(configInfo.componentInfo as Record<string, unknown>)[moduleId] = {
			id: uuid(moduleId),
			path: moduleId,
			component: isComponent,
			styleIsolation,
			usingComponents: cComponents,
			componentPlaceholder: { ...((cContent as { componentPlaceholder?: Record<string, unknown> }).componentPlaceholder || {}) },
		}

		// 只有当配置文件存在时才递归处理
		if (cContent.usingComponents && Object.keys(cContent.usingComponents as Record<string, string>).length > 0) {
			storeComponentConfig((configInfo.componentInfo as Record<string, unknown>)[moduleId] as Record<string, unknown>, componentFilePath)
		}
	}
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

/**
 * styleIsolation can be declared either in component.json or in
 * Component({ options }). The style compiler must know it before service
 * runtime starts, so only statically-declared literal options participate.
 * addGlobalClass is the legacy equivalent of apply-shared.
 */
function resolveComponentStyleIsolation(componentConfig: Record<string, unknown>, componentJsonPath: string): string {
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
		const source = getContentByPath(scriptPath)
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
		console.warn(`[env] 无法解析组件样式隔离配置 ${scriptPath}: ${(error as Error).message}`)
	}

	return 'isolated'
}

function getModuleId(src: string, pageFilePath: string): string {
	const resolvedAlias = resolveAppAlias(src)
	if (resolvedAlias) {
		return resolvedAlias
	}

	const npmResolver = getCompilerContext().npmResolver
	if (!npmResolver) {
		// 如果 npm 解析器未初始化，使用原有逻辑
		const workPath = getWorkPath()
		return toMiniProgramModuleId(
			resolveMiniProgramPath(workPath, pageFilePath, src),
			workPath,
		)
	}

	// 使用 npm 解析器处理组件路径
	return npmResolver.resolveComponentPath(src, pageFilePath)
}

function resolveAppAlias(src: string): string | null {
	const resolveAlias = (configInfo.appInfo as { resolveAlias?: Record<string, string> } | undefined)?.resolveAlias
	if (!resolveAlias || typeof src !== 'string') {
		return null
	}

	for (const [alias, target] of Object.entries(resolveAlias as Record<string, string>)) {
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

function getTargetPath(): string {
	return pathInfo.targetPath as string
}

function getComponent(src: string): unknown {
	return (configInfo.componentInfo as Record<string, unknown>)[src]
}

function getPageConfigInfo(): Record<string, unknown> {
	return configInfo.pageInfo as Record<string, unknown>
}

function getAppConfigInfo(): Record<string, unknown> {
	return configInfo.appInfo as Record<string, unknown>
}

function getWorkPath(): string {
	return pathInfo.workPath as string
}

function getNpmResolver(): NpmResolver | null {
	return getCompilerContext().npmResolver
}

function getAppId(): string | undefined {
	return (configInfo.projectInfo as { appid?: string }).appid
}

function getAppName(): string | undefined {
	if ((configInfo.projectInfo as { projectname?: string }).projectname) {
		return decodeURIComponent((configInfo.projectInfo as { projectname?: string }).projectname!)
	}
	return getAppId()
}

function transSubDir(name: string): string {
	// 去除尾部的斜杠，并在前面添加 'sub_'
	return `sub_${name.replace(/\/$/, '')}`
}

/**
 * 获取页面及其配置信息，并生成id（输出的 json 文件没有 id)
 */
function getPages(): { mainPages: unknown[]; subPages: Record<string, unknown> } {
	if (isMiniGame()) {
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
	// 获取所有页面路径
	const appConfig = getAppConfigInfo() as { pages: string[]; subPackages?: { root: string; pages: string[]; independent?: boolean }[]; usingComponents?: Record<string, string> }
	const { pages, subPackages = [], usingComponents: globalComponents = {} } = appConfig
	const pageInfo = getPageConfigInfo() as Record<string, { usingComponents?: Record<string, string>; componentPlaceholder?: Record<string, unknown>; customTabBar?: unknown }>
	
	const mainPages = pages.map(path => {
		const pageComponents = pageInfo[path]?.usingComponents || {}
		// 合并全局组件和页面组件，页面组件优先级更高
		const mergedComponents = { ...globalComponents, ...pageComponents }
		
		return {
			id: uuid(path),
			path,
			appStyleScopeId: getAppStyleScopeId(),
			sharedStyleScopeIds: collectSharedStyleScopeIds(mergedComponents),
			usingComponents: mergedComponents,
			componentPlaceholder: { ...(pageInfo[path]?.componentPlaceholder || {}) },
			customTabBar: pageInfo[path]?.customTabBar,
		}
	})

	const subPages: Record<string, unknown> = {}
	subPackages?.forEach((subPkg: { root: string; pages: string[]; independent?: boolean }) => {
		const rootPath = subPkg.root.endsWith('/') ? subPkg.root : `${subPkg.root}/`
		const independent = subPkg.independent ? subPkg.independent : false
		subPages[transSubDir(rootPath)] = {
			independent,
			info: subPkg.pages.map(path => {
				const fullPath = rootPath + path
				const pageComponents = pageInfo[fullPath]?.usingComponents || {}
				// 合并全局组件和页面组件，页面组件优先级更高
				const mergedComponents = { ...globalComponents, ...pageComponents }
				
				return {
					id: uuid(fullPath),
					path: fullPath,
					appStyleScopeId: getAppStyleScopeId(),
					sharedStyleScopeIds: collectSharedStyleScopeIds(mergedComponents),
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

function addExistingModuleFiles(graph: DependencyGraph, moduleId: string): void {
	const relativeId = moduleId.replace(/^\/+/, '')
	const basePath = path.resolve(getWorkPath(), relativeId)
	const baseCandidates = [basePath, path.join(basePath, 'index')]
	const extensions = [
		'.json',
		'.js',
		'.ts',
		...getTemplateExts(),
		...getStyleExts(),
		...getViewScriptExts(),
	]
	for (const candidateBase of baseCandidates) {
		for (const extension of extensions) {
			const filePath = `${candidateBase}${extension}`
			if (fs.existsSync(filePath)) {
				graph.addFile(moduleId, filePath, getFileDependencyKind(filePath))
			}
		}
	}
}

function getFileDependencyKind(filePath: string): string {
	const extension = path.extname(filePath).toLowerCase()
	if (extension === '.json') return 'config'
	if (extension === '.js' || extension === '.ts') return 'logic'
	if (getTemplateExts().includes(extension) || getViewScriptExts().includes(extension)) return 'view'
	if (getStyleExts().includes(extension)) return 'style'
	return 'module'
}

function createInitialDependencyGraph(): DependencyGraph {
	const graph = new DependencyGraph()
	if (isMiniGame()) {
		graph.addNode(MINI_GAME_ENTRY_PATH, { type: MINI_GAME_RUNTIME_TYPE, entry: true })
		for (const fileName of [
			'game.json',
			'game.js',
			'game.ts',
			'project.config.json',
			'project.private.config.json',
		]) {
			const filePath = path.resolve(getWorkPath(), fileName)
			if (fs.existsSync(filePath)) {
				graph.addFile(MINI_GAME_ENTRY_PATH, filePath, getFileDependencyKind(filePath))
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
		const filePath = path.resolve(getWorkPath(), fileName)
		if (fs.existsSync(filePath)) {
			graph.addFile('app', filePath, getFileDependencyKind(filePath))
		}
	}
	addExistingModuleFiles(graph, 'app')
	for (const item of (getAppConfigInfo() as { tabBar?: { list?: Array<{ iconPath?: string; selectedIconPath?: string }> } }).tabBar?.list || []) {
		for (const field of ['iconPath', 'selectedIconPath']) {
			if (!item[field as 'iconPath' | 'selectedIconPath']) continue
			const assetPath = resolveAssetSourcePath(getWorkPath(), '', item[field as 'iconPath' | 'selectedIconPath']!)
			if (fs.existsSync(assetPath)) {
				graph.addFile('app', assetPath, 'config')
			}
		}
	}

	for (const component of Object.values((configInfo.componentInfo as Record<string, { path: string; usingComponents?: Record<string, string> }>) || {})) {
		graph.addNode(component.path, { type: 'component' })
		addExistingModuleFiles(graph, component.path)
	}
	for (const component of Object.values((configInfo.componentInfo as Record<string, { path: string; usingComponents?: Record<string, string> }>) || {})) {
		for (const dependencyPath of Object.values(component.usingComponents || {})) {
			graph.addDependency(component.path, dependencyPath, 'component')
		}
	}

	const pages = getPages()
	const addEntry = (page: { path: string; usingComponents?: Record<string, string> }, packageRoot: string | null) => {
		graph.addNode(page.path, {
			type: 'page',
			entry: true,
			packageRoot,
		})
		addExistingModuleFiles(graph, page.path)
		graph.addDependency(page.path, 'app', 'app')
		for (const dependencyPath of Object.values(page.usingComponents || {})) {
			graph.addDependency(page.path, dependencyPath, 'component')
		}
	}
	for (const page of pages.mainPages as { path: string; usingComponents?: Record<string, string> }[]) {
		addEntry(page, null)
	}
	for (const [packageRoot, subPackage] of Object.entries(pages.subPages as Record<string, { info: { path: string; usingComponents?: Record<string, string> }[] }>)) {
		for (const page of subPackage.info) {
			addEntry(page, packageRoot)
		}
	}
	return graph
}

function collectSharedStyleScopeIds(usingComponents: Record<string, string> | undefined): string[] {
	const result: string[] = []
	const visited = new Set()
	const visit = (componentPath: string) => {
		if (visited.has(componentPath)) {
			return
		}
		visited.add(componentPath)
		const component = (configInfo.componentInfo as Record<string, { id: string; styleIsolation?: string; usingComponents?: Record<string, string> }>)[componentPath]
		if (!component) {
			return
		}
		if (component.styleIsolation === 'shared') {
			result.push(component.id)
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

function getAppStyleScopeId(): string {
	return uuid('app')
}

function isTemporaryTargetPath(): boolean {
	return pathInfo.temporaryTargetPath === true
}

export {
	getAppConfigInfo,
	getDependencyGraph,
	getAppId,
	getAppName,
	getAppStyleScopeId,
	getComponent,
	getContentByPath,
	getNpmResolver,
	getPageConfigInfo,
	getPages,
	getProjectConfig,
	getRuntimeType,
	getStyleExts,
	getTargetPath,
	getTemplateDirectivePrefixes,
	getTemplateExts,
	getViewScriptExts,
	getViewScriptTags,
	getWorkPath,
	isMiniGame,
	isTemporaryTargetPath,
	resetStoreInfo,
	resolveAppAlias,
	runWithCompilerContext,
	storeInfo,
	storeProjectConfig,
}
