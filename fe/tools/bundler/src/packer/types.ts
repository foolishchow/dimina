/**
 * Packer core shape — 6 组件形状定义（D-PCS-1..10）
 *
 * 本文件是"北星契约"——定义目标形状，不实施物理抽取。
 * 现有代码不 wire 这些类型；实施 Action 逐步迁移。
 *
 * 管线：graph.build(ctx) → load → compile → emit
 *
 * 决策：
 *   D-PCS-1  storeInfo 只剩 paths+fileTypes = PackerContext（I/O 环境）
 *   D-PCS-2  graph 推导逻辑自包含（config fixpoint + source fixpoint）
 *   D-PCS-3  graph 由 Orchestrator 触发，长期持有（per session/watch）
 *   D-PCS-4  Graph 自己 bootstrap 自己（build(ctx) 直接读 app.json）
 *   D-PCS-5  三个 registry 取代 Packer 单体接口
 *   D-PCS-6  PackerContext(I/O+fileTypes) + OrchestratorState(graph+cache) 拆区
 *   D-PCS-7  Emitter 封装 emit 策略（strategy + produceBuckets）
 *   D-PCS-8  通用 worker（运行时收 kind 从内置 map 选实现）
 *   D-PCS-9  OrchestratorState session-scoped，ALS pipeline-scoped
 *   D-PCS-10 CompiledModule discriminated union
 *
 * 前身：fe-tools-packer-lifecycle-audit（F-1..F-6 关键发现）
 */

// ── 现有类型引用（import type，tsc 擦除，不产生运行时依赖）──
// R-PCS-11: 新类型用 import type 引用现有类型，不复制
import type { EmitEntry, EmitTransformConfig } from './emit/emit.ts'
import type { GraphSnapshot } from './graph/dependency-graph.ts'
import type { GraphConfigData } from './graph/graph.ts'
import type { CachedModuleResult } from './cache/module-result-cache.ts'
import type { BuildModel } from './emit/build-model.ts'
import type { Lifecycle } from '../shared/lifecycle.ts'

// ════════════════════════════════════════════════════════════════════
// §1 基础类型
// ════════════════════════════════════════════════════════════════════

/** 模块种类（D-PCS-10 判别字段） */
export type ModuleKind = 'logic' | 'view' | 'style' | 'config'

/** 文件类型分类（env.ts 层 4，PackerContext.fileTypes 字段） */
export interface PackerFileTypes {
	templateExts: string[]
	styleExts: string[]
	viewScriptExts: string[]
	viewScriptTags: string[]
	directivePrefixes: string[]
}

/** load 环节提取的元数据（D-PCS-10: 不含索引签名） */
export interface PackerModuleMetadata {
	sourcePath: string
}

/** view 车道的 wxs 绑定信息 */
export interface WxsBinding {
	localIdentifier: string
	templatePropertyName: string
}

// ── config shapes（D-NS-1：PageConfig/ComponentConfig relocate env.ts → types.ts，shape 层 canonical home）──

/** 页面配置（app.json pages 条目 / 页面 .json）。 */
export interface PageConfig {
	usingComponents?: Record<string, string>
	componentPlaceholder?: Record<string, unknown>
	customTabBar?: unknown
	[key: string]: unknown
}

/** 组件配置（component .json）。 */
export interface ComponentConfig {
	path?: string
	id?: string
	styleIsolation?: string
	usingComponents?: Record<string, string>
	[key: string]: unknown
}

// ════════════════════════════════════════════════════════════════════
// §2 PackerContext（D-PCS-1, D-PCS-6）
// ════════════════════════════════════════════════════════════════════

/**
 * I/O 环境（D-PCS-1: storeInfo 只剩 paths+fileTypes）。
 *
 * D-PCS-6: 不含 graph/cache/invalidated——那些在 OrchestratorState（§7）。
 * D-PCS-9: pipeline-scoped（ALS），OrchestratorState 是 session-scoped。
 * F-1:     现实是 ALS-backed（非 plain object）；形状是 interface 契约。
 */
export interface PackerContext {
	/** 通用 I/O */
	workPath: string
	targetPath: string
	readContent: (path: string) => string

	/** 模块解析（D-PCS-1: deferred——讨论调度器时定是否保留） */
	resolveAlias: (src: string) => string | null
	resolveNpm: (src: string, baseFile: string) => string

	/** 文件类型 */
	fileTypes: PackerFileTypes

	// 注意：graph / moduleCache / invalidatedModules 不在 PackerContext
	// D-PCS-6: 这些在 OrchestratorState（§7）
	// D-PCS-4: Graph 自己从 ctx.workPath 读 app.json bootstrap
}

// ════════════════════════════════════════════════════════════════════
// §2b StageChannelContext（R-HR-4, fe-tools-hmr-chain-residuals）
// ════════════════════════════════════════════════════════════════════

/**
 * stage-channel 边界 typed context（R-HR-4）。
 *
 * 替代 stage-channel.ts / orchestrator.ts 中 `ctx as { field }` 字段断言——
 * 单一 typed 边界声明在档。storeInfo 保持 opaque（unknown，不引 env.ts 层类型，
 * 维 types.ts 纯形状纪律）；消费点窄化（ctx.storeInfo as {x}）属局部窄化。
 *
 * 字段跨 load/compile/emit 三 stage 增量写入，故全 optional。
 */
export interface StageChannelContext {
	// load stage（orchestrator）
	buildModel?: unknown
	storeInfo?: unknown
	dependencyGraph?: unknown
	loadedModules?: Map<string, unknown>
	cache?: unknown
	viewCache?: Map<string, unknown> | undefined
	styleCache?: Map<string, unknown> | undefined
	// compile stage
	viewOrderList?: Map<string, unknown> | undefined
	invalidatedModules?: string[] | undefined
	compatibilityWarnings?: Set<string> | undefined
	allPages?: unknown
	pages?: unknown
	compileConfig?: unknown
	sourcemap?: boolean
	sourcemapTargetPath?: unknown
	/** R7-3: loadBindings 跨 task mutable 闭包 → sctx 字段（StageDispatcher 写, result 读 appId） */
	loadBindings?: unknown
}

// ════════════════════════════════════════════════════════════════════
// §3 LoadedModule + CompiledModule（D-PCS-10）
// ════════════════════════════════════════════════════════════════════

/**
 * load 环节产出（parse + walk = 发现）。
 *
 * 瞬态：传给 compile 后丢弃。不缓存（graph 是 dependencies 的天然缓存）。
 */
export interface LoadedModule {
	moduleId: string
	kind: ModuleKind
	source: string
	dependencies: string[]
	metadata: PackerModuleMetadata
}

/** compile 环节产出的公共基础。 */
export interface CompiledModuleBase {
	moduleId: string
	kind: ModuleKind
	code: string
	map: string | null
	dependencies: string[]
}

/** logic 编译产物。 */
export interface LogicCompiledModule extends CompiledModuleBase {
	kind: 'logic'
	extraInfoCode?: string
}

/** view 编译产物。 */
export interface ViewCompiledModule extends CompiledModuleBase {
	kind: 'view'
	renderBody?: { start: number; end: number }
	wxsBindings?: WxsBinding[]
}

/** style 编译产物。 */
export interface StyleCompiledModule extends CompiledModuleBase {
	kind: 'style'
	styleScopeId?: string
}

/**
 * compile 环节产出（D-PCS-10: discriminated union）。
 *
 * `kind` 是判别字段，TS narrowing 自动生效。registry 边界不丢类型。
 * 替代方案（胖接口 + 索引签名）否决——索引签名是 `any` 的伪装。
 *
 * TODO: 后续考虑泛型方案（`CompiledModule<M extends PackerModuleMetadata>`）——
 * 泛型可以让 metadata 类型安全穿透 registry 边界，但泛型参数穿透所有 API，复杂度高。
 * 当前 discriminated union 简单且足够。
 */
export type CompiledModule = LogicCompiledModule | ViewCompiledModule | StyleCompiledModule

// ════════════════════════════════════════════════════════════════════
// §4 LoadInput + EmitOptions + EmitBucket（D-PCS-7）
// ════════════════════════════════════════════════════════════════════

/**
 * load 环节的最小输入。
 *
 * Scheme 层预计算的 Dimina 专有数据通过 optional 字段传入（不进 PackerContext）。
 */
export interface LoadInput {
	moduleId: string
	kind: ModuleKind
	source: string
	/** view 专有（Scheme 层预计算） */
	usingComponents?: Record<string, string>
	/** style 专有（Scheme 层预计算） */
	styleScopeId?: string
}

/** emit 环节的配置选项。transform 引用现有 EmitTransformConfig。 */
export interface EmitOptions {
	transform: EmitTransformConfig & { strategy: string }
	sourcemap: boolean
	sourcemapTargetPath: string | null
	filename: string
	relPrefix: string
}

/** emit 策略（D-PCS-7: Emitter 的属性，不是 Orchestrator 的决策）。 */
export type EmitStrategy = 'inline' | 'delayed'

/** delayed emit 的分桶（D-PCS-7: delayed Emitter 专有）。 */
export interface EmitBucket {
	kind: ModuleKind
	entryId: string
	modules: CompiledModule[]
	emitOptions: EmitOptions
}

// ════════════════════════════════════════════════════════════════════
// §5 3 个 per-kind 契约 + 3 个 registry（D-PCS-5, D-PCS-7）
// ════════════════════════════════════════════════════════════════════

/** load = parse + walk = 发现依赖。F-5: 现实写本地 graph；target: 返回 deps delta。 */
export interface Loader {
	load(input: LoadInput, ctx: PackerContext): Promise<LoadedModule>
}

/** compile = transform = 变换源码 → 产物。依赖已确定，不参与发现。 */
export interface Compiler {
	compile(module: LoadedModule, ctx: PackerContext): Promise<CompiledModule>
}

/**
 * emit = bundle = 装配。
 *
 * D-PCS-7: Emitter 封装自己的 emit 策略，Orchestrator 只查 strategy 决定调用路径。
 * F-4: emit 时机因车道而异——logic delayed（按桶）；view/style inline。
 */
export interface Emitter {
	readonly strategy: EmitStrategy
	emit(
		entryId: string,
		modules: CompiledModule[],
		ctx: PackerContext,
		options: EmitOptions,
	): Promise<EmitEntry>
	/** delayed 专有：产分桶。inline 的 Emitter 不实现。 */
	produceBuckets?(compiled: CompiledModule[], entries: string[]): EmitBucket[]
}

/**
 * kind → Loader 的映射（D-PCS-5: Orchestrator 的派发配置）。
 *
 * registry 的作用是 Orchestrator 的派发配置（有哪些 kind、怎么派发），
 * 不是 worker 运行时查实现的机制（D-PCS-8: worker 内置 map）。
 */
export interface LoaderRegistry {
	get(kind: ModuleKind): Loader
	register(kind: ModuleKind, loader: Loader): void
	kinds(): ModuleKind[]
}

/** kind → Compiler 的映射。 */
export interface CompileRegistry {
	get(kind: ModuleKind): Compiler
	register(kind: ModuleKind, compiler: Compiler): void
}

/** kind → Emitter 的映射。 */
export interface EmitRegistry {
	get(kind: ModuleKind): Emitter
	register(kind: ModuleKind, emitter: Emitter): void
}

// ════════════════════════════════════════════════════════════════════
// §6 Graph（D-PCS-2, D-PCS-3, D-PCS-4）
// ════════════════════════════════════════════════════════════════════

/**
 * 有自己推导逻辑的组件（D-PCS-2），不是被动数据结构。
 *
 * 两层 fixpoint（D-PCS-2）：
 *   - config fixpoint（build 内部）：读 app.json → 发现 pages → 递归组件 → 扫文件
 *   - source fixpoint（mergeDelta）：worker parse 发现 require/@import/wxs
 *
 * D-PCS-3: 由 Orchestrator 触发，长期持有（per session/watch），不再 ephemeral。
 * D-PCS-4: 自己 bootstrap——build(ctx) 直接从 ctx.workPath 读 app.json。
 *
 * F-2: graph 跨线程——快照 + 合并（toJSON / mergeDelta）。
 */
export interface Graph {
	/** config fixpoint（读 app.json → 递归发现组件 → 扫文件）。 */
	build(ctx: PackerContext): void

	/** 配置变更时重新 config fixpoint + reconcile（加新 / 删旧 / 保不变）。 */
	reconcile(ctx: PackerContext): void

	/** 合并 worker source-level delta。 */
	mergeDelta(delta: GraphSnapshot): void

	/** 跨线程序列化。 */
	toJSON(): GraphSnapshot

	// ── 查询 ──

	/** entry 集（Orchestrator 查要编哪些）。 */
	getEntries(): string[]

	/** file ownership（Orchestrator 查要 parse 哪些文件）。 */
	getFileOwners(moduleId: string): string[]

	/** 受影响的 entry 列表。 */
	getAffectedEntries(file: string): string[]

	/** 失效模块列表。 */
	getInvalidatedModules(file: string): string[]

	/** 文件是否在图中。 */
	hasFile(file: string): boolean

	/** 文件的 kind 列表。 */
	getFileKinds(file: string): string[]

	// ── config-data accessors（D-NS-1：interface 查询面补全——PackerGraph 已实现 PC-B4c/B7）──

	/** 获取 appId（PC-B4c：主线程路由，消除 ALS getAppId）。 */
	getAppId(): string | undefined

	/** 获取项目名（PC-B4c：主线程路由，消除 ALS getAppName）。 */
	getAppName(): string | undefined

	/** 获取 app 级配置信息（PC-B4c：主线程路由，消除 ALS getAppConfigInfo）。 */
	getAppConfigInfo(): Record<string, unknown>

	/** 获取 config fixpoint 结果（快照恢复 / cache 序列化用）。 */
	getConfigData(): GraphConfigData

	/** 获取页面配置信息（PC-B4c4：主线程路由，消除 ALS getPageConfigInfo）。 */
	getPageConfigInfo(): Record<string, PageConfig>
}

// ════════════════════════════════════════════════════════════════════
// §7 OrchestratorState（D-PCS-6, D-PCS-9）
// ════════════════════════════════════════════════════════════════════

/**
 * session-scoped 状态（D-PCS-6: 拆出 PackerContext；D-PCS-9: 跨 rebuild 持久）。
 *
 * 生命周期时序：
 *   session start → 创建 OrchestratorState（graph 空 + cache 空）
 *   pipeline.run() × N → ALS 临时（PackerContext）；state 持久
 *   session end → OrchestratorState 销毁
 *
 * graph 不靠 ALS 活着——在 OrchestratorState 里，活过 pipeline.run()。
 */
export interface OrchestratorState {
	/** 活图（session-scoped，跨 rebuild 持久）。 */
	graph: Graph

	/** 活 cache（session-scoped）。key = moduleId（不含 fingerprint）。 */
	moduleCache: ModuleResultCache<CachedModuleResult>

	/** 失效集（per-rebuild 重算）。全 kind，不按 'logic' 过滤。 */
	invalidatedModules: Set<string>
}

/**
 * 模块结果缓存（泛型化）。
 *
 * M2 已有具体实现（model/module-result-cache.ts ModuleResultCache class），
 * 本 interface 是形状契约——现有 class 需泛型化后才能 conform。
 *
 * 缓存策略：
 *   - LoadedModule 不缓存（graph 是 dependencies 的天然缓存）
 *   - CompiledModule 缓存（key = moduleId）
 *   - EmitEntry 不缓存（emit 便宜）
 */
export interface ModuleResultCache<V = CachedModuleResult> {
	get(moduleId: string): V | undefined
	set(moduleId: string, result: V): void
	has(moduleId: string): boolean
	delete(moduleId: string): void
	clear(dirtyIds: Iterable<string>): void
	get size(): number
	toJSON(): [string, V][]
}

// ════════════════════════════════════════════════════════════════════
// §8 PackerOrchestrator（D-PCS-5, D-PCS-8, D-PCS-9）
// §8a BuildResult（D-NS-3：北星 return type composite——Promise<EmitEntry[]> → Promise<BuildResult>）
// ════════════════════════════════════════════════════════════════════

/** 编译入口。 */
export interface PackerEntry {
	entryId: string
	kind: ModuleKind
	moduleIds: string[]
}

/** 编排选项。 */
/**
 * 编译选项（D-NS-5：OrchestrateOptions refactor——compile-shared + mode flags）。
 * 避免 CompileRequest extends 继承 watch 字段（F-X1-1 WatchRequest-only 分类）。
 */
export interface CompileOptions {
	/** 各车道并行（现状 Listr concurrent: true）。默认 true。 */
	parallel: boolean
	/** watch 增量（affectedEntries + invalidatedModules）。默认 false。 */
	incremental?: boolean
	/** .json 变了（触发 graph.reconcile / 全量）。默认 false。 */
	configChanged?: boolean
	/** 要跑的车道（view/logic/style）。 */
	stages?: string[]
	prepareConfig?: boolean
	prepareNpm?: boolean
	/** .dev：跳过 materialize。 */
	skipMaterialize?: boolean
}

/** watch 增量数据（D-NS-5：watch-only）。 */
export interface WatchOptions {
	/** 受影响 entry（增量）。 */
	affectedEntries?: string[]
	/** 全 kind 失效模块列表（G3 D-IV-6/7 反转：原 logic-only，现全 kind）。 */
	invalidatedModules?: string[]
	/** 增量复制旧产物根。 */
	seedPath?: string
}

/**
 * PUBLIC 编译请求（D-NS-5，F-AB1-1：retain store?/lifecycle? per-request override）。
 * workPath/targetPath 从 ctx；state 2nd arg。
 */
export interface CompileRequest extends CompileOptions {
	useAppIdDir?: boolean
	/** RAW FileTypesInput（store.load 用，非 normalized）。 */
	fileTypes?: unknown
	/** C1 / createCompileTarget 其余字段（mode/platform/minify/…）。 */
	compileOptions?: Record<string, unknown>
	/** per-request store override（_orchestrate L170 runStore ?? providedStore）。 */
	store?: unknown
	/** per-request lifecycle override。 */
	lifecycle?: Lifecycle
}

/** watch 请求（D-NS-5：增量数据 only）。 */
export interface WatchRequest extends CompileRequest, WatchOptions {}

/**
 * 唯一主动组件。
 *
 * D-PCS-5: 拥有 3 registry（派发配置）。
 * D-PCS-8: 通用 worker（运行时收 kind 从内置 map 选实现）。
 * D-PCS-9: OrchestratorState session-scoped。
 *
 * 编排流程：
 *   1. 触发 state.graph.build(ctx) 或 reconcile(ctx)（config fixpoint）
 *   2. 从 state.graph.getEntries() 查 entries
 *   3. 对 loaderRegistry.kinds() 每个 kind 派发到 worker（并行）
 *   4. worker 内：从内置 map 选 loader/compiler/emitter → load fixpoint → compile → emit
 *   5. 合并 graph delta（state.graph.mergeDelta）+ 写 cache
 *   6. inline emit 直接收集；delayed emit 等所有车道完成后统一 emit
 *
 * F-3: 不是全局串行 fixpoint——是各车道级 fixpoint + 合并。
 */
export interface PackerOrchestrator {
	orchestrate(
		ctx: PackerContext,
		state: OrchestratorState,
		options: CompileRequest | WatchRequest,
	): Promise<BuildResult>
}

/** 北星 composite return（D-NS-3，F-AG1-1/F-AH1-1 cast 分类）。 */
export interface BuildResult {
	/** 编译产物 entries（北星 aspirational 契约 D-FC-5——sourced from buildModel.entries.values()）。 */
	entries: EmitEntry[]
	appId: string | undefined
	name: string | undefined
	path: string | undefined
	/** guaranteed GraphSnapshot（source state.graph.toJSON()——F-AG1-1）。 */
	dependencyGraph: GraphSnapshot
	buildModel: BuildModel | undefined
}

// ════════════════════════════════════════════════════════════════════
// §9 BuildCollaborator（facade-collaborator D-FC-1）
// ══════════════════════════════════════════════════════════════════════

/**
 * collaborator 统一形状（D-FC-1: collaborator 抽取，logic 搬迁非包壳）。
 *
 * 每 collaborator 拥有一类 build 业务活的完整逻辑（sctx 字段设置 +
 * lifecycle 事件 + 错误处理），orchestrator task body 仅委托 run()。
 * Deps 是每 collaborator 的 typed 子接口（禁单一 bag，避 mutable bag 覆辙）。
 */
export interface BuildCollaborator<Deps> {
	/** 多数 collaborator 返 void；StageDispatcher 返 ListrTask[]（sub-task list 交 facade newListr 渲染） */
	run(sctx: StageChannelContext, deps: Deps): Promise<unknown>
}
