# Technical Design — fe-tools-packer-core-shape

> 本设计基于 draft.md 的 D-PCS-1..10 决策。draft.md 是伪代码草稿，本文档是正式设计。

## §0 设计输入

### §0.1 前身决策

| 决策 | 内容 | 本 Action 约束 |
|---|---|---|
| W1 | emit.ts parameterize 可独立先行（S 级） | 本 Action 取代 W1——形状定义优先于单点参数化 |
| W2 | logic/** 参数化需 L 级重构 | 不实施——只定义形状 |
| W3 | env.ts 不拆（注入 context） | PackerContext 是接口，env.ts 是潜在实现 |
| W4 | dependency-graph 不拆（限定 kind API） | Graph 引用现有 DependencyGraph 类型 |
| D-MF-1 | 方案 A；刀 2 仅 logic；view/style 排除；规范形迁移另门 | 本 Action 定义的形状是"另门"的北星 |
| D-ER-5 | produceEntry 从 emitEntry 提取 | Emitter.emit 复用 produceEntry/emitEntry 签名 |
| D-RC-1..3 | ModuleResultCache session-only；IPC 快照；dep 发现用 cached.logicDependencies | 模块生命周期形状复用 ModuleResultCache |
| D-IV-1..6 | computeInvalidatedModules logic-only；闭包沿 kind=logic 边 | invalidatedModules 形状泛化到全 kind（形状定义，不实施） |

### §0.2 本 Action 决策（D-PCS-1..10）

| 决策 | 内容 |
|---|---|
| D-PCS-1 | storeInfo 只剩 paths+fileTypes = PackerContext。读 app.json / 递归组件 / 建图 / runtimeType 全归 Graph |
| D-PCS-2 | graph 推导逻辑自包含。config fixpoint + source fixpoint 都是 Graph 的两层发现 |
| D-PCS-3 | graph 由 Orchestrator 触发，长期持有（per session/watch） |
| D-PCS-4 | Graph 自己 bootstrap 自己。build(ctx) 直接读 app.json，没有 bootstrap 阶段 |
| D-PCS-5 | 三个 registry 取代 Packer 单体接口 |
| D-PCS-6 | PackerContext(I/O+fileTypes) + OrchestratorState(graph+cache+invalidated) 拆区 |
| D-PCS-7 | Emitter 封装 emit 策略（strategy + produceBuckets） |
| D-PCS-8 | 通用 worker，运行时收 kind 从内置 map 选实现 |
| D-PCS-9 | OrchestratorState session-scoped，ALS pipeline-scoped |
| D-PCS-10 | CompiledModule discriminated union |

### §0.3 现有碎片

| 碎片 | 位置 | 对应 Packer 组件 |
|---|---|---|
| DependencyGraph | model/dependency-graph.ts | Graph（D-PCS-2: 逻辑自包含） |
| ModuleResultCache | model/module-result-cache.ts | OrchestratorState.moduleCache |
| computeInvalidatedModules | model/invalidation.ts | OrchestratorState.invalidatedModules |
| produceEntry / emitEntry | pipeline/emit.ts | Emitter.emit |
| EmitModule / EmitEntry | pipeline/emit.ts | CompiledModule 子集 / EmitEntry |
| deriveFromGraph | model/convergence.ts | Orchestrator 雏形（只读版） |
| 三车道 parse-walk | logic/style/view parse-walk.ts | Loader.load |
| transformCjs / Vue compile / postcss | logic/transform.ts / view / style | Compiler.compile |
| build-pipeline | pipeline/build-pipeline.ts | Orchestrator（stage 级） |
| watch-plan | watch/watch-plan.ts | Orchestrator（entry 级） |
| worker-pool | watch/worker-pool.ts | Executor（不归 Packer） |

## §1 管线：load → compile → emit

### §1.1 三环节定义

Packer 管线是 3 个环节。**load**（parse + walk）是正式环节名——现有三车道 `parse-walk.ts` 即此环节的实现。

```
graph.build(ctx) → load → compile → emit
```

| 环节 | 正式名 | 做什么 | 输入 | 输出 | 反馈循环 |
|---|---|---|---|---|---|
| 0 | **graph build** | config fixpoint | PackerContext | graph 项目结构 | ✅ 递归发现组件 |
| 1 | **load** | parse + walk = 发现 | LoadInput + ctx | LoadedModule（source + dependencies + metadata） | ✅ dependencies 驱动下一轮 |
| 2 | **compile** | transform = 变换 | LoadedModule + ctx | CompiledModule（code + map） | ❌ 依赖已确定 |
| 3 | **emit** | bundle = 装配 | CompiledModule[] + ctx + options | EmitEntry | ❌ 纯组装 |

### §1.2 两个 fixpoint

Graph 有两层 fixpoint（D-PCS-2）：

- **config fixpoint**（graph.build 内部）：读 app.json → 发现 pages → 读 page.json → 发现 components → 递归 → 扫文件 → 项目结构完成
- **source fixpoint**（load 阶段）：parse 源码 → 发现 require/@import/wxs → mergeDelta → 继续直到稳定

两层都是 graph 在长——从不同输入长（JSON vs source）。Graph 是这两个 fixpoint 的共同 owner。

### §1.3 load 在 graph build 之后启动

load 需要从 graph 拿 3 样东西才能开始：
- entry 集（graph.getEntries()）
- file ownership（graph.getFileOwners()）
- graph 快照（graph.toJSON()，传给 worker）

graph build 完成后交付这些给 Orchestrator，Orchestrator 才能启动 load。

### §1.4 跨车道依赖留在车内

view 的 wxs 处理（view→logic 的跨车道依赖）留在 view 车道内部——load 发现 wxs，compile 处理 wxs。Orchestrator 不管跨车道。

## §2 PackerContext（D-PCS-1, D-PCS-6）

### §2.1 设计

```typescript
interface PackerContext {
  // 通用 I/O（env.ts 层 1）
  workPath: string
  targetPath: string
  readContent: (path: string) => string

  // 模块解析（D-PCS-1: deferred——讨论调度器时定是否保留）
  resolveAlias: (src: string) => string | null
  resolveNpm: (src: string, baseFile: string) => string

  // 文件类型（env.ts 层 4）
  fileTypes: PackerFileTypes

  // 注意：graph / moduleCache / invalidatedModules 不在 PackerContext
  // D-PCS-6: 这些在 OrchestratorState（§5）
  // D-PCS-4: Graph 自己从 ctx.workPath 读 app.json bootstrap
}

interface PackerFileTypes {
  templateExts: string[]
  styleExts: string[]
  viewScriptExts: string[]
  viewScriptTags: string[]
  directivePrefixes: string[]
}
```

### §2.2 PackerContext 是 I/O 环境，不是状态

D-PCS-6 拆区：PackerContext 只含被动 I/O（paths + fileTypes + resolvers），不含 graph/cache/invalidated（那些在 OrchestratorState）。D-PCS-9: PackerContext 是 pipeline-scoped（ALS），OrchestratorState 是 session-scoped。

### §2.3 Dimina 专有字段不进 PackerContext

env.ts 的 `getComponent` / `getAppConfigInfo` / `getAppId` / `isMiniGame` 不进 PackerContext。D-PCS-4: Graph 自己读 app.json，runtimeType 在 Graph 内部判断。Scheme 层专有逻辑通过预计算到 module metadata 或由 Orchestrator 桥接。

## §3 LoadedModule + CompiledModule（D-PCS-10）

### §3.1 设计

```typescript
type ModuleKind = 'logic' | 'view' | 'style' | 'config'

// load 环节产出
interface LoadedModule {
  moduleId: string
  kind: ModuleKind
  source: string
  dependencies: string[]
  metadata: PackerModuleMetadata
}

// compile 环节产出——D-PCS-10: discriminated union
interface CompiledModuleBase {
  moduleId: string
  kind: ModuleKind
  code: string
  map: string | null
  dependencies: string[]
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
```

### §3.2 为什么 discriminated union（D-PCS-10）

每个 kind 只有自己需要的字段。`kind` 是判别字段，TS narrowing 自动生效。registry 边界不丢类型——`registry.get('logic')` 返回 Compiler，产出的 CompiledModule 在消费方通过 `module.kind === 'logic'` 窄化。

替代方案（胖接口 + `[key: string]: unknown` 索引签名）否决——索引签名是 `any` 的伪装，允许无效组合。

TODO: 后续考虑泛型方案（`CompiledModule<M extends PackerModuleMetadata>`）——泛型可以让 metadata 类型安全穿透 registry 边界，但泛型参数穿透所有 API，复杂度高。当前 discriminated union 简单且足够。

### §3.3 与现有类型的映射

| 现有类型 | → 形状类型 |
|---|---|
| `EmitModule`（moduleId, code, map, extraInfoCode） | CompiledModule 子集（emit 只用这些） |
| `CompileInfo`（path, code, map, extraInfoCode） | LogicCompiledModule |
| `scriptRes` / `renderRes`（view） | ViewCompiledModule |
| `compileRes`（style） | StyleCompiledModule |

## §4 Packer API → 3 registry（D-PCS-5, D-PCS-7）

### §4.1 设计

```typescript
// ── 3 个 per-kind 契约 ──
interface Loader {
  load(input: LoadInput, ctx: PackerContext): Promise<LoadedModule>
}

interface Compiler {
  compile(module: LoadedModule, ctx: PackerContext): Promise<CompiledModule>
}

interface Emitter {
  readonly strategy: EmitStrategy  // D-PCS-7
  emit(entryId: string, modules: CompiledModule[], ctx: PackerContext, options: EmitOptions): Promise<EmitEntry>
  produceBuckets?(compiled: CompiledModule[], entries: string[]): EmitBucket[]  // delayed 专有
}

type EmitStrategy = 'inline' | 'delayed'

interface EmitBucket {
  kind: ModuleKind
  entryId: string
  modules: CompiledModule[]
  emitOptions: EmitOptions
}

// ── 3 个 registry ──
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
```

### §4.2 为什么 registry 取代单体 Packer（D-PCS-5）

单体 Packer 的 `loadModule/compileModule/emitEntry` 内部 `switch(kind)` 硬编码派发。registry 把派发解耦——加新 kind 只需注册，不改 Orchestrator。

registry 的作用是 **Orchestrator 的派发配置**（有哪些 kind、怎么派发），不是 worker 运行时查实现的机制。worker 内置实现 map（D-PCS-8），通过 kind 关联。

### §4.3 Emitter 封装 emit 策略（D-PCS-7）

inline vs delayed 是 Emitter 的属性（`strategy`），不是 Orchestrator 的决策。delayed 的 Emitter 额外实现 `produceBuckets`——分桶逻辑封装在 Emitter 内部。Orchestrator 只查 `emitter.strategy` 决定调用路径。

## §5 Graph + OrchestratorState + Orchestrator（D-PCS-2, D-PCS-3, D-PCS-4, D-PCS-5, D-PCS-8, D-PCS-9）

### §5.1 Graph（D-PCS-2, D-PCS-3, D-PCS-4）

```typescript
interface Graph {
  build(ctx: PackerContext): void           // config fixpoint（读 app.json → 递归 → 扫文件）
  reconcile(ctx: PackerContext): void        // 配置变更时重新 config fixpoint
  mergeDelta(delta: GraphSnapshot): void     // source delta（worker parse 发现）
  toJSON(): GraphSnapshot                    // 跨线程
  getEntries(): string[]
  getFileOwners(moduleId: string): string[]
  getAffectedEntries(file: string): string[]
  getInvalidatedModules(file: string): string[]
  hasFile(file: string): boolean
  getFileKinds(file: string): string[]
}
```

Graph 自己 bootstrap 自己（D-PCS-4）：`build(ctx)` 直接从 `ctx.workPath` 读 app.json，做 config fixpoint。没有 bootstrap 阶段，没有 ProjectModel 中间数据。

### §5.2 OrchestratorState（D-PCS-6, D-PCS-9）

```typescript
interface OrchestratorState {
  graph: Graph                        // session-scoped，跨 rebuild 持久
  moduleCache: ModuleResultCache      // session-scoped
  invalidatedModules: Set<string>    // per-rebuild 重算
}
```

session start 创建，跨 rebuild 持久。ALS（PackerContext）是 pipeline-scoped——pipeline.run() 时创建，返回后销毁。graph 不在 ALS 里，不靠 ALS 活着。

### §5.3 Orchestrator（D-PCS-5）

```typescript
interface PackerOrchestrator {
  loaderRegistry: LoaderRegistry
  compileRegistry: CompileRegistry
  emitRegistry: EmitRegistry

  orchestrate(ctx: PackerContext, state: OrchestratorState, options: OrchestrateOptions): Promise<EmitEntry[]>
}

interface OrchestrateOptions {
  parallel: boolean
  incremental: boolean
  configChanged: boolean
}
```

Orchestrator 是唯一主动组件。编排流程：
1. 触发 `state.graph.build(ctx)` 或 `reconcile(ctx)`（config fixpoint）
2. 从 `state.graph.getEntries()` 查 entries
3. 对 `loaderRegistry.kinds()` 每个 kind 派发到 worker（并行）
4. worker 内：从内置 map 选 loader/compiler/emitter → load fixpoint → compile → emit
5. 合并 graph delta（`state.graph.mergeDelta`）+ 写 cache
6. inline emit 直接收集；delayed emit 等所有车道完成后统一调 `emitter.emit`

### §5.4 通用 worker（D-PCS-8）

worker 不分 lane——运行时收 `kind` 消息，从内置 map 选实现。一个 worker-entry，内置所有 kind 的 Loader/Compiler/Emitter。主线程 registry 和 worker 内置 map 是两套实例（不能跨线程传函数），通过 kind 关联。

### §5.5 与现有编排的关系

| 现有编排 | → Orchestrator |
|---|---|
| build-pipeline（stage 级） | Orchestrator 统一——模块级依赖驱动 |
| watch-plan（entry 级） | Orchestrator 增量过滤——模块级 |
| stage-channel | Orchestrator 合并 graph delta + 写 cache |
| worker-pool | Executor 层（不归 Packer） |

## §6 缓存 + 失效

### §6.1 缓存策略

- **LoadedModule 不缓存**：graph 是 LoadedModule.dependencies 的天然缓存
- **CompiledModule 缓存**：key = moduleId（不含 fingerprint）
- **EmitEntry 不缓存**：emit 便宜

### §6.2 cache key = moduleId

M1 invalidatedModules 负责脏标记——cache 只存有效结果。fingerprint 下沉到 invalidation 层。

### §6.3 模块级增量（TODO）

现实：logic 有 M1+M2 模块级增量；view/style 无。形状 target：三车道统一。前提：M1 泛化全 kind + view/style 接入 moduleCache。另开 Action 实施。

## §7 文件落点

### §7.1 新文件

```
src/packer/
  types.ts      — 全部形状 interface 声明
  README.md     — Packer/Scheme 边界 + 现有代码映射表
```

### §7.2 不改的文件

- `pipeline/emit.ts`（EmitEntry / EmitModule / produceEntry 不变）
- `model/dependency-graph.ts`（DependencyGraph 不变）
- `model/module-result-cache.ts`（现有类不变）
- `model/invalidation.ts`（现有函数不变）
- `model/convergence.ts`（deriveFromGraph 不变）
- `core/env.ts`（W3: 不拆）
- 三车道 parse-walk / index.ts

### §7.3 tsconfig

`src/packer/types.ts` 须在 tsconfig include 范围内（现有 `src/**/*` 自动包含）。

## §8 风险表

| 风险 | 影响 | 缓解 |
|---|---|---|
| 形状定义后现有代码不 conform | 新类型是"北星"，现有代码不 wire | README 映射表标注"现状 vs 目标" |
| Graph 推导逻辑自包含需重构 env.ts | storeInfo 的 config fixpoint 逻辑要搬到 Graph | 形状只定 interface；实施时分步迁移 |
| registry + worker 内置 map 两套实例 | 维护一致性需约定 | 通过 kind 关联；session start 时双注册 |
| discriminated union 后 emit 需 narrow | Emitter 按 kind 窄化 | Emitter 从 registry 来，kind 已知 |
| 新类型引用现有类型导致循环 import | types.ts import emit.ts / dependency-graph.ts | `import type` 纯类型引用，tsc 擦除 |
| load 和 compile 分离后 view wxs 交织需重构 | view parse-walk 的 wxs 发现+处理交织 | 形状只定目标；实施时拆分 |

## §9 替代方案

### §9.1 PackerContext 含 Dimina 专有（否决）

否决理由：Packer 不通用。D-PCS-4: Graph 自己读 app.json，runtimeType 在 Graph 内部判断。

### §9.2 CompiledModule 胖接口 + 索引签名（否决）

否决理由：`[key: string]: unknown` 是 `any` 的伪装，允许无效组合。D-PCS-10: 用 discriminated union 代替。TODO: 后续考虑泛型方案。

### §9.3 Packer 单体接口（否决）

否决理由：`loadModule/compileModule/emitEntry` 内部 `switch(kind)` 硬编码。D-PCS-5: 3 registry 取代——加新 kind 不改 Orchestrator。

### §9.4 Packer API 黑盒 pack()（否决）

否决理由：无法支持增量和 HMR；load 和 compile 混在一起，反馈循环归属不清。

### §9.5 load 和 compile 不分离（否决）

否决理由：发现和变换交织——反馈循环归属不清；缓存粒度不清。

### §9.6 bootstrap 独立阶段（否决）

否决理由：读 app.json 和从 app.json 发现 pages 是同一个动作。D-PCS-4: Graph 自己 bootstrap 自己，没有独立 bootstrap 阶段。

### §9.7 per-lane worker（否决）

否决理由：三份 worker-entry 维护成本高。D-PCS-8: 通用 worker，一个 worker-entry 内置所有 kind。

### §9.8 graph 在 PackerContext / ALS 里（否决）

否决理由：graph 生命周期和 ALS 绑定——ephemeral。D-PCS-6/D-PCS-9: graph 在 OrchestratorState（session-scoped），不靠 ALS 活着。
