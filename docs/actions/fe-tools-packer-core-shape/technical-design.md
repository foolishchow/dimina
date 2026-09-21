# Technical Design — fe-tools-packer-core-shape

## §0 设计输入

### §0.1 前身决策

| 决策 | 内容 | 本 Action 约束 |
|---|---|---|
| W1 | emit.ts parameterize 可独立先行（S 级） | 本 Action 取代 W1——形状定义优先于单点参数化 |
| W2 | logic/** 参数化需 L 级重构 | 不实施——只定义形状 |
| W3 | env.ts 不拆（注入 context） | PackerContext 是接口，env.ts 是潜在实现 |
| W4 | dependency-graph 不拆（限定 kind API） | PackerContext.graph 字段引用现有 DependencyGraph 类型 |
| D-MF-1 | 方案 A；刀 2 仅 logic；view/style 排除；规范形迁移另门 | 本 Action 定义的形状是"另门"的北星 |
| D-ER-5 | produceEntry 从 emitEntry 提取 | Packer API.emitEntry 复用 produceEntry/emitEntry 签名 |
| D-RC-1..3 | ModuleResultCache session-only；IPC 快照；dep 发现用 cached.logicDependencies | 模块生命周期形状复用 ModuleResultCache |
| D-IV-1..6 | computeInvalidatedModules logic-only；闭包沿 kind=logic 边 | invalidatedModules 形状泛化到全 kind（形状定义，不实施） |

### §0.2 env.ts 扇入扇出分析（本讨论产出）

27 exports 分类：

| 层 | 数量 | 函数 | Packer 需要 |
|---|---|---|---|
| 通用 I/O | 5 | getWorkPath / getTargetPath / getContentByPath / resolveAppAlias / getNpmResolver | ✅ PackerContext |
| Dimina 专有 | 5 | getDependencyGraph / getComponent / getAppConfigInfo / getAppId / isMiniGame | ❌ SchemeContext 或预计算 |
| 文件类型 | 5 | getStyleExts / getTemplateExts / getViewScriptExts / getViewScriptTags / getTemplateDirectivePrefixes | ✅ PackerContext.fileTypes |
| 纯 Scheme | 6 | getPages / getPageConfigInfo / getAppStyleScopeId / getAppName / isTemporaryTargetPath / runWithCompilerContext | ❌ 不迁移 |
| 生命周期 | 3 | resetStoreInfo / storeInfo / storeProjectConfig | ❌ 不迁移（storeInfo/resetStoreInfo 是 env.ts 内部） |
| 死 export | 3 | getProjectConfig / getRuntimeType / storeProjectConfig | ❌ 仅测试用 |

Packer 层直接调 16/27 exports。真正的 Packer 通用面是 5 个 I/O + 5 个文件类型 = 10 个。

### §0.3 现有碎片

| 碎片 | 位置 | 对应 Packer 组件 |
|---|---|---|
| DependencyGraph | model/dependency-graph.ts | PackerContext.graph |
| ModuleResultCache | model/module-result-cache.ts | 模块生命周期 |
| computeInvalidatedModules | model/invalidation.ts | 模块生命周期 |
| produceEntry / emitEntry | pipeline/emit.ts | Packer API.emitEntry |
| EmitModule / EmitEntry | pipeline/emit.ts | CompiledModule 子集 / EmitEntry |
| deriveFromGraph | model/convergence.ts | Orchestrator 雏形（只读版） |
| 三车道 parse-walk | logic/style/view parse-walk.ts | Packer API.loadModule |
| transformCjs / Vue compile / postcss | logic/transform.ts / view / style | Packer API.compileModule |
| build-pipeline | pipeline/build-pipeline.ts | Orchestrator（stage 级） |
| watch-plan | watch/watch-plan.ts | Orchestrator（entry 级） |
| worker-pool | watch/worker-pool.ts | Executor（不归 Packer） |

## §1 管线：load → compile → emit

### §1.1 三环节定义

Packer 管线是 3 个环节。**load**（parse + walk）是正式环节名——现有三车道 `parse-walk.ts` 即此环节的实现。

```
load → compile → emit
```

| 环节 | 正式名 | 做什么 | 输入 | 输出 | 反馈循环 |
|---|---|---|---|---|---|
| 1 | **load** | parse + walk = 发现 | LoadInput（moduleId + kind + source）+ ctx | LoadedModule（source + dependencies + metadata） | ✅ dependencies 驱动下一轮 |
| 2 | **compile** | transform = 变换 | LoadedModule + ctx | CompiledModule（code + map） | ❌ 依赖已确定 |
| 3 | **emit** | bundle = 装配 | CompiledModule[] + ctx + options | EmitEntry | ❌ 纯组装 |

### §1.2 为什么 load 和 compile 可分离

三车道现在 parse-walk 里交织了 load（发现）和 compile（变换），但概念上可分离：

**Logic**：
- load: parse JS → walk require/import → 发现依赖 module IDs
- compile: transformCjs（ESM→CJS）

**View**：
- load: parse WXML → walk DOM → 发现 usingComponents / wxs / includes
- compile: Vue compileTemplate + wxs replacement（用 load 发现的 wxs 内容）

**Style**：
- load: parse WXSS → walk @import → 发现依赖 module IDs
- compile: postcss/less → CSS + map

关键：**wxs 的发现（load）和处理（compile）可分离**——load 阶段 parse WXML 发现 `<wxs>` 标签 + 提取内容 + 记录 module ID；compile 阶段用这些 wxs 内容做 replacement。现在它们在同一函数里交织，但不必须交织。

### §1.3 跨车道依赖留在车内

view 的 wxs 处理（view→logic 的跨车道依赖）留在 view 车道内部——load 发现 wxs，compile 处理 wxs。Orchestrator 不管跨车道。理由：wxs 的发现和处理交织太深，拆出来要重构 view parse-walk 核心逻辑，ROI 不明。这是形状定义接受的妥协——Packer 不是纯粹通用的打包器，view 车道知道怎么处理 wxs。

## §2 PackerContext

### §2.1 设计

```typescript
interface PackerContext {
  // 通用 I/O（env.ts 层 1）
  workPath: string
  targetPath: string
  readContent: (path: string) => string

  // 模块解析（env.ts 层 1）
  resolveAlias: (src: string) => string | null
  resolveNpm: (src: string, baseFile: string) => string

  // 文件类型（env.ts 层 4）
  fileTypes: PackerFileTypes

  // 图（env.ts getDependencyGraph）
  graph: DependencyGraph

  // 缓存（M2 ModuleResultCache 泛型化）
  moduleCache: ModuleResultCache<CompiledModule>

  // 失效（M1 invalidatedModules 泛化）
  invalidatedModules: Set<string>
}

interface PackerFileTypes {
  templateExts: string[]
  styleExts: string[]
  viewScriptExts: string[]
  viewScriptTags: string[]
  directivePrefixes: string[]
}
```

### §2.2 Dimina 专有字段不进 PackerContext

env.ts 层 2（`getComponent` / `getAppConfigInfo` / `getAppId` / `isMiniGame`）不进 PackerContext。两条路径：

**路径 A（预计算到 metadata）**：Scheme 层在发现阶段调 env.ts 拿到 component config / appId / runtimeType，嵌入 LoadedModule.metadata。Packer 编译时只读 metadata，不调 env.ts。

**路径 B（SchemeContext 注入 Orchestrator）**：Orchestrator 持有 `SchemeContext`（含 getComponent / getAppId / isMiniGame），在编排时调 Scheme 层查询，结果传给 Packer API。

**本设计倾向路径 A**（预计算）——Packer 真正通用，不持有任何 Dimina 引用。路径 B 作为备选。

### §2.3 与 packer-research 草案的差异

packer-research 草案：
```
PackerContext { sourceRoot, outputRoot, moduleIdPrefix, runtimeType,
  graphWriter{...}, resolver{content/npm/alias/component/appConfig}, stateRestore }
```

本设计差异：
- `runtimeType` 移出（Dimina 专有 → 预计算或 SchemeContext）
- `resolver{component/appConfig}` 移出（同上）
- `graphWriter` 改为 `graph: DependencyGraph`（Packer 直接读现有图类型，不重新定义 writer 接口）
- 加 `moduleCache` + `invalidatedModules`（packer-research 草案无——M1/M2 当时未 complete）

## §3 LoadedModule + CompiledModule

### §3.1 设计

```typescript
type ModuleKind = 'logic' | 'view' | 'style' | 'config'

// load 环节产出
interface LoadedModule {
  moduleId: string
  kind: ModuleKind
  source: string                    // 原始源码
  dependencies: string[]            // load 发现的依赖 module ID 列表
  metadata: PackerModuleMetadata    // load 提取的元数据
}

// compile 环节产出
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
  // View-specific（load 阶段发现，compile 阶段消费）
  wxsBindings?: WxsBinding[]
  renderBody?: { start: number; end: number }
  // Style-specific
  styleScopeId?: string
  // 允许 lane-specific 扩展
  [key: string]: unknown
}
```

### §3.2 与现有类型的映射

| 现有类型 | 字段 | → 阶段类型 |
|---|---|---|
| `EmitModule` | moduleId, code, map, extraInfoCode | CompiledModule 子集（emit 只用这些） |
| `CompileInfo` | path, code, map, extraInfoCode | CompiledModule（moduleId=path） |
| `ModuleCompileCacheEntry` | instruction.scriptModule | LoadedModule.metadata.wxsBindings 等 |
| `CachedModuleResult` | compileInfo, logicDependencies | CompiledModule + dependencies |
| parse-walk 内部 source | 源码字符串 | LoadedModule.source |

### §3.3 metadata 形状决策

采用 `[key: string]: unknown` 索引签名 + 文档化 lane-specific 字段，不用 kind 判别联合。理由：
- 判别联合会让 compileModule 的类型签名复杂化（需 narrow kind）
- 现有 view parse-walk 的 metadata 字段动态性高
- 索引签名允许渐进类型化（先文档化，后续可收紧）

## §4 Packer API

### §4.1 设计

```typescript
interface LoadInput {
  moduleId: string
  kind: ModuleKind
  source: string
}

interface Packer {
  // load 环节：parse + walk = 发现
  loadModule(input: LoadInput, ctx: PackerContext): Promise<LoadedModule>

  // compile 环节：transform = 变换
  compileModule(module: LoadedModule, ctx: PackerContext): Promise<CompiledModule>

  // emit 环节：bundle = 装配
  emitEntry(entryId: string, modules: CompiledModule[], ctx: PackerContext, options: EmitOptions): Promise<EmitEntry>
}

interface EmitOptions {
  transform: EmitTransformConfig & { strategy: string }
  sourcemap: boolean
  sourcemapTargetPath: string | null
  filename: string
  relPrefix: string
}
```

### §4.2 为什么 3 环节细粒度

选择 load + compile + emit 细粒度，不选黑盒 `pack(entries)`。理由：
- 黑盒无法支持增量（watch 需要只调 loadModule/compileModule 跳过未失效的）
- 黑盒无法支持 HMR（HMR 需要只调 emitEntry 发一个 entry 的 patch）
- load 和 compile 分离让反馈循环归 load——compile 不参与发现，依赖已确定
- 细粒度让 Orchestrator 有编排空间

### §4.3 与现有 API 的关系

- `loadModule` ≈ 现有三车道 `parse-walk` 的 load 部分（parse + walk 依赖发现）
- `compileModule` ≈ 现有三车道 parse-walk 的 compile 部分 + `transformCjs`（logic）/ Vue compile（view）/ postcss（style）
- `emitEntry` ≈ 现有 `produceEntry` / `emitEntry`（from emit.ts），签名兼容

### §4.4 per-lane dispatch

`loadModule` / `compileModule` 的实现必然 per-kind dispatch（`switch(module.kind)`）。三车道 load/compile 逻辑差异大（JS AST walk vs WXML DOM walk vs CSS @import walk），无法真正统一。形状定义承认这一点——Packer API 是接口契约，实现是 per-lane dispatch。

## §5 模块生命周期

### §5.1 设计

```typescript
// M2 已有，泛型化形状
interface ModuleResultCache<V = CompiledModule> {
  get(moduleId: string): { module: V; dependencies: string[] } | undefined
  set(moduleId: string, result: { module: V; dependencies: string[] }): void
  has(moduleId: string): boolean
  delete(moduleId: string): void
  clear(dirtyIds: Iterable<string>): void
  size(): number
}

// M1 已有，泛化形状（不再 kind='logic' 过滤）
type InvalidatedModules = Set<string>
```

### §5.2 缓存 key 策略

**cache key = moduleId**（不含 fingerprint）。理由：
- M1 invalidatedModules 负责脏标记——cache 只存有效结果
- fingerprint 下沉到 invalidation 层（M1 的 `computeInvalidatedModules` 按 changed files 推导脏集）
- cache 不做 fingerprint 比对——那是 invalidation 的职责

### §5.3 缓存范围（待定）

LoadedModule 是否缓存？CompiledModule 缓存？——讨论中。选项：

- **只缓存 CompiledModule**（现状 M2）：load 每次重做——load 便宜（parse + walk），重做可接受。
- **缓存 LoadedModule + CompiledModule**：两阶段都增量跳过，但缓存粒度更细，复杂度更高。

形状定义阶段只文档化选项，不拍板。

### §5.4 泛型化决策

现有 `ModuleResultCache` 硬绑 `CompileInfo`（logic-specific）。形状定义泛型化到 `V`——三车道各实例化 `ModuleResultCache<CompiledModule>`。形状定义只写 interface，不改现有类。

## §6 PackerOrchestrator

### §6.1 设计

```typescript
interface PackerEntry {
  entryId: string
  kind: ModuleKind
  moduleIds: string[]
}

interface OrchestrateOptions {
  parallel: boolean
  incremental: boolean
}

interface PackerOrchestrator {
  orchestrate(
    entries: PackerEntry[],
    ctx: PackerContext,
    api: Packer,
    options: OrchestrateOptions,
  ): Promise<EmitEntry[]>
}
```

### §6.2 编排职责——load 反馈循环

Orchestrator 是**唯一主动组件**。核心是 **load 阶段的反馈循环**（fixpoint computation）：

1. **load 反馈循环**：
   ```
   frontier = initial entries
   while frontier not empty:
     loaded = load(frontier)                  // parse + walk → 发现依赖
     new_deps = loaded.dependencies           // 从结果提取新依赖
     frontier = new_deps - already_visited    // 新依赖减已编
   // 依赖集稳定（fixpoint）→ 所有模块 loaded
   ```
2. **增量过滤**：查 `ctx.moduleCache` + `ctx.invalidatedModules`，跳过未失效模块（load 和/或 compile 阶段跳过）
3. **compile**：对每个 loaded 模块调 `api.compileModule(loaded, ctx)`
4. **emit**：对每个 entry 收集编译结果，调 `api.emitEntry(entryId, compiled, ctx, options)`

**反馈循环在 load 环节**——不是 compile。compile 的输入 dependencies 已在 load 确定。

### §6.3 与现有编排的关系

| 现有编排 | 级别 | → Orchestrator |
|---|---|---|
| build-pipeline | stage 级（logic→view→style 线性） | Orchestrator 是模块级（依赖驱动，非线性） |
| watch-plan | entry 级（affected entries） | Orchestrator 增量过滤是模块级 |
| 各 lane parse-walk | 模块级（lane-internal） | Orchestrator 统一三车道 load |
| worker-pool | 线程级（worker 分配） | 不归 Orchestrator——Executor 层 |

**Orchestrator 不是新概念——是把现有 stage 级编排下沉到模块级，从车道线性变依赖驱动。**

### §6.4 Orchestrator 是函数还是 class

**倾向 interface（函数契约）**，不倾向 class。理由：
- interface 更灵活——不同实现可注入（eager / lazy / parallel）
- class 持有状态会让编排逻辑和状态管理耦合
- Orchestrator 的状态（cache / graph）来自 PackerContext，不需要自持

## §7 文件落点

### §7.1 新文件

```
src/packer/
  types.ts      — 5 组件 interface 声明（PackerContext / LoadedModule+CompiledModule / Packer / ModuleResultCache / PackerOrchestrator）
  README.md     — Packer/Scheme 边界 + 现有代码映射表 + load→compile→emit 管线说明
```

### §7.2 不改的文件

- `pipeline/emit.ts`（EmitEntry / EmitModule / produceEntry 不变——Packer API 引用它们）
- `model/dependency-graph.ts`（DependencyGraph 不变——PackerContext.graph 引用它）
- `model/module-result-cache.ts`（现有类不变——形状定义的泛型 interface 是"目标"，现有类是"当前"）
- `model/invalidation.ts`（现有函数不变）
- `model/convergence.ts`（deriveFromGraph 不变——它已经是 Orchestrator 的只读雏形）
- `core/env.ts`（W3 决策：不拆）
- 三车道 parse-walk / index.ts（load 环节的现有实现，不改）

### §7.3 tsconfig

`src/packer/types.ts` 须在 tsconfig include 范围内。现有 tsconfig include 是 `src/**/*`——新目录自动包含。

## §8 风险表

| 风险 | 影响 | 缓解 |
|---|---|---|
| 形状定义后现有代码不 conform | 新类型是"北星"，现有代码不 wire——不 conform 是预期 | README 映射表明确标注"现状 vs 目标" |
| `PackerModuleMetadata` 索引签名太松 | 类型安全不足 | 文档化 lane-specific 字段；后续 Action 可收紧为判别联合 |
| Orchestrator 形状与现有 build-pipeline 差异大 | 实施时迁移路径长 | 形状定义是北星——迁移分多步，每步行为 0 |
| PackerContext 不含 Dimina 专有 → parse-walk 无法直接 conform | parse-walk 调 getComponent 等无法映射到 PackerContext | 路径 A（预计算到 metadata）或路径 B（SchemeContext 注入 Orchestrator）——实施时选 |
| 新类型引用现有类型导致循环 import | types.ts import emit.ts / dependency-graph.ts | `import type` 纯类型引用，tsc 擦除，无运行时循环 |
| load 和 compile 分离后，view 的 wxs 交织需重构 | view parse-walk 的 wxs 发现+处理目前交织 | 形状定义只定目标；实施时拆分——load 提取 wxs 内容，compile 做 replacement |

## §9 替代方案

### §9.1 PackerContext 含 Dimina 专有（否决）

packer-research 草案路径：PackerContext 含 `runtimeType` + `resolver{component/appConfig}`。

**否决理由**：Packer 不通用——知道 Dimina 组件和运行时类型。但保留为备选（若路径 A 预计算成本过高，路径 B 的 SchemeContext 可让 Orchestrator 持有 Dimina 专有引用）。

### §9.2 PackerModule 用 kind 判别联合（否决）

```typescript
type LoadedModule = LogicModule | ViewModule | StyleModule | ConfigModule
```

**否决理由**：compileModule 签名复杂（需 narrow kind）；现有 parse-walk 产出动态性高；索引签名 + 文档化更渐进友好。保留为后续收紧选项。

### §9.3 Packer API 黑盒 pack()（否决）

```typescript
interface Packer {
  pack(entries: PackerEntry[], ctx: PackerContext): Promise<EmitEntry[]>
}
```

**否决理由**：无法支持增量（loadModule/compileModule 不可单独调）和 HMR（emitEntry 不可单独调）；load 和 compile 混在一起，反馈循环无法归 load。细粒度 3 环节 API 更灵活。

### §9.4 load 和 compile 不分离（否决）

维持现有 `compileModule(module) → module` 签名（load + compile 混在一起）。

**否决理由**：发现和变换交织——反馈循环归属不清（在 compile 还是 load？）；缓存粒度不清（缓存 compile 结果还是 load+compile？）；现有 parse-walk 名字不反映"load"这个环节的独立地位。
