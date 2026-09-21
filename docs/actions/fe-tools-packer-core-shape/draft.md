# Packer Core Shape — Pseudocode Draft

> 本文件是形状设计的伪代码草稿，非正式文档。综合 source-audit 的 F-1..F-6 发现 + 讨论结论。
> 目的：让形状可读、可讨论、可修正，最终指导 `types.ts` 的实现。

---

## §1 PackerContext — ALS-backed，非 plain object

### 发现 F-1

Worker 不接收 PackerContext 参数——接收 `storeInfo` 快照，调 `resetStoreInfo` 重建 ALS。
load/compile/emit 通过 ALS 隐式获取上下文。

### 决策 D-PCS-1：storeInfo 大部分归 Graph，不进 Packer 形状

storeInfo 现在做 6 件事：
1. storePathInfo（paths）
2. normalizeFileTypes（file type mapping）
3. storeAppConfig（读 app.json）
4. storePageConfig（递归发现组件树，读 page.json / component.json）
5. createInitialDependencyGraph（建图）
6. normalizeRuntimeType（读 project.config.json 判 miniProgram vs game）

3-6 **全是 Graph 的逻辑**（D-PCS-2/D-PCS-3/D-PCS-4）。Graph 自己读 app.json、判断 runtimeType、递归发现组件、扫文件、建图。

storeInfo 只剩 1-2（paths + fileTypes）——这就是 **PackerContext**（I/O 环境），不是独立阶段。

**bootstrap 作为独立阶段不存在了。** PackerContext 是环境就绪，Graph 自己 bootstrap 自己。

### 伪代码

```typescript
// ── PackerContext 是 ALS-backed 的上下文，不是传参的 plain object ──
// 现实：env.ts 的 storeInfo / resetStoreInfo 是 bootstrap，产出 PackerContext
// 形状：定义 interface 让 ALS 的隐式获取有类型契约

interface PackerContext {
  // ── I/O 区（load/compile/emit 读；Graph build 读 app.json）──
  workPath: string
  targetPath: string
  readContent: (path: string) => string

  // ── 解析区 ──
  // 后续迁移：NpmResolver / resolveAlias 是否进 PackerContext 待讨论（§8 Q-8）
  resolveAlias: (src: string) => string | null
  resolveNpm: (src: string, baseFile: string) => string

  // ── 文件类型区 ──
  fileTypes: PackerFileTypes

  // ── 注意：graph / moduleCache / invalidatedModules 不在 PackerContext ──
  // D-PCS-6：拆到 OrchestratorState（§5）
  // graph 是 Graph 组件（§4），由 Orchestrator 触发 build/mergeDelta
}

interface PackerFileTypes {
  templateExts: string[]
  styleExts: string[]
  viewScriptExts: string[]
  viewScriptTags: string[]
  directivePrefixes: string[]
}

// ── 可序列化约束 ──
// graph 要 toJSON() / merge() ——跨线程必须
// cache 要 toJSON() / 重建 ——跨线程必须
// F-1 结论：PackerContext 不是传参的，是 ALS 重建的
```

---

## §2 LoadedModule + CompiledModule — 两阶段模块类型

### 伪代码

```typescript
type ModuleKind = 'logic' | 'view' | 'style' | 'config'

// ── load 环节产出（parse + walk = 发现）──
// 瞬态：传给 compile 后丢弃。不缓存（graph 是依赖缓存）
interface LoadedModule {
  moduleId: string
  kind: ModuleKind
  source: string                    // 原始源码
  dependencies: string[]            // load 发现的依赖 module ID 列表
  metadata: PackerModuleMetadata    // load 提取的元数据
}

// ── compile 环节产出（transform = 变换）──
// 持久化：存入 moduleCache（跨 rebuild 复用）
// D-PCS-10: discriminated union——kind 是判别字段，TS narrowing 自动生效
interface CompiledModuleBase {
  moduleId: string
  kind: ModuleKind
  code: string                      // 编译产物
  map: string | null
  dependencies: string[]            // = LoadedModule 的，确认
}

interface LogicCompiledModule extends CompiledModuleBase {
  kind: 'logic'
  extraInfoCode?: string
}

interface ViewCompiledModule extends CompiledModuleBase {
  kind: 'view'
  renderBody?: { start: number; end: number }
  wxsBindings?: WxsBinding[]
}

interface StyleCompiledModule extends CompiledModuleBase {
  kind: 'style'
  styleScopeId?: string
}

type CompiledModule = LogicCompiledModule | ViewCompiledModule | StyleCompiledModule

interface PackerModuleMetadata {
  sourcePath: string
}

// TODO D-PCS-10: 后续考虑泛型方案（CompiledModule<M extends PackerModuleMetadata>）
// 泛型可以让 metadata 类型安全穿透 Compiler → registry 边界
// 但泛型参数会穿透所有 API，复杂度高
// 当前用 discriminated union（A），简单且 TS narrowing 天然支持
// registry 边界不丢类型（kind 字段自动判别）

// EmitModule = CompiledModule 子集（emit 只用 moduleId + code + map + extraInfoCode）
// 现有 emit.ts 的 EmitModule interface 不变
```

---

## §3 Packer API — 3 registry（load / compile / emit）

### 决策 D-PCS-5：三个 registry 取代 Packer 单体接口

现在 Packer API 的 `loadModule/compileModule/emitEntry` 三个方法内部 `switch(kind)` 硬编码派发。三车道逻辑差异极大（logic parse JS AST 找 require；view parse WXML 找 include/wxs；style parse WXSS 找 @import）。

形状 target：三个 registry 取代单体 Packer 接口。每个 registry 映射 `ModuleKind → 实现`。Orchestrator 拥有三个 registry，用 registry 派发，不做 switch。

好处：
- 加新 kind 不改 Orchestrator——注册一个 Loader/Compiler/Emitter 就行
- load/compile/emit 实现和 Orchestrator 解耦——Loader/Compiler/Emitter 是独立单元
- 可测试——每个 per-kind 实现单独测

### 决策 D-PCS-7：Emitter 封装 emit 策略

inline vs delayed 不是 Orchestrator 的决策——是 Emitter 自己的特性。logic 按桶发射因为 JS 需要合并打包；view/style 按入口发射因为 WXML/WXSS 天然独立。

Emitter 声明自己的 `strategy`，Orchestrator 只查 strategy 决定调用路径。delayed 的 Emitter 额外实现 `produceBuckets`——分桶逻辑（按 main/sub package）封装在 Emitter 内部，Orchestrator 不需要知道怎么分。

### 发现 F-4

emit 时机因车道而异：logic 推迟（按桶，独立 stage）；view/style 即编即发（inline）。

### 伪代码

```typescript
// ── 最小输入 ──
interface LoadInput {
  moduleId: string
  kind: ModuleKind
  source: string
  // Scheme 层预计算的 Dimina 专有数据（不进 PackerContext）
  usingComponents?: Record<string, string>   // view 专有
  styleScopeId?: string                       // style 专有
}

interface EmitOptions {
  transform: { strategy: string; minify: boolean; target: string; platform: string }
  sourcemap: boolean
  sourcemapTargetPath: string | null
  filename: string
  relPrefix: string
}

// ── 三个 per-kind 契约 ──
interface Loader {
  // load = parse + walk = 发现依赖
  // F-5：现实 parse-walk 写本地 graph；形状 target：返回 LoadedModule.dependencies
  load(input: LoadInput, ctx: PackerContext): Promise<LoadedModule>
}

interface Compiler {
  // compile = transform = 变换源码 → 产物
  // 依赖已确定（LoadedModule.dependencies），不参与发现
  compile(module: LoadedModule, ctx: PackerContext): Promise<CompiledModule>
}

interface Emitter {
  // emit = bundle = 装配
  // D-PCS-7：Emitter 封装自己的 emit 策略，Orchestrator 只查 strategy
  readonly strategy: EmitStrategy

  // inline: 直接 emit → EmitEntry
  // delayed: 先调 produceBuckets 产分桶，等所有车道完成后统一 emit
  emit(
    entryId: string,
    modules: CompiledModule[],
    ctx: PackerContext,
    options: EmitOptions,
  ): Promise<EmitEntry>   // EmitEntry from pipeline/emit.ts（不变）

  // delayed 专有：产分桶（按 main/sub package 等）
  // inline 的 Emitter 不实现这个
  produceBuckets?(
    compiled: CompiledModule[],
    entries: string[],
  ): EmitBucket[]
}

type EmitStrategy = 'inline' | 'delayed'

interface EmitBucket {
  kind: ModuleKind           // D-PCS-7: delayed emit 需要知道哪个 kind 的 bucket
  entryId: string
  modules: CompiledModule[]
  emitOptions: EmitOptions
}

// ── 三个 registry ──
// D-PCS-5: kind → 实现的映射，可插拔
// D-PCS-7: Emitter 封装 emit 策略（strategy）
interface LoaderRegistry {
  get(kind: ModuleKind): Loader
  register(kind: ModuleKind, loader: Loader): void
  kinds(): ModuleKind[]
}
interface CompileRegistry {
  get(kind: ModuleKind): Compiler
  register(kind: ModuleKind, compiler: Compiler): void
}
interface EmitRegistry {
  get(kind: ModuleKind): Emitter
  register(kind: ModuleKind, emitter: Emitter): void
}

// ── 注册示例（session start 时）──
// loaderRegistry.register('logic', new LogicLoader())    // parse JS → walk AST → require
// loaderRegistry.register('view', new ViewLoader())      // parse WXML → walk → include/wxs
// loaderRegistry.register('style', new StyleLoader())   // parse WXSS → walk → @import
// compileRegistry.register('logic', new LogicCompiler()) // transformCjs
// compileRegistry.register('view', new ViewCompiler())   // Vue compile
// compileRegistry.register('style', new StyleCompiler()) // postcss
// emitRegistry.register('logic', new LogicEmitter())     // strategy: 'delayed', produceBuckets
// emitRegistry.register('view', new ViewEmitter())       // strategy: 'inline'
// emitRegistry.register('style', new StyleEmitter())     // strategy: 'inline'
```

---

## §4 模块生命周期 — graph + cache

### 发现 F-2

graph 和 cache 跨线程——快照 + 合并。写权在 worker（本地副本）和主线程（合并）之间分叉。

### 决策 D-PCS-2：graph 逻辑自包含，Orchestrator 触发

graph 不是被动数据结构——是**有自己推导逻辑的组件**。现在 `createInitialDependencyGraph` + `storePageConfig` + `storeAppConfig` 的逻辑散在 env.ts，和读配置、扫文件混在一起。形状 target：全部推导逻辑搬进 Graph 自身，自包含。

config fixpoint（递归组件发现）和 source fixpoint（parse-walk）都是 Graph 的两层发现：
- **config fixpoint**：读 app.json → 发现 pages → 读 page.json → 发现 components → 递归 → 扫文件 → 项目结构完成
- **source fixpoint**：parse 源码 → 发现 require/@import/wxs → mergeDelta → 继续直到稳定

两层都是 graph 在长——从不同输入长（JSON vs source）。Graph 是这两个 fixpoint 的共同 owner。

### 决策 D-PCS-3：graph 由 Orchestrator 触发，不在 bootstrap

graph 是从 app.json 推导的派生状态。app.json 会变——graph 的项目结构层需要重新推导。Orchestrator 负责 graph 的全部生命周期：
- 首次：graph.build(ctx) — Graph 自己读 app.json，做 config fixpoint
- rebuild 配置没变：只合并 worker 的 source-level delta
- rebuild 配置变了：graph.reconcile(ctx) — 重新 config fixpoint + reconcile（加新 / 删旧 / 保不变）

现在 graph 在 `storeInfo`（bootstrap）里创建，ephemeral（per pipeline.run）。Orchestrator 触发后 graph 变长期持有（per session/watch）。

### 决策 D-PCS-4：Graph 自己 bootstrap 自己，没有独立 bootstrap 阶段

读 app.json 这一步也是 Graph 的——不能把"读 app.json"和"从 app.json 发现 pages"拆开，它们是同一个动作。

storeInfo 的 6 步中，3-6（读 app.json / 递归组件 / 建图 / runtimeType）全是 Graph 逻辑。只剩 1-2（paths + fileTypes）= PackerContext（I/O 环境）。

**bootstrap 作为独立阶段不存在了。** PackerContext 是环境就绪，Graph 自己从 ctx.workPath 读 app.json 开始 bootstrap。

graph 有两层内容，来源不同，变化条件不同：

| 层 | 来源 | 变化条件 | 谁产 |
|---|---|---|---|
| 项目结构（entries + files + component edges） | app.json 推导（config fixpoint） | .json 变更 | Graph 自己读 app.json + 递归 |
| 源码依赖（require / @import / wxs edges） | parse-walk（source fixpoint） | 源码变更 | worker 发现，Orchestrator 触发 mergeDelta |

### 伪代码

```typescript
// ── Graph 是有自己逻辑的组件，不是被动数据结构 ──
// D-PCS-2：推导逻辑自包含（config fixpoint + source delta merge）
// D-PCS-3：Orchestrator 触发
// D-PCS-4：Graph 自己 bootstrap 自己——build(ctx) 直接读 app.json
interface Graph {
  // config fixpoint——从 ctx.workPath 读 app.json 开始
  // 内部：读 project.config.json 判 runtimeType → 读 app.json → 发现 pages
  //       → 读 page.json → 发现 components → 递归 → 扫文件
  //       → 项目结构完成
  build(ctx: PackerContext): void

  // 配置变了——重新 config fixpoint + reconcile（加新 / 删旧 / 保不变）
  reconcile(ctx: PackerContext): void

  // source delta——worker parse 源码发现的 require/@import/wxs → 合并
  mergeDelta(delta: GraphSnapshot): void

  // 跨线程（F-2）——worker 从快照重建本地副本
  toJSON(): GraphSnapshot

  // 查询（现有 API + 新增）
  getEntries(): string[]               // entry 集（Orchestrator 查要编哪些）
  getFileOwners(moduleId: string): string[]  // file ownership（Orchestrator 查要 parse 哪些文件）
  getAffectedEntries(file: string): string[]
  getInvalidatedModules(file: string): string[]
  hasFile(file: string): boolean
  getFileKinds(file: string): string[]
}

// ── ModuleResultCache 泛型化（M2 已有，泛型形状）──
interface ModuleResultCache<V = CompiledModule> {
  get(moduleId: string): { module: V; dependencies: string[] } | undefined
  set(moduleId: string, result: { module: V; dependencies: string[] }): void
  has(moduleId: string): boolean
  delete(moduleId: string): void
  clear(dirtyIds: Iterable<string>): void
  size(): number

  // 跨线程必须（F-2）
  toJSON(): [string, unknown][]
}

// ── cache key = moduleId（不含 fingerprint）──
// M1 invalidatedModules 负责驱逐——cache 只存有效结果

// ── 缓存范围（待定）──
// 只缓存 CompiledModule（现状 M2）：load 每次重做——load 便宜，可接受
// 缓存 LoadedModule + CompiledModule：两阶段都跳过——复杂度翻倍
// 倾向：只缓存 CompiledModule。graph 是 LoadedModule.dependencies 的天然缓存。

// ── invalidatedModules 全 kind（形状 target）──
// 现实：computeInvalidatedModules 只沿 kind=logic 边（logic-only）
// 形状：泛化到全 kind——M1 闭包须覆盖全 kind 边
type InvalidatedModules = Set<string>  // 全 kind，不按 'logic' 过滤
```

---

## §5 Orchestrator — per-lane 并行 fixpoint + 合并

### 发现 F-3

三车道并行跑各自的 parse-walk fixpoint。不是全局串行 fixpoint。

### 决策 D-PCS-9：OrchestratorState session-scoped，ALS pipeline-scoped

OrchestratorState（graph + cache + invalidatedModules）是 **session-scoped**——session start 创建，跨 rebuild 持久。graph 不在 ALS 里（D-PCS-6），不靠 ALS 活着。

PackerContext（ALS）是 **pipeline-scoped**——pipeline.run() 时创建，返回后销毁。ALS 只是 I/O 环境（workPath + fileTypes），pipeline.run 时可用就行。

```
session start:
  → 创建 Orchestrator（注册 registries）
  → 创建 OrchestratorState（graph 空 + cache 空 + invalidatedModules 空）

pipeline.run() × N:
  → runWithCompilerContext(() => ...)  ← ALS 创建（pipeline-scoped）
  → ctx = getPackerContext()  ← 从 ALS 拿
  → orchestrator.orchestrate(ctx, state, options)
  → pipeline.run() 返回 → ALS 销毁
  → state 还在（session-scoped）

session end:
  → OrchestratorState 销毁
```

graph.build(ctx) 时 ctx 是 ALS-backed——但 graph 持有的数据不依赖 ALS。graph 在 OrchestratorState 里，活过 pipeline.run()。

### 伪代码

```typescript
interface PackerEntry {
  entryId: string
  kind: ModuleKind
  moduleIds: string[]
}

interface OrchestrateOptions {
  parallel: boolean     // 各车道并行（现状 Listr concurrent: true）
  incremental: boolean  // watch 增量（affectedEntries + invalidatedModules）
  configChanged: boolean  // .json 变了（触发 graph.reconcile）
}

// ── Orchestrator 是唯一主动组件 ──
// D-PCS-5: 拥有三个 registry
// D-PCS-8: 通用 worker
// D-PCS-9: OrchestratorState session-scoped
// 但不是"一个全局串行 fixpoint"——是各车道级 fixpoint + 合并
interface PackerOrchestrator {
  loaderRegistry: LoaderRegistry
  compileRegistry: CompileRegistry
  emitRegistry: EmitRegistry

  orchestrate(
    ctx: PackerContext,
    state: OrchestratorState,
    options: OrchestrateOptions,
  ): Promise<EmitEntry[]>
}

// ── 状态区——session-scoped（D-PCS-9）──
// D-PCS-2/D-PCS-3/D-PCS-4：graph 由 Orchestrator 触发，逻辑自包含，自己 bootstrap
// D-PCS-6：拆出 PackerContext，graph/cache/invalidated 在 OrchestratorState
// D-PCS-9：session-scoped，跨 rebuild 持久；ALS pipeline-scoped 不影响 state
// F-2：graph/cache 的活引用只在主线程；worker 收快照
interface OrchestratorState {
  graph: Graph                        // 活图（session-scoped，跨 rebuild 持久）
  moduleCache: ModuleResultCache     // 活 cache（session-scoped）
  invalidatedModules: Set<string>    // 失效集（per-rebuild 重算）
}

// ── Orchestrator 编排伪代码 ──
// 反映现实流程（source-audit §2-§4），不是抽象设计

async function orchestrate(
  ctx: PackerContext,
  state: OrchestratorState,
  orch: PackerOrchestrator,
  options: OrchestrateOptions,
): Promise<EmitEntry[]> {
  const results: EmitEntry[] = []

  // ── 阶段 0：Graph bootstrap（config fixpoint）──
  // D-PCS-4：Graph 自己 bootstrap 自己——从 ctx 读 app.json
  // D-PCS-3：Orchestrator 触发 graph.build(ctx)
  //   → Graph 内部：读 app.json → 发现 pages → 读 page.json → 发现 components
  //     → 递归 → 扫文件 → 项目结构完成
  //   → 交付给 Orchestrator：entry 集 + file ownership + 查询能力
  if (!options.incremental) {
    state.graph.build(ctx)           // 首次：config fixpoint
  } else if (options.configChanged) {
    state.graph.reconcile(ctx)       // .json 变了：重新 config fixpoint + reconcile
  }
  // else：增量，graph 项目结构不变，只等 source delta

  // ── 从 graph 查 entries ──
  const entries: PackerEntry[] = state.graph.getEntries().map(id => ({
    entryId: id,
    kind: deriveKind(id),
    moduleIds: [],
  }))

  // ── 阶段 2：并行 compile（从 registry 查有哪些 kind）──
  // F-3：不是全局 fixpoint，是各车道各自 fixpoint + 合并
  // D-PCS-5：从 loaderRegistry.kinds() 自动派发
  // 现实：Listr concurrent: true，三车道独立 worker
  if (options.parallel) {
    const kinds = orch.loaderRegistry.kinds()  // ['logic', 'view', 'style']
    const laneResults = await Promise.all(
      kinds.map(kind => runLane(kind, entries, ctx, state, orch, options))
    )
    const [logicResult, viewResult, styleResult] = laneResults

    // ── 合并 graph delta（F-2）──
    // D-PCS-2/D-PCS-3：Orchestrator 触发 graph.mergeDelta（source fixpoint）
    // 现实：ctx.dependencyGraph.merge(result.dependencyGraph)
    for (const result of laneResults) {
      if (result?.graphDelta) {
        state.graph.mergeDelta(result.graphDelta)
      }
    }

    // ── 写 cache（F-2）──
    // 现实：stage-channel 从 worker 返回值写 cache
    for (const result of laneResults) {
      for (const compiled of result?.compiled ?? []) {
        state.moduleCache.set(compiled.moduleId, {
          module: compiled,
          dependencies: compiled.dependencies,
        })
      }
    }

    // ── 收集 inline emit（即时，F-4）──
    // D-PCS-5/D-PCS-7：从 registry 查 strategy=inline 的 kind 的 inline emit
    for (const result of laneResults) {
      if (result?.entries) {
        results.push(...result.entries)
      }
    }

    // ── delayed emit 推迟（F-4）──
    // 现实：独立 stage，按桶（main + subs）
    // D-PCS-5/D-PCS-7：从 emitRegistry 查 strategy=delayed 的 kind
    for (const result of laneResults) {
      if (result?.emitBuckets) {
        for (const bucket of result.emitBuckets) {
          const emitter = orch.emitRegistry.get(bucket.kind)
          const entry = await emitter.emit(
            bucket.entryId,
            bucket.modules,
            ctx,
            bucket.emitOptions,
          )
          results.push(entry)
        }
      }
    }
  }

  return results
}

// ── per-lane fixpoint（车道级）──
// 每个车道内部有自己的 fixpoint：parse → walk → 发现 deps → 继续 walk
// 现实：三车道的 parse-walk 各自实现这个
// D-PCS-8：通用 worker——运行时收 kind，从内置 map 选实现
async function runLane(
  kind: ModuleKind,
  entries: PackerEntry[],
  ctx: PackerContext,
  state: OrchestratorState,
  orch: PackerOrchestrator,
  options: OrchestrateOptions,
): Promise<LaneResult> {
  // D-PCS-5：Orchestrator 用 registry 决定有哪些 kind、派发到 worker
  // D-PCS-8：worker 是通用的——收 kind 后从内置 map 选实现
  //   主线程 registry 和 worker 内置 map 是两套实例（不能跨线程传函数）
  //   通过 kind 关联——两边注册一致的 kind → 实现映射

  // ── 派发到通用 worker（executeTask → postMessage）──
  // 消息: { kind, entries, storeInfo, graphSnapshot, cacheSnapshot, invalidatedModules }
  //   storeInfo 含 PackerContext I/O + graph 快照（路径 B：graph 随 storeInfo 传入）

  // ── Worker 内执行 ──
  // Worker 内置 map（bundle 时绑定）:
  //   const implementations: Record<ModuleKind, LaneImpl> = {
  //     logic: { loader: new LogicLoader(), compiler: new LogicCompiler(), emitter: new LogicEmitter() },
  //     view:  { loader: new ViewLoader(),  compiler: new ViewCompiler(),  emitter: new ViewEmitter() },
  //     style: { loader: new StyleLoader(), compiler: new StyleCompiler(), emitter: new StyleEmitter() },
  //   }
  //
  // Worker.onMessage({ kind, entries, storeInfo, ... }) =>
  //   1. resetStoreInfo(storeInfo)   // 重建 ALS → PackerContext 可用
  //      （graph 快照也在 storeInfo 里——路径 B）
  //   2. const { loader, compiler, emitter } = implementations[kind]
  //   3. load fixpoint:
  //      frontier = entries
  //      while frontier:
  //        loaded = loader.load(input, ctx)   // parse + walk
  //        // F-5: 现实写本地 graph；target: 返回 deps delta
  //        frontier = loaded.dependencies - visited
  //   4. compile:
  //      for moduleId in invalidatedModules ∩ lane:
  //        if cache hit → skip
  //        compiled = compiler.compile(loaded, ctx)
  //   5. emit——根据 emitter.strategy 派发（D-PCS-7）
  //      inline: emitter.emit → EmitEntry → onOutput 回传
  //      delayed: emitter.produceBuckets → EmitBucket[]（不直接 emit）
  //   6. 返回 { compiled, graphDelta, emitBuckets, entries }

  // 主线程收到序列化结果后合并
  return { compiled: [], graphDelta: null, emitBuckets: null, entries: [] }
}

interface LaneResult {
  compiled: CompiledModule[]
  graphDelta: unknown | null         // 序列化的 graph 增量
  emitBuckets: EmitBucket[] | null   // delayed strategy 的 kind 专有
  entries: EmitEntry[]               // inline strategy 的 kind 的 emit
}

// EmitBucket 定义在 §3（D-PCS-7: 含 kind 字段）
```

---

## §6 watch rebuild — Orchestrator 增量路径

### 伪代码

```typescript
// ── watch rebuild 伪代码（source-audit §4）──
async function watchRebuild(
  changedFiles: string[],
  ctx: PackerContext,
  state: OrchestratorState,
): Promise<void> {
  // ── M1 失效计算（主线程）──
  const affectedEntries = computeAffectedEntries(state.graph, changedFiles)
  const invalidatedModules = computeInvalidatedModules(state.graph, changedFiles)
  const stages = computeStagesForFiles(state.graph, changedFiles)

  // .json 变更 → graph.reconcile（重新 config fixpoint）
  // D-PCS-3/D-PCS-4：Graph 自己重新读 app.json，reconcile 项目结构
  const configChanged = changedFiles.some(f => f.endsWith('.json'))
  // 未追踪文件 → 全量
  if (changedFiles.some(f => !state.graph.hasFile(f))) {
    return fullRebuild(ctx, state)
  }

  // ── 增量 build ──
  // 现实：build(..., { affectedEntries, stages, invalidatedModules, seedPath, ... })
  await orchestrate(
    ctx,
    state,
    orch,
    { parallel: true, incremental: true, configChanged },
  )

  // ── 增量路径的差异（F-6）──
  // logic: 有 moduleCache + invalidatedModules → 模块级跳过
  // view/style: 无 moduleCache → 全量重编受影响 entry 下所有模块
  // 形状 target: view/style 也接入 moduleCache → 模块级跳过
  //   前提：M1 invalidatedModules 泛化到全 kind（不只 logic）
}
```

---

## §7 关键 gap：形状 target vs 现实

```
                    现实（source-audit）              形状 target
                    ──────────────────              ────────────
PackerContext       ALS-backed（env.ts）             interface 契约（ALS 是实现）
                    worker 从 storeInfo 重建          D-PCS-6: 只含 I/O+fileTypes
                                                     graph/cache 在 OrchestratorState

Packer API          loadModule/compileModule/         target: 3 registry 取代
                    emitEntry（switch(kind) 硬编码）    Loader/Compiler/Emitter（D-PCS-5）
                                                     Orchestrator 拥有 3 个 registry

worker              per-lane worker（编译时绑定）      target: 通用 worker（D-PCS-8）
                    三份 worker-entry                   运行时收 kind，从内置 map 选
                                                     一个 worker-entry，内置所有 kind

load                交织 compile（parse-walk）       分离：Loader.load 独立
                    写本地 graph（非纯函数）           target: 返回 deps delta（需重构）

compile             交织在 parse-walk 里              分离：Compiler.compile 独立

emit                logic 推迟（独立 stage）          Emitter 封装 strategy（D-PCS-7）
                    view/style inline                inline: 直接 emit
                                                     delayed: produceBuckets 后统一 emit

graph 创建          env.ts createInitialDependency    target: Graph 自己 bootstrap（D-PCS-4）
                    Graph + storeAppConfig +              Graph.build(ctx) 直接读 app.json
                    storePageConfig（bootstrap 内）      Orchestrator 触发（D-PCS-3）
                                                     没有 bootstrap 阶段

graph 生命周期      ephemeral（per pipeline.run）     target: session-scoped（D-PCS-9）
                    storeInfo 重建                     OrchestratorState 跨 rebuild 持久
                                                     ALS pipeline-scoped 不影响 state

cache 生命周期      ephemeral（per pipeline.run）     target: session-scoped（D-PCS-9）
                    重建                               同 graph

cache 写权          主线程 stage-channel 写           target: Orchestrator 独占
                    worker 只读快照                   现实: 同（worker 不写 cache）

fixpoint            三车道并行 per-lane fixpoint      形状承认：per-lane 并行
                    非全局串行                        不强求全局串行

模块级增量          logic only（M1+M2）              target: 三车道统一
                    view/style 无                     前提: M1 泛化全 kind

CompiledModule      四车道各自表示                    target: discriminated union（D-PCS-10）
                    EmitModule / CompileInfo /         LogicCompiledModule | ViewCompiledModule
                    scriptRes / compileRes             | StyleCompiledModule
                                                     TODO: 后续考虑泛型方案
```

---

## §8 未决问题（待讨论）

1. **load 纯函数化是否值得？** 现实 parse-walk 写本地 graph。target 是返回 deps delta。重构 parse-walk 成本？ROI？
   - **讨论结论**：不强制纯函数化——返回 dependencies 即可，写本地 graph 是实现细节（线程边界封装副作用）
2. **PackerContext 保留 ALS 还是参数化？** 现实是 ALS。形状要不要保留？还是定义参数化 target？
   - **讨论结论**：保留 ALS——形状是 interface，ALS 是实现。storeInfo 是 Scheme 层 bootstrap，不进 Packer 形状（D-PCS-1）
3. **Orchestrator 是真实组件还是抽象层？** 现实是 build-pipeline + stage-channel + watch-plan 三碎片。形状要不要定义真实 Orchestrator 实现？还是只定 interface？
   - **讨论结论**：只定 interface——统一实现是实施 Action
4. **view/style 模块级增量何时做？** 是 core-shape 一起做？还是另开 Action？
   - **讨论结论**：另开 Action——形状定 target，实施另做
5. **logic emit 推迟 vs view/style 即时——形状怎么统一？** 是承认差异（per-lane emit 策略）？还是统一为"全部推迟"？
   - **讨论结论**：承认差异——per-lane emit 策略
6. **PackerContext 拆 I/O 区 + 状态区？** 还是保持一个 interface？
   - **讨论结论**：拆——PackerContext(I/O+fileTypes) + OrchestratorState(graph+cache)
7. **storeInfo / bootstrap 迁移？** storeInfo 现在做 6 件事，3-6 全归 Graph。
   - **决策 D-PCS-1**（收紧）：storeInfo 只剩 paths + fileTypes = PackerContext（I/O 环境）。读 app.json / 递归组件 / 建图 / runtimeType 全归 Graph。
   - **决策 D-PCS-4**：Graph 自己 bootstrap 自己。没有独立 bootstrap 阶段。PackerContext 是环境就绪，Graph.build(ctx) 直接读 app.json 开始。
8. **NpmResolver / resolveAlias 是否进 PackerContext？** 后续讨论调度器时再定。
   - **deferred**
9. **graph 谁触发？逻辑在哪？config fixpoint 归谁？**
   - **决策 D-PCS-2**：graph 推导逻辑自包含（build / reconcile / mergeDelta）。config fixpoint（读 app.json + 递归组件）和 source fixpoint（parse-walk）都是 Graph 的两层发现。推导逻辑从 env.ts 搬进 Graph 自身。
   - **决策 D-PCS-3**：graph 由 Orchestrator 触发，不在 bootstrap 建。Graph 变长期持有（per session/watch），不再 ephemeral。
   - **决策 D-PCS-4**：Graph 自己 bootstrap 自己。build(ctx) 直接从 ctx.workPath 读 app.json，不需要 ProjectModel/ProjectBootstrap 中间数据。
   - **graph 有两层内容**：项目结构层（app.json 推导，config fixpoint）+ 源码依赖层（parse-walk 发现，source fixpoint）。两层在同一 graph，变化触发条件不同。
   - **graph build 是 fixpoint**（config-level），不是 one-shot。Graph 内部递归发现组件树。
   - **load 在 graph build 之后启动**：load 需要从 graph 拿 entries + file ownership + 快照。
10. **Packer API 用单体接口还是 registry？**
    - **决策 D-PCS-5**：三个 registry 取代 Packer 单体接口。LoaderRegistry / CompileRegistry / EmitRegistry 映射 ModuleKind → per-kind 实现。Orchestrator 拥有三个 registry，用 registry 派发，不做 switch。加新 kind 只需注册，不改 Orchestrator。
11. **emit 策略（inline vs delayed）该谁决定？**
    - **决策 D-PCS-7**：Emitter 封装自己的 emit 策略。`strategy: 'inline' | 'delayed'` 是 Emitter 的属性，不是 Orchestrator 的决策。delayed 的 Emitter 额外实现 `produceBuckets`——分桶逻辑封装在 Emitter 内部。Orchestrator 只查 `emitter.strategy` 决定调用路径，不需要知道哪个 kind 是 inline/delayed。
12. **worker 是 per-lane 还是通用？**
    - **决策 D-PCS-8**：通用 worker。worker 不分 lane——运行时收 `kind` 消息，从内置 map 选 Loader/Compiler/Emitter 实现。一个 worker-entry，内置所有 kind 的实现。主线程 registry 和 worker 内置 map 是两套实例（不能跨线程传函数），通过 kind 关联——两边注册一致的 kind → 实现映射。
    - registry 的作用：Orchestrator 的派发配置（有哪些 kind、怎么派发），不是 worker 运行时查实现的机制。
13. **OrchestratorState 生命周期？ALS 生命周期？**
    - **决策 D-PCS-9**：OrchestratorState 是 session-scoped（session start 创建，跨 rebuild 持久）。ALS 是 pipeline-scoped（pipeline.run() 时创建，返回后销毁）。graph 不在 ALS 里（D-PCS-6），不靠 ALS 活着——graph 在 OrchestratorState 里，活过 pipeline.run()。graph.build(ctx) 时 ctx 是 ALS-backed，但 graph 持有的数据不依赖 ALS。
14. **CompiledModule 类型怎么收敛？**
    - **决策 D-PCS-10**：discriminated union。`CompiledModule = LogicCompiledModule | ViewCompiledModule | StyleCompiledModule`，`kind` 是判别字段。每个 variant 只有自己需要的字段，TS narrowing 自动生效。registry 边界不丢类型。
    - **TODO**：后续考虑泛型方案（`CompiledModule<M extends PackerModuleMetadata>`）——泛型可以让 metadata 类型安全穿透 Compiler → registry 边界，但泛型参数穿透所有 API，复杂度高。当前用 A（discriminated union），简单且足够。
