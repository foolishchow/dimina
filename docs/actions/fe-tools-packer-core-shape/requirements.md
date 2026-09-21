# Requirements — fe-tools-packer-core-shape

## 问题

Packer 形状没定，后续方向都在猜：

- **watch 增量**：模块缓存形状（key、value、序列化）依赖 PackerModule 定义；现在做要猜，Parker 形状定了要返工
- **HMR**：patch 接口依赖 Packer API 定义；现在做要猜
- **deriveFromGraph**：从图推导模块集依赖 PackerModule + PackerContext 形状；MC3a 已有雏形但未正式化

`fe-tools-packer-research` 回答了"抽取是否值得"（不值得立即做），但没回答"Packer 长什么样"。本 Action 回答这个问题——定义形状契约，不做物理抽取。

## MUST 需求

### R-PCS-1 PackerContext

MUST 定义 `PackerContext` interface，包含：
- 通用 I/O：`workPath` / `targetPath` / `readContent`
- 模块解析：`resolveAlias` / `resolveNpm`
- 文件类型：`fileTypes`（templateExts / styleExts / viewScriptExts / viewScriptTags / directivePrefixes）
- 图：`graph`（DependencyGraph 实例）
- 缓存：`moduleCache`（泛型 ModuleResultCache）
- 失效：`invalidatedModules`（Set<string>）

MUST 不含 Dimina 专有字段（`getComponent` / `getAppId` / `isMiniGame` / `getAppConfigInfo`）——这些由 Orchestrator 通过 SchemeContext 桥接，或预计算到 PackerModule.metadata。

### R-PCS-2 PackerModule

MUST 定义 `PackerModule` interface，包含：
- `moduleId: string`
- `kind: ModuleKind`（`'logic' | 'view' | 'style' | 'config'`）
- `code: string`
- `map: string | null`
- `dependencies: string[]`（模块 ID 列表）
- `extraInfoCode?: string`
- `metadata: PackerModuleMetadata`（lane-specific，文档化每种 kind 的字段）

### R-PCS-3 Packer API

MUST 定义 `Packer` interface，包含：
- `compileModule(module: PackerModule, ctx: PackerContext): Promise<PackerModule>`
- `emitEntry(entryId: string, modules: PackerModule[], ctx: PackerContext, options: EmitOptions): Promise<EmitEntry>`

MUST 复用现有 `EmitEntry` / `EmitModule` 类型（from `pipeline/emit.ts`）作为兼容基础。

### R-PCS-4 模块生命周期

MUST 定义模块生命周期形状：
- `ModuleResultCache<V>` 泛型化（V = PackerModule 或 lane-specific 子类型）
- `invalidatedModules: Set<string>` 全 kind（不按 `'logic'` 过滤）
- 缓存 key 策略文档化（moduleId 还是 moduleId + fingerprint）

### R-PCS-5 PackerOrchestrator

MUST 定义 `PackerOrchestrator` interface，包含：
- `orchestrate(entries: PackerEntry[], ctx: PackerContext, api: Packer, options: OrchestrateOptions): Promise<EmitEntry[]>`
- 职责文档化：发现 → 排序 → 增量跳过 → 编译 → 发射 → 跨车道协调

### R-PCS-6 Packer/Scheme 边界

MUST 在 `src/packer/README.md` 文档化：
- Packer（通用）：模块标识 / 模块图 / transform / 模块产出 / 缓存 / 失效 / 编排
- Scheme（Dimina 专有）：项目配置加载 / 运行时类型 / 组件树发现 / 样式隔离 / 页面分包结构
- 边界：Scheme 产 PackerEntry[] + PackerContext + 预计算 metadata；Packer 消费它们产出 EmitEntry[]

### R-PCS-7 现有代码映射

MUST 在 `src/packer/README.md` 文档化映射表：
- env.ts 27 exports → PackerContext 字段 / SchemeContext / 不迁移
- 现有 module 类型（EmitModule / CompileInfo / scriptRes / compileRes）→ PackerModule
- 现有 API（produceEntry / emitEntry / parse-walk）→ Packer API
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
- 实现编译/发射逻辑
- watch 增量 / HMR / deriveFromGraph
- 改 env.ts / dependency-graph.ts / 三车道 parse-walk
- 把新类型接入现有代码（wire）
