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

## MUST 需求

### R-PCS-1 PackerContext

MUST 定义 `PackerContext` interface，包含：
- 通用 I/O：`workPath` / `targetPath` / `readContent`
- 模块解析：`resolveAlias` / `resolveNpm`
- 文件类型：`fileTypes`（templateExts / styleExts / viewScriptExts / viewScriptTags / directivePrefixes）
- 图：`graph`（DependencyGraph 实例）
- 缓存：`moduleCache`（泛型 ModuleResultCache）
- 失效：`invalidatedModules`（Set<string>）

MUST 不含 Dimina 专有字段（`getComponent` / `getAppId` / `isMiniGame` / `getAppConfigInfo`）——这些由 Orchestrator 通过 SchemeContext 桥接，或预计算到 module metadata。

### R-PCS-2 LoadedModule + CompiledModule

MUST 定义两阶段模块类型：

**LoadedModule**（load 环节产出）：
- `moduleId: string`
- `kind: ModuleKind`（`'logic' | 'view' | 'style' | 'config'`）
- `source: string`（原始源码）
- `dependencies: string[]`（load 发现的依赖 module ID 列表）
- `metadata: PackerModuleMetadata`（load 提取的元数据）

**CompiledModule**（compile 环节产出）：
- `moduleId: string`
- `kind: ModuleKind`
- `code: string`（编译产物）
- `map: string | null`
- `dependencies: string[]`（= LoadedModule 的，确认）
- `extraInfoCode?: string`
- `metadata: PackerModuleMetadata`（透传 + compile 补充）

MUST `EmitModule`（现有，from `pipeline/emit.ts`）= CompiledModule 的子集（moduleId + code + map + extraInfoCode）——emit 只用这几个字段。

### R-PCS-3 Packer API

MUST 定义 `Packer` interface，3 环节：
- `loadModule(input: LoadInput, ctx: PackerContext): Promise<LoadedModule>` — parse + walk = 发现
- `compileModule(module: LoadedModule, ctx: PackerContext): Promise<CompiledModule>` — transform = 变换
- `emitEntry(entryId: string, modules: CompiledModule[], ctx: PackerContext, options: EmitOptions): Promise<EmitEntry>` — bundle = 装配

MUST 复用现有 `EmitEntry` 类型（from `pipeline/emit.ts`）作为 emit 输出。

MUST `LoadInput` 含 `moduleId` + `kind` + `source`（最小输入供 load 开始）。

### R-PCS-4 模块生命周期

MUST 定义模块生命周期形状：
- `ModuleResultCache<V>` 泛型化（V = CompiledModule 或 lane-specific 子类型）
- `invalidatedModules: Set<string>` 全 kind（不按 `'logic'` 过滤）
- 缓存 key 策略文档化（moduleId 还是 moduleId + fingerprint）——形状定义阶段文档化选项，实施时拍板

### R-PCS-5 PackerOrchestrator

MUST 定义 `PackerOrchestrator` interface，包含：
- `orchestrate(entries: PackerEntry[], ctx: PackerContext, api: Packer, options: OrchestrateOptions): Promise<EmitEntry[]>`
- 职责文档化：load 反馈循环（fixpoint）→ compile → emit

MUST 文档化 Orchestrator 的反馈循环语义：
1. frontier = initial entries
2. while frontier: loaded = load(frontier) → frontier = loaded.deps - visited
3. compile all loaded
4. emit entries

### R-PCS-6 Packer/Scheme 边界

MUST 在 `src/packer/README.md` 文档化：
- Packer（通用）：load（parse+walk） / compile（transform） / emit（bundle） / 缓存 / 失效 / 编排
- Scheme（Dimina 专有）：项目配置加载 / 运行时类型 / 组件树发现 / 样式隔离 / 页面分包结构
- 边界：Scheme 产 PackerEntry[] + PackerContext + 预计算 metadata；Packer 消费它们产出 EmitEntry[]

### R-PCS-7 现有代码映射

MUST 在 `src/packer/README.md` 文档化映射表：
- env.ts 27 exports → PackerContext 字段 / SchemeContext / 不迁移
- 现有 module 类型（EmitModule / CompileInfo / scriptRes / compileRes）→ LoadedModule / CompiledModule
- 现有 parse-walk（三车道）→ load 环节（Packer API.loadModule）
- 现有 transform（transformCjs / Vue compile / postcss）→ compile 环节（Packer API.compileModule）
- 现有 emit（produceEntry / emitEntry）→ emit 环节（Packer API.emitEntry）
- 现有 lifecycle（ModuleResultCache / computeInvalidatedModules）→ 模块生命周期
- 现有编排（build-pipeline / watch-plan / worker-pool）→ PackerOrchestrator

### R-PCS-8 行为 0

MUST diff=0（不改任何现有文件的行为）；vitest 608/608 绿；tsc 0 错。

### R-PCS-9 类型约束

MUST 不引入 `any` / `@ts-nocheck` / `as any`。允许 `as string | undefined` 等窄类型断言。

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
- watch 增量 / HMR / deriveFromGraph
- 改 env.ts / dependency-graph.ts / 三车道 parse-walk
- 把新类型接入现有代码（wire）
- 缓存策略最终拍板（形状定义阶段只文档化选项）
