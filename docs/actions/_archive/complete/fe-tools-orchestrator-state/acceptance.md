# Acceptance — fe-tools-orchestrator-state

## A-OS-1 — OrchestratorState 实现类（R-OS-1, D-OS-5, D-PCS-3, D-PCS-6, D-PCS-9）

- [x] `src/packer/session-state.ts` 含 `export class PackerSessionState`
- [x] 持有 `graph: PackerGraph`（session-scoped）
- [x] 持有 `moduleCache: ModuleResultCache`（session-scoped）
- [x] 持有 `invalidatedModules: Set<string>`（per-rebuild）
- [x] 不写 `implements OrchestratorState`（ModuleResultCache class 与 types.ts interface 不兼容；conformance deferred）

## A-OS-2 — storeInfo 接收 options.graph（R-OS-2, D-OS-2）

- [x] `StoreInfoOptions` 加 `graph?: PackerGraph` 字段
- [x] build-pipeline 从 runOptions 解构 `state`，将 `state?.graph` 传给 `store.load`
- [x] 传入 `options.graph` 时用传入实例（不 `new PackerGraph()`）
- [x] 未传入时向后兼容（`new PackerGraph()`）
- [x] 传入 `options.graph` 且有 `options.dependencyGraph` 时跳过 `restoreFromSnapshot`

## A-OS-3 — watch rebuild 用 state.graph.reconcile（R-OS-3, D-OS-2, D-PCS-3）

- [x] watch rebuild 时 `state.graph` 已有上一次 build 的数据
- [x] storeInfo 调 `graph.reconcile()`（不调 `restoreFromSnapshot`）
- [x] graph 跨 rebuild 持久（同一 PackerGraph 实例）
- [x] worker delta（source-level edges）跨 build 保留

## A-OS-4 — watch-runner 创建 state（R-OS-4, D-OS-1, D-OS-4）

- [x] watch-runner 在 session start 创建 `PackerSessionState`（或注入）
- [x] `createBuildWatcher` 加 `state?: PackerSessionState` 可选参数
- [x] state 通过 `options.state` 传给 `build()` → build-pipeline
- [x] cache 从 `state.moduleCache` 取
- [x] 单次 build（compile CLI）不传 state（向后兼容）

## A-OS-5 — watch-plan 从 state.graph 读活图（R-OS-5, D-OS-3）

- [x] watch-runner 传 `dependencyGraph: state.graph` 给 `createWatchBuildPlan`
- [x] `state.graph` 签名兼容 `createWatchBuildPlan` 的 `dependencyGraph` 参数
- [x] `hasFile()` 返回真实结果（非空图）→ 增量路径可生效

## A-OS-6 — 行为 0（R-OS-6）

- [x] 单次 build：7 examples 全 diff=0
- [x] watch rebuild：产物与 full rebuild 一致
- [x] vitest 全绿（608+，含 watch-runner.spec.js）

## A-OS-7 — 类型约束（R-OS-7）

- [x] 无 `any` / `as any` / `@ts-nocheck`
- [x] 无 `[key: string]: unknown` 索引签名
