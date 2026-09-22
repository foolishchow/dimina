# Design Draft — fe-tools-orchestrator-state

## §1 现状分析

### 1.1 graph 生命周期（per-build ephemeral）

```
build() → runWithCompilerContext(() => _runBuild())
  → storeInfo(workPath, { fileTypes, dependencyGraph })
    → const graph = new PackerGraph()       // ← 每次新建
    → graph.build() 或 restoreFromSnapshot + reconcile
    → context.graph = graph                  // 写入 ALS context
    → context.dependencyGraph = graph.getInnerGraph()
  → [Listr tasks: worker delta → context.dependencyGraph.merge(...)]
  → ALS context 销毁 → graph 丢失
```

watch rebuild: `createWatchBuildPlan({ dependencyGraph: activeStore.getDependencyGraph() })`
→ `activeStore.getDependencyGraph()` 调 `getCompilerContext().dependencyGraph`
→ 在 ALS 外 → 返回 `defaultCompilerContext.dependencyGraph`（**空图**）
→ `hasFile() = false` → 全 untracked → `incremental: false` → full rebuild

### 1.2 cache 生命周期

```
watch-runner.ts:
  const cache = new ModuleResultCache()     // 局部变量，session-scoped
  build(..., { cache })                      // 通过 options 传
  rebuild: build(..., { cache, ...plan.options })
```

单次 build（compile CLI）: 不传 cache → build-pipeline 不设 ctx.cache → 无 cache hit。

### 1.3 invalidated 生命周期

```
watch-plan.ts:
  computeInvalidatedModules(dependencyGraph, tracked)
  → plan.options.invalidatedModules = [...]
build-pipeline:
  if (invalidatedModules) ctx.invalidatedModules = invalidatedModules
```

per-rebuild 重算，通过 plan.options 传入。

### 1.4 三处散落

| 状态 | 持有者 | 生命周期 | 问题 |
|---|---|---|---|
| graph | storeInfo 内 new（ALS context） | per-build | D-PCS-3 违反 |
| cache | watch-runner 局部变量 | per-watch-session | 单次 build 无 cache |
| invalidated | watch-plan → plan.options | per-rebuild | 不在统一对象 |

## §2 目标形状

```typescript
// src/packer/types.ts §7（已定义，落地它）
interface OrchestratorState {
    graph: Graph              // 活图，session-scoped，跨 rebuild 持久
    moduleCache: ModuleResultCache  // 活 cache，session-scoped
    invalidatedModules: Set<string> // per-rebuild 重算
}

// src/packer/session-state.ts（新建）
import { PackerGraph } from './graph.ts'
import { ModuleResultCache } from '../model/module-result-cache.ts'

/**
 * session-scoped 状态：graph + cache + invalidated。
 *
 * 注意：不写 `implements OrchestratorState`——现有 ModuleResultCache class
 * 的 get/set 返回 CachedModuleResult（非 { module, dependencies }），
 * 且 size 是 getter（非 method），与 types.ts §7 interface 不兼容。
 * 接口 conformance deferred 到 ModuleResultCache 泛型化 Action。
 * 当前用结构类型——字段名与形状一致，运行时行为正确。
 */
export class PackerSessionState {
    readonly graph: PackerGraph = new PackerGraph()
    readonly moduleCache: ModuleResultCache = new ModuleResultCache()
    invalidatedModules: Set<string> = new Set()
}
```

## §3 决策详述

### D-OS-1: state 由 watch-runner 创建（可注入）

**决策**：`createBuildWatcher` 加 `state?: PackerSessionState` 可选参数。传入时用传入的（测试注入 mock）；未传入时 `new PackerSessionState()` 内部创建。state 通过 `options.state` 传入 `build()` → build-pipeline。单次 build（compile CLI）不传 state（向后兼容走旧路径）。

**理由**：
- 与现有 cache 传递模式一致（watch-runner 创建，通过 options 传）
- 单次 build 不需要跨 build 持久（只 build 一次）
- build-pipeline 检查 `options.state`，有则用 state.graph，无则走旧路径

**替代方案否决**：
- build() 内部惰性创建 state → state 不暴露给 watch-runner → watch-plan 无法读 state.graph
- ALS 持 state → D-PCS-9 说 ALS 是 pipeline-scoped，OrchestratorState 是 session-scoped，不能放 ALS
- state 不可注入 → watch-runner.spec.js 无法 mock state.graph（测试注入 mock store.getDependencyGraph 被 D-OS-3 绕过）

### D-OS-2: storeInfo 接收 options.graph

**决策**：`StoreInfoOptions` 加 `graph?: PackerGraph`。传入时用传入实例（不新建），跳过 restoreFromSnapshot。

**伪代码**：

```typescript
function storeInfo(workPath, options = {}) {
    const context = getCompilerContext()
    context.compilerOptions = normalizeFileTypes(options.fileTypes)  // step 1
    storePathInfo(workPath)                                            // step 2

    const graph = options.graph ?? new PackerGraph()  // 用传入的或新建

    if (options.dependencyGraph) {
        // watch rebuild
        // 注意：当 options.graph 存在（state 路径）时，options.dependencyGraph
        // 快照是 dead weight——storeInfo 不读它（graph 已有活数据）。
        // 保留传递是为了向后兼容（无 state 的旧路径仍需 restoreFromSnapshot）。
        if (!options.graph) {
            // 旧路径（无 state）：从快照重建旧图
            graph.restoreFromSnapshot(context.configInfo, options.dependencyGraph)
        }
        // state 路径：graph 已有数据（含 worker delta），跳过 restore
        graph.reconcile(toPackerContext(context))
    } else {
        // first build
        graph.build(toPackerContext(context))
    }

    context.graph = graph
    context.configInfo = graph.getConfigData() as ConfigInfo
    context.dependencyGraph = graph.getInnerGraph()

    return { pathInfo, configInfo, compilerOptions, dependencyGraph: graph.toJSON() }
}
```

**行为 0 分析**：
- 首次 build（无 dependencyGraph，有/无 graph）：都是 `graph.build()`，行为一样 ✅
- watch rebuild 旧路径（有 dependencyGraph，无 graph）：`new + restoreFromSnapshot + reconcile`，同旧 ✅
- watch rebuild 新路径（有 dependencyGraph，有 graph）：`state.graph + reconcile`（oldGraph = 活图）
  - 旧路径 oldGraph = 从快照重建（快照来自空 default → 空图）
  - 新路径 oldGraph = 活图（含 worker delta）
  - 差异：新路径保留了 worker delta；但 full rebuild 的 parse-walk 会重新发现同样的 edges → 输出一致 ✅

### D-OS-3: watch-plan 从 state.graph 读活图

**决策**：watch-runner 传 `dependencyGraph: state.graph` 给 `createWatchBuildPlan`（替代 `activeStore.getDependencyGraph()`）。

**理由**：
- `state.graph`（PackerGraph）实现 Graph interface（hasFile/getAffectedEntries/getFileKinds/getInvalidatedModules/toJSON），签名兼容 `createWatchBuildPlan` 的 `dependencyGraph` 参数
- `state.graph` 有上一次 build 的真实数据（含 worker delta）
- `hasFile() = true` → tracked → `incremental: true` → 增量路径生效

**行为 0 分析**：
- 旧路径：watch-plan 读空图 → full rebuild → 产物 A
- 新路径：watch-plan 读活图 → 增量 rebuild → 产物 B
- A == B 吗？增量 rebuild 只编译 affected entries，用 cache hit 跳过未变模块。未变模块的 cache 结果 = 上一次 full build 的结果 → 产物应一致 ✅
- 风险：cache hit 返回 stale 结果 → 需测试验证

### D-OS-4: cache 从 state.moduleCache 取

**决策**：watch-runner 从 `state.moduleCache` 取 cache，仍通过 `options.cache` 传 build-pipeline。build-pipeline 不改 cache 读取逻辑。

**理由**：
- 最小改动：build-pipeline 的 `if (cache) ctx.cache = cache` 不变
- cache 持有者从局部变量提升到 state.moduleCache
- 单次 build 不传 cache（行为 0 保持——无 cache hit）

### D-OS-5: PackerSessionState class

**决策**：用 class（非工厂函数），因为 OrchestratorState 是纯数据 interface，class 可加 readonly 修饰。

```typescript
export class PackerSessionState {
    readonly graph: PackerGraph = new PackerGraph()
    readonly moduleCache: ModuleResultCache = new ModuleResultCache()
    invalidatedModules: Set<string> = new Set()
}
```

## §4 伪代码

### 4.1 watch-runner.ts

```typescript
// createBuildWatcher 加 state 可选参数
export function createBuildWatcher({
    targetPath, workPath, useAppIdDir, store, state, options = {}, ...
}: { ..., state?: PackerSessionState, ... }) {
    // ...
    const activeStore = store ?? createProjectStore()
    const sessionState = state ?? new PackerSessionState()  // 注入或新建

    // first build
    buildResult = await build(targetPath, workPath, useAppIdDir, {
        ...options,
        store: activeStore,
        cache: sessionState.moduleCache,  // ← 从 state 取
        state: sessionState,               // ← 传 state
    })

    // rebuild
    rebuild: async (change) => {
        const plan = createWatchBuildPlan({
            changedFiles: change.changedFiles,
            dependencyGraph: sessionState.graph,  // ← 活图（替代 activeStore.getDependencyGraph()）
            workPath,
            publishedPath,
        })
        if (plan.skip) return
        // ...
        const result = await build(targetPath, workPath, useAppIdDir, {
            ...options,
            store: activeStore,
            cache: sessionState.moduleCache,  // ← 从 state 取
            state: sessionState,               // ← 传 state
            ...plan.options,
        })
    }
}
```

### 4.2 build-pipeline.ts

```typescript
// 需新增 import
import { PackerSessionState } from '../../packer/session-state.ts'

// _runBuild 解构加 state（需同步更新 runOptions 类型 cast）
const { ..., cache, invalidatedModules, skipMaterialize, state } = runOptions as {
    // ... 现有字段 ...
    cache?: unknown
    invalidatedModules?: string[]
    skipMaterialize?: boolean
    state?: PackerSessionState  // ← 新增
}

// state 需加入 serializableOptions 排除列表（同 store/lifecycle/dependencyGraph）
const { dependencyGraph: _graphPayload, lifecycle: _lifecyclePayload, store: _storeRef,
         state: _stateRef,  // ← 新增：防止 PackerSessionState 泄漏到 lifecycle.emit payload
         targetPath: _t, workPath: _w, useAppIdDir: _u, ...serializableOptions } = runOptions

// '收集配置信息' task
const graph = state?.graph  // 从 state 取 graph（可能 undefined → 走旧路径）
;(ctx).storeInfo = _store.load(workPath, { fileTypes, dependencyGraph, graph })
```

### 4.3 storeInfo（见 D-OS-2 伪代码）

## §5 风险

| 风险 | 缓解 |
|---|---|
| watch rebuild 增量路径产出 ≠ 全量产出 | V-OS-3 验证：watch rebuild 产物 vs 全量产物 diff=0 |
| cache hit 返回 stale 结果 | cache key = moduleId（不含 fingerprint），reconcile 后图更新 → invalidatedModules 驱逐 dirty |
| `state.graph` 的 reconcile 合入旧 worker delta 导致图膨胀 | reconcile 的 removeStale 删除不在新 config 的 entries；merge 只加 edges 不加 nodes |
| watch-runner.spec.js mock 测例需更新 | state 可注入 → 测试注入 mock state.graph（替代 mock store.getDependencyGraph）；PS2 测例改为验证 sessionState.graph 被读 |

## §6 不在本 Action 范围

- PackerOrchestrator（§8）— 后续 Action
- load/compile 分离 — 后续 Action
- PackerContext 落地路 2 — 后续 Action
- computeInvalidatedModules 泛化全 kind — deferred (`fe-tools-incremental-unify`)
- NpmResolver 进 PackerContext — 讨论调度器时定
