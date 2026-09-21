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

## §3 讨论

### Q-1: configInfo 归属

storeAppConfig/storePageConfig 写 configInfo（ALS 全局状态）。Graph.build 也要写 configInfo 吗？还是 Graph 内部持有？

**倾向**：Graph 内部持有 `configData`（appInfo / pageInfo / componentInfo / runtimeType）。ALS getter（getComponent 等）改为从 Graph 读。但 ALS context 是 per-pipeline 的，Graph 是 session-scoped——生命周期不匹配。

**问题**：ALS getter 在 worker 内也调（worker 从 storeInfo 快照重建 ALS）。Graph 在主线程持有，worker 没有 Graph 实例。

**倾向**：storeInfo 瘦身后仍把 configData 快照写入 ALS（给 worker 用），但 config fixpoint 逻辑在 Graph 里。storeInfo = PackerContext + configData 快照（从 Graph 取）。

### Q-2: getter 从哪读

getComponent / getAppConfigInfo / isMiniGame 从 ALS 读 configInfo。Graph 持有 configData 后，这些 getter 从哪读？

**倾向**：ALS context 加 `graphConfigData` 字段。storeInfo 从 Graph 取 configData 写入 ALS。getter 从 ALS 读（不变）。worker 从 storeInfo 快照恢复 ALS（不变）。

### Q-3: watch graph merge

watch rebuild 的 graph merge 逻辑（storeInfo 内 `options.dependencyGraph` 合并 + 删旧 entry）搬到哪里？

**倾向**：搬入 `reconcile(ctx)`。reconcile 做：重做 config fixpoint + merge old source edges + 删旧 entry。

### Q-4: createInitialDependencyGraph 自洽

createInitialDependencyGraph 读 configInfo.componentInfo 建 graph。Graph 自己持有 configInfo 后，build 内部自洽？

**倾向**：是的。build 内部先读 app.json → 发现组件 → 再建图——configData 和 graph 都在 Graph 内部，不依赖 ALS。

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
