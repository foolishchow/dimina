# Technical Design — fe-tools-packer-orchestrator

Status: **complete（2026-09-22）** — D-OR-0..8 已实施并闭合。

权威参考：[Experience-Review.md](../../../../Experience-Review.md) · [packer types §8](../../../../../fe/tools/bundler/src/packer/types.ts) · [orchestrator-state](../fe-tools-orchestrator-state/README.md)

## §0 现状

```text
CLI / runOnce ──► build-pipeline.run ──► stages + stage-channel
watch-runner ──► watch-plan ──► build-pipeline.run ──► 同上
                      ▲
              PackerSessionState（graph/cache 已 session 化）
```

`PackerOrchestrator` 仅有 interface，无实现。今日 `build` 返回 buildResult（含 `appId` / `buildModel` 等）。

## §1 目标接线（D-OR-5 P2 + D-OR-8）

```text
公开 build / runOnce（入口适配器，D-OR-8）
  → state = options.state ?? new PackerSessionState()
  → store / lifecycle / paths 解析
  → orch.orchestrate(ctxFields…, state, OrchestrateOptions)
  → 透传 buildResult（D-OR-7）

watch-runner
  → 长活 sessionState
  → plan → OrchestrateOptions（D-OR-6）
  → 同一 orch.orchestrate(…, sessionState, options)
  → 透传 buildResult

orch.orchestrate
  → runWithCompilerContext（内部包，迁自 pipeline）
  → 原 build-pipeline 过程体（init + 三车道 + publish）
  → graph.build | reconcile；硬编码三车道；mergeDelta + cache 写
  → return buildResult

build-pipeline.ts → 删除或无编排逻辑的过渡 re-export（本门结束前双脑清零）
```

## §2 与形状的关系

| 形状 | 本门 |
| --- | --- |
| `orchestrate(ctx, state, options)` | **实现**（吃下今日 pipeline 体） |
| 返回 `Promise<EmitEntry[]>` | **本门不强制**（D-OR-7：返回 buildResult；收敛另门） |
| 3 registry 真表驱动 | stub / 硬编码三车道（D-OR-2） |
| 通用 worker 按 kind 选 Loader/Compiler/Emitter | **不做**（仍用现有 engines） |
| F-3 per-lane 并行 | **保持**；`parallel` 默认 `true` |
| F-4 emit 时机 | **保持** logic delayed；view/style 仍 streaming |
| `OrchestrateOptions` | **M1 扩展**（D-OR-6，含 `skipMaterialize`） |

## §3 落点

| 组件 | 变更方向 |
| --- | --- |
| `src/packer/orchestrator.ts`（+ 可选 steps） | **持有**原 pipeline 过程体；`runWithCompilerContext`；返回 buildResult |
| `src/index.ts` `build` / `runBuild` | **仅入口适配器**（D-OR-8）；透传 buildResult |
| `session/*` | `runOnce` → 适配路径；`.dev` 的 `skipMaterialize` 进 options |
| `watch/watch-runner.ts` | → `orchestrate`；plan → `OrchestrateOptions`；**停传** `cache` / `dependencyGraph` 快照 |
| `pipeline/build-pipeline.ts` | **删或死 shim** |
| `pipeline/stage-channel.ts` | merge/cache 由 orch 发起；可降为工具函数 |
| `src/packer/types.ts` | 扩展 `OrchestrateOptions`（D-OR-6）；返回类型字面 `EmitEntry[]` **可暂留**，实现不强制 `implements` |

## §4 行为 0

- 不改三车道 parse-walk / transform / emit 字符串语义
- 不改今日增量过滤集合的计算规则（只改谁调用）
- 公开返回值字段对消费方可用（至少 `appId`；既有 `buildModel` 等保持）
- `.dev` / `skipMaterialize` 与今日一致
- 验证：examples diff + watch rebuild + vitest

## §5 单次 state（D-OR-4）

```text
runOnce / 公开 build
  → state = options.state ?? new PackerSessionState()
  → orch.orchestrate(..., state, { incremental:false, parallel:true, ... })
  → 返回后丢弃（不挂 Bundler Session）

watch
  → sessionState 长活于 createBuildWatcher.start()..stop()
```

公开 `build(options)` **认** `options.state?: PackerSessionState`（测例注入）；从 lifecycle 可序列化载荷中剥离（与今日剥 `state` 同策略）。

## §6 pipeline → orch（D-OR-5 P2）

过程体搬家，不是包一层。公开 `build` 可留文件名，脑在 orch。

## §7 OrchestrateOptions（D-OR-6 M1）

```ts
// 既有
parallel: boolean          // 默认 true
incremental: boolean
configChanged: boolean     // ↔ plan：.json 变化 → 全量

// 本门最小扩展
affectedEntries?: string[]
stages?: string[]
invalidatedModules?: string[]
seedPath?: string
prepareConfig?: boolean
prepareNpm?: boolean
skipMaterialize?: boolean  // .dev / session 行为 0
```

**不进 options**：`dependencyGraph` toJSON；`cache`（改读 `state.moduleCache`）。

| 场景 | options 要点 |
| --- | --- |
| 单次 / 全量 | `incremental:false`；`parallel:true`；`configChanged:false`；集合省略；prepare* 对齐今日默认 |
| watch 增量 | plan 填齐扩展字段；`incremental:true`；`configChanged:false` |
| watch json/未追踪 → 全量 | `incremental:false`；`configChanged:true`（json）或未追踪时 `configChanged:false` 仍全量（对齐今日 plan 空 options） |
| `.dev` | `skipMaterialize` 按今日 `!previewAdapter` 语义由 session 填入 |

## §8 装配边界（D-OR-8）

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| 入口适配器（`build`/`runOnce`） | `state` / `store` / `lifecycle` / paths / `useAppIdDir` / fileTypes；组 `OrchestrateOptions`；调 orch；透传 buildResult | Listr；`runWithCompilerContext`；mergeDelta；写 cache；传 `options.cache` |
| `PackerOrchestrator` | `runWithCompilerContext`；过程体；graph 触发；stage 派发；merge/cache 写；返回 buildResult | 创建 Bundler Session；决定 watch 是否 listen |
| watch-runner | 长活 state；plan→options；调 orch | 自建第二套 pipeline |

**cache 唯一权威**：`state.moduleCache`。适配器与 watch **禁止**再旁路传入独立 `cache` 实例（与 state 脱节）。

**非 Options 通道（冻）**：`store` / `lifecycle` / `useAppIdDir` 及今日 `run` 已有、非增量控制面的同类参数 **不进** `OrchestrateOptions`。随迁入 orch 的内部调用面保留——允许：

1. `createPackerOrchestrator` / 适配器持有 orch，经闭包或实例字段注入 store/lifecycle；或
2. orch 私有方法签名扩参（等价于今日 `pipeline.run({...})`）；

**禁止**为此再开 M2 legacy 第二袋。orch **每调用 new 或模块单例均可**。

形状字面 `orchestrate(ctx, state, options)`：本门以过程体归位为先；`ctx` 可在 ALS 内由 `toPackerContext` 取得（对齐今日），不要求适配器先构造完整 plain `PackerContext`。

## §9 返回值（D-OR-7）

```text
orch.orchestrate → buildResult（今日字段）
公开 build / watch.start / rebuild → 同一对象透传
形状 EmitEntry[] → 另门收敛；本门可不 implements PackerOrchestrator
```

## §10 Review 收口

Readiness 缺口与 residual 已冻入 D-OR-6..8。**complete（2026-09-22）**。
