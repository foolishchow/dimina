# Design Draft — fe-tools-packer-facade-collaborator

Status: **draft（2026-10-09）**

## §1 问题诊断（来自 [retrospect](../../fe-tools/2026-10-09-packer-facade-aspect-retrospect.md) F-PA-1）

`_orchestrate`（orchestrator.ts:103-366）是 god object：
- 7 类业务活内联（R-FC-1 表）+ 4 registry 公开返回（orchestrator.ts:96-99）+ OrchestrateRequest ~19 字段透传
- 北星 `PackerOrchestrator.orchestrate(ctx, state, options) → EmitEntry[]`（types.ts:416）未落地——实际 `_orchestrate(request: OrchestrateRequest) → Record<string, unknown>`
- orchestrator.ts:6 自承"不写 implements PackerOrchestrator（返回值与形状 EmitEntry[] 张力，D-OR-7）"

根因（retrospect §2）：类型层（types.ts 北星 facade+aspect+strategy）与运行层（orchestrator+ALS+Listr+mutable bag）双轨——类型层是文档，god object 活在运行层。

## §2 设计门（draft 提议，formalize 待锁）

### D-FC-1 — collaborator 抽取（logic 搬迁，非包壳）

7 collaborator 抽取（R-FC-1 表），每 collaborator 拥有完整业务逻辑（含 sctx 字段设置 + lifecycle 事件 + 错误处理）。orchestrator task body 仅 `await collaborator.run(sctx, deps...)`。

**collaborator 生命周期 + 注入**（防 collaborator 无主实例化）：
- **无状态 collaborator（6 个，createPackerOrchestrator 闭包内一次构造复用）**：ConfigCollector / DistPreparer / ConfigCompiler / StageDispatcher / LogicEmitter / Publisher——无实例 mutable state（逻辑体读 sctx + ALS + deps，不自持 build 间状态）→ 闭包单例复用安全
- **有状态 collaborator（NpmBuilder，每次 build 重新构造）**：NpmBuilder 是有状态 class（`this.builtPackages: Set` + `this.packageDependencies: Map` + `this.miniprogramExts`）——跨 build 复用会泄漏 builtPackages/packageDependencies → **NpmBuilder 不在 createPackerOrchestrator 闭包构造，每次 _orchestrate 内 `new NpmBuilder(workPath, targetPath, dependencyGraph)`**（FC-P2 接线时守此）
- **registry 注入**：createPackerOrchestrator 装配 4 registry（dispatchRegistry/loaderRegistry/compileRegistry/emitRegistry）→ 构造无状态 collaborator 时传 registry 作 deps（ConfigCollector 收 loaderRegistry、StageDispatcher 收 dispatchRegistry 等）
- **_orchestrate 访问**：无状态 collaborator 在 createPackerOrchestrator 闭包 → _orchestrate（同闭包或经 orchestrate wrap）直接访问 collaborator 实例，task body `await collaborator.run(sctx, deps...)`——_orchestrate 签名收敛（收 request + 闭包访问 collaborator/registry，不再收 5 参数）

**模块级 process-scoped state（不受 collaborator 抽取影响）**：`previousCompatibilityWarnings` Map（L57，跨 build warning diff 记忆）+ `isPrinted` let（L56，art code 一次性）——留 facade 模块级（process-scoped 非 instance-scoped），行为 0 须验此 state 不变（collaborator 抽取不触此 state）。

**facade 级装配 vs collaborator 级边界**（_orchestrate 顶部闭包变量归属，须明示防 collaborator 隐式耦合）：
- **facade 级（orchestrator 构造，传 collaborator deps）**：
  - `store`（3-way 装配：`runStore ?? providedStore ?? createProjectStore()`，L130）→ ConfigCollectorDeps.store
  - `compileTarget`（`createCompileTarget(runOptions)`，L132）→ StageDispatcherDeps.compileTarget
  - `lifecycle`（3-way：`runLifecycle ?? pipelineLifecycle ?? createLifecycle()`，L133）→ 所有 collaborator deps.lifecycle
  - `runOptions`（compileOptions + targetPath/workPath/useAppIdDir/fileTypes/stages/affectedEntries/seedPath，L131）→ facade 内部，供 createCompileTarget
- **collaborator 级（内部从 state 读，非外部传）**：
  - `cache`/`viewCache`/`viewOrderList`/`styleCache`（L152-156 从 `state.moduleCache`/`state.viewCache`/`state.viewOrderList`/`state.styleCache` 提取）→ ConfigCollector 内部 `const cache = state.moduleCache` 等（deps 仅传 state）
- **mutable 跨 task 闭包变量（须改 sctx 字段）**：
  - `loadBindings`（L147 `let ... = null` → L252 StageDispatcher 写 `readLoadBindings()` → L353 result 读 `.appId`）→ **抽 collaborator 后改 `sctx.loadBindings` 字段**（StageDispatcher 写 sctx.loadBindings，result 读 sctx.loadBindings.appId）——消跨 task mutable 闭包，collaborator 无隐式耦合

**sctx 字段所有权矩阵**（防 collaborator 间隐式耦合，implementer 须据此推导 deps）：

| sctx 字段 | 写入（collaborator） | 读取（collaborator） |
| --- | --- | --- |
| buildModel | ConfigCollector | LogicEmitter（.add）、Publisher（materialize）、createStageTask |
| cache/viewCache/viewOrderList/styleCache | ConfigCollector | stage-channel 内部 |
| dependencyGraph | ConfigCollector | createStageTask（经 ctx） |
| storeInfo | ConfigCollector | LogicEmitter |
| loadedModules | ConfigCollector | 后续门消费（本 Action 不读） |
| invalidatedModules | ConfigCollector | stage-channel 读 |
| loadBindings | StageDispatcher | result（appId） |
| allPages | StageDispatcher | result |
| pages | StageDispatcher | LogicEmitter、createStageTask |
| compatibilityWarnings | StageDispatcher | createStageTask |
| compileConfig/sourcemap/sourcemapTargetPath | StageDispatcher | LogicEmitter |

**ctx→sctx 统一**（collaborator 搬迁须清理）：现状 LogicEmitter L37-38 用 `ctx.buildModel`/`ctx.storeInfo`（未 cast sctx）+ ConfigCollector L23 `ctx.storeInfo`——collaborator 抽取须统一为 `sctx.X`（先 `const sctx = ctx as StageChannelContext`，再全用 sctx）。

**rigor 红线**：collaborator 须搬入真实逻辑。验：`grep 'await.*collaborator.run' orchestrator.ts` 非 0 + collaborator 文件含原 orchestrator 逻辑体（git diff -M rename + 逻辑体搬迁，非新建空壳）。

**rigor 红线**：collaborator 须搬入真实逻辑。验：`grep 'await.*collaborator.run' orchestrator.ts` 非 0 + collaborator 文件含原 orchestrator 逻辑体（git diff -M rename + 逻辑体搬迁，非新建空壳）。

**collaborator 接口形状**（types.ts 声明，每 collaborator typed deps 子接口——禁单一 CollaboratorDeps bag，避重蹈 StageChannelContext mutable bag 覆辙 F-PA-4）：

**类型来源声明**（deps 引的 2 个非导出类型须先 export）：
- `ProjectStore`：现 `createProjectStore` 返回 inferred（无 export interface）→ 须在 `packer/store/project-store.ts` 加 `export interface ProjectStore { load(w, o): Record<string, unknown>; getDependencyGraph(): ... }`（或 types.ts 声明）
- `Lifecycle`：现 orchestrator.ts:14 inline `type Lifecycle = {emit...; isolatedListenerErrors...}` → 须 export（迁 shared/lifecycle.ts 或 types.ts）
- `BuildModel`（class，emit/build-model.ts:17）/ `CompileTarget`+`PagesInfo`（compile-target.types.ts）/ `LoaderRegistry`等（types.ts）✓ 已导出
```ts
interface BuildCollaborator<Deps> {
  run(sctx: StageChannelContext, deps: Deps): Promise<void>
}
// 每 collaborator typed deps（非 bag）：
interface ConfigCollectorDeps { store: ProjectStore; state: PackerSessionState; lifecycle: Lifecycle; loaderRegistry: LoaderRegistry; fileTypes?: unknown; invalidatedModules?: string[]; viewCache?: ...; viewOrderList?: ...; styleCache?: ... }
interface StageDispatcherDeps { dispatchRegistry: PackerDispatchRegistry; compileTarget: CompileTarget; affectedEntries?: string[]; lifecycle: Lifecycle; parallel: boolean }
// StageDispatcher 写 sctx.loadBindings + sctx.allPages + sctx.pages + sctx.compatibilityWarnings + sctx.compileConfig/sourcemap/sourcemapTargetPath（消 loadBindings 闭包）
interface LogicEmitterDeps { state: PackerSessionState; pages: PagesInfo; compileConfigOpts: ...; sourcemap: boolean; sourcemapTargetPath?: string; storeInfo: unknown; buildModel: BuildModel; lifecycle: Lifecycle }
interface PublisherDeps { targetPath: string; useAppIdDir: boolean; seedPath?: string; skipMaterialize?: boolean; buildModel: BuildModel; lifecycle: Lifecycle }
// DistPreparer / ConfigCompiler / NpmBuilder deps 类似（仅所需字段）
```

**放置**（**formalize 倾向锁**：放对应域子目录，mirror 域归属，避免新顶层 collaborator/）：
- ConfigCollector → `packer/store/config-collector.ts`（store.load 域）
- DistPreparer → `packer/emit/dist-preparer.ts`（产物输出域）
- ConfigCompiler → `packer/pipeline/config-compiler-collab.ts`（stage 编排域，区别于既有 config-compiler.ts）
- NpmBuilder → `packer/pipeline/npm-builder.ts`（已存在，加 collaborator 接线）
- StageDispatcher → `packer/pipeline/stage-dispatcher.ts`（stage 派发域，含 createStageTask）
- LogicEmitter → `packer/emit/logic-emitter.ts`（emit 域）
- Publisher → `packer/emit/publisher.ts`（materialize+publish 域，区别于既有 publish.ts）

**grep 路径统一**（validation/acceptance 用实际域子目录，非新建顶层目录）：ALS 保留验 = `grep ... src/packer/{store,emit,pipeline}/`

**分批序**（按依赖 + 风险，明列依赖关系）：
- FC-P1 DistPreparer + ConfigCompiler（trivial，**无 sctx 依赖**——纯 createDist/compileConfig 调用）→ 验行为 0
- FC-P2 NpmBuilder（已 class，仅接线 task body，**读 sctx.dependencyGraph**）→ 验
- FC-P3 ConfigCollector（最复杂——store.load + sctx 字段设置 + registry kinds + ALS 读；**设 sctx.storeInfo/dependencyGraph/buildModel/cache 等供 P4-P6 读**）→ 验
- FC-P4 StageDispatcher（readLoadBindings + computeStagePlan + createStageTask；**读 sctx（P3 设）+ 写 sctx.pages/compatibilityWarnings/compileConfig/sourcemap**）→ 验
- FC-P5 LogicEmitter（deriveLogicBuckets + emitEngine；**读 sctx.pages/compileConfig/sourcemap（P4 写）+ state.graph/cache**）→ 验
- FC-P6 Publisher（materialize + publishToDist；**读 sctx.buildModel（P3 设 + P4/P5 add）**）→ 验
- FC-P7a CompileRequest 收敛（build 入口）→ 验
- FC-P7b WatchRequest 收敛（dev session 入口）→ 验

**依赖序**：P1/P2 无 sctx 依赖可先行；P3 设 sctx（P4-P6 前置）；P4 写 sctx（P5 前置）；P7 入口收敛**最后**（先内部 collaborator 稳定，再改入口签名）。

### D-FC-2 — facade 契约落地（types.ts 北星兑现）

分两相（reconcile 北星 interface 本身公开 registry 的张力）：

**D-FC-2a — orchestrate 签名落地**（北星不改）：
- orchestrator `implements PackerOrchestrator`（消解 orchestrator.ts:6 自承 D-OR-7 张力）
- `orchestrate(ctx: PackerContext, state: OrchestratorState, options: OrchestrateOptions) → Promise<EmitEntry[]>` 签名对齐北星（types.ts:416）
- 返回值 `EmitEntry[]`——实际今日返回 `Record<string, unknown>`（buildResult = {appId/name/path/dependencyGraph/buildModel}）。**reconcile 锁**：buildResult 落地为 EmitEntry[] 形状——buildModel.entries 即 EmitEntry[]（materialize 消费）+ 顶层 metadata（appId/name/path/dependencyGraph）作 EmitEntry[] 伴随返回（facade 合 result = EmitEntry[] + metadata 对象）。result 消费处（session/index.ts buildModel/appId）同步对齐

**D-FC-2b — registry 私有化**（须北星 interface 改，单独相）：
- 北星 `PackerOrchestrator` interface（types.ts:416）现公开 `loaderRegistry/compileRegistry/emitRegistry` 作字段——私有化须删此 3 字段
- `createPackerOrchestrator` 返回仅 `{ orchestrate }`（registry facade 内部）
- **D-FC-5 纪律校正**："不重写 types.ts 北星"指不改 facade/aspect/strategy SHAPE 结构；删 registry 公开字段是 facade 收敛核心（非 shape 重设计），允许
- 调用方（src/index.ts + logic-loader.spec）伸手 registry 处须改

**风险**：D-FC-2b 改北星 interface → 须验调用方无 registry 伸手。**实证伸手处**：`__tests__/logic-loader.spec.js:140-147`（6 处 `orch.loaderRegistry.get/kinds` + `orch.compileRegistry/emitRegistry.get` 断言 registry 实体化）——D-FC-2b 须同步改此 spec（删 registry 伸手断言，改验 orchestrate 行为而非内部 registry）。

### D-FC-3 — OrchestrateRequest 收敛

~19 字段 → `CompileRequest`（one-shot）+ `WatchRequest`（增量 = CompileRequest + 增量字段）。build() 入口 + dev session 适配器改写。

**分相**：
- FC-P7a CompileRequest 收敛（build 入口）→ 验
- FC-P7b WatchRequest 收敛（dev session 入口）→ 验

**风险**：入口签名改 → orchestrate 真调用方 `src/index.ts`（build facade wrapper）+ `__tests__/logic-loader.spec.js`（测试 mock）；build() 的下游消费者（`bin/dev.ts`、`session/runner.ts`、`session/index.ts`）经 build() 间接触；result 消费在 `session/index.ts`（buildModel/appId）。行为 0 须验（result 字段消费处全对齐）。

### D-FC-4 — ALS 保留（B 切法留后，rigor 红线守）

collaborator 内部可调 ALS 读（`getWorkPath()`/`getPages()`/`getAppConfigInfo()`/`isMiniGame()`/`runWithCompilerContext()`）——**不改 ALS 为 PackerContext 入参**。ALS 直调是 I/O 读，非被抽的业务逻辑。B 切法（ALS→PackerContext 闭合）留后轮。

**验**：`grep 'getWorkPath\|getPages\|getAppConfigInfo\|isMiniGame' src/packer/{store,emit,pipeline}/` 非 0（ALS 保留）+ collaborator 仍拥有业务逻辑（非纯 forward）。

### D-FC-5 — Non-scope 边界（不动项）

- **renderer 注入点**（F-PA-3）：orchestrator.ts:64-72 webviewRenderer 常量 + 副作用注册 + renderers.ts `Renderer` 索引签名**保留原样**（模块级，A 切法另 Action）
- **aspect 分离**（F-PA-2）：collaborator 内部 sourcemap/compatibilityWarnings/compileConfig 穿线**保留**（C 切法另 Action）
- **compatibility warning 跨 build 记忆**：`printCompatibilityWarnings` + `previousCompatibilityWarnings` Map（orchestrator.ts:57,410）是 post-build 打印 hook（compatibility 横切域 F-PA-2）——**留 orchestrator facade 模块级**（非 7 collaborator 之一；aspect 分离 C 轮再抽）
- **L/C/E dispatch wiring**（F-PA-5/E）：L/C/E registry 仍 NOT wired，PackerDispatchRegistry 仍 WIRED（runtime HMR API 外部阻塞）
- **types.ts 北星 SHAPE 不重写**：不改既有 facade/aspect/strategy 结构；**D-FC-6 ADD collaborator 接口（BuildCollaborator<Deps> + 7 *Deps）是新维度 ADD，非改既有 SHAPE，允许**；D-FC-2b 删 registry 公开字段是 facade 收敛核心（非 shape 重设计），允许（见 D-FC-2b 纪律校正）

## §3 收敛映射

| 目标 | 源 |
| --- | --- |
| `packer/store/config-collector.ts` | orchestrator.ts initPhases[0] 逻辑体 |
| `packer/emit/dist-preparer.ts` | orchestrator.ts initPhases[1] 逻辑体 |
| `packer/pipeline/config-compiler-collab.ts` | orchestrator.ts initPhases[2] 逻辑体 |
| `packer/pipeline/npm-builder.ts`（已存在，加 collaborator 接线）| orchestrator.ts initPhases[3] 逻辑体 |
| `packer/pipeline/stage-dispatcher.ts` | orchestrator.ts compile task + createStageTask 逻辑体 |
| `packer/emit/logic-emitter.ts` | orchestrator.ts Logic emit task 逻辑体 |
| `packer/emit/publisher.ts`（或 `packer/emit/publish.ts` 扩）| orchestrator.ts 写入产物 task 逻辑体 |

**orchestrator.ts 终态**：现 429 行 → 抽 7 collaborator + createStageTask 后估 ~120-150 行（非 ~80——Listr task 序 + createPackerOrchestrator 装配 + result 合 + webviewRenderer 常量/副作用注册 + printCompatibilityWarnings/previousWarnings Map 保留）。保留项（D-FC-5 Non-scope + facade 级）：file header + imports / OrchestrateRequest interface / createPackerOrchestrator（registry 装配 + store/lifecycle 3-way + orchestrate wrap）/ _orchestrate（Listr task 序 + 7 collaborator.run 委托 + result 合）/ webviewRenderer 常量 + 副作用注册 / printCompatibilityWarnings + previousCompatibilityWarnings Map。

**result 合归属**（facade 级，非 collaborator）：_orchestrate 末尾 `const result = { appId, name, path, dependencyGraph, buildModel }`——读 sctx.loadBindings.appId（StageDispatcher 写）+ sctx.dependencyGraph/buildModel（ConfigCollector 写）+ ALS（getAppName/getAppConfigInfo）。留 facade（合多 collaborator 输出 + ALS 读）。

## §4 blast radius（须 formalize 前实测）

| 项 | 估计 | 实测方法 |
| --- | --- | --- |
| orchestrator.ts 自身 | 7 业务块搬迁出 | git diff -M rename + 逻辑体行数减 |
| 调用方 | orchestrate 真调用方 = `src/index.ts`（build wrapper）+ `__tests__/logic-loader.spec.js`；build() 下游 = bin/dev + session/runner + session/index（经 build() 间接）；result 消费 = session/index.ts（buildModel/appId） | grep orchestrate / build( 消费 |
| result 消费 | buildResult 字段（appId/name/path/dependencyGraph/buildModel）——FC-P2 改返回值时触 | grep result.appId 等 |
| types.ts | collaborator 接口 + CompileRequest/WatchRequest 形状 | 新增 shape |
| 测试 | mock orchestrator 的 spec（若有）| grep createPackerOrchestrator __tests__ |

## §5 行为 0 gate（每相）

- tsc 0 errors
- vitest 全绿（87/647 基线，compile-cli-cache flaky solo pass）
- 7 项目 diff=0（air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui）
- rigor check：`grep 'await.*\.run(' orchestrator.ts` 非 0（collaborator 委托）+ collaborator 文件含原逻辑体（git diff -M）+ ALS 保留 grep 非 0
