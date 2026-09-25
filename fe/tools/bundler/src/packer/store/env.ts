import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { AsyncContextStore } from '../worker/async-context-store.ts'
import { uuid } from '../../shared/utils.ts'
import { NpmResolver } from '../graph/npm-resolver.ts'
import { DependencyGraph } from '../graph/dependency-graph.ts'
import { PackerGraph } from '../graph/graph.ts'
import type { PackerContext, PageConfig, ComponentConfig } from '../types.ts'
import {
	type FixpointCtx,
	readProjectConfig,
	readAppConfig,
	readPageConfig,
	buildInitialGraph,
	getPagesImpl,
	resolveAppAlias as resolveAppAliasImpl,
} from '../graph/config-fixpoint.ts'

const packerALS = new AsyncContextStore<CompilerContext>({ name: 'packer' })
let defaultCompilerContext: CompilerContext | undefined

type CompilerContext = {
	pathInfo: PathInfo
	configInfo: ConfigInfo
	npmResolver: NpmResolver | null
	dependencyGraph: DependencyGraph
	compilerOptions: ReturnType<typeof normalizeFileTypes>
	graph?: PackerGraph
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
	return packerALS.tryGet() ?? defaultCompilerContext
}

// 将现有属性访问路由到当前异步构建上下文。直接调用 storeInfo() 的测试和
// 独立 Worker 没有 AsyncLocalStorage store 时，仍使用各自进程内的默认上下文。
interface PathInfo {
	workPath?: string
	targetPath?: string
	temporaryTargetPath?: boolean
	[key: string]: unknown
}

const pathInfo: PathInfo = new Proxy({}, {
	get: (_, key) => getCompilerContext().pathInfo[key as string],
	set: (_, key, value) => {
		getCompilerContext().pathInfo[key as string] = value
		return true
	},
})
// D-NS-1：PageConfig/ComponentConfig 已 relocate 到 types.ts（shape 层 canonical home）。
// 此处 re-export 已 import 的类型，向后兼容现有 `from '../store/env.ts'` 消费方。
export type { PageConfig, ComponentConfig }

interface ConfigInfo {
	projectInfo?: Record<string, unknown>
	appInfo?: Record<string, unknown>
	componentInfo?: Record<string, ComponentConfig>
	pageInfo?: Record<string, PageConfig>
	runtimeType?: string
	[key: string]: unknown
}

const configInfo: ConfigInfo = new Proxy({}, {
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
const MINI_PROGRAM_RUNTIME_TYPE = 'miniProgram'
const MINI_GAME_RUNTIME_TYPE = 'game'

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
export interface FileTypesInput { template?: string[]; style?: string[]; viewScript?: string[] }
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

interface StoreInfoOptions { fileTypes?: FileTypesInput; dependencyGraph?: ConstructorParameters<typeof DependencyGraph>[0]; graph?: PackerGraph }
function storeInfo(workPath: string, options: StoreInfoOptions = {}): { pathInfo: PathInfo; configInfo: ConfigInfo; compilerOptions: ReturnType<typeof normalizeFileTypes>; dependencyGraph: ReturnType<DependencyGraph['toJSON']> } {
	// B 切法（PC-B8a）：graph build 从 local context（非 ALS getCompilerContext 读）。
	// pathInfo/compilerOptions 本地计算；PackerContext 从 localCtx 建（不经 ALS Proxy 读）。
	const compilerOptions = normalizeFileTypes(options.fileTypes)
	const localPathInfo = computePathInfo(workPath)
	const localCtx: CompilerContext = {
		pathInfo: localPathInfo,
		compilerOptions,
		npmResolver: new NpmResolver(workPath),
		configInfo: {},
		dependencyGraph: new DependencyGraph(),
	}

	// Steps 3-6: 委托 PackerGraph 做 config fixpoint
	// D-GP-1: options.graph 传入时走 reconcile（保留旧图 source-level edges）；旧路径（dependencyGraph 快照）走 restore+reconcile；无则 build fresh
	const graph = options.graph ?? new PackerGraph()
	if (options.graph) {
		// State 路径：graph 是 state 持有的活图实例
		// 首次 build: reconcile on empty = build + merge empty = build（等价）
		// Watch rebuild: reconcile 保留旧图 source-level edges
		graph.reconcile(toPackerContext(localCtx))
	} else if (options.dependencyGraph) {
		// 旧路径（无 state）：从快照重建旧图 → reconcile
		graph.restoreFromSnapshot(localCtx.configInfo, options.dependencyGraph)
		graph.reconcile(toPackerContext(localCtx))
	} else {
		// 无 state 无快照：首次 build fresh
		graph.build(toPackerContext(localCtx))
	}

	// compat: 将结果写回 ALS context（residual 读者：custom-file-types.spec getter + publish/npm-builder fallback）。
	// PC-B8b 将移除此写（需测试改读 storeInfo 返回值）。
	const context = getCompilerContext()
	context.pathInfo = localPathInfo
	context.compilerOptions = compilerOptions
	context.npmResolver = localCtx.npmResolver
	context.graph = graph
	context.configInfo = graph.getConfigData() as ConfigInfo
	context.dependencyGraph = graph.getInnerGraph()

	return {
		pathInfo: localPathInfo,
		configInfo: graph.getConfigData() as ConfigInfo,
		compilerOptions,
		dependencyGraph: graph.toJSON() as ReturnType<DependencyGraph['toJSON']>,
	}
}

function resetStoreInfo(opts: { pathInfo: PathInfo; configInfo: ConfigInfo; compilerOptions?: ReturnType<typeof normalizeFileTypes>; dependencyGraph?: ConstructorParameters<typeof DependencyGraph>[0] }): void {
	const context = getCompilerContext()
	context.pathInfo = opts.pathInfo
	context.configInfo = opts.configInfo
	// Worker 恢复上下文时使用主线程生成的自定义文件类型配置，缺省时回退到内置配置。
	context.compilerOptions = opts.compilerOptions || normalizeFileTypes()

	// 从快照重建 PackerGraph
	const graph = new PackerGraph()
	graph.restoreFromSnapshot(opts.configInfo, opts.dependencyGraph)
	context.graph = graph
	context.dependencyGraph = graph.getInnerGraph()

	// 重新初始化 npm 解析器
	if (pathInfo.workPath) {
		context.npmResolver = new NpmResolver(pathInfo.workPath!)
	}
}

function runWithCompilerContext<T>(callback: () => T): T {
	return packerALS.run(createCompilerContext(), callback)
}

/**
 * CompilerContext → PackerContext 适配器（D-GB build-pipeline / watch-plan 共用）。
 * 字段映射: compilerOptions.templateDirectivePrefixes → fileTypes.directivePrefixes
 * D-PCS-1: resolveAlias / resolveNpm 为 deferred stub（讨论调度器时定）。
 */
function toPackerContext(ctx: CompilerContext): PackerContext {
	return {
		workPath: ctx.pathInfo.workPath!,
		targetPath: ctx.pathInfo.targetPath!,
		readContent: (p: string) => fs.readFileSync(p, { encoding: 'utf-8' }),
		// D-PCS-1: deferred stub — NpmResolver integration TBD
		resolveAlias: (_src: string) => null,
		resolveNpm: (src: string, _baseFile: string) => src,
		fileTypes: {
			templateExts: ctx.compilerOptions.templateExts,
			styleExts: ctx.compilerOptions.styleExts,
			viewScriptExts: ctx.compilerOptions.viewScriptExts,
			viewScriptTags: ctx.compilerOptions.viewScriptTags,
			directivePrefixes: ctx.compilerOptions.templateDirectivePrefixes,
		},
	}
}

/**
 * B 切法（PC-B10a）：从原始 workPath/targetPath/fileTypes 显式建 PackerContext。
 * orchestrate(ctx, state, options) 签名落地用——ctx 是显式入参（非 ALS 派生）。
 * fileTypes 是 RAW FileTypesInput（store.load 用）；ctx.fileTypes 是 normalized（PackerContext 形状）。
 */
function buildPackerContext(workPath: string, targetPath: string, fileTypes?: FileTypesInput): PackerContext {
	const compilerOptions = normalizeFileTypes(fileTypes)
	return {
		workPath,
		targetPath,
		readContent: (p: string) => fs.readFileSync(p, { encoding: 'utf-8' }),
		resolveAlias: (_src: string) => null,
		resolveNpm: (src: string, _baseFile: string) => src,
		fileTypes: {
			templateExts: compilerOptions.templateExts,
			styleExts: compilerOptions.styleExts,
			viewScriptExts: compilerOptions.viewScriptExts,
			viewScriptTags: compilerOptions.viewScriptTags,
			directivePrefixes: compilerOptions.templateDirectivePrefixes,
		},
	}
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
	return getCompilerContext().graph?.getInnerGraph() ?? getCompilerContext().dependencyGraph
}

/** B 切法（PC-B8a）：纯函数计算 pathInfo（不 mutate ALS Proxy）。storeInfo 用。 */
function computePathInfo(workPath: string): PathInfo {
	const pi: PathInfo = { workPath }
	// 优先使用环境变量中的 TARGET_PATH
	if (process.env.TARGET_PATH) {
		pi.targetPath = process.env.TARGET_PATH
		pi.temporaryTargetPath = false
	} else {
		// 使用工作区目录或系统临时目录，确保有写入权限
		const tempDir = process.env.GITHUB_WORKSPACE || os.tmpdir()
		// mkdtemp 的原子分配保证并行构建不会在同一毫秒复用并互相覆盖产物。
		pi.targetPath = fs.mkdtempSync(path.join(tempDir, 'dimina-fe-dist-'))
		pi.temporaryTargetPath = true
	}
	return pi
}

function storePathInfo(workPath: string): void {
	const pi = computePathInfo(workPath)
	pathInfo.workPath = pi.workPath
	pathInfo.targetPath = pi.targetPath
	pathInfo.temporaryTargetPath = pi.temporaryTargetPath
	// 初始化 npm 解析器
	getCompilerContext().npmResolver = new NpmResolver(workPath)
}

/**
 * D-PC-11: 薄壳委托 config-fixpoint.readProjectConfig。
 * configInfo (ALS Proxy) 作为 configData 传入，写入经 Proxy 回 ALS。
 */
function storeProjectConfig() {
	const ctx = toPackerContext(getCompilerContext())
	const npm = getCompilerContext().npmResolver ?? new NpmResolver(ctx.workPath)
	readProjectConfig({ ctx, configData: configInfo, npm } as FixpointCtx)
}

function getProjectConfig(): Record<string, unknown> {
	return configInfo.projectInfo!
}

/**
 * D-PC-11: 薄壳委托 config-fixpoint.readAppConfig。
 */
function storeAppConfig() {
	const ctx = toPackerContext(getCompilerContext())
	const npm = getCompilerContext().npmResolver ?? new NpmResolver(ctx.workPath)
	readAppConfig({ ctx, configData: configInfo, npm } as FixpointCtx)
}

function getRuntimeType(): string {
	return getCompilerContext().graph?.getRuntimeType() ?? (configInfo.runtimeType || MINI_PROGRAM_RUNTIME_TYPE)
}

function isMiniGame(): boolean {
	return getRuntimeType() === MINI_GAME_RUNTIME_TYPE
}

function getContentByPath(path: string): string {
	return fs.readFileSync(path, { encoding: 'utf-8' })
}

/**
 * D-PC-11: 薄壳委托 config-fixpoint.readPageConfig。
 */
function storePageConfig(): void {
	const ctx = toPackerContext(getCompilerContext())
	const npm = getCompilerContext().npmResolver ?? new NpmResolver(ctx.workPath)
	readPageConfig({ ctx, configData: configInfo, npm } as FixpointCtx)
}

/**
 * R3-1: 薄壳委托 config-fixpoint.resolveAppAlias（读 ALS configInfo.appInfo）。
 * 外部调用者 parse-walk.ts 继续使用此版本。
 */
function resolveAppAlias(src: string): string | null {
	return resolveAppAliasImpl(src, configInfo.appInfo)
}

function getTargetPath(): string {
	return pathInfo.targetPath!
}

function getComponent(src: string): unknown {
	const graph = getCompilerContext().graph
	if (graph) return graph.getComponent(src)
	return (configInfo.componentInfo!)[src]
}

function getPageConfigInfo(): Record<string, PageConfig> {
	return configInfo.pageInfo!
}

function getAppConfigInfo(): Record<string, unknown> {
	const graph = getCompilerContext().graph
	if (graph) return graph.getAppConfigInfo()
	return configInfo.appInfo!
}

function getWorkPath(): string {
	return pathInfo.workPath!
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

/**
 * 薄壳委托 config-fixpoint.getPagesImpl（读 ALS configInfo，storeInfo 后已同步 Graph）。
 */
function getPages(): { mainPages: Array<{ id: string; path: string; usingComponents?: Record<string, string>; [key: string]: unknown }>; subPages: Record<string, { info: Array<{ path: string; usingComponents?: Record<string, string>; [key: string]: unknown }> }> } {
	const ctx = toPackerContext(getCompilerContext())
	const npm = getCompilerContext().npmResolver ?? new NpmResolver(ctx.workPath)
	return getPagesImpl({ ctx, configData: configInfo, npm } as FixpointCtx)
}

/**
 * D-PC-11: 薄壳委托 config-fixpoint.buildInitialGraph。
 */
function createInitialDependencyGraph(): DependencyGraph {
	const ctx = toPackerContext(getCompilerContext())
	const npm = getCompilerContext().npmResolver ?? new NpmResolver(ctx.workPath)
	return buildInitialGraph({ ctx, configData: configInfo, npm } as FixpointCtx)
}

function getAppStyleScopeId(): string {
	return uuid('app')
}

function isTemporaryTargetPath(): boolean {
	return pathInfo.temporaryTargetPath === true
}

export {
	getCompilerContext,
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
	storeAppConfig,
	storePageConfig,
	storePathInfo,
	storeProjectConfig,
	storeInfo,
	buildPackerContext,
	createInitialDependencyGraph,
	toPackerContext,
}
