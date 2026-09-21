# Packer Core Shape — Pseudocode Draft

> 本文件是形状设计的伪代码草稿，非正式文档。综合 source-audit 的 F-1..F-6 发现 + 讨论结论。
> 目的：让形状可读、可讨论、可修正，最终指导 `types.ts` 的实现。

---

## §1 PackerContext — ALS-backed，非 plain object

### 发现 F-1

Worker 不接收 PackerContext 参数——接收 `storeInfo` 快照，调 `resetStoreInfo` 重建 ALS。
load/compile/emit 通过 ALS 隐式获取上下文。

### 伪代码

```typescript
// ── PackerContext 是 ALS-backed 的上下文，不是传参的 plain object ──
// 现实：env.ts 的 storeInfo / resetStoreInfo 就是它的实现
// 形状：定义 interface 让 ALS 的隐式获取有类型契约

interface PackerContext {
  // ── I/O 区（load/compile/emit 读）──
  workPath: string
  targetPath: string
  readContent: (path: string) => string

  // ── 解析区 ──
  resolveAlias: (src: string) => string | null
  resolveNpm: (src: string, baseFile: string) => string

  // ── 文件类型区 ──
  fileTypes: PackerFileTypes

  // ── 状态区（Orchestrator 独占写；worker 只读快照）──
  // 现实：worker 通过 ALS 读 graph/cache，本地写副本，返回 delta
  graph: DependencyGraph              // 活图引用（主线程）/ 快照副本（worker）
  moduleCache: ModuleResultCache     // 活 cache（主线程）/ 快照（worker）
  invalidatedModules: Set<string>    // 失效集（watch 增量）
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
interface CompiledModule {
  moduleId: string
  kind: ModuleKind
  code: string                      // 编译产物
  map: string | null
  dependencies: string[]            // = LoadedModule 的，确认
  extraInfoCode?: string
  metadata: PackerModuleMetadata    // 透传 + compile 补充
}

interface PackerModuleMetadata {
  sourcePath: string
  // View-specific（load 发现，compile 消费）
  wxsBindings?: WxsBinding[]
  renderBody?: { start: number; end: number }
  // Style-specific
  styleScopeId?: string
  // 索引签名——允许 lane-specific 扩展，渐进类型化
  [key: string]: unknown
}

// EmitModule = CompiledModule 子集（emit 只用 moduleId + code + map + extraInfoCode）
// 现有 emit.ts 的 EmitModule interface 不变——Packer API 引用它
```

---

## §3 Packer API — load → compile → emit 3 环节

### 发现 F-4

emit 时机因车道而异：logic 推迟（按桶，独立 stage）；view/style 即编即发（inline）。

### 伪代码

```typescript
// ── 最小输入 ──
interface LoadInput {
  moduleId: string
  kind: ModuleKind
  source: string
  // Scheme 层预计算的 Dimina 专有数据（F-1 路径 A：不进 PackerContext）
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

// ── Packer API：3 环节 ──
// 现实：load/compile 交织在 parse-walk 里；形状的目标是分离
// 现实：这些方法跑在 Worker 里，通过 ALS 读 PackerContext
interface Packer {
  // load：parse + walk = 发现依赖
  // F-5：现实 parse-walk 写本地 graph（非纯函数）
  //      形状 target：返回 deps delta，Orchestrator 写 graph（需重构）
  loadModule(input: LoadInput, ctx: PackerContext): Promise<LoadedModule>

  // compile：transform = 变换源码 → 产物
  // 依赖已确定（LoadedModule.dependencies），不参与发现
  compileModule(module: LoadedModule, ctx: PackerContext): Promise<CompiledModule>

  // emit：bundle = 装配
  // F-4：logic 用 perModule 策略（按桶）；view 用 bundle 策略（按 entry）
  emitEntry(
    entryId: string,
    modules: CompiledModule[],
    ctx: PackerContext,
    options: EmitOptions,
  ): Promise<EmitEntry>   // EmitEntry from pipeline/emit.ts（不变）
}

// ── per-lane dispatch ──
// loadModule/compileModule 实现必然 switch(kind)
// 三车道 load/compile 逻辑差异大，无法真正统一
// Packer API 是接口契约，实现是 per-lane dispatch
```

---

## §4 模块生命周期 — graph + cache（跨线程快照 + 合并）

### 发现 F-2

graph 和 cache 跨线程——快照 + 合并。写权在 worker（本地副本）和主线程（合并）之间分叉。

### 伪代码

```typescript
// ── ModuleResultCache 泛型化（M2 已有，泛型形状）──
// 现实：硬绑 CompileInfo（logic-specific）
// 形状：泛型 V，三车道各实例化
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
// fingerprint 下沉到 invalidation 层（computeInvalidatedModules 按 changed files 推导脏集）

// ── graph 跨线程（F-2）──
// 现实：DependencyGraph 已有 toJSON() / merge()
// 形状：确认这两个方法为 PackerContext.graph 的契约

// ── 缓存范围（待定）──
// 只缓存 CompiledModule（现状 M2）：load 每次重做——load 便宜，可接受
// 缓存 LoadedModule + CompiledModule：两阶段都跳过——复杂度翻倍
// 倾向：只缓存 CompiledModule。graph 是 LoadedModule.dependencies 的天然缓存。

// ── invalidatedModules 全 kind（形状 target）──
// 现实：computeInvalidatedModules 只沿 kind=logic 边（logic-only）
// 形状：泛化到全 kind——M1 闭包须覆盖全 kind 边
// 前提条件：cache key = moduleId 在 M1 闭包正确的前提下安全
type InvalidatedModules = Set<string>  // 全 kind，不按 'logic' 过滤
```

---

## §5 Orchestrator — per-lane 并行 fixpoint + 合并

### 发现 F-3

三车道并行跑各自的 parse-walk fixpoint。不是全局串行 fixpoint。

### 伪代码

```typescript
interface PackerEntry {
  entryId: string
  kind: ModuleKind
  moduleIds: string[]
}

interface OrchestrateOptions {
  parallel: boolean     // 三车道并行（现状 Listr concurrent: true）
  incremental: boolean  // watch 增量（affectedEntries + invalidatedModules）
}

// ── Orchestrator 是唯一主动组件 ──
// 但不是"一个全局串行 fixpoint"——是三并行车道级 fixpoint + 合并
interface PackerOrchestrator {
  orchestrate(
    entries: PackerEntry[],
    ctx: PackerContext,
    state: OrchestratorState,
    api: Packer,
    options: OrchestrateOptions,
  ): Promise<EmitEntry[]>
}

// ── 状态区——Orchestrator 独占（主线程）──
// F-2：graph/cache 的活引用只在主线程；worker 收快照
interface OrchestratorState {
  graph: DependencyGraph              // 活图（主线程）
  moduleCache: ModuleResultCache     // 活 cache（主线程）
  invalidatedModules: Set<string>    // 失效集
}

// ── Orchestrator 编排伪代码 ──
// 反映现实流程（source-audit §2-§4），不是抽象设计

async function orchestrate(
  entries: PackerEntry[],
  ctx: PackerContext,
  state: OrchestratorState,
  api: Packer,
  options: OrchestrateOptions,
): Promise<EmitEntry[]> {
  const results: EmitEntry[] = []

  // ── 阶段 1：Packer 创建（storeInfo / resetStoreInfo）──
  // 现实：store.load(workPath) = env.ts storeInfo()
  // 这一步在 pipeline.run 里，不在 Orchestrator 里
  // 但形状要承认：PackerContext 在这里诞生
  // ctx 已通过 ALS 恢复——Orchestrator 假设 ctx 可用

  // ── 阶段 2：三车道并行 compile ──
  // F-3：不是全局 fixpoint，是三车道各自 fixpoint + 合并
  // 现实：Listr concurrent: true，三车道独立 worker
  if (options.parallel) {
    const [logicResult, viewResult, styleResult] = await Promise.all([
      runLane('logic', entries, ctx, state, api, options),
      runLane('view', entries, ctx, state, api, options),
      runLane('style', entries, ctx, state, api, options),
    ])

    // ── 合并 graph delta（F-2）──
    // 现实：ctx.dependencyGraph.merge(result.dependencyGraph)
    for (const result of [logicResult, viewResult, styleResult]) {
      if (result?.graphDelta) {
        state.graph.merge(result.graphDelta)
      }
    }

    // ── 写 cache（F-2）──
    // 现实：stage-channel 从 worker 返回值写 cache
    for (const result of [logicResult, viewResult, styleResult]) {
      for (const compiled of result?.compiled ?? []) {
        state.moduleCache.set(compiled.moduleId, {
          module: compiled,
          dependencies: compiled.dependencies,
        })
      }
    }

    // ── 收集 view/style emit（即时，F-4）──
    results.push(...viewResult.entries, ...styleResult.entries)

    // ── logic emit 推迟（F-4）──
    // 现实：独立 stage，按桶（main + subs）
    if (logicResult?.emitBuckets) {
      for (const bucket of logicResult.emitBuckets) {
        const entry = await api.emitEntry(
          bucket.entryId,
          bucket.modules,
          ctx,
          bucket.emitOptions,
        )
        results.push(entry)
      }
    }
  }

  return results
}

// ── per-lane fixpoint（车道级）──
// 每个车道内部有自己的 fixpoint：parse → walk → 发现 deps → 继续 walk
// 现实：三车道的 parse-walk 各自实现这个
async function runLane(
  kind: ModuleKind,
  entries: PackerEntry[],
  ctx: PackerContext,
  state: OrchestratorState,
  api: Packer,
  options: OrchestrateOptions,
): Promise<LaneResult> {
  // ── Worker 内执行（现实：executeTask → postMessage → Worker）──
  // Worker:
  //   1. resetStoreInfo(storeInfo)  // 重建 ALS → PackerContext 可用
  //   2. load fixpoint:
  //      frontier = entries.filter(e => e.kind === kind)
  //      while frontier:
  //        loaded = api.loadModule(input, ctx)   // parse + walk
  //        // F-5: 现实写本地 graph；target: 返回 deps delta
  //        frontier = loaded.dependencies - visited
  //   3. compile:
  //      for moduleId in invalidatedModules ∩ lane:
  //        if cache hit → skip
  //        compiled = api.compileModule(loaded, ctx)
  //   4. emit（view/style inline；logic 产 emitBuckets）
  //      view/style: api.emitEntry → EmitEntry → onOutput 回传
  //      logic: 产 emitBuckets（不直接 emit）
  //   5. 返回 { compiled, graphDelta, emitBuckets, entries }

  // 主线程收到序列化结果后合并
  return { compiled: [], graphDelta: null, emitBuckets: null, entries: [] }
}

interface LaneResult {
  compiled: CompiledModule[]
  graphDelta: unknown | null         // 序列化的 graph 增量
  emitBuckets: EmitBucket[] | null   // logic 专有
  entries: EmitEntry[]               // view/style inline emit
}

interface EmitBucket {
  entryId: string
  modules: CompiledModule[]
  emitOptions: EmitOptions
}
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

  // .json 变更 → 全量（config 影响 graph 结构）
  if (changedFiles.some(f => f.endsWith('.json'))) {
    return fullRebuild(ctx, state)
  }
  // 未追踪文件 → 全量
  if (changedFiles.some(f => !state.graph.hasFile(f))) {
    return fullRebuild(ctx, state)
  }

  // ── 增量 build ──
  // 现实：build(..., { affectedEntries, stages, invalidatedModules, seedPath, ... })
  await orchestrate(
    affectedEntries.map(id => ({ entryId: id, kind: deriveKind(id), moduleIds: [] })),
    ctx,
    state,
    packerApi,
    { parallel: true, incremental: true },
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
                    worker 从 storeInfo 重建          同——形状不改 ALS 机制

load                交织 compile（parse-walk）       分离：loadModule 独立
                    写本地 graph（非纯函数）           target: 返回 deps delta（需重构）

compile             交织在 parse-walk 里              分离：compileModule 独立

emit                logic 推迟（独立 stage）          形状承认：emit 时机因车道
                    view/style inline                同

graph 写权          env.ts 初始 + worker 本地写       target: Orchestrator 独占
                    + 主线程合并                      现实: 快照+合并（线程边界必然）

cache 写权          主线程 stage-channel 写           target: Orchestrator 独占
                    worker 只读快照                   现实: 同（worker 不写 cache）

fixpoint            三车道并行 per-lane fixpoint      形状承认：per-lane 并行
                    非全局串行                        不强求全局串行

模块级增量          logic only（M1+M2）              target: 三车道统一
                    view/style 无                     前提: M1 泛化全 kind

CompiledModule      四车道各自表示                    target: 统一类型
                    EmitModule / CompileInfo /         PackerModule（需收敛）
                    scriptRes / compileRes
```

---

## §8 未决问题（待讨论）

1. **load 纯函数化是否值得？** 现实 parse-walk 写本地 graph。target 是返回 deps delta。重构 parse-walk 成本？ROI？
2. **PackerContext 保留 ALS 还是参数化？** 现实是 ALS。形状要不要保留？还是定义参数化 target？
3. **Orchestrator 是真实组件还是抽象层？** 现实是 build-pipeline + stage-channel + watch-plan 三碎片。形状要不要定义真实 Orchestrator 实现？还是只定 interface？
4. **view/style 模块级增量何时做？** 是 core-shape 一起做？还是另开 Action？
5. **logic emit 推迟 vs view/style 即时——形状怎么统一？** 是承认差异（per-lane emit 策略）？还是统一为"全部推迟"？
6. **PackerContext 拆 I/O 区 + 状态区？** 还是保持一个 interface？
