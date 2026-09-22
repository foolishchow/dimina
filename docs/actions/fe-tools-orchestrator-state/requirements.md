# Requirements — fe-tools-orchestrator-state

## R-OS-1 — OrchestratorState 实现类

MUST 创建 `src/packer/session-state.ts`，定义 `export class PackerSessionState`。

- 持有 `graph: PackerGraph`（session-scoped，跨 rebuild 持久）
- 持有 `moduleCache: ModuleResultCache`（session-scoped）
- 持有 `invalidatedModules: Set<string>`（per-rebuild 重算）
- 不写 `implements OrchestratorState`——现有 ModuleResultCache class 的 get/set 返回 CachedModuleResult（非 `{ module, dependencies }`）且 size 是 getter（非 method），与 types.ts §7 interface 不兼容。接口 conformance deferred 到 ModuleResultCache 泛型化 Action。当前用结构类型——字段名与形状一致。

依据：D-PCS-3（graph 长期持有）, D-PCS-6（PackerContext + OrchestratorState 拆区）, D-PCS-9（OrchestratorState session-scoped）。

## R-OS-2 — storeInfo 接收 options.graph

MUST `storeInfo` 接收 `options.graph`（PackerGraph 实例）。

- 传入 `options.graph` 时：用传入的实例（不 `new PackerGraph()`）
- 未传入时：向后兼容，`new PackerGraph()`（单次 build 场景）
- `StoreInfoOptions` 加 `graph?: PackerGraph` 字段

依据：D-OS-2, D-PCS-3（graph 跨 build 复用而非重建）。

## R-OS-3 — watch rebuild 不再 restoreFromSnapshot

MUST watch rebuild 用 `state.graph.reconcile()` 复用旧图。

- 当 `options.graph` 传入（从 state）且 `options.dependencyGraph` 存在时：跳过 `restoreFromSnapshot`（graph 已有数据），直接 `reconcile`
- 当 `options.graph` 未传入且 `options.dependencyGraph` 存在时：旧路径（restoreFromSnapshot + reconcile）

依据：D-OS-2, D-PCS-3（graph 不靠 ALS 活着）。

## R-OS-4 — watch-runner 创建 state

MUST watch-runner 在 session start 创建 `PackerSessionState`（或注入）。

- `createBuildWatcher` 加 `state?: PackerSessionState` 可选参数
- 传入时用传入的（测试注入 mock）；未传入时 `new PackerSessionState()` 内部创建
- 首次 build：`state.graph` 是新实例（`new PackerGraph()`），storeInfo 调 `graph.build()`
- watch rebuild：`state.graph` 已有上一次 build 的数据（含 worker delta），storeInfo 调 `graph.reconcile()`
- state 通过 `options.state` 传给 `build()` → build-pipeline
- cache 从 `state.moduleCache` 取，仍通过 `options.cache` 传

依据：D-OS-1, D-OS-4, D-PCS-9（session-scoped）。

## R-OS-5 — watch-plan 从 state.graph 读活图

MUST watch-plan 从 `state.graph` 读活图。

- watch-runner 传 `dependencyGraph: state.graph` 给 `createWatchBuildPlan`（替代 `activeStore.getDependencyGraph()`）
- `state.graph` 实现 Graph interface（hasFile/getAffectedEntries/getFileKinds/getInvalidatedModules/toJSON），签名兼容
- `plan.options.dependencyGraph = state.graph.toJSON()` 变为活图快照（而非空 default 快照）

依据：D-OS-3, D-PCS-3（graph 跨 build 持久 → watch-plan 能看到真实图 → 增量路径生效）。

## R-OS-6 — 行为 0

MUST 行为不变。

- 单次 build：7 examples 全 diff=0（graph 是新实例，逻辑同旧）
- watch rebuild：产物与 full rebuild 一致（增量路径产出 = 全量产出）
- vitest 全绿（608+，含 watch-runner.spec.js mock 测例）

依据：行为 0 原则。

## R-OS-7 — 类型约束

MUST 不引入 `any` / `as any` / `@ts-nocheck` / `[key: string]: unknown`。

依据：ts-migration 纪律。
