# Requirements — fe-tools-graph-persist

Status: **draft（2026-10-07）**

## 问题

`storeInfo`（`env.ts`）用 `options.dependencyGraph` 判断走 `reconcile` 还是 `build`。watch-runner 有意不传 `dependencyGraph` 快照（D-OR-6/8），因为 `state.graph` 已持有活图。但 `storeInfo` 没检查 `options.graph` → 走 `build()` → source-level edges 全量丢失。

## 需求

### R-GP-1（MUST）— state 路径走 reconcile

`storeInfo` 在 `options.graph` 传入时（state 路径）调 `reconcile` 而非 `build`。reconcile 保留旧图 source-level edges（D-GB-3: build + merge old + remove stale）。

依据：`PackerGraph.reconcile` 已实现；首次 build 时 reconcile 等价于 build（merge 空 old graph = no-op）。

### R-GP-2（MUST）— 首次 build 行为 0

`storeInfo` 修正后，首次 build（空图 reconcile）产物与修正前（`build()`）字节完全一致。全量 7 项目 diff=0。

依据：reconcile on empty graph = build + merge empty = build。行为不变。

### R-GP-3（MUST）— watch rebuild 图完整性

修正后，watch rebuild 后 `state.graph` 保留上一次 build 的 source-level edges（含 cached 模块的边）。vitest 全绿（回归）。注意：watch-runner.spec.js mock 了 `store.load` → 不直接验证 reconcile 路径；watch rebuild 图完整性由代码审阅 + 首次 build diff=0 间接验证。

依据：cached 模块跳过 parse-walk → 不补边 → 依赖 reconcile 保留旧边。

### R-GP-4（MUST）— 旧路径（无 state）不受影响

`options.dependencyGraph` 传入但 `options.graph` 未传入的旧路径（restoreFromSnapshot + reconcile）不受影响。

依据：向后兼容；不破坏非 state 调用方。

## 约束

- 行为 0 原则：首次 build 产物字节完全不变。
- 不改 `PackerGraph.build` / `reconcile` 逻辑（已正确）。
- 不改 watch-runner 传参（D-OR-6/8 有意不传 dependencyGraph 快照）。
- 不加 `any` / `as any` / `@ts-nocheck` / `[key: string]`。

## Non-scope

- fingerprints 持久化（G2）
- `getInvalidatedModules` 泛化全 kind（G3）
- view/style 模块级 cache（G4/G5 = incremental-unify）
- stale edge 清理
- 跨进程持久
- load/compile 分离
