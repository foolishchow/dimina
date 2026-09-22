# Requirements — fe-tools-graph-bootstrap

## 问题

`env.ts storeInfo()` 做了 6 件事（步 1-2 = PackerContext，步 3-6 = Graph 逻辑）：

```
storeInfo(workPath, options):
  1. normalizeFileTypes(options.fileTypes)     → compilerOptions     // PackerContext
  2. storePathInfo(workPath)                   → pathInfo            // PackerContext
  3. storeProjectConfig()                      → configInfo          // Graph: 读 project.config.json
  4. storeAppConfig()                          → configInfo.appInfo  // Graph: 读 app.json + detectRuntimeType
  5. storePageConfig()                         → configInfo.pageInfo // Graph: 递归组件树
  6. createInitialDependencyGraph()           → dependencyGraph     // Graph: 建图 + 扫文件
```

步 3-6 是 config fixpoint（D-PCS-2: Graph 的逻辑），但：
- 散在 4 个独立函数中（`storeProjectConfig` / `storeAppConfig` / `storePageConfig` / `createInitialDependencyGraph`）
- 和 ALS 全局状态深度耦合（`configInfo` 写在 ALS context 上）
- `createInitialDependencyGraph` 读 `configInfo.componentInfo`（步 5 的产物）——步 5 和步 6 无法独立

形状 D-PCS-4 要求 `graph.build(ctx)` 自包含。现状不满足。

## 核心概念：config fixpoint

```
graph.build(ctx):
  读 project.config.json → detectRuntimeType（miniProgram vs game）
  读 app.json → 发现 pages + subPackages
  读 page.json → 发现 usingComponents → 递归发现 components
  扫文件 → addNode + addFile + addDependency
  → 项目结构完成（entries + file ownership + component edges）
```

这是一层 fixpoint：从 JSON 配置递归推导项目结构。变化条件：.json 变更。

## 决策输入（from core-shape）

| 决策 | 内容 | 约束 |
|---|---|---|
| D-PCS-1 | storeInfo 只剩 paths+fileTypes = PackerContext | 步 1-2 留 env.ts，步 3-6 搬 Graph |
| D-PCS-2 | graph 推导逻辑自包含 | config fixpoint 全归 Graph.build |
| D-PCS-3 | graph 由 Orchestrator 触发，长期持有 | build-pipeline 调 graph.build，不在 storeInfo |
| D-PCS-4 | Graph 自己 bootstrap | build(ctx) 直接读 app.json，无中间数据 |
| D-PCS-6 | PackerContext(I/O) + OrchestratorState(graph+cache) 拆区 | graph 不在 ALS 里 |

## 本 Action 决策

| 决策 | 内容 |
|---|---|
| D-GB-1 | configInfo 归属：Graph 内部持有 configData，ALS 持 Graph 引用（路 1 过渡态）|
| D-GB-2 | getter 读取：全局 getter 委托 Graph，签名不变 |
| D-GB-3 | watch merge：搬入 PackerGraph.reconcile(ctx) |
| D-GB-4 | build 自洽：内部先读 config 建 configData，再从 configData 建图 |

## MUST 需求

### R-GB-1 Graph 实现类（D-GB-1, D-GB-4）

MUST 创建 `src/packer/graph.ts`，`export class PackerGraph implements Graph`（Graph interface from `types.ts`）。
MUST 在 `types.ts` 定义 `GraphConfigData` 类型（ConfigInfo 的类型安全子集，无 `[key: string]: unknown` 索引签名——D-PCS-10）。

MUST 实现全部 Graph interface 方法：
- `build(ctx: PackerContext): void` — config fixpoint
- `reconcile(ctx: PackerContext): void` — 配置变更重做 fixpoint
- `mergeDelta(delta: GraphSnapshot): void` — 合并 worker source delta
- `toJSON(): GraphSnapshot` — 序列化
- `getEntries()` / `getFileOwners()` / `getAffectedEntries()` / `getInvalidatedModules()` / `hasFile()` / `getFileKinds()` — 查询（委托现有 DependencyGraph）

### R-GB-2 build(ctx) 自包含（D-GB-4）

MUST `build(ctx)` 从 `ctx.workPath` 直接读 app.json → 递归发现组件 → 扫文件 → 建图。
MUST 不依赖外部 `configInfo` 预先填充——Graph 内部持有 config 数据。

### R-GB-3 reconcile(ctx)（D-GB-3）

MUST `reconcile(ctx)` 处理配置变更：重做 config fixpoint + 保留不变的 source-level edges。
MUST watch rebuild 的 graph merge 逻辑（现有 storeInfo 内 `options.dependencyGraph` 合并）由 reconcile 承接。

### R-GB-4 storeInfo 瘦身（D-GB-1, D-GB-4）

MUST `storeInfo` 瘦身为只设 PackerContext（步 1-2：paths + fileTypes）。
MUST 调用方（build-pipeline / watch-plan）改为调 `graph.build(ctx)` 或 `graph.reconcile(ctx)`。
MUST build-pipeline 需 CompilerContext→PackerContext adapter（bridge ALS ctx 到 Graph interface 签名——见 design.draft §4）。
MUST PackerGraph 提供 `getConfigData()` 方法，供 storeInfo 取 configData 快照写入 ALS。

### R-GB-5 ALS 兼容（D-GB-2）

MUST 现有 ALS getter（`getComponent` / `getAppConfigInfo` / `getRuntimeType` / `isMiniGame` 等）不改签名。
MUST 这些 getter 的调用方不改。
MUST `resetStoreInfo` 实现变更为重建 PackerGraph（从 configInfo + dependencyGraph 快照），签名不变——调用方（emit-engine.ts）不改。
MUST PackerGraph 提供 `restoreFromSnapshot(configData, graphSnapshot)` 方法供 worker 重建（不调 build，不重读 app.json）。

### R-GB-6 行为 0

MUST diff=0（产物完全相同）。
MUST vitest 全绿。
MUST tsc 0 错。

### R-GB-7 类型约束

MUST 不引入 `any` / `as any` / `@ts-nocheck`。
MUST 不用 `[key: string]: unknown` 索引签名。

## SHOULD

- R-GB-8 SHOULD PackerGraph 内部委托现有 DependencyGraph 类（不重新实现图数据结构）
- R-GB-9 SHOULD config 数据（appInfo / pageInfo / componentInfo）由 Graph 持有，ALS getter 从 Graph 读（D-GB-1, D-GB-2）

## 约束

- tsconfig: `noUnusedLocals` / `strict` / `module: NodeNext` / `allowImportingTsExtensions`
- 现有 DependencyGraph 类不改名、不改签名
- env.ts 不拆（D-W3）——Graph 是新模块
- 三车道 parse-walk / transform / emit 不改

## 非范围

- load / compile / emit 逻辑实现
- Orchestrator 实现
- watch 增量（view/style moduleCache）——另开 Action `fe-tools-incremental-unify`
- Packer 形状类型全量 wire
- env.ts 物理拆分

## TODO

- Q-1..Q-4 已拍板为 D-GB-1..4（见 design.draft.md §3）
