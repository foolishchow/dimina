# Design Draft — fe-tools-graph-bootstrap

> 本文件是设计草稿，非正式文档。用于讨论 Q-1..Q-4 后产出正式 technical-design。

## §1 现状分析

### §1.1 storeInfo 的 6 步

```typescript
// env.ts storeInfo()
function storeInfo(workPath, options = {}) {
  const context = getCompilerContext()           // ALS
  context.compilerOptions = normalizeFileTypes(options.fileTypes)  // 步 1: PackerContext
  storePathInfo(workPath)                        // 步 2: PackerContext
  storeProjectConfig()                           // 步 3: 读 project.config.json → configInfo
  storeAppConfig()                               // 步 4: 读 app.json → configInfo.appInfo + runtimeType
  storePageConfig()                              // 步 5: 递归组件 → configInfo.pageInfo/componentInfo
  context.dependencyGraph = createInitialDependencyGraph()  // 步 6: 建图（读 configInfo）
  if (options.dependencyGraph) {                 // watch merge
    context.dependencyGraph.merge(options.dependencyGraph)
    // ... reconcile logic（删旧 entry）
  }
  return { pathInfo, configInfo, compilerOptions, dependencyGraph: toJSON() }
}
```

### §1.2 ALS 依赖图

```
storeInfo 写:
  context.compilerOptions  ← 步 1
  context.pathInfo         ← 步 2
  context.configInfo       ← 步 3-5
  context.dependencyGraph  ← 步 6

ALS getter 读:
  getComponent(path)       → configInfo.componentInfo[path]
  getAppConfigInfo()       → configInfo.appInfo
  getRuntimeType()         → configInfo.runtimeType
  isMiniGame()             → configInfo.runtimeType === MINI_GAME
  getDependencyGraph()      → context.dependencyGraph
  getWorkPath()             → pathInfo.workPath
```

### §1.3 调用方

| 调用方 | 位置 | 用途 |
|---|---|---|
| build-pipeline | pipeline/build-pipeline.ts `_runBuild` | 第一 build——storeInfo 全量 |
| watch-plan | watch/watch-plan.ts `createWatchBuildPlan` | watch rebuild——storeInfo + options.dependencyGraph merge |
| resetStoreInfo | env.ts | worker 重建 ALS——从快照恢复 |

## §2 target 形状

```typescript
// src/packer/graph.ts
import type { Graph, PackerContext, GraphSnapshot } from './types.ts'
import type { GraphSnapshot as DepGraphSnapshot } from '../model/dependency-graph.ts'
import { DependencyGraph } from '../model/dependency-graph.ts'

export class PackerGraph implements Graph {
  private graph: DependencyGraph
  private configData: GraphConfigData  // appInfo / pageInfo / componentInfo / runtimeType

  build(ctx: PackerContext): void {
    // 步 3-6 自包含
    this.configData = this.readAppConfig(ctx.workPath)       // 步 3-4
    this.discoverComponents(ctx.workPath)                     // 步 5
    this.graph = this.createInitialGraph(ctx)                // 步 6
  }

  reconcile(ctx: PackerContext): void {
    // 重新 config fixpoint + 保留 source edges
    const oldGraph = this.graph
    this.build(ctx)
    // merge old source-level edges...
  }

  mergeDelta(delta: GraphSnapshot): void {
    this.graph.merge(delta)
  }

  toJSON(): GraphSnapshot { return this.graph.toJSON() }

  // 查询委托
  getEntries() { return this.graph.getEntries() }
  getFileOwners(id: string) { return this.graph.getFileOwners(id) }
  // ...

  // ALS getter 兼容
  getComponent(path: string) { return this.configData.componentInfo[path] }
  getAppConfigInfo() { return this.configData.appInfo }
  getRuntimeType() { return this.configData.runtimeType }
  isMiniGame() { return this.configData.runtimeType === MINI_GAME }
}
```

## §3 决策（已拍板）

### D-GB-1: configInfo 归属——Graph 持有，ALS 持 Graph 引用（路 1 过渡态）

Graph 内部持有 configData（appInfo / pageInfo / componentInfo / runtimeType）。ALS context 持 Graph 引用（不再存原始 configInfo）。

```typescript
// ALS context 变化：
// 现在: { pathInfo, configInfo, compilerOptions, dependencyGraph, npmResolver }
// 改后: { pathInfo, compilerOptions, npmResolver, graph: PackerGraph }
//
// D-PCS-6 说 graph 不在 PackerContext——接口契约层不违反。
// 实现层 ALS 持引用是过渡态（路 1），后续路 2（显式传参）是终极。
```

行为 0：getter 返回值不变，数据源从 ALS configInfo 变成 Graph。

### D-GB-2: getter 读取——全局 getter 委托 Graph，签名不变

```typescript
// env.ts — getter 实现改，签名不变
function getComponent(path: string) {
  return packerALS.get().graph.getComponent(path)
}
function getDependencyGraph() {
  return packerALS.get().graph.getInnerGraph()  // 返回 DependencyGraph
}
function getAppConfigInfo() {
  return packerALS.get().graph.getAppConfigInfo()
}
function getRuntimeType() {
  return packerALS.get().graph.getRuntimeType()
}
function isMiniGame() {
  return packerALS.get().graph.isMiniGame()
}
```

调用方不改——签名全不变。Worker：resetStoreInfo 重建 PackerGraph（从快照），getter 委托到本地 Graph。

### D-GB-3: watch graph merge——搬入 PackerGraph.reconcile(ctx)

现有 storeInfo 的 merge 逻辑（记录 fresh entries → merge old graph → 删除 stale entries）搬入 reconcile：

```typescript
// PackerGraph
reconcile(ctx: PackerContext): void {
  // 1. 重做 config fixpoint → freshGraph（读 app.json → 递归 → 建图）
  // 2. merge old source-level edges（从 this.graph 合入 freshGraph）
  // 3. 删除 stale entries（不在新 config 里的旧 entry）
  // 4. this.graph = freshGraph
}
```

storeInfo 不再做 merge——只调 `graph.reconcile(ctx)` 或 `graph.build(ctx)`。

### D-GB-4: build 自洽——内部先读 config 建 configData，再从 configData 建图

```typescript
// PackerGraph
build(ctx: PackerContext): void {
  // 步 3: 读 project.config.json → runtimeType
  // 步 4: 读 app.json → configData.appInfo
  // 步 5: 递归发现组件 → configData.pageInfo + componentInfo
  // 步 6: 从 configData 建图（不再从 ALS configInfo 读）
  this.configData = this.readConfig(ctx.workPath)    // 步 3-5
  this.graph = this.buildGraph(ctx, this.configData)  // 步 6
}
```

不依赖 ALS configInfo 预填——build 从 ctx.workPath 读文件。configData 是 Graph 内部状态。D-PCS-4 满足。

## §4 伪代码

```typescript
// build-pipeline.ts _runBuild
// 现状: ctx.storeInfo = store.load(workPath, { fileTypes, dependencyGraph })
// target:
const graph = state.graph  // OrchestratorState.session.graph
if (!options.incremental) {
  graph.build(ctx)           // 首次：config fixpoint
} else if (options.configChanged) {
  graph.reconcile(ctx)       // .json 变了：reconcile
}
// storeInfo 仍调（写 ALS I/O + configData 快照），但步 3-6 委托 Graph
store.load(workPath, { fileTypes, graph })  // 瘦身后的 storeInfo

// env.ts storeInfo 瘦身后
function storeInfo(workPath, options = {}) {
  const context = getCompilerContext()
  context.compilerOptions = normalizeFileTypes(options.fileTypes)  // 步 1
  storePathInfo(workPath)                        // 步 2
  // 步 3-6 不在 storeInfo 里——由 graph.build/reconcile 做了
  // 但 ALS 需要 configData 快照给 getter 用
  if (options.graph) {
    context.configInfo = options.graph.getConfigData()  // 从 Graph 取快照
    context.dependencyGraph = options.graph  // ALS 也持有 graph 引用（getter 兼容）
  }
  return { pathInfo, configInfo, compilerOptions, dependencyGraph: context.dependencyGraph.toJSON() }
}
```

## §5 风险

| 风险 | 缓解 |
|---|---|
| ALS getter 签名不变但数据源变了 | configData 快照写入 ALS，getter 读 ALS 不变 |
| worker 没有 Graph 实例 | storeInfo 快照含 configData，worker 重建 ALS 从快照读 |
| storeInfo 和 graph.build 的调用顺序 | build-pipeline 先调 graph.build 再调 storeInfo（storeInfo 从 Graph 取快照） |
| 行为 0 难度——config fixpoint 逻辑搬家可能改变执行顺序 | 逐步迁移：先提取逻辑到 Graph，再改调用方 |
