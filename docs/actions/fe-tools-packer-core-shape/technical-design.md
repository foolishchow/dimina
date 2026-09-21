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
| D-ER-5 | produceEntry 从 emitEntry 提取 | Packer API 复用 produceEntry/emitEntry 签名 |
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
| EmitModule / EmitEntry | pipeline/emit.ts | PackerModule / EmitEntry |
| deriveFromGraph | model/convergence.ts | Orchestrator 雏形（只读版） |
| build-pipeline | pipeline/build-pipeline.ts | Orchestrator（stage 级） |
| watch-plan | watch/watch-plan.ts | Orchestrator（entry 级） |
| worker-pool | watch/worker-pool.ts | Executor（不归 Packer） |

## §1 PackerContext

### §1.1 设计

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
  moduleCache: ModuleResultCache<PackerModule>

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

### §1.2 Dimina 专有字段不进 PackerContext

env.ts 层 2（`getComponent` / `getAppConfigInfo` / `getAppId` / `isMiniGame`）不进 PackerContext。两条路径：

**路径 A（预计算到 metadata）**：Scheme 层在发现阶段调 env.ts 拿到 component config / appId / runtimeType，嵌入 PackerModule.metadata。Packer 编译时只读 metadata，不调 env.ts。

**路径 B（SchemeContext 注入 Orchestrator）**：Orchestrator 持有 `SchemeContext`（含 getComponent / getAppId / isMiniGame），在编排时调 Scheme 层查询，结果传给 Packer API。

**本设计倾向路径 A**（预计算）——Packer 真正通用，不持有任何 Dimina 引用。路径 B 作为备选（Orchestrator 可同时持 PackerContext + SchemeContext）。

### §1.3 与 packer-research 草案的差异

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

## §2 PackerModule

### §2.1 设计

```typescript
type ModuleKind = 'logic' | 'view' | 'style' | 'config'

interface PackerModule {
  moduleId: string
  kind: ModuleKind
  code: string
  map: string | null
  dependencies: string[]
  extraInfoCode?: string
  metadata: PackerModuleMetadata
}

interface PackerModuleMetadata {
  sourcePath: string
  // View-specific（view parse-walk 产出）
  wxsBindings?: WxsBinding[]
  renderBody?: { start: number; end: number }
  // Style-specific
  styleScopeId?: string
  // Logic-specific
  // (extraInfoCode 在公共字段)
  // 允许 lane-specific 扩展
  [key: string]: unknown
}
```

### §2.2 与现有类型的映射

| 现有类型 | 字段 | → PackerModule 字段 |
|---|---|---|
| `EmitModule` | moduleId, code, map, extraInfoCode | moduleId, code, map, extraInfoCode |
| `CompileInfo` | path, code, map, extraInfoCode | moduleId(=path), code, map, extraInfoCode |
| `ModuleCompileCacheEntry` | instruction.scriptModule | metadata.wxsBindings 等 |
| `CachedModuleResult` | compileInfo, logicDependencies | code/map/extraInfoCode + dependencies |

### §2.3 metadata 形状决策

**采用 `[key: string]: unknown` 索引签名 + 文档化 lane-specific 字段**，不用 kind 判别联合。理由：
- 判别联合会让 compileModule 的类型签名复杂化（需 narrow kind）
- 现有 view parse-walk 的 metadata 字段动态性高（wxsBindings 结构复杂）
- 索引签名允许渐进类型化（先文档化，后续可收紧）

## §3 Packer API

### §3.1 设计

```typescript
interface Packer {
  compileModule(module: PackerModule, ctx: PackerContext): Promise<PackerModule>
  emitEntry(entryId: string, modules: PackerModule[], ctx: PackerContext, options: EmitOptions): Promise<EmitEntry>
}

interface EmitOptions {
  transform: EmitTransformConfig & { strategy: string }
  sourcemap: boolean
  sourcemapTargetPath: string | null
  filename: string
  relPrefix: string
}
```

### §3.2 粒度决策

选择 **细粒度**（compileModule + emitEntry），不选黑盒 `pack(entries)`。理由：
- 黑盒无法支持增量（watch 需要只调 compileModule 跳过未失效的）
- 黑盒无法支持 HMR（HMR 需要只调 emitEntry 发一个 entry 的 patch）
- 细粒度让 Orchestrator 有编排空间

### §3.3 与现有 API 的关系

- `compileModule` ≈ 现有 `logicParseWalk` + `transformCjs`（logic）/ `viewParseWalk`（view）/ `styleParseWalk`（style）的抽象
- `emitEntry` ≈ 现有 `produceEntry` / `emitEntry`（from emit.ts），签名兼容

## §4 模块生命周期

### §4.1 设计

```typescript
// M2 已有，泛型化形状
interface ModuleResultCache<V = PackerModule> {
  get(moduleId: string): { module: V; dependencies: string[] } | undefined
  set(moduleId: string, result: { module: V; dependencies: string[] }): void
  has(moduleId: string): boolean
  delete(moduleId: string): void
  clear(dirtyIds: Iterable<string>): void
  size(): number
}

// M1 已有，泛化形状（不再 kind='logic' 过滤）
// computeInvalidatedModules 的返回类型
type InvalidatedModules = Set<string>
```

### §4.2 缓存 key 策略

**cache key = moduleId**（不含 fingerprint）。理由：
- M1 invalidatedModules 负责脏标记——cache 只存有效结果
- fingerprint 下沉到 invalidation 层（M1 的 `computeInvalidatedModules` 按 changed files 推导脏集）
- cache 不做 fingerprint 比对——那是 invalidation 的职责

### §4.3 泛型化决策

现有 `ModuleResultCache` 硬绑 `CompileInfo`（logic-specific）。形状定义泛型化到 `V`——三车道各实例化：
- logic: `ModuleResultCache<PackerModule>`
- view: `ModuleResultCache<PackerModule>`
- style: `ModuleResultCache<PackerModule>`

**注意**：形状定义只写 interface，不改现有 `ModuleResultCache` 类（那是实施 Action 的事）。

## §5 PackerOrchestrator

### §5.1 设计

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

### §5.2 编排职责

Orchestrator 是**唯一主动组件**，5 个编排步骤：

1. **发现**：从 entries + graph 遍历，收集所有待编模块（含跨车道依赖）
2. **增量过滤**：查 `ctx.moduleCache` + `ctx.invalidatedModules`，跳过未失效模块
3. **排序**：按依赖关系拓扑排序（跨车道——view 的 wxs 依赖 logic 模块 → logic 先编）
4. **编译**：对每个待编模块调 `api.compileModule(module, ctx)`
5. **发射**：对每个 entry 收集编译结果，调 `api.emitEntry(entryId, modules, ctx, options)`

### §5.3 与现有编排的关系

| 现有编排 | 级别 | → Orchestrator |
|---|---|---|
| build-pipeline | stage 级（logic→view→style 线性） | Orchestrator 是模块级（依赖驱动，非线性） |
| watch-plan | entry 级（affected entries） | Orchestrator 增量过滤是模块级 |
| 各 lane parse-walk | 模块级（lane-internal） | Orchestrator 统一三车道发现 |
| worker-pool | 线程级（worker 分配） | 不归 Orchestrator——Executor 层 |

**Orchestrator 不是新概念——是把现有 stage 级编排下沉到模块级，从车道线性变依赖驱动。**

### §5.4 Orchestrator 是函数还是 class

**倾向 interface（函数契约）**，不倾向 class。理由：
- interface 更灵活——不同实现可注入（eager / lazy / parallel）
- class 持有状态会让编排逻辑和状态管理耦合
- Orchestrator 的状态（cache / graph）来自 PackerContext，不需要自持

## §6 文件落点

### §6.1 新文件

```
src/packer/
  types.ts      — 5 组件 interface 声明
  README.md     — Packer/Scheme 边界 + 现有代码映射表
```

### §6.2 不改的文件

- `pipeline/emit.ts`（EmitEntry / EmitModule / produceEntry 不变——Packer API 引用它们）
- `model/dependency-graph.ts`（DependencyGraph 不变——PackerContext.graph 引用它）
- `model/module-result-cache.ts`（现有类不变——形状定义的泛型 interface 是"目标"，现有类是"当前"）
- `model/invalidation.ts`（现有函数不变）
- `model/convergence.ts`（deriveFromGraph 不变——它已经是 Orchestrator 的只读雏形）
- `core/env.ts`（W3 决策：不拆）
- 三车道 parse-walk / index.ts

### §6.3 tsconfig

`src/packer/types.ts` 须在 tsconfig include 范围内。现有 tsconfig include 是 `src/**/*`——新目录自动包含。

## §7 风险表

| 风险 | 影响 | 缓解 |
|---|---|---|
| 形状定义后现有代码不 conform | 新类型是"北星"，现有代码不 wire——不 conform 是预期 | README 映射表明确标注"现状 vs 目标" |
| `PackerModuleMetadata` 索引签名太松 | 类型安全不足 | 文档化 lane-specific 字段；后续 Action 可收紧为判别联合 |
| Orchestrator 形状与现有 build-pipeline 差异大 | 实施时迁移路径长 | 形状定义是北星——迁移分多步，每步行为 0 |
| PackerContext 不含 Dimina 专有 → parse-walk 无法直接 conform | parse-walk 调 getComponent 等无法映射到 PackerContext | 路径 A（预计算到 metadata）或路径 B（SchemeContext 注入 Orchestrator）——实施时选 |
| 新类型引用现有类型导致循环 import | types.ts import emit.ts / dependency-graph.ts | `import type` 纯类型引用，tsc 擦除，无运行时循环 |

## §8 替代方案

### §8.1 PackerContext 含 Dimina 专有（否决）

packer-research 草案路径：PackerContext 含 `runtimeType` + `resolver{component/appConfig}`。

**否决理由**：Packer 不通用——知道 Dimina 组件和运行时类型。但保留为备选（若路径 A 预计算成本过高，路径 B 的 SchemeContext 可让 Orchestrator 持有 Dimina 专有引用）。

### §8.2 PackerModule 用 kind 判别联合（否决）

```typescript
type PackerModule = LogicModule | ViewModule | StyleModule | ConfigModule
```

**否决理由**：compileModule 签名复杂（需 narrow kind）；现有 parse-walk 产出动态性高；索引签名 + 文档化更渐进友好。保留为后续收紧选项。

### §8.3 Packer API 黑盒 pack()（否决）

```typescript
interface Packer {
  pack(entries: PackerEntry[], ctx: PackerContext): Promise<EmitEntry[]>
}
```

**否决理由**：无法支持增量（compileModule 不可单独调）和 HMR（emitEntry 不可单独调）。细粒度 API 更灵活。
