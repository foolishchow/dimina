/**
 * env — L2 ALS 门面 + L3 worker 桥接 + storeInfo wrapper（fe-tools-env-l1-extract 终态）。
 *
 * L1 计算层已迁 env-compute.ts（纯模块——fileTypes 规范化 / pathInfo 计算 /
 * PackerContext 构造 / computeStoreInfo / worker reset 数据组装）。此处保留：
 * - L2 ALS 门面：defaultCompilerContext singleton + pathInfo/configInfo Proxy + getters
 *   （compiler/* parse-walk 仍读 ALS getters——阶段 3 迁 PackerContext 参数）
 * - L3 worker 桥接：resetStoreInfo（写 defaultCompilerContext——worker 上下文恢复）
 * - storeInfo wrapper：调 env-compute.computeStoreInfo + compat 写保留（backflow——
 *   测试 fixture 依赖 ALS getter；P-NS6 audit load-bearing，推迟为后续 initiative）
 * - re-export L1（方案 A 最小改动——消费方 import from env.ts 不变）
 */
import { NpmResolver } from '../graph/npm-resolver.ts'
import { DependencyGraph } from '../graph/dependency-graph.ts'
import { PackerGraph } from '../graph/graph.ts'
import { getPagesImpl, type FixpointCtx } from '../graph/config-fixpoint.ts'
import type { PageConfig } from '../types.ts'
import {
	type CompilerContext,
	type PathInfo,
	type ConfigInfo,
	type FileTypesInput,
	type StoreInfoOptions,
	type ResetStoreInfoOptions,
	normalizeFileTypes,
	computeStoreInfo,
	computePathInfo,
	toPackerContext,
	MINI_PROGRAM_RUNTIME_TYPE,
	MINI_GAME_RUNTIME_TYPE,
	resolveAppAlias as resolveAppAliasCompute,
} from './env-compute.ts'

export {
	buildPackerContext,
	storeInfoCtx,
	buildResetStoreInfoData,
	getAppStyleScopeId,
	getContentByPath,
} from './env-compute.ts'
export type { PathInfo, ConfigInfo, FileTypesInput }

let defaultCompilerContext: CompilerContext | undefined

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
	return defaultCompilerContext
}

// 将现有属性访问路由到当前异步构建上下文。直接调用 storeInfo() 的测试和
// 独立 Worker 没有 AsyncLocalStorage store 时，仍使用各自进程内的默认上下文。
const pathInfo: PathInfo = new Proxy({}, {
	get: (_, key) => getCompilerContext().pathInfo[key as string],
	set: (_, key, value) => {
		getCompilerContext().pathInfo[key as string] = value
		return true
	},
})

const configInfo: ConfigInfo = new Proxy({}, {
	get: (_, key) => getCompilerContext().configInfo[key as string],
	set: (_, key, value) => {
		getCompilerContext().configInfo[key as string] = value
		return true
	},
})

function storeInfo(workPath: string, options: StoreInfoOptions = {}): { pathInfo: PathInfo; configInfo: ConfigInfo; compilerOptions: ReturnType<typeof normalizeFileTypes>; dependencyGraph: ReturnType<DependencyGraph['toJSON']> } {
	// D-SI-4（fe-tools-scratch-internalize）：传 computePathInfo(workPath) 作 pathInfo 参数
	// （含 mkdtemp targetPath——compat backflow，测试 fixture 依赖 pathInfo.targetPath）。
	// computeStoreInfo 内部不再 mkdtemp（内化入 BaseOutput 构造）；wrapper 传 pathInfo 补 targetPath。
	const r = computeStoreInfo(workPath, options, computePathInfo(workPath))

	// compat: 将结果写回 defaultCompilerContext（主线程 pathInfo/configInfo Proxy +
	// getter 读者：dist-preparer createDist(targetPath)、npm-builder fallback、view/style/logic
	// parse-walk 经 worker resetStoreInfo）。P-NS6 audit：此写 load-bearing——主线程
	// getter 消费方未全迁 storeInfo() 返回值前不可删。
	const context = getCompilerContext()
	context.pathInfo = r.pathInfo
	context.compilerOptions = r.compilerOptions
	context.npmResolver = r.npmResolver
	context.graph = r.graph
	context.configInfo = r.configInfo
	context.dependencyGraph = r.graph.getInnerGraph()

	return {
		pathInfo: r.pathInfo,
		configInfo: r.configInfo,
		compilerOptions: r.compilerOptions,
		dependencyGraph: r.graph.toJSON() as ReturnType<DependencyGraph['toJSON']>,
	}
}

function resetStoreInfo(opts: ResetStoreInfoOptions): void {
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

/**
 * R3-1: 薄壳委托 config-fixpoint.resolveAppAlias（读 ALS configInfo.appInfo）。
 * D-EL1-4 选项 A 锁定：单参签名 + import 均不变（parse-walk 调用方不动），
 * 内部调 env-compute 双参纯函数。
 */
function resolveAppAlias(src: string): string | null {
	return resolveAppAliasCompute(src, configInfo.appInfo)
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

function getDependencyGraph(): DependencyGraph {
	return getCompilerContext().graph?.getInnerGraph() ?? getCompilerContext().dependencyGraph
}

function getProjectConfig(): Record<string, unknown> {
	return configInfo.projectInfo!
}

function getRuntimeType(): string {
	return getCompilerContext().graph?.getRuntimeType() ?? (configInfo.runtimeType || MINI_PROGRAM_RUNTIME_TYPE)
}

function isMiniGame(): boolean {
	return getRuntimeType() === MINI_GAME_RUNTIME_TYPE
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
 * 保留 env.ts（F-R1-1/F-R3-1：测试 21 文件 47 调用点 fixture 依赖——不迁 env-compute）。
 */
function getPages(): { mainPages: Array<{ id: string; path: string; usingComponents?: Record<string, string>; [key: string]: unknown }>; subPages: Record<string, { info: Array<{ path: string; usingComponents?: Record<string, string>; [key: string]: unknown }> }> } {
	const ctx = toPackerContext(getCompilerContext())
	const npm = getCompilerContext().npmResolver ?? new NpmResolver(ctx.workPath)
	return getPagesImpl({ ctx, configData: configInfo, npm } as FixpointCtx)
}

export {
	getAppConfigInfo,
	getDependencyGraph,
	getAppId,
	getAppName,
	getComponent,
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
	resetStoreInfo,
	resolveAppAlias,
	storeInfo,
}
