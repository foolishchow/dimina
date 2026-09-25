# Design Draft — fe-tools-packer-facade-collaborator

Status: **draft（2026-10-09）**

## §1 问题诊断（来自 [retrospect](../../fe-tools/2026-10-09-packer-facade-aspect-retrospect.md) F-PA-1）

`_orchestrate`（orchestrator.ts:103-366）是 god object：
- 6 类业务活内联（R-FC-1 表）+ 4 registry 公开返回（orchestrator.ts:84-88）+ OrchestrateRequest 20+ 字段透传
- 北星 `PackerOrchestrator.orchestrate(ctx, state, options) → EmitEntry[]`（types.ts:386-393）未落地——实际 `_orchestrate(request: OrchestrateRequest) → Record<string, unknown>`
- orchestrator.ts:13 自承"不写 implements PackerOrchestrator（返回值与形状 EmitEntry[] 张力，D-OR-7）"

根因（retrospect §2）：类型层（types.ts 北星 facade+aspect+strategy）与运行层（orchestrator+ALS+Listr+mutable bag）双轨——类型层是文档，god object 活在运行层。

## §2 设计门（draft 提议，formalize 待锁）

### D-FC-1 — collaborator 抽取（logic 搬迁，非包壳）

6 collaborator 抽取（R-FC-1 表），每 collaborator 拥有完整业务逻辑（含 sctx 字段设置 + lifecycle 事件 + 错误处理）。orchestrator task body 仅 `await collaborator.run(sctx, deps...)`。

**rigor 红线**：collaborator 须搬入真实逻辑。验：`grep 'await.*collaborator.run' orchestrator.ts` 非 0 + collaborator 文件含原 orchestrator 逻辑体（git diff -M rename + 逻辑体搬迁，非新建空壳）。

**collaborator 接口形状**（types.ts 声明）：
```ts
interface BuildCollaborator {
  run(sctx: StageChannelContext, deps: CollaboratorDeps): Promise<void>
}
interface CollaboratorDeps {
  store: ProjectStore
  state: PackerSessionState
  lifecycle: Lifecycle
  dispatchRegistry: PackerDispatchRegistry
  loaderRegistry: LoaderRegistry
  // ...per-collaborator 子集
}
```

**放置**（design 提议，formalize 锁）：
- `packer/collaborator/` 新子目录（7 文件：config-collector.ts / dist-preparer.ts / config-compiler.ts / npm-builder-collab.ts / stage-dispatcher.ts / logic-emitter.ts / publisher.ts）
- 或：放对应域子目录（config-collector→store/、stage-dispatcher→pipeline/、logic-emitter→emit/、publisher→emit/、npm-builder→pipeline/）—— **倾向此**（mirror 域归属，避免新顶层）

**分批序**（按依赖 + 风险）：
- FC-P1 DistPreparer + ConfigCompiler（trivial，纯 forward 逻辑体小）→ 验行为 0
- FC-P2 NpmBuilder（已 class，仅接线 task body）→ 验
- FC-P3 ConfigCollector（最复杂——store.load + sctx 字段 + registry kinds + ALS 读）→ 验
- FC-P4 StageDispatcher（readLoadBindings + computeStagePlan + createStageTask）→ 验
- FC-P5 LogicEmitter（deriveLogicBuckets + emitEngine 特例）→ 验
- FC-P6 Publisher（materialize + publishToDist）→ 验

### D-FC-2 — facade 契约落地（types.ts 北星兑现）

`PackerOrchestrator.orchestrate(ctx, state, options) → EmitEntry[]` 真落地：
- orchestrator `implements PackerOrchestrator`（消解 D-OR-7 张力）
- `createPackerOrchestrator` 返回仅 `{ orchestrate }`（4 registry 私有，facade 内部）
- 返回值 `EmitEntry[]`（北星）——实际今日返回 `Record<string, unknown>`（buildResult），须 reconcile：或扩北星 EmitEntry 兼容 buildResult 字段，或 buildResult 落地为 EmitEntry[] 形状（design 提议后者——buildResult = EmitEntry[] + metadata）

**风险**：返回值改 → build() 入口 + dev session 适配器消费 result 处须同步。行为 0 须验（result 字段消费处全对齐）。

### D-FC-3 — OrchestrateRequest 收敛

20+ 字段 → `CompileRequest`（one-shot）+ `WatchRequest`（增量 = CompileRequest + 增量字段）。build() 入口 + dev session 适配器改写。

**分相**：
- FC-P7a CompileRequest 收敛（build 入口）→ 验
- FC-P7b WatchRequest 收敛（dev session 入口）→ 验

**风险**：入口签名改 → 3 调用方（bin/index.ts build、bin/dev.ts、session/runner.ts）+ 测试 mock 须同步。行为 0 须验。

### D-FC-4 — ALS 保留（B 切法留后，rigor 红线守）

collaborator 内部可调 ALS 读（`getWorkPath()`/`getPages()`/`getAppConfigInfo()`/`isMiniGame()`/`runWithCompilerContext()`）——**不改 ALS 为 PackerContext 入参**。ALS 直调是 I/O 读，非被抽的业务逻辑。B 切法（ALS→PackerContext 闭合）留后轮。

**验**：`grep 'getWorkPath\|getPages\|getAppConfigInfo\|isMiniGame' packer/collaborator/` 非 0（ALS 保留）+ collaborator 仍拥有业务逻辑（非纯 forward）。

### D-FC-5 — Non-scope 边界（不动项）

- **renderer 注入点**（F-PA-3）：orchestrator.ts:62-70 webviewRenderer 副作用注册 + renderers.ts `Renderer` 索引签名**保留原样**（A 切法另 Action）
- **aspect 分离**（F-PA-2）：collaborator 内部 sourcemap/compatibilityWarnings/compileConfig 穿线**保留**（C 切法另 Action）
- **L/C/E dispatch wiring**（F-PA-5/E）：L/C/E registry 仍 NOT wired，PackerDispatchRegistry 仍 WIRED（runtime HMR API 外部阻塞）
- **types.ts 北星重写**：不重写 types.ts 北星契约（只落地，不改形状）——F-PA-1 是运行层缺陷，types.ts 是好资产

## §3 收敛映射

| 目标 | 源 |
| --- | --- |
| `packer/collaborator/config-collector.ts`（或 `packer/store/config-collector.ts`）| orchestrator.ts initPhases[0] 逻辑体 |
| `packer/collaborator/dist-preparer.ts`（或 `packer/emit/dist-preparer.ts`）| orchestrator.ts initPhases[1] 逻辑体 |
| `packer/collaborator/config-compiler-collab.ts`（或 `packer/pipeline/config-compiler-collab.ts`）| orchestrator.ts initPhases[2] 逻辑体 |
| `packer/pipeline/npm-builder.ts`（已存在，加 collaborator 接线）| orchestrator.ts initPhases[3] 逻辑体 |
| `packer/collaborator/stage-dispatcher.ts`（或 `packer/pipeline/stage-dispatcher.ts`）| orchestrator.ts compile task + createStageTask 逻辑体 |
| `packer/emit/logic-emitter.ts` | orchestrator.ts Logic emit task 逻辑体 |
| `packer/emit/publisher.ts`（或 `packer/emit/publish.ts` 扩）| orchestrator.ts 写入产物 task 逻辑体 |

**orchestrator.ts 终态**：~80 行（createPackerOrchestrator 装配 + orchestrate = Listr task 序委托 7 collaborator + result 合）。今日 ~370 行。

## §4 blast radius（须 formalize 前实测）

| 项 | 估计 | 实测方法 |
| --- | --- | --- |
| orchestrator.ts 自身 | 6 业务块搬迁出 | git diff -M rename + 逻辑体行数减 |
| 调用方 | build()（bin/index.ts）+ dev（bin/dev.ts）+ session/runner.ts——FC-P7 改入口签名时触 | grep orchestrate 消费 |
| result 消费 | buildResult 字段（appId/name/path/dependencyGraph/buildModel）——FC-P2 改返回值时触 | grep result.appId 等 |
| types.ts | collaborator 接口 + CompileRequest/WatchRequest 形状 | 新增 shape |
| 测试 | mock orchestrator 的 spec（若有）| grep createPackerOrchestrator __tests__ |

## §5 行为 0 gate（每相）

- tsc 0 errors
- vitest 全绿（87/647 基线，compile-cli-cache flaky solo pass）
- 7 项目 diff=0（air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui）
- rigor check：`grep 'await.*\.run(' orchestrator.ts` 非 0（collaborator 委托）+ collaborator 文件含原逻辑体（git diff -M）+ ALS 保留 grep 非 0
