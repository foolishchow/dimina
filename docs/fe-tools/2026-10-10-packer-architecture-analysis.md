# Packer 整体架构分析

> 2026-10-10 · fe/tools/bundler/src/packer/ 架构梳理

## 0. 概览

packer 是 fe/tools/bundler 的编译编排核心，承载 mini-program 从工程配置到产物发布的完整 pipeline。当前由 **45 个 .ts 文件 / ~5800 LOC** 组成，分布 11 个子目录。

```
packer/
├── types.ts            520  北星 shape（§1-§9 interface 契约层）
├── orchestrator.ts     334  主流程（7 collaborator + Listr 任务编排）
├── store/              640  环境/上下文（env.ts 枢纽 + config-collector + project-store）
├── graph/             1419  config fixpoint（config-fixpoint 665 + graph + dependency-graph + npm-resolver）
├── pipeline/           657  collaborator 实施（7 个 stage collaborator）
├── emit/               766  产物输出（build-model + emit + publish + 4 emitter/preparer）
├── cache/              636  持久化（compile-cache + fingerprint + invalidation + module-result-cache）
├── registry/           396  注册表（dispatch + lce 3-registry + renderers）
├── state/              148  会话/通道（session-state + stage-channel）
├── worker/             200  worker runtime（executor spawn + define-engine + runtime + sinks）
├── aspect/             321  兼容性检查（compatibility）
└── worker/async-context-store  42  ALS 原语
```

---

## 1. 北星 shape 层（types.ts §1-§9）

types.ts 是 packer 的**纯 shape 契约层**——9 section 定义全部 interface，不含 implementation。它是重构的「目标形状」，implementation 逐步对齐。

| § | 契约 | 职责 | 实施对齐 |
|---|---|---|---|
| §1 | 基础类型（ModuleKind / PackerFileTypes / PageConfig / ComponentConfig / WxsBinding） | 领域原语 | ✓（D-NS-1 PageConfig relocate） |
| §2 | **PackerContext** | I/O 能力 bundle（workPath/targetPath/readContent/resolve/fileTypes）——纯 shape 无 graph | ✓ |
| §2b | **StageChannelContext** | stage-channel 边界 typed context（R-HR-4，替代 `ctx as {field}` 断言） | ◐ 部分（cast 仍存） |
| §3 | LoadedModule + CompiledModule（3 per-kind） | 模块编译产物 shape | ✓ |
| §4 | LoadInput + EmitOptions + EmitBucket | load/emit 装载 shape | ✓ |
| §5 | **3 per-kind 契约**（Loader/Compiler/Emitter）+ **3 registry**（LoaderRegistry/CompileRegistry/EmitRegistry） | 扩展点（dispatch wiring 未接线——A/C/E 轨道） | ✗（stub，D-HR-1 blocked） |
| §6 | **Graph**（含 D-NS-1 5 accessors） | 依赖图 shape（accessor 查询面 + 结构面） | ✓（D-NS-1） |
| §7 | **OrchestratorState**（Graph + ModuleResultCache + Set + fingerprints/caches） | 编排态 shape | ✓（D-NS-2 moduleCache 对齐） |
| §8 | **PackerOrchestrator**（orchestrate 北星签名）+ **BuildResult**（D-NS-3 composite）+ CompileOptions/WatchOptions/CompileRequest/WatchRequest（D-NS-5） | 编排接口 + 请求收敛 + 返回类型 | ✓（D-NS-3/4/5） |
| §9 | **BuildCollaborator\<Deps\>** | collaborator 统一形状（facade-collaborator D-FC-1） | ✓（7 collaborator） |

**关键张力**：§5（3 per-kind 契约 + 3 registry）已定义但 implementation 是 stub——dispatch wiring 未接线（D-HR-1 blocked，A/C/E 轨道待启动）。

---

## 2. 主流程（orchestrator.ts）

orchestrator 是 packer 的主编排入口。`createPackerOrchestrator()` 返 `: PackerOrchestrator`（D-NS-4），闭包内一次构造 7 collaborator + 2 registry 复用。

### 2.1 阶段序（Listr 任务树）

```
orchestrate(ctx: PackerContext, state, options: CompileRequest|WatchRequest)
  → _orchestrate(request, providedStore, pipelineLifecycle, dispatchRegistry, loaderRegistry, collaborators)
    │
    ├─ initPhases (concurrent: false 顺序)
    │   ├─ 1. configCollector  → store.load → storeInfo（建/reconcile graph）+ sctx 9 字段
    │   ├─ 2. distPreparer     → createDist(seedPath)（准备产物目录）
    │   ├─ 3. configCompiler   → graph 配置编译
    │   └─ 4. npmBuilder       → npm 包构建
    │
    ├─ compilePhase (concurrent: parallel 旗控)
    │   └─ stageDispatcher     → computeStagePlan + 派发 view/style/logic stage 任务
    │       └─ 每个 stage → runCompileStage → executeTask → new Worker(spawn compiler/* entry)
    │
    └─ emitPhase (concurrent: false 顺序)
        ├─ 5. logicEmitter     → emit logic 产物
        └─ 6. publisher        → materialize + publishToDist + BUNDLE_PUBLISHED 事件
```

### 2.2 ctx → sctx → state 数据流

```
build() 入口
  → buildPackerContext(workPath, targetPath, fileTypes) = ctx: PackerContext
  → orchestrate(ctx, state: PackerSessionState, options)
    → request = {...options, workPath: ctx.workPath, targetPath: ctx.targetPath, state}
    → _orchestrate(request, ...)
      → collaborator.run(ctx as StageChannelContext, deps)   ← ctx 经 Listr task 透传，cast 为 sctx
        → sctx.storeInfo = store.load(...)                     ← config-collector 填
        → sctx.buildModel / dependencyGraph / cache / ...      ← 各 collaborator 填/读
        → state.graph / state.moduleCache / state.fingerprints ← OrchestratorState 持久态
```

**边界张力**：ctx 经 Listr 透传为 `Record<string, unknown>`，collaborator 入口 `ctx as unknown as StageChannelContext` 一次窄化（R-HR-4 单一边界，但 cast 仍存）。

---

## 3. 7 collaborator（facade-collaborator D-FC-1）

统一形状 `BuildCollaborator<Deps> = { run(sctx, deps): Promise<void> }`。每个 collaborator「拥有逻辑非包壳」（F-PA-1）。

| collaborator | 所在 | 职责 | 读 | 写 sctx |
|---|---|---|---|---|
| **configCollector** | store/config-collector | config bootstrap（触发 store.load→storeInfo）+ loader 派发 | store/state/lifecycle/loaderRegistry/workPath/fileTypes | storeInfo/dependencyGraph/cache/buildModel/loadedModules |
| **distPreparer** | emit/dist-preparer | 准备产物目录（createDist） | seedPath/lifecycle | —（不读写 sctx） |
| **configCompiler** | pipeline/config-compiler | graph 配置编译（tabBar icons 等） | state.graph/lifecycle | sctx（经 deps） |
| **npmBuilder** | pipeline/npm-builder | npm 包构建 | sctx.storeInfo.pathInfo/compilerOptions + sctx.dependencyGraph | — |
| **stageDispatcher** | pipeline/stage-dispatcher | stage 计算 + 派发 worker compile | state.graph + sctx.storeInfo + plan.stageSpecs | sctx.compatibilityWarnings |
| **logicEmitter** | emit/logic-emitter | emit logic 产物 | state.buildModel/state.moduleCache | — |
| **publisher** | emit/publisher | materialize + publishToDist + 事件 | sctx.storeInfo.pathInfo + sctx.buildModel + deps.appId | — |

**B 切法迁移状态**：collaborator 已迁显式读 `sctx.storeInfo`/`state.graph`（非 ALS getter）——除 distPreparer（不读写 sctx）+ publisher/npmBuilder 仍有同源冗余 fallback（见 storeInfo 概念分析）。

---

## 4. worker 模型（线程边界）

packer 的 compile phase 经 worker 线程执行（compiler/* parse-walk），主线程 orchestrate 不直接编译。

```
stageDispatcher
  → runCompileStage({script, engine, ctx→sctx, task, options, onOutput})   state/stage-channel.ts
    → executeTask({engine, input, onOutput})                                 worker/executor.ts
      → workerPool.runWorker(() => new Worker(ENTRY_PATH[script]))           spawn compiler/* entry
        ├─ view   → compiler/view/index.ts   （resetStoreInfo + parse-walk）
        ├─ logic  → compiler/logic/index.ts  （resetStoreInfo + parse-walk）
        └─ style  → compiler/style/index.ts  （resetStoreInfo + parse-walk）
      ← worker.on('message') → onOutput(entry) / resolve(payload)
```

### 4.1 跨线程数据传递

- **入 worker**（postMessage input）：`{pages, storeInfo, sourcemap, compileConfig, cache, viewCache, viewOrderList, invalidatedModules, ...}`——**sctx.storeInfo 快照 + caches 快照**经 message 传
- **worker 内**：`resetStoreInfo(input.storeInfo)` 填 worker 线程 `defaultCompilerContext` → parse-walk 经 getters 读
- **出 worker**（message 回传）：`{entry}` (onOutput 逐条) + `{...payload}` (resolve，含 dependencyGraph snapshot)

### 4.2 worker 模型的结构性后果

worker 是独立线程，**无法经闭包收上下文**——必须靠 ALS singleton + resetStoreInfo 跨线程填充。这是 env.ts ALS 门面（L2+L3）存在的**结构性根因**，非纯过渡物（至少中期）。

---

## 5. graph 层（config fixpoint）

graph/ 是 packer 最重的子模块（1419 LOC），承载 config bootstrap 的核心逻辑。

| 文件 | 职责 |
|---|---|
| **config-fixpoint.ts** (665) | config fixpoint 主逻辑——app.json/project.config.json 解析 → page 配置 → graph.build/reconcile；buildFixpointCtx helper（显式非 ALS 建 PackerContext） |
| **graph.ts** (216) | PackerGraph（implements Graph interface，D-NS-1 accessors）——活图实例，reconcile/restoreFromSnapshot/build |
| **dependency-graph.ts** (280) | DependencyGraph（底层图结构，addFile/addDependency/merge/toJSON/getInnerGraph） |
| **npm-resolver.ts** (258) | NpmResolver（模块解析） |

**数据流**：`storeInfo` → 建 localCtx → `toPackerContext` → `graph.build/reconcile(ctx)` → graph 持有 configInfo（graph.getConfigData）+ dependencyGraph（graph.getInnerGraph）。

---

## 6. store 层（环境枢纽）—— 已分析

见 [`2026-10-10-storeinfo-concept-analysis.md`](./2026-10-10-storeinfo-concept-analysis.md)。env.ts 三层混合（计算 + ALS 门面 + worker 桥接），storeInfo 矛盾身份（消耗品 + singleton 持久 mutator），sctx.storeInfo 冗余投影。

---

## 7. registry 层（扩展点 + dispatch）

3 个 registry + 1 dispatch + 1 renderers：

| 文件 | 职责 | 实施状态 |
|---|---|---|
| **lce.ts** | LoaderRegistryImpl / CompileRegistryImpl / EmitRegistryImpl（3 registry impl） | ◐（loader 实体化 H2 Phase 2a；compile/emit stub Phase 2b/2c） |
| **dispatch.ts** | PackerDispatchRegistry + readLoadBindings + computeStagePlan（stage 计算派发） | ✓（dispatch registry 实体化） |
| **renderers.ts** | renderer 注册表（registerRenderer/getRenderer） | ✓ |

**张力**：§5 北星定义 3 per-kind 契约（Loader/Compiler/Emitter）+ 3 registry，但 **compile/emit registry 是 stub**——dispatch wiring 未接线（D-HR-1 blocked，A/C/E 轨道）。当前 view/style/logic 经 worker spawn 直接编译，不经 registry 派发。

---

## 8. 依赖方向与循环

### 8.1 packer → compiler/*（engine 引用）

```
packer/state/stage-channel.ts  → compiler/view/index.ts (viewEngine)
                                → compiler/logic/index.ts (logicEngine)
                                → compiler/style/index.ts (styleEngine)
packer/registry/dispatch.ts     → 同上 3 engine
packer/orchestrator.ts         → compiler/logic/registry-impl.ts (logicLoader)
packer/cache/module-result-cache.ts → compiler/logic/index.ts (CompileInfo type)
```

### 8.2 compiler/* → packer（env.ts getters）

```
compiler/logic/index.ts        → packer/store/env.ts (resetStoreInfo + 6 getters)
compiler/logic/parse-walk.ts   → packer/store/env.ts (6 getters)
compiler/style/index.ts        → packer/store/env.ts (resetStoreInfo)
compiler/style/parse-walk.ts   → packer/store/env.ts (7 getters)
compiler/view/index.ts         → packer/store/env.ts (resetStoreInfo + 3 getters)
compiler/view/parse-walk.ts    → packer/store/env.ts (8 getters)
compiler/view/wxml/compile.ts  → packer/store/env.ts (4 getters)
compiler/view/wxml/load/*      → packer/store/env.ts (getters)
compiler/view/wxml/renderer/vue/tools.ts → packer/aspect/compatibility.ts
```

### 8.3 循环依赖

**packer ↔ compiler/* 双向依赖**：
- packer 引 compiler/*（engine + logicLoader + CompileInfo type）
- compiler/* 引 packer（env.ts getters + aspect/compatibility）

**解环点**：env.ts 的 ALS 门面是循环的载体——compiler/* 经 getters 反向依赖 packer/store/env.ts。若 compiler/* 迁显式上下文（阶段 3），循环断开。当前循环是 **worker 模型 + ALS 门面** 的结构性产物。

---

## 9. 架构张力清单

| # | 张力 | 根因 | 阶段 |
|---|---|---|---|
| T1 | **env.ts 三层混合**（计算 + ALS 门面 + worker 桥接） | 历史叠加——B 切法迁 collaborator 显式读，但 compiler/* 仍经 ALS | 阶段 2（L1 迁出）/ 阶段 3（L2+L3 退役） |
| T2 | **storeInfo 矛盾身份**（消耗品 + singleton mutator） | compat 写是 sctx.storeInfo 冗余投影的副作用 | 阶段 1（塌缩，消 sctx.storeInfo） |
| T3 | **sctx.storeInfo 冗余投影**（vs PackerContext + state.graph） | collaborator 未直接读 PackerContext | 阶段 1（塌缩） |
| T4 | **PackerContext 3 构造器 duplication**（buildPackerContext/buildFixpointCtx/toPackerContext） | 历史多入口 | 独立 dedup follow-up |
| T5 | **§5 3-registry stub**（compile/emit 未实体化） | dispatch wiring 是 L 级 + premature optimization（D-HR-1 locked B） | A/C/E 轨道（gated by runtime HMR API） |
| T6 | **packer ↔ compiler/* 循环依赖** | ALS 门面是循环载体 | 阶段 3（compiler/* 迁显式上下文） |
| T7 | **worker 模型强制 ALS singleton** | 独立线程无法经闭包收上下文 | 阶段 3（worker entry 显式传 context） |
| T8 | **StageChannelContext cast 边界**（ctx as unknown as StageChannelContext） | Listr task ctx 为 Record<string,unknown>，R-HR-4 单一边界但 cast 仍存 | 独立（StageChannelContext 全型化） |

---

## 10. 重构轨道状态

packer 重构 5 轨道 + 北星演进：

| 轨道 | 内容 | 状态 |
|---|---|---|
| **B**（ALS 闭合） | 主线程 ALS 退役（collaborator 显式读 sctx.storeInfo/state.graph） | ✓ complete（PC-B2..B10a） |
| **D**（facade-collaborator） | 7 collaborator 抽取 + registry 私有化 | ✓ complete（FC-P0..P6） |
| **北星**（north-star-evolution） | types.ts interface 演进——Graph accessors + moduleCache 对齐 + BuildResult + : PackerOrchestrator + CompileRequest/WatchRequest | ✓ complete（D-NS-1..6） |
| **A**（renderer） | renderer 抽象层演进（aspect/backend dispatch） | 待启动 |
| **C**（aspect） | aspect 横切面抽取 | 待启动 |
| **E**（dispatch wiring） | §5 3-registry 实体化 + dispatch 接线（D-HR-1 b/c） | 待启动（gated by runtime HMR API） |
| **backflow**（storeInfo 塌缩） | 消 sctx.storeInfo + storeInfo 纯化 + compat 写自然死 | 待 formalize（阶段 1） |
| **阶段 2**（env.ts L1 迁出） | storeInfo/buildPackerContext/normalize → 纯模块 | 待（独立 follow-up） |
| **阶段 3**（L2+L3 退役） | compiler/* 显式上下文 + worker entry 重构 + singleton 消亡 | 大 initiative（gated by worker 模型调整） |

---

## 11. 结构性总结

packer 当前是**半迁移态**：

- **北星 shape 层**（types.ts）已对齐——9 section interface 清晰，implementation 逐步靠拢（D-NS-1..6 闭合）
- **collaborator 层**已抽取——7 collaborator 显式读 sctx.storeInfo/state.graph（B 切法 + facade-collaborator 闭合）
- **环境层**（env.ts）混合未拆——计算 + ALS 门面 + worker 桥接三层共存，storeInfo 矛盾身份，sctx.storeInfo 冗余投影
- **worker 模型**强制 ALS singleton——compiler/* 经 getters 反向依赖 env.ts，形成 packer↔compiler 循环
- **扩展点**（§5 3-registry）半 stub——dispatch wiring 未接线，view/style/logic 经 worker spawn 直接编译

**核心结构债**：env.ts 的混合身份 + sctx.storeInfo 冗余 + ALS 门面循环。这三者同源——storeInfo 矛盾身份的具象（sctx.storeInfo）+ env.ts 承载（混合）+ ALS 门面（循环载体）。塌缩 sctx.storeInfo（阶段 1）是破局起点——让 storeInfo 纯化 → compat 写死 → 为 env.ts 拆模块（阶段 2）+ compiler/* 显式上下文（阶段 3）铺路。

---

## 附录：关键数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│ main thread                                                     │
│                                                                 │
│  build() → buildPackerContext() → ctx: PackerContext            │
│    → orchestrate(ctx, state, options)                           │
│      → _orchestrate(request, ..., collaborators)                │
│        │                                                        │
│        │  ┌─ configCollector → store.load → storeInfo           │
│        │  │    → graph.build/reconcile(toPackerContext)          │
│        │  │    → sctx.storeInfo + compat 写 defaultCompilerCtx   │
│        │  │                                                     │
│        │  ├─ distPreparer → createDist(getTargetPath getter)    │ ← ALS 读
│        │  ├─ configCompiler → state.graph                       │
│        │  ├─ npmBuilder → sctx.storeInfo + sctx.dependencyGraph │
│        │  │                                                     │
│        │  ├─ stageDispatcher → computeStagePlan                 │
│        │  │    → runCompileStage → executeTask ─────────────┐   │
│        │  │                                                   │   │
│        │  ├─ logicEmitter → state.buildModel                 │   │
│        │  └─ publisher → sctx.storeInfo + publishToDist       │   │
│        │                                                     ▼   │
│        └─ BuildResult ← {entries, appId, name, path,          │   │
│                        dependencyGraph, buildModel}            │   │
│                                                              │   │
└──────────────────────────────────────────────────────────────┼───┘
                                                               │
                        ┌──────────────────────────────────────┴────┐
                        │ worker thread (spawn per stage)            │
                        │                                           │
                        │  compiler/{logic,style,view}/index.ts     │
                        │    → resetStoreInfo(input.storeInfo)       │ ← ALS 写
                        │    → parse-walk → getters                 │ ← ALS 读
                        │      (getWorkPath/getAppId/getDependency  │
                        │       Graph/getTemplateExts/...)          │
                        │    → postMessage {entry} / {payload}      │
                        │                                           │
                        └───────────────────────────────────────────┘

ALS singleton (defaultCompilerContext):
  main thread  ← storeInfo compat 写（load-bearing，待塌缩）
  worker thread ← resetStoreInfo（worker 桥接，保留）
```
