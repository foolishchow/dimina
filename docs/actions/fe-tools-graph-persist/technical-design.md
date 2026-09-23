# Technical Design — fe-tools-graph-persist

Status: **draft（2026-10-07）**

权威参考：[Experience-Review.md](../../Experience-Review.md) · [orchestrator-state](../_archive/complete/fe-tools-orchestrator-state/README.md) · [packer-context](../_archive/complete/fe-tools-packer-context/README.md)

## 1. 现状代码

### storeInfo 分支逻辑（env.ts:202-212）

```typescript
const graph = options.graph ?? new PackerGraph()
if (options.dependencyGraph) {
    // Watch rebuild
    if (!options.graph) {
        graph.restoreFromSnapshot(context.configInfo, options.dependencyGraph)
    }
    // state 路径：graph 已有数据（含 worker delta），跳过 restore
    graph.reconcile(toPackerContext(context))
} else {
    // First build: build fresh
    graph.build(toPackerContext(context))
}
```

### watch-runner rebuild 传参（watch-runner.ts:117-121）

```typescript
const result = await build(targetPath, workPath, useAppIdDir, {
    ...options,
    store: activeStore,
    state: sessionState,        // ← state.graph 持活图
    ...plan.options,            // ← 不含 dependencyGraph 快照
})
```

### 时序分析

```
首次 build:
  options.graph = state.graph (new PackerGraph, 空)
  options.dependencyGraph = undefined
  → else → graph.build(ctx)  ← 正确（空图）

Watch rebuild:
  options.graph = state.graph (有 config + source edges)
  options.dependencyGraph = undefined  ← 没传
  → else → graph.build(ctx)  ← 🔴 全量重建！source edges 丢失
```

## 2. 设计

### D-GP-1: storeInfo 分支条件修正

用 `options.graph` 判断 state 路径（是否走 reconcile）：

```typescript
const graph = options.graph ?? new PackerGraph()
if (options.graph) {
    // State 路径：graph 是 state 持有的活图实例
    // 首次 build: reconcile on empty = build + merge empty = build（等价）
    // Watch rebuild: reconcile 保留旧图 source-level edges
    graph.reconcile(toPackerContext(context))
} else if (options.dependencyGraph) {
    // 旧路径（无 state）：从快照重建旧图 → reconcile
    graph.restoreFromSnapshot(context.configInfo, options.dependencyGraph)
    graph.reconcile(toPackerContext(context))
} else {
    // 无 state 无快照：首次 build fresh
    graph.build(toPackerContext(context))
}
```

依据：R-GP-1（state 路径走 reconcile）+ R-GP-4（旧路径不受影响）。

### D-GP-2: 首次 build 安全性

reconcile 对空图的等价性：

```typescript
reconcile(ctx): void {
    const oldGraph = this.graph    // 空 DependencyGraph
    this.build(ctx)                // fresh config fixpoint → this.graph = new DependencyGraph
    this.graph.merge(oldGraph)     // merge 空 graph → addNode/addDependency no-op（空 nodes/edges）
    // remove stale: freshEntryIds 包含所有 entries → 无 stale
}
```

结果 = `build()` + merge no-op + remove stale no-op = `build()`。行为不变。✅

依据：R-GP-2（行为 0）。

### D-GP-3: watch rebuild 图完整性

修正后 watch rebuild 流程：

```
1. reconcile(ctx)
   ├─ oldGraph = state.graph (上次 config + source edges)
   ├─ build(ctx) → fresh config graph
   ├─ merge(oldGraph) → 旧 source edges 保留
   └─ remove stale entries

2. compile stages run
   ├─ cached modules: 跳过 parse-walk → 旧 source edges 保留（reconcile 保留）
   └─ non-cached modules: parse-walk → worker delta → mergeDelta 补新边

3. 结果：state.graph 有 config + 旧 source edges + 新 source edges
```

cached 模块的 source edges 不再丢失。图完整。✅

依据：R-GP-3。

### D-GP-4: 旧路径不受影响

`options.graph` 未传入但 `options.dependencyGraph` 传入 → 走 `else if` 分支（restoreFromSnapshot + reconcile）。与修正前逻辑一致。✅

**注**：当前无生产/测试调用方走此路径——`dependencyGraph` 在 `ORCH_OPTION_KEYS` 中，`build()` 不传给 `orchestrate()` → `storeInfo` 不收到。保留为向后兼容。

## 3. 不改什么

- `PackerGraph.build` / `reconcile` 逻辑（已正确）。
- watch-runner 传参（D-OR-6/8 有意不传 dependencyGraph 快照）。
- `StoreInfoOptions` 接口签名。
- stage-channel / mergeDelta 逻辑。
- logic cache hit 路径（cached 模块跳过 parse-walk）。
- fingerprints / getInvalidatedModules / view-style cache（另门）。

## 4. 交付物

| 文件 | 变更 |
|---|---|
| `src/compiler/core/env.ts` | `storeInfo` 分支条件：`if (options.graph)` → reconcile；`else if (options.dependencyGraph)` → restore+reconcile；`else` → build |

## 5. 验收映射

| 设计 | 需求 | 验收 |
|---|---|---|
| D-GP-1 分支修正 | R-GP-1 | A-GP1 |
| D-GP-2 首次 build 等价 | R-GP-2 | A-GP2 |
| D-GP-3 watch rebuild 图完整 | R-GP-3 | A-GP3 |
| D-GP-4 旧路径不变 | R-GP-4 | A-GP4 |
