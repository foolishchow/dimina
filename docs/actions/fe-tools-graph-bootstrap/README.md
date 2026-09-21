# FE Tools Graph Bootstrap

- Action: `fe-tools-graph-bootstrap`
- Status: `draft`
- Updated: 2026-09-21
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-packer-core-shape`](../_archive/complete/fe-tools-packer-core-shape/README.md)（**complete 已归档**；Packer core 6 组件形状定义——Graph interface 契约）
- 前身：[`fe-tools-packer-lifecycle-audit`](../_archive/complete/fe-tools-packer-lifecycle-audit/README.md)（**complete 已归档**；F-1..F-6 关键发现）
- 工作分支：`feature/fe-tools-sidecar`

## 背景

`fe-tools-packer-core-shape`（complete 归档）定义了 Graph 的北星契约（D-PCS-2, D-PCS-3, D-PCS-4）：

- **D-PCS-2**: graph 推导逻辑自包含（build / reconcile / mergeDelta）
- **D-PCS-4**: Graph 自己 bootstrap——build(ctx) 直接从 ctx.workPath 读 app.json

但现状是 `env.ts storeInfo()` 做了 6 件事：

| 步 | storeInfo 内 | 形状归属 |
|---|---|---|
| 1 | `normalizeFileTypes(options.fileTypes)` | PackerContext.fileTypes ✅ |
| 2 | `storePathInfo(workPath)` | PackerContext.workPath/targetPath ✅ |
| 3 | `storeProjectConfig()` | **Graph（读 project.config.json）** |
| 4 | `storeAppConfig()` | **Graph（读 app.json + detectRuntimeType）** |
| 5 | `storePageConfig()` | **Graph（递归发现组件树）** |
| 6 | `createInitialDependencyGraph()` | **Graph（建图 + 扫文件）** |

步 3-6 全是 Graph 的逻辑，但散落在 env.ts 中，和 ALS context 深度耦合。`storeAppConfig` 写 `configInfo.appInfo`，`storePageConfig` 写 `configInfo.pageInfo/componentInfo`，`createInitialDependencyGraph` 读 `configInfo` 建 graph。

**问题**：config fixpoint 逻辑（读 app.json → 递归组件 → 扫文件 → 建图）分散在 env.ts 的 4 个函数中，和 ALS 隐式状态耦合。形状定义了 Graph.build(ctx) 应自包含这些逻辑，但现状不是。

## 目标

**将 config fixpoint 逻辑从 env.ts storeInfo 迁入 Graph**——让 Graph 实现形状契约的 `build(ctx)` / `reconcile(ctx)`。

## 非目标

- 不实现 load / compile / emit 逻辑（Loader / Compiler / Emitter）
- 不实现 Orchestrator
- 不拆 env.ts（D-W3: env.ts 不拆——Graph 是新模块，env.ts 继续提供 ALS I/O）
- 不改三车道 parse-walk / transform / emit
- 不把所有 Packer 形状类型 wire 到现有代码
- 不改 watch 增量逻辑（view/style 模块级增量另开 Action）

## 设计输入

- [`fe-tools-packer-core-shape`](../_archive/complete/fe-tools-packer-core-shape/README.md) — Graph interface 契约（D-PCS-2, D-PCS-3, D-PCS-4）
- [`fe-tools-packer-lifecycle-audit`](../_archive/complete/fe-tools-packer-lifecycle-audit/source-audit.md) — §2 第一 build / §4 watch rebuild / §5 graph 生命周期 / F-1 ALS-backed / F-2 graph 跨线程
- env.ts `storeInfo()` 实现（6 步）
- `model/dependency-graph.ts` — DependencyGraph 类（现有实现）

## 交付物

1. `src/packer/graph.ts` — Graph 实现类（implements shape's Graph interface）
2. env.ts storeInfo 瘦身——步 3-6 改为调 `graph.build(ctx)`
3. ALS 兼容——storeAppConfig/storePageConfig/createInitialDependencyGraph 逻辑搬入 Graph，ALS 仍提供 I/O
4. 行为 0——产物 diff=0，vitest 全绿

## Requirements

- R-GB-1 MUST 创建 `src/packer/graph.ts`，实现 Graph interface（from `types.ts`）
- R-GB-2 MUST `graph.build(ctx)` 自包含 config fixpoint（读 app.json → 递归组件 → 扫文件 → 建图）
- R-GB-3 MUST `graph.reconcile(ctx)` 处理配置变更（重新 config fixpoint + reconcile）
- R-GB-4 MUST storeInfo 瘦身为只设 PackerContext（paths + fileTypes），调 graph.build
- R-GB-5 MUST ALS 兼容——现有 getComponent / getAppConfigInfo / getRuntimeType 等 getter 不改签名
- R-GB-6 MUST 行为 0（diff=0 + vitest 全绿 + tsc 0 错）
- R-GB-7 MUST 不引入 `any` / `as any` / `[key: string]: unknown`

## Readiness gaps

- Q-1: storeAppConfig/storePageConfig 写 configInfo（ALS 全局状态）。Graph.build 也要写 configInfo 吗？还是 Graph 内部持有 configInfo？
- Q-2: getComponent / getAppConfigInfo / isMiniGame 等 getter 从 ALS 读 configInfo。Graph 持有 configInfo 后，这些 getter 从哪读？
- Q-3: watch rebuild 的 graph merge 逻辑（storeInfo 内 `options.dependencyGraph` 合并）搬到哪里？
- Q-4: `createInitialDependencyGraph` 读 `configInfo.componentInfo` 建 graph。Graph 自己持有 configInfo 后，build 内部自洽？

## Closure conditions

- R-GB-1..7 全 passed
- behavior 0（diff=0 + vitest 全绿）
- Graph 实现 conforms to shape interface
