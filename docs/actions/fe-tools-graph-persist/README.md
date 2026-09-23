# FE Tools Graph Persist

- Action: `fe-tools-graph-persist`
- Status: `draft`
- Updated: 2026-10-07
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-orchestrator-state`](../_archive/complete/fe-tools-orchestrator-state/README.md)（**complete**；PackerSessionState 持 graph + cache + invalidated）
- 前置：[`fe-tools-packer-context`](../_archive/complete/fe-tools-packer-context/README.md)（**complete**；config fixpoint 迁入 PackerGraph）
- 工作分支：`feature/fe-tools-sidecar`

## Background

### 问题：watch rebuild 时 graph 被 `build()` 全量重建，source-level edges 丢失

`storeInfo`（`env.ts`）用 `options.dependencyGraph` 判断走 reconcile 还是 build：

```typescript
const graph = options.graph ?? new PackerGraph()
if (options.dependencyGraph) {
    // Watch rebuild → reconcile（保留旧图 source edges）
    graph.reconcile(ctx)
} else {
    // First build → build fresh
    graph.build(ctx)
}
```

watch-runner **有意不传** `dependencyGraph` 快照（`D-OR-6/8：不传 cache / dependencyGraph 快照`），因为 `state.graph` 已持有活图。但 `storeInfo` 用 `options.dependencyGraph` 判断分支——没传 → `graph.build()` → **活图的 source-level edges 被全量覆盖**。

### 连锁后果

1. **cached 模块的图边丢失**：logic cache hit 时跳过 parse-walk → 不调 `addDependency` → source edges 不补 → 图不完整 → 下次 rebuild `computeAffectedEntries` / `computeInvalidatedModules` 在不完整图上跑 → 漏算
2. **增量基础不成立**：图不持久 → invalidated 算不出 → cache 永远全量 miss → `incremental-unify` 无法生效

### reconcile 设计已就位

`PackerGraph.reconcile(ctx)` 已实现（D-GB-3）：

```typescript
reconcile(ctx): void {
    const oldGraph = this.graph    // 保存旧图
    this.build(ctx)                // 重新 config fixpoint → fresh graph
    this.graph.merge(oldGraph)     // 合入旧图 source-level edges
    // 删除 stale entries
}
```

reconcile 在首次 build 时等价于 build（merge 空 old graph = no-op）。watch rebuild 时保留旧 source edges。**逻辑已就位，只是没走到。**

## Goal

修复 `storeInfo` 分支条件，使 state 路径（`options.graph` 传入）走 `reconcile` 而非 `build`。

## Non-goals

- fingerprints 持久化（G2，另门）
- `getInvalidatedModules` 泛化全 kind（G3，另门）
- view/style 模块级 cache（G4/G5 = incremental-unify，等本门完成后重激活）
- stale edge 清理（非 cached 模块 deps 变化后的旧边残留）
- 跨进程持久（cross-process / dev-server restart）
- load/compile 分离

## Design inputs

- [Experience-Review.md](../../Experience-Review.md) §12 行为 0 全量验证
- [`fe-tools-orchestrator-state`](../_archive/complete/fe-tools-orchestrator-state/README.md)（PackerSessionState）
- [`fe-tools-packer-context`](../_archive/complete/fe-tools-packer-context/README.md)（config fixpoint + reconcile）
- `src/compiler/core/env.ts`（`storeInfo` 分支逻辑）
- `src/packer/graph.ts`（`build` / `reconcile`）
- `src/watch/watch-runner.ts`（rebuild 传参）

## Deliverables

- `src/compiler/core/env.ts`：`storeInfo` 分支条件修正——`options.graph` 传入时走 `reconcile`
- `src/packer/graph.ts`：如有需要，reconcile 对空图（首次 build）的 no-op 安全性验证

## Requirements

- [requirements.md](requirements.md)

## Technical design

- [technical-design.md](technical-design.md)

## Implementation plan

- [implementation-plan.md](implementation-plan.md)

## Acceptance

- [acceptance.md](acceptance.md)

## Validation

- [validation.md](validation.md)

## Readiness gaps

- 无；reconcile 逻辑已实现（D-GB-3），只需修正 `storeInfo` 分支条件。

## Closure conditions

- A-GP1..4 全部 [x]；
- 首次 build diff=0（reconcile on empty = build）；
- vitest 全绿（含 watch-runner.spec.js D-OS-3 测试）；
- 回流 architecture-notes。
