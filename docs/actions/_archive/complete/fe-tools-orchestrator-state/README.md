# FE Tools Orchestrator State

- Action: `fe-tools-orchestrator-state`
- Status: `complete`
- Updated: 2026-09-22
- Status authority: [Action Status](../../../STATUS.md)
- 前置：[`fe-tools-graph-bootstrap`](../fe-tools-graph-bootstrap/README.md)（**complete 已归档**；PackerGraph 落地——config fixpoint 路 1 过渡态）
- 前置：[`fe-tools-packer-core-shape`](../fe-tools-packer-core-shape/README.md)（**complete 已归档**；OrchestratorState 形状契约 §7）
- 前身：[`fe-tools-module-result-cache`](../fe-tools-module-result-cache/README.md)（**complete 已归档**；M2 ModuleResultCache logic-only）
- 工作分支：`feature/fe-tools-sidecar`

## 背景

graph-bootstrap 完成后，PackerGraph 已落地（路 1 过渡态）。但 **D-PCS-3 违反**：PackerGraph 每次 `storeInfo()` 新建 → ephemeral，不跨 build 持久。

### 三处散落状态

| 状态 | 现在在哪 | 生命周期 | 问题 |
|---|---|---|---|
| graph | `storeInfo()` 内 `new PackerGraph()` | **per-build** | D-PCS-3 违反：graph 应 session-scoped |
| cache | `watch-runner.ts` 局部变量 | per-watch-session | 单次 build 无 cache；不在统一对象里 |
| invalidated | `watch-plan` 每次 `computeInvalidatedModules` 重算 | per-rebuild | 通过 `plan.options` 传入 |

### 关键发现：watch 模式 graph 丢失

`activeStore.getDependencyGraph()` 在 ALS 外调用 → 返回 `defaultCompilerContext.dependencyGraph`（初始空图，storeInfo 只更新 ALS context 不更新 default）。所以 **watch rebuild 实际都是 full rebuild**——plan 看到 `hasFile() = false` → untracked → `incremental: false`。

worker parse-walk 发现的 source-level edges（require/@import）也在 ALS context 销毁后丢失。

## 目标

**把 graph + cache + invalidated 三处散落状态收敛为一个 session-scoped 的 `OrchestratorState`，让 graph 跨 rebuild 长期存活（D-PCS-3）。**

具体：
1. 创建 `PackerSessionState`（定义 class，结构类型匹配 OrchestratorState 形状——不 `implements`，conformance deferred）——持有活 graph + 活 cache + invalidated 集
2. watch-runner 创建 state，跨 rebuild 持有
3. storeInfo 接收 `options.graph`（从 state 来），不新建 PackerGraph
4. watch rebuild 用 `state.graph.reconcile()` 复用旧图（不再 restoreFromSnapshot 重建）
5. watch-plan 从 `state.graph` 读活图（而非从空 defaultCompilerContext 读）

## 非目标

- 不实现 PackerOrchestrator（§8，后续 Action）
- 不做 load/compile 分离（后续 Action）
- 不做 PackerContext 落地路 2（graph.build 从 ctx.readContent 读，后续 Action）
- 不泛化 computeInvalidatedModules 全 kind（deferred: `fe-tools-incremental-unify`）
- 不改三车道 parse-walk / transform / emit 逻辑

## 交付物

1. `src/packer/session-state.ts` — PackerSessionState class
2. `src/compiler/core/env.ts` — storeInfo 接收 options.graph
3. `src/compiler/pipeline/build-pipeline.ts` — 从 state.graph 传给 store.load
4. `src/watch/watch-runner.ts` — 创建 state，传 cache + state + state.graph 给 watch-plan

## Requirements

- R-OS-1 MUST 创建 `src/packer/session-state.ts`，定义 `PackerSessionState` class（结构类型匹配 OrchestratorState 形状，不 `implements`）
- R-OS-2 MUST storeInfo 接收 `options.graph`（PackerGraph 实例），传入时不新建
- R-OS-3 MUST watch rebuild 用 `state.graph.reconcile()`（不再 restoreFromSnapshot 重建旧图）
- R-OS-4 MUST watch-runner 创建 state（session start），跨 rebuild 持有
- R-OS-5 MUST watch-plan 从 `state.graph` 读活图（而非空 defaultCompilerContext）
- R-OS-6 MUST 行为 0（单次 build diff=0 + watch rebuild 产物一致 + vitest 全绿）
- R-OS-7 MUST 不引入 `any` / `as any` / `[key: string]: unknown`

## 决策汇总

| 决策 | 内容 |
|---|---|
| D-OS-1 | state 由 watch-runner 创建（可注入）；createBuildWatcher 加 state? 可选参数，未传入时内部 new；通过 options.state 传入 build-pipeline；单次 build 不传 |
| D-OS-2 | storeInfo 接收 options.graph；传入时用传入实例（不新建），跳过 restoreFromSnapshot |
| D-OS-3 | watch-plan 从 state.graph 读活图（替代 activeStore.getDependencyGraph() 读空 default） |
| D-OS-4 | cache 从 state.moduleCache 取，仍通过 options.cache 传 build-pipeline（不改读取逻辑） |
| D-OS-5 | PackerSessionState class：graph + moduleCache + invalidatedModules（new PackerGraph() + new ModuleResultCache() + new Set()） |

## Closure conditions

- R-OS-1..7 全 passed
- behavior 0（单次 build 7 examples diff=0 + watch rebuild 产物一致 + vitest 全绿）
- PackerSessionState 字段与 OrchestratorState 形状一致（结构类型，不 `implements`——ModuleResultCache class conformance deferred）
