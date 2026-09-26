/**
 * env-compute — L1 计算层纯模块（fe-tools-env-l1-extract D-EL1-1）。
 *
 * 从 env.ts 迁出的纯计算函数（无 ALS 依赖）：fileTypes 规范化、pathInfo 计算、
 * PackerContext 构造、storeInfo 纯计算（computeStoreInfo）、worker reset 数据组装。
 * env.ts 退化为 L2 ALS 门面 + L3 worker 桥接 + storeInfo wrapper（compat 写保留 backflow）。
 *
 * 不依赖 env.ts（无循环）。依赖：graph + config-fixpoint(resolveAppAliasImpl) +
 * types + state + shared(uuid)。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { uuid } from '../../shared/utils.ts'
import { NpmResolver } from '../graph/npm-resolver.ts'
import { DependencyGraph } from '../graph/dependency-graph.ts'
import { PackerGraph } from '../graph/graph.ts'
import { resolveAppAlias as resolveAppAliasImpl, buildPackerContextFromOptions } from '../graph/config-fixpoint.ts'
import type { PackerContext, PageConfig, ComponentConfig } from '../types.ts'
import type { PackerSessionState } from '../state/session-state.ts'

// ── 常量（L1——env.ts L2 getters 经 import 消费 MINI_*_RUNTIME_TYPE）──

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

// ── type（L1 形状层——PathInfo/ConfigInfo 迁此 export，env.ts re-export）──

export interface PathInfo {
	workPath?: string
	targetPath?: string
	temporaryTargetPath?: boolean
	[key: string]: unknown
}

export interface ConfigInfo {
	projectInfo?: Record<string, unknown>
	appInfo?: Record<string, unknown>
	componentInfo?: Record<string, ComponentConfig>
	pageInfo?: Record<string, PageConfig>
	runtimeType?: string
	[key: string]: unknown
}

export interface FileTypesInput { template?: string[]; style?: string[]; viewScript?: string[] }

export interface StoreInfoOptions { fileTypes?: FileTypesInput; dependencyGraph?: ConstructorParameters<typeof DependencyGraph>[0]; graph?: PackerGraph }

export interface ResetStoreInfoOptions {
	pathInfo: PathInfo
	configInfo: ConfigInfo
	compilerOptions?: ReturnType<typeof normalizeFileTypes>
	dependencyGraph?: ConstructorParameters<typeof DependencyGraph>[0]
}

/**
 * CompilerContext——env.ts L2 singleton 的 context 形状（F-EL1 实施注记：
 * design D-EL1-2 原「internal」修正为 export——env.ts getPages 薄壳调
 * toPackerContext(getCompilerContext()) 须引用此类型 + 函数）。
 */
export type CompilerContext = {
	pathInfo: PathInfo
	configInfo: ConfigInfo
	npmResolver: NpmResolver | null
	dependencyGraph: DependencyGraph
	compilerOptions: ReturnType<typeof normalizeFileTypes>
	graph?: PackerGraph
}

// ── fileTypes 规范化（L1 纯函数）──

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
export function normalizeFileTypes(fileTypes: FileTypesInput = {}): { templateExts: string[]; templateDirectivePrefixes: string[]; styleExts: string[]; viewScriptExts: string[]; viewScriptTags: string[] } {
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

// ── path 计算 + PackerContext 构造（L1 纯函数）──

/** B 切法（PC-B8a）：纯函数计算 pathInfo（不 mutate ALS Proxy）。storeInfo 用。 */
export function computePathInfo(workPath: string): PathInfo {
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

/**
 * CompilerContext → PackerContext 适配器（D-GB build-pipeline / watch-plan 共用）。
 * D-PCD-3（fe-tools-packer-context-dedup）：调 buildPackerContextFromOptions 内核（逐字搬迁去重）。
 * 从 CompilerContext 取 workPath/targetPath/compilerOptions 调内核（散参）。
 * `!` 窄断言保留（pathInfo optional——现状同）。CompilerContext 依赖保留（不破）。
 */
export function toPackerContext(ctx: CompilerContext): PackerContext {
	return buildPackerContextFromOptions(ctx.pathInfo.workPath!, ctx.pathInfo.targetPath!, ctx.compilerOptions)
}

/**
 * B 切法（PC-B10a）：从原始 workPath/targetPath/fileTypes 显式建 PackerContext。
 * orchestrate(ctx, state, options) 签名落地用——ctx 是显式入参（非 ALS 派生）。
 * fileTypes 是 RAW FileTypesInput（store.load 用）；ctx.fileTypes 是 normalized（PackerContext 形状）。
 * D-PCD-2（fe-tools-packer-context-dedup）：调 buildPackerContextFromOptions 内核（normalize 先 + 内核）。
 * public 签名不变（收 RAW FileTypesInput）。
 */
export function buildPackerContext(workPath: string, targetPath: string, fileTypes?: FileTypesInput): PackerContext {
	return buildPackerContextFromOptions(workPath, targetPath, normalizeFileTypes(fileTypes))
}

// ── computeStoreInfo（storeInfo 纯计算拆分——D-EL1-2）──

/**
 * storeInfo 的纯计算部分（fe-tools-env-l1-extract D-EL1-2 拆分）。
 *
 * D-SI-3（fe-tools-scratch-internalize）：收 pathInfo? 参数（caller 传）——
 * storeInfoCtx 传 {workPath}（无 targetPath——orchestrate 链路用 output.scratch 投影）；
 * storeInfo wrapper 传 computePathInfo(workPath)（含 mkdtemp targetPath——compat backflow）。
 * mkdtemp 不再在 computeStoreInfo 内跑（内化入 BaseOutput 构造）。
 *
 * 无 compat 写（compat 写留 env.ts storeInfo wrapper——backflow，测试 fixture 依赖）。
 *
 * 返回 npmResolver（F-R6-1）：wrapper compat 写 `context.npmResolver = r.npmResolver`
 * 喂主线程 parse-walk 测试路径（parse-walk.ts getNpmResolver ← 9 测试文件
 * storeInfo 后主线程直调 logicParseWalk 依赖）。
 *
 * 迁移细则（F-R4-1——行为 0 纪律）：逐字搬迁 storeInfo 的 graph 分支逻辑——
 * `if (options.graph)` 分支内顺序执行 reconcile → restoreFromSnapshot → reconcile
 * （两段都跑——storeinfo-collapse 后 7-diff=0 已验证此行为正确，不「修正」为二选一）；
 * SC_TRACE console.error x2 逐字搬迁（debug-only env-gate 不影响产物）。
 */
export function computeStoreInfo(workPath: string, options: StoreInfoOptions = {}, pathInfo?: PathInfo): { pathInfo: PathInfo; compilerOptions: ReturnType<typeof normalizeFileTypes>; graph: PackerGraph; configInfo: ConfigInfo; npmResolver: NpmResolver } {
	// B 切法（PC-B8a）：graph build 从 local context（非 ALS getCompilerContext 读）。
	// D-SI-3: pathInfo 由 caller 传——storeInfoCtx 传 {workPath}（orchestrate 链路用 output.scratch）；
	// storeInfo wrapper 传 computePathInfo(workPath)（含 mkdtemp targetPath——compat backflow）。
	const compilerOptions = normalizeFileTypes(options.fileTypes)
	const localPathInfo = pathInfo ?? { workPath }
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
		if (process.env.SC_TRACE) console.error('[storeInfo reconcile] configData=', Object.keys(graph.getConfigData()))
		// 旧路径（无 state）：从快照重建旧图 → reconcile
		graph.restoreFromSnapshot(localCtx.configInfo, options.dependencyGraph)
		graph.reconcile(toPackerContext(localCtx))
	} else {
		// 无 state 无快照：首次 build fresh
		graph.build(toPackerContext(localCtx))
	}
	if (process.env.SC_TRACE) console.error('[storeInfo] path=', graph === options.graph ? 'reconcile' : 'build', 'configData=', Object.keys(graph.getConfigData()).length, 'nodes=', graph.getInnerGraph()?.toJSON?.()?.nodes?.length)

	return {
		pathInfo: localPathInfo,
		configInfo: graph.getConfigData() as ConfigInfo,
		compilerOptions,
		graph,
		// localCtx.npmResolver 由上方 new NpmResolver(workPath) 赋值——窄断言（非 as any）
		npmResolver: localCtx.npmResolver!,
	}
}

// ── storeInfoCtx（orchestrate 链路纯函数——D-EL1-3）──

/**
 * D-SC3 storeInfoCtx: orchestrate 链路用（config-collector 经 store.load）。
 * 调 computeStoreInfo（无 compat 写——主线程 orchestrate 0 ALS 活读实证 D-EL1-3；
 * compat 写保留在 env.ts storeInfo wrapper，测试 fixture 走 wrapper）。
 * sctx.storeInfo 殁骸已清（storeinfo-collapse R-SC4 完成）。
 *
 * D-SI-3（fe-tools-scratch-internalize）：不设 state.scratch——mkdtemp 内化入 BaseOutput
 * 构造，orchestrator 预设 state.scratch = output.scratch（投影，consumer 不改读源）。
 * computeStoreInfo 传 {workPath}（pathInfo 默认——orchestrate 链路不 mkdtemp）。
 */
export function storeInfoCtx(ctx: PackerContext, graph: PackerGraph, _state: PackerSessionState): void {
	// D-SI-3: state 参数保留（store.load 契约）但不再使用——mkdtemp 内化入 BaseOutput，
	// orchestrator 预设 state.scratch = output.scratch（投影）。storeInfoCtx 不设 state.scratch。
	computeStoreInfo(ctx.workPath, { graph })
}

// ── buildResetStoreInfoData（worker reset 数据组装——D-SC5 §5.3）──

export function buildResetStoreInfoData(ctx: PackerContext, state: PackerSessionState): ResetStoreInfoOptions {
	return {
		pathInfo: { workPath: ctx.workPath, targetPath: state.scratch },
		configInfo: state.graph.getConfigData() as ConfigInfo,
		compilerOptions: {
			templateExts: ctx.fileTypes.templateExts,
			templateDirectivePrefixes: ctx.fileTypes.directivePrefixes,
			styleExts: ctx.fileTypes.styleExts,
			viewScriptExts: ctx.fileTypes.viewScriptExts,
			viewScriptTags: ctx.fileTypes.viewScriptTags,
		},
		dependencyGraph: state.graph.getInnerGraph(),
	}
}

// ── resolveAppAlias（双参纯函数——D-EL1-4 选项 A）──

/**
 * R3-1: 薄壳委托 config-fixpoint.resolveAppAlias 的纯函数版（收 appInfo 参数）。
 * env.ts 保留单参 wrapper（读 ALS configInfo.appInfo + 调此函数）——
 * parse-walk import/调用均不变（D-EL1-4 选项 A 锁定）。
 */
export function resolveAppAlias(src: string, appInfo: Record<string, unknown> | undefined): string | null {
	return resolveAppAliasImpl(src, appInfo)
}

// ── 纯工具 ──

export function getAppStyleScopeId(): string {
	return uuid('app')
}

export function getContentByPath(path: string): string {
	return fs.readFileSync(path, { encoding: 'utf-8' })
}

export { MINI_PROGRAM_RUNTIME_TYPE, MINI_GAME_RUNTIME_TYPE }
