# Packer Core — 形状定义

> **北星契约**（D-PCS-1..10）。定义目标形状，不实施物理抽取。
> 现有代码不 wire 这些类型；实施 Action 逐步迁移。
>
 * 前身：[`fe-tools-packer-lifecycle-audit`](../../../../../docs/actions/_archive/complete/fe-tools-packer-lifecycle-audit/README.md)（complete 已归档；F-1..F-6 关键发现）

## 管线：graph.build → load → compile → emit

```
graph.build(ctx)  →  load  →  compile  →  emit
   (config)          (发现)    (变换)      (装配)
```

| 环节 | 做什么 | 输入 | 输出 | 反馈循环 |
|---|---|---|---|---|
| graph build | config fixpoint | PackerContext | graph 项目结构 | ✅ 递归发现组件 |
| load | parse + walk = 发现 | LoadInput + ctx | LoadedModule（source + deps + metadata） | ✅ deps 驱动下一轮 |
| compile | transform = 变换 | LoadedModule + ctx | CompiledModule（code + map） | ❌ 依赖已确定 |
| emit | bundle = 装配 | CompiledModule[] + ctx + options | EmitEntry | ❌ 纯组装 |

### 两个 fixpoint（D-PCS-2）

- **config fixpoint**（graph.build 内部）：读 app.json → 发现 pages → 读 page.json → 发现 components → 递归 → 扫文件 → 项目结构完成
- **source fixpoint**（load 阶段）：parse 源码 → 发现 require/@import/wxs → mergeDelta → 继续直到稳定

两层都是 graph 在长——从不同输入长（JSON vs source）。Graph 是这两个 fixpoint 的共同 owner。

### load 在 graph build 之后启动（D-PCS-3）

load 需要从 graph 拿 3 样东西才能开始：
1. entry 集（`graph.getEntries()`）
2. file ownership（`graph.getFileOwners()`）
3. graph 快照（`graph.toJSON()`，传给 worker）

## Packer / Scheme 边界（R-PCS-6）

| 层 | 职责 | 内容 |
|---|---|---|
| **Packer**（通用） | 模块打包 | load / compile / emit / 缓存 / 失效 / 编排 / Graph |
| **Scheme**（Dimina 专有） | 项目配置 | 项目配置加载 / 运行时类型 / 组件树发现 / 样式隔离 / 页面分包结构 |

**边界**：Scheme 产 PackerContext（I/O 环境）；Packer 从 ctx 自己 bootstrap Graph → load → compile → emit。

Scheme 层专有字段（getComponent / getAppId / isMiniGame / getAppConfigInfo）不进 PackerContext（D-PCS-4: Graph 自己读 app.json，runtimeType 在 Graph 内部判断）。

## 6 组件形状

| # | 组件 | 类型 | 决策 |
|---|---|---|---|
| ① | PackerContext | `interface` | D-PCS-1, D-PCS-6: I/O only（paths + fileTypes + resolvers） |
| ② | Graph | `interface` | D-PCS-2, D-PCS-3, D-PCS-4: self-bootstrap, config+source fixpoint |
| ③ | LoadedModule + CompiledModule | `interface` + `type` | D-PCS-10: discriminated union（kind 判别） |
| ④ | Loader / Compiler / Emitter + 3 registry | `interface` × 6 | D-PCS-5, D-PCS-7: registry 派发，Emitter 封装 strategy |
| ⑤ | OrchestratorState | `interface` | D-PCS-6, D-PCS-9: session-scoped（graph + cache + invalidated） |
| ⑥ | PackerOrchestrator | `interface` | D-PCS-5, D-PCS-8, D-PCS-9: owns 3 registry, 通用 worker |

## D-PCS-1..10 决策摘要

| 决策 | 内容 |
|---|---|
| D-PCS-1 | storeInfo 只剩 paths+fileTypes = PackerContext。读 app.json / 递归组件 / 建图 / runtimeType 全归 Graph |
| D-PCS-2 | graph 推导逻辑自包含（build / reconcile / mergeDelta）。config fixpoint + source fixpoint 都是 Graph 的两层发现 |
| D-PCS-3 | graph 由 Orchestrator 触发，长期持有（per session/watch），不再 ephemeral |
| D-PCS-4 | Graph 自己 bootstrap 自己。build(ctx) 直接从 ctx.workPath 读 app.json，没有 bootstrap 阶段 |
| D-PCS-5 | 三个 registry 取代 Packer 单体接口。LoaderRegistry / CompileRegistry / EmitRegistry 映射 ModuleKind → per-kind 实现 |
| D-PCS-6 | PackerContext(I/O+fileTypes) + OrchestratorState(graph+cache+invalidated) 拆区 |
| D-PCS-7 | Emitter 封装 emit 策略。strategy 是 Emitter 属性，delayed 额外实现 produceBuckets |
| D-PCS-8 | 通用 worker。运行时收 kind 从内置 map 选实现。一个 worker-entry |
| D-PCS-9 | OrchestratorState session-scoped，ALS pipeline-scoped。graph 不靠 ALS 活着 |
| D-PCS-10 | CompiledModule discriminated union。kind 是判别字段。TODO: 后续考虑泛型方案 |

## 现有代码映射表（R-PCS-7）

### env.ts exports → PackerContext / Graph / OrchestratorState / 不迁移

| env.ts 层 | exports | → 形状组件 | 备注 |
|---|---|---|---|
| 通用 I/O | storePathInfo / getWorkPath / getTargetPath / readContent / resolveNpm | PackerContext | I/O 环境 |
| 模块解析 | resolveAlias | PackerContext | D-PCS-1: deferred |
| 文件类型 | normalizeFileTypes + 5 个 getter | PackerContext.fileTypes | |
| Dimina 专有 | storeAppConfig / storePageConfig / getComponent / getAppConfigInfo / getAppId / isMiniGame | Graph（D-PCS-2, D-PCS-4） | config fixpoint 迁入 config-fixpoint.ts；env 保留薄壳 |
| 运行时类型 | normalizeRuntimeType / getRuntimeType | Graph（D-PCS-4） | runtimeType 在 Graph 内部判断 |
| 生命周期 | storeInfo / resetStoreInfo | 不迁移（ALS 实现） | PackerContext 是 interface，ALS 是实现 |
| 纯 Scheme | storeProjectConfig / getCompilerOptions / ... | 迁入 config-fixpoint.ts（薄壳 env 保留） | D-PC-11 |

### 现有 module 类型 → LoadedModule / CompiledModule

| 现有类型 | 位置 | → 形状类型 | 备注 |
|---|---|---|---|
| CompileInfo | logic/index.ts | LogicCompiledModule 子集 | emit 只用 moduleId + code + map + extraInfoCode |
| EmitModule | pipeline/emit.ts | CompiledModule 子集 | emit 消费端的最小接口 |
| scriptRes / renderRes | view/parse-walk.ts | ViewCompiledModule | renderBody + wxsBindings |
| compileRes | style/parse-walk.ts | StyleCompiledModule | styleScopeId |
| CachedModuleResult | model/module-result-cache.ts | ModuleResultCache\<V\> value | 现有非泛型，形状泛型化 |

### 现有 parse-walk → Loader.load

| 车道 | 现有代码 | → Loader | 现状 |
|---|---|---|---|
| logic | logicParseWalk（logic/parse-walk.ts） | LogicLoader | parse JS → walk AST → require |
| view | viewParseWalk（view/parse-walk.ts） | ViewLoader | parse WXML → walk → include/wxs |
| style | styleParseWalk（style/parse-walk.ts） | StyleLoader | parse WXSS → walk → @import |

现状：load 和 compile 交织在 parse-walk 中。F-5: parse-walk 写本地 graph（非纯函数）。形状 target: 返回 deps delta（需重构）。

### 现有 transform → Compiler.compile

| 车道 | 现有代码 | → Compiler | 现状 |
|---|---|---|---|
| logic | transformCjs（logic/transform.ts） | LogicCompiler | esbuild CJS + sourcemap remap |
| view | Vue compileTemplate（view/parse-walk.ts 内） | ViewCompiler | 交织在 parse-walk 里 |
| style | postcss / less（style/parse-walk.ts 内） | StyleCompiler | 交织在 parse-walk 里 |

### 现有 emit → Emitter.emit

| 车道 | 现有代码 | → Emitter | strategy | produceBuckets |
|---|---|---|---|---|
| logic | produceEntry（pipeline/emit.ts） | LogicEmitter | delayed | ✅ 按分包 main + subs |
| view | emitEntry（pipeline/emit.ts） | ViewEmitter | inline | ❌ |
| style | emitStyle（style/emit.ts） | StyleEmitter | inline | ❌ |

F-4: emit 时机因车道而异——logic 推迟（独立 stage）；view/style 即编即发（inline）。

### 现有 lifecycle → OrchestratorState

| 现有代码 | 位置 | → OrchestratorState | 备注 |
|---|---|---|---|
| ModuleResultCache | model/module-result-cache.ts | .moduleCache | logic-only；非泛型 |
| computeInvalidatedModules | model/invalidation.ts | .invalidatedModules | logic-only；形状泛化到全 kind |
| DependencyGraph | model/dependency-graph.ts | .graph | Graph 的现有实现 |

F-6: view/style 无模块级增量——只有 entry 级过滤（computeAffectedEntries）。

### 现有编排 → PackerOrchestrator

| 现有代码 | 位置 | → Orchestrator | 现状 |
|---|---|---|---|
| build-pipeline | pipeline/build-pipeline.ts | stage 级编排 | 车道线性，不是模块级 |
| watch-plan | watch/watch-plan.ts | entry 级增量过滤 | |
| stage-channel | pipeline/stage-channel.ts | graph delta 合并 + cache 写 | |
| worker-pool | watch/worker-pool.ts | Executor 层（不归 Packer） | |

## 关键发现（F-1..F-6，来自 lifecycle-audit）

| 发现 | 内容 | 形状约束 |
|---|---|---|
| F-1 | PackerContext 是 ALS-backed，非 plain object | 形状是 interface 契约；ALS 是实现 |
| F-2 | graph/cache 跨线程——快照 + 合并 | Graph.toJSON() / mergeDelta；cache.toJSON() |
| F-3 | fixpoint 是 per-lane 并行，非全局串行 | 形状承认 per-lane 并行 |
| F-4 | emit 时机因车道而异 | Emitter 封装 strategy（D-PCS-7） |
| F-5 | load 不是纯函数——写本地 graph | 不强制纯函数化；返回 dependencies |
| F-6 | view/style 无模块级增量 | TODO: M1 泛化全 kind（另开 Action） |

## 缓存策略

| 对象 | 缓存？ | key | 备注 |
|---|---|---|---|
| LoadedModule | ❌ | — | graph 是 dependencies 的天然缓存 |
| CompiledModule | ✅ | moduleId（不含 fingerprint） | M1 invalidatedModules 负责驱逐 |
| EmitEntry | ❌ | — | emit 便宜 |

## TODO 清单

- [ ] 泛型 CompiledModule（`CompiledModule<M>`）——当前 discriminated union 够用，后续视需求
- [ ] 模块级增量（M1 泛化全 kind + view/style 接入 moduleCache）——另开 Action
- [ ] NpmResolver / resolveAlias 是否进 PackerContext——讨论调度器时再定
