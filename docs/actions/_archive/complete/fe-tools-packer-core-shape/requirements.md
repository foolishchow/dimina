# Requirements — fe-tools-packer-core-shape

## 问题

Packer 形状没定，后续方向都在猜：

- **watch 增量**：模块缓存形状（key、value、序列化）依赖模块类型定义；现在做要猜，Packer 形状定了要返工
- **HMR**：patch 接口依赖 Packer API 定义；现在做要猜
- **deriveFromGraph**：从图推导模块集依赖 LoadedModule + PackerContext 形状；MC3a 已有雏形但未正式化

`fe-tools-packer-research` 回答了"抽取是否值得"（不值得立即做），但没回答"Packer 长什么样"。本 Action 回答这个问题——定义形状契约，不做物理抽取。

## 核心概念：load → compile → emit

Packer 管线是 3 个环节：

- **load**（parse + walk）：从源码发现依赖（require / usingComponents / @import / wxs）。反馈循环归属环节——dependencies 驱动下一轮 load。
- **compile**（transform）：将 LoadedModule 变换为 CompiledModule（code + map）。依赖已确定，不参与发现。
- **emit**（bundle）：将 CompiledModule[] 装配为 EmitEntry。纯组装。

现有三车道 `parse-walk.ts` 即 load 环节的实现（parse 源码→AST/DOM + walk 发现依赖）。load 和 compile 目前交织在 parse-walk.ts 中，但概念上可分离。

## 决策汇总

本 Action 通过 draft.md 讨论产出 10 个决策（D-PCS-1..10），定义 Packer core 形状：

| 决策 | 内容 |
|---|---|
| D-PCS-1 | storeInfo 只剩 paths+fileTypes = PackerContext（I/O 环境）。读 app.json / 递归组件 / 建图 / runtimeType 全归 Graph |
| D-PCS-2 | graph 推导逻辑自包含（build / reconcile / mergeDelta）。config fixpoint + source fixpoint 都是 Graph 的两层发现 |
| D-PCS-3 | graph 由 Orchestrator 触发，长期持有（per session/watch），不再 ephemeral |
| D-PCS-4 | Graph 自己 bootstrap 自己。build(ctx) 直接从 ctx.workPath 读 app.json，没有 bootstrap 阶段 |
| D-PCS-5 | 三个 registry 取代 Packer 单体接口。LoaderRegistry / CompileRegistry / EmitRegistry 映射 ModuleKind → per-kind 实现 |
| D-PCS-6 | PackerContext(I/O+fileTypes) + OrchestratorState(graph+cache+invalidated) 拆区 |
| D-PCS-7 | Emitter 封装 emit 策略。strategy 是 Emitter 属性，delayed 额外实现 produceBuckets |
| D-PCS-8 | 通用 worker。运行时收 kind 从内置 map 选实现。一个 worker-entry |
| D-PCS-9 | OrchestratorState session-scoped，ALS pipeline-scoped。graph 不靠 ALS 活着 |
| D-PCS-10 | CompiledModule discriminated union。kind 是判别字段。TODO: 后续考虑泛型方案 |

## MUST 需求

### R-PCS-1 PackerContext（D-PCS-1, D-PCS-6）

MUST 定义 `PackerContext` interface，只含 I/O 环境（不含 graph/cache/invalidated——那些在 OrchestratorState）：

- 通用 I/O：`workPath` / `targetPath` / `readContent`
- 模块解析：`resolveAlias` / `resolveNpm`（D-PCS-1: deferred——讨论调度器时定是否保留）
- 文件类型：`fileTypes`（PackerFileTypes: templateExts / styleExts / viewScriptExts / viewScriptTags / directivePrefixes）

MUST 不含：graph / moduleCache / invalidatedModules（D-PCS-6: 这些在 OrchestratorState）
MUST 不含 Dimina 专有字段（getComponent / getAppId / isMiniGame / getAppConfigInfo）

### R-PCS-2 LoadedModule + CompiledModule（D-PCS-10）

MUST 定义两阶段模块类型：

**LoadedModule**（load 环节产出）：
- `moduleId: string`
- `kind: ModuleKind`（`'logic' | 'view' | 'style' | 'config'`）
- `source: string`（原始源码）
- `dependencies: string[]`（load 发现的依赖 module ID 列表）
- `metadata: PackerModuleMetadata`（load 提取的元数据）

**CompiledModule**（D-PCS-10: discriminated union）：
- `CompiledModuleBase`：moduleId / kind / code / map / dependencies
- `LogicCompiledModule extends CompiledModuleBase`：kind='logic', extraInfoCode?
- `ViewCompiledModule extends CompiledModuleBase`：kind='view', renderBody?, wxsBindings?
- `StyleCompiledModule extends CompiledModuleBase`：kind='style', styleScopeId?
- `type CompiledModule = LogicCompiledModule | ViewCompiledModule | StyleCompiledModule`

MUST `PackerModuleMetadata` = `{ sourcePath: string }`（不含索引签名 `[key: string]: unknown`）
MUST `EmitModule`（现有，from `pipeline/emit.ts`）= CompiledModule 的子集

### R-PCS-3 Packer API → 3 registry（D-PCS-5, D-PCS-7）

MUST 定义 3 个 per-kind 契约 + 3 个 registry（取代单体 Packer interface）：

**per-kind 契约**：
- `Loader`：`load(input: LoadInput, ctx: PackerContext): Promise<LoadedModule>` — parse + walk = 发现
- `Compiler`：`compile(module: LoadedModule, ctx: PackerContext): Promise<CompiledModule>` — transform = 变换
- `Emitter`：`readonly strategy: EmitStrategy` + `emit(entryId, modules, ctx, options): Promise<EmitEntry>` + `produceBuckets?(compiled, entries): EmitBucket[]`（D-PCS-7: delayed 专有）

**3 个 registry**：
- `LoaderRegistry`：`get(kind) / register(kind, loader) / kinds(): ModuleKind[]`
- `CompileRegistry`：`get(kind) / register(kind, compiler)`
- `EmitRegistry`：`get(kind) / register(kind, emitter)`

MUST 复用现有 `EmitEntry` 类型（from `pipeline/emit.ts`）
MUST `LoadInput` 含 `moduleId` + `kind` + `source` + optional lane-specific data
MUST `EmitStrategy = 'inline' | 'delayed'`
MUST `EmitBucket` 含 `kind` + `entryId` + `modules` + `emitOptions`

### R-PCS-4 Graph + 模块生命周期（D-PCS-2, D-PCS-3, D-PCS-4）

MUST 定义 `Graph` interface（有自己推导逻辑的组件，不是被动数据结构）：
- `build(ctx: PackerContext): void` — config fixpoint（读 app.json → 递归发现组件 → 扫文件）
- `reconcile(ctx: PackerContext): void` — 配置变更时重新 config fixpoint
- `mergeDelta(delta: GraphSnapshot): void` — 合并 worker source-level delta
- `toJSON(): GraphSnapshot` — 跨线程序列化
- 查询：`getEntries() / getFileOwners(moduleId) / getAffectedEntries(file) / getInvalidatedModules(file) / hasFile(file) / getFileKinds(file)`

MUST 定义 `OrchestratorState`（session-scoped，D-PCS-9）：
- `graph: Graph`
- `moduleCache: ModuleResultCache`
- `invalidatedModules: Set<string>`

MUST `ModuleResultCache<V>` 泛型化
MUST `invalidatedModules: Set<string>` 全 kind（TODO: M1 泛化全 kind + view/style 接入 moduleCache → 另开 Action）
MUST cache key = moduleId（不含 fingerprint）

### R-PCS-5 PackerOrchestrator（D-PCS-5, D-PCS-8, D-PCS-9）

MUST 定义 `PackerOrchestrator` interface：
- 拥有 3 个 registry（loaderRegistry / compileRegistry / emitRegistry）
- `orchestrate(ctx: PackerContext, state: OrchestratorState, options: OrchestrateOptions): Promise<EmitEntry[]>`
- 职责文档化：触发 graph.build/reconcile → load fixpoint（source）→ mergeDelta → compile → emit

MUST `OrchestrateOptions` 含 `parallel` / `incremental` / `configChanged`
MUST OrchestratorState session-scoped（D-PCS-9）：session start 创建，跨 rebuild 持久
MUST worker 是通用的（D-PCS-8）：运行时收 kind，从内置 map 选实现

### R-PCS-6 Packer/Scheme 边界

MUST 在 `src/packer/README.md` 文档化：
- Packer（通用）：load / compile / emit / 缓存 / 失效 / 编排 / Graph
- Scheme（Dimina 专有）：项目配置加载 / 运行时类型 / 组件树发现 / 样式隔离 / 页面分包结构
- 边界：Scheme 产 PackerContext（I/O 环境）；Packer 从 ctx 自己 bootstrap Graph → load → compile → emit

### R-PCS-7 现有代码映射

MUST 在 `src/packer/README.md` 文档化映射表：
- env.ts exports → PackerContext / Graph / OrchestratorState / 不迁移
- 现有 module 类型 → LoadedModule / CompiledModule（discriminated union）
- 现有 parse-walk → Loader.load
- 现有 transform → Compiler.compile
- 现有 emit → Emitter.emit
- 现有 lifecycle → OrchestratorState
- 现有编排 → PackerOrchestrator

### R-PCS-8 行为 0

MUST diff=0；vitest 全绿；tsc 0 错。

### R-PCS-9 类型约束

MUST 不引入 `any` / `@ts-nocheck` / `as any`。允许 `as string | undefined` 等窄类型断言。
MUST 不用 `[key: string]: unknown` 索引签名（D-PCS-10: 用 discriminated union 代替）。

## SHOULD

- R-PCS-10 SHOULD `src/packer/types.ts` 可独立 `tsc --noEmit` 0 错
- R-PCS-11 SHOULD 新类型用 `import type` 引用现有类型（EmitEntry / DependencyGraph 等），不复制

## 约束

- tsconfig: `noUnusedLocals: true` / `strict: true` / `module: NodeNext` / `allowImportingTsExtensions: true`
- 新文件 `src/packer/types.ts` 须在 tsconfig include 范围内
- 现有类型（EmitEntry / EmitModule / DependencyGraph / ModuleResultCache）不可改名

## 非范围

- Packer 物理抽取（搬代码、删 env.ts import）
- 实现 Orchestrator 逻辑
- 实现 load / compile / emit 逻辑
- 实现 Graph 推导逻辑
- watch 增量 / HMR / deriveFromGraph
- 改 env.ts / dependency-graph.ts / 三车道 parse-walk
- 把新类型接入现有代码（wire）
- 模块级增量实施（TODO: 另开 Action）

## TODO（后续 Action）

- 泛型 CompiledModule（`CompiledModule<M>`）——当前 A（discriminated union）够用，后续视需求
- 模块级增量（M1 泛化全 kind + view/style 接入 moduleCache）——另开 Action
- NpmResolver / resolveAlias 是否进 PackerContext——讨论调度器时再定
