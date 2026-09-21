# Source Audit — fe-tools-packer-core-shape

> Packer（= 整个 bundler）全流程生命周期梳理。从 session 创建到产物输出 + watch rebuild 循环。每环节标注读什么、写什么、碰 graph 还是 cache、映射到 5 组件。

## §1 入口

### §1.1 compile CLI

```
bin/compile.ts → build(targetPath, workPath, useAppIdDir, options)
  → src/index.ts runBuild()
    → createProjectStore()                    // ProjectStore 创建（graph 持有者）
    → createBuildPipeline({ store })
    → pipeline.run({ targetPath, workPath, useAppIdDir, ...options })
```

### §1.2 session

```
session/index.ts createBundler(resolved)
  → SessionState { workPath, targetPath, compile, store: createProjectStore(), lifecycle, activeLoop }
  → createSessionRunner(state)

session.build(overrides)
  → runner.runOnce(overrides)                 // R4 idle-check
  → composeOptions(overrides)                 // C1/pipeline 白名单合并 + store/lifecycle 注入
  → build(state.targetPath, state.workPath, state.useAppIdDir, options)
  → 同 §1.1

session.watch(watchOpts)
  → runner.composeOptions(watchBuildOptions)
  → createBuildWatcher({ store: state.store, ... })   // PS2: watch 与 build 共用同一 Store
  → runner.occupyLoop('watch')                         // R3: 从创建占位

session.dev(devOpts)
  → session.watch({ autoListen: false, skipMaterialize, ... })
  → watcher.start() → preview adapter → watcher.listen()
```

### §1.3 Packer 创建点

| 场景 | 创建点 | 产出 |
|---|---|---|
| 第一 build（CLI / session.build） | `store.load(workPath, { fileTypes, dependencyGraph })` = `env.ts storeInfo()` | ALS context: pathInfo / configInfo / compilerOptions / dependencyGraph |
| watch rebuild（worker 内） | `env.ts resetStoreInfo(snapshot)` | 从 storeInfo 快照恢复 ALS context |

**storeInfo 是 Packer 的"诞生"**——graph 在这里创建，context 在这里初始化。

---

## §2 第一 build 流程（`pipeline.run` → `_runBuild`）

### §2.1 全局时序

```
createBuildPipeline({ store }) → run(options)
  → runWithCompilerContext(() => _runBuild(options))    // 开 ALS context（主线程）

  _runBuild:
  ┌─────────────────────────────────────────────────────────────────┐
  │ 阶段 1：初始化项目（concurrent: false）                          │
  │                                                                 │
  │  1a. 收集配置信息                                                │
  │      ctx.buildModel = new BuildModel()                           │
  │      ctx.storeInfo = store.load(workPath, { fileTypes, dep })   │
  │        → env.ts storeInfo:                                      │
  │          storePathInfo（workPath, targetPath）                    │
  │          storeProjectConfig（project.config.json）                 │
  │          storeAppConfig（app.json, runtimeType 检测）               │
  │          storePageConfig（pages, components, usingComponents 递归）│
  │          createInitialDependencyGraph                            │
  │            → graph: entries + file ownership + component edges   │
  │        → 返回快照 { pathInfo, configInfo, compilerOptions, dep }  │
  │      ctx.dependencyGraph = store.getDependencyGraph()            │
  │      ctx.cache = cache（watch 时有）                              │
  │      ctx.invalidatedModules（watch 增量时有）                     │
  │                                                                 │
  │  1b. 准备产物目录 createDist(seedPath)                           │
  │  1c. 编译配置信息 compileConfig()（config-compiler.ts）           │
  │  1d. 构建 npm 包 NpmBuilder（npm-builder.ts）                    │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │ 阶段 2：编译项目（concurrent: true — 三车道并行）                 │
  │                                                                 │
  │  loadBindings = readLoadBindings()  // 读 pages + appId          │
  │  plan = deriveStagePlan(compileTarget, loadBindings, {           │
  │    affectedEntries,                                              │
  │  })                                                              │
  │  → plan.stages = ['logic', 'view', 'style']（或子集）             │
  │  → plan.stageSpecs[stage].workerOptions                          │
  │                                                                 │
  │  compileTasks = plan.stages.map(stage => createStageTask(...))   │
  │  → Listr concurrent: true                                        │
  │    每个阶段 → runCompileStage({ script, ctx, options })          │
  │      → executeTask({ engine: ENGINES[script], input })           │
  │        // Worker 内（见 §3）                                       │
  │      → ctx.dependencyGraph.merge(result.dependencyGraph)         │
  │      → cache.set(info.path, { compileInfo, logicDependencies }) │
  │      → ctx.emitBuckets = result.emitBuckets（logic 专有）          │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │ 阶段 3：Logic emit（串行，在 compile 之后）                        │
  │                                                                 │
  │  for each bucket (subs + main):                                  │
  │    executeTask({ engine: emitEngine, input: {                    │
  │      modules: emitBuckets[...], transform, storeInfo,            │
  │    }})                                                           │
  │      → emit-worker: resetStoreInfo + produceEntry → EmitEntry    │
  │    → buildModel.add(entry)                                       │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │ 阶段 4：写入编译产物（串行）                                       │
  │                                                                 │
  │  materialize(buildModel, targetPath)   // if !skipMaterialize   │
  │  publishToDist(targetPath, useAppIdDir)                          │
  └─────────────────────────────────────────────────────────────────┘

  → 返回 { appId, name, path, dependencyGraph: toJSON, buildModel }
```

### §2.2 关键标注

| 步骤 | 读 | 写 | 碰 graph | 碰 cache |
|---|---|---|---|---|
| store.load | 文件系统 | ALS context (pathInfo/configInfo/graph) | ✅ 创建 | — |
| createInitialDependencyGraph | 文件系统 + configInfo | graph (entries + files + edges) | ✅ 初始化 | — |
| runCompileStage → worker | storeInfo 快照 + cache 快照 | compileRes + graph delta | ✅ 本地写 | ✅ 本地读 |
| stage-channel merge | result.dependencyGraph | ctx.dependencyGraph | ✅ 合并 | — |
| stage-channel cache write | result.compileRes + logicDeps | ctx.cache | — | ✅ 写 |
| Logic emit task | ctx.emitBuckets + storeInfo | buildModel | — | — |
| materialize | buildModel | 文件系统 | — | — |

---

## §3 Worker 内流程

### §3.1 compile worker（logic / view / style）

```
主线程 executeTask({ engine, input })
  → postMessage(input) → Worker

Worker:
  1. resetStoreInfo(storeInfo)              // 从快照恢复 ALS
     → pathInfo / configInfo / compilerOptions / dependencyGraph 重建
     → NpmResolver 重建

  2. parse-walk（load + compile 交织）:
     logic: logicParseWalk → walk require 链 → transformCjs → compileRes
     view:  viewParseWalk → walk 组件树 → Vue compile → wxs replacement → emitEntry
     style: styleParseWalk → walk @import → postcss → emitEntry

     // load 阶段（parse + walk）:
     //   读 ALS: getWorkPath / getDependencyGraph / getNpmResolver / resolveAppAlias
     //   写本地 graph: graph.addFile / graph.addDependency
     //   读 cache 快照: cache hit → 跳过 compile（logic 专有）
     
     // compile 阶段（transform）:
     //   logic: transformCjs + minify → code + map
     //   view: Vue compileTemplate + wxs replacement → render code + map
     //   style: postcss/less → CSS + map

     // emit 阶段（view/style inline；logic 产出 emitBuckets）:
     //   view/style: emitEntry → EmitEntry → onOutput 回传
     //   logic: 产出 emitBuckets（不直接 emit）

  3. 返回 { compileRes, dependencyGraph: toJSON, logicDependencies, emitBuckets, compatibilityWarnings }

主线程:
  → result 到达
  → ctx.dependencyGraph.merge(result.dependencyGraph)
  → cache.set(...)
  → ctx.emitBuckets = result.emitBuckets（logic）
  → buildModel.add(entry)（view/style via onOutput）
```

### §3.2 emit worker（logic 专有）

```
主线程 Logic emit task
  → executeTask({ engine: emitEngine, input: { modules, transform, storeInfo } })
  → postMessage(input) → Worker

Worker (emit-engine):
  1. resetStoreInfo(storeInfo)              // 恢复 ALS（getWorkPath 等）
  2. produceEntry(emitParams)               // emit.ts: bundle/perModule 策略
     → modDefine 包裹 + sourcemap merge → EmitEntry
  3. 返回 { entry }

主线程:
  → buildModel.add(entry)
```

### §3.3 三车道 emit 差异

| 车道 | emit 时机 | emit 位置 | 产物 |
|---|---|---|---|
| logic | **推迟**（独立 stage，compile 全部完后） | emit-worker | EmitEntry（按分包：main + subs） |
| view | **即时**（compile stage 内） | compile worker（inline） | EmitEntry（按 page） |
| style | **即时**（compile stage 内） | compile worker（inline） | EmitEntry（按 page） |

---

## §4 watch rebuild 流程

### §4.1 全局时序

```
chokidar file change
  → scheduler.schedule(event, filePath)
    → dirtyFiles.add(filePath)
    → drain():
      → rebuild({ changedFiles })
        → createWatchBuildPlan({ changedFiles, dependencyGraph: store.getDependencyGraph() })

          ┌─ .json 变更 → 全量（re-scan config）────────────┐
          ├─ 未追踪文件 → 全量（新文件）────────────────────┤
          └─ 已追踪文件:                                    │
               computeAffectedEntries(graph, tracked)       │
                 → 受影响 entry 集                           │
               computeInvalidatedModules(graph, tracked)     │
                 → logic module IDs（kind=logic 过滤）        │
               computeStagesForFiles(graph, tracked)         │
                 → 需跑哪些 stage                             │
               → plan: {                                     │
                   incremental: true,                        │
                   options: {                                │
                     affectedEntries,                        │
                     stages,                                 │
                     invalidatedModules,                    │
                     seedPath: publishedPath,               │
                     dependencyGraph: toJSON(),              │
                     prepareConfig: false,                   │
                     prepareNpm: maybe,                     │
                   }                                        │
                 }                                           │
      ┌─────────────────────────────────────────────────┘
      │
      → build(targetPath, workPath, useAppIdDir, { store, cache, ...plan.options })
        → pipeline.run({ ...plan.options })
          → _runBuild:
            → store.load(workPath, { dependencyGraph: plan.dependencyGraph })
              // 合并图快照（不重新 createInitialDependencyGraph）
            → skip config/npm（prepareConfig: false）
            → deriveStagePlan with affectedEntries → 只跑受影响 stage
            → compileTasks: 只跑 plan.stages
              → worker: resetStoreInfo + parse-walk（有 cache + invalidatedModules）
                → logic: 跳过 cache hit，只编 invalidated
                → view/style: 无模块 cache，全量重编受影响 entry
            → emit + materialize（或 dev skipMaterialize）
```

### §4.2 增量数据流

| 步骤 | 读 | 产出 | 备注 |
|---|---|---|---|
| createWatchBuildPlan | live graph | plan.options | 主线程，store.getDependencyGraph() |
| computeAffectedEntries | graph | Set<entryId> | entry 级失效 |
| computeInvalidatedModules | graph | string[] (logic only) | 模块级失效，kind=logic 过滤 |
| computeStagesForFiles | graph | Set<stage> | 文件 kind → stage 映射 |
| store.load | plan.dependencyGraph | ALS context | 合并图快照，不重建 |
| worker compile | cache + invalidatedModules | compileRes + graph delta | logic 跳过 cache hit |

### §4.3 view/style 无模块级增量

| 能力 | logic | view | style |
|---|---|---|---|
| ModuleResultCache（跨 rebuild） | ✅ | ❌ | ❌ |
| invalidatedModules（模块级失效） | ✅ | ❌ | ❌ |
| computeAffectedEntries（entry 级） | ✅ | ✅ | ✅ |
| 车内缓存（intra-build dedup） | ✅ | ✅ moduleCompileCache | ✅ compileRes |

view/style 的 moduleCompileCache / compileRes 是**同一 build 内的去重**，不跨 rebuild。改 .wxml/.wxss → `computeAffectedEntries` 找到受影响 entry → 该 entry 下**所有模块**重新 parse-walk + compile。

---

## §5 graph 生命周期

### §5.1 graph 的创建/变异/合并

```
                  主线程                           Worker
                  ───────                           ──────
第一 build:
  storeInfo                                     ──────
    createInitialDependencyGraph ──→ graph      │
    （entries + file ownership + edges）         │
                                                │
  executeTask ──────────────────→ postMessage ──→ resetStoreInfo
                                                   → 本地 graph 副本
                                                   → parse-walk 写本地 graph
  ←── result.dependencyGraph ───← postMessage ────
  ctx.dependencyGraph.merge(delta)               │
                                                │
  返回 dependencyGraph: toJSON ──→ result      │

watch rebuild:
  store.load(workPath, { dependencyGraph: snapshot })
    → storeInfo 合并图快照（不重建）
  executeTask ──────────────────→ postMessage ──→ resetStoreInfo
                                                   → 本地 graph 副本
                                                   → parse-walk 写本地 graph
  ←── result.dependencyGraph ───← postMessage ────
  ctx.dependencyGraph.merge(delta)
```

### §5.2 graph 写权分布

| 位置 | 写操作 | 写的是什么 |
|---|---|---|
| env.ts createInitialDependencyGraph | graph.addNode / addFile / addDependency | 初始 entries + file ownership + component edges |
| Worker parse-walk | graph.addFile / addDependency | walk 发现的新依赖（require / usingComponents / @import / wxs） |
| 主线程 stage-channel | ctx.dependencyGraph.merge(result.dependencyGraph) | 合并 worker 返回的图增量 |

**graph 写权在 env.ts（初始）、worker（walk 发现）、主线程（合并）之间分叉。**

---

## §6 cache 生命周期

### §6.1 cache 的创建/读/写

```
                  主线程                           Worker
                  ───────                           ──────
watch start:
  new ModuleResultCache() ──→ cache 实例          │
                                                │
  executeTask input.cache = new Map(cache.toJSON())│
    → 序列化快照 ─────────────→ postMessage ──→ Worker 收到 Map 快照
                                                   → parse-walk 读 cache hit
                                                   → 跳过 compile（logic 专有）
  ←── result.compileRes + logicDeps ───← postMessage ────
  stage-channel: cacheInstance.set(info.path, ...)│
```

### §6.2 cache 写权分布

| 位置 | 读/写 | 操作 |
|---|---|---|
| watch-runner start | 写（创建） | `new ModuleResultCache()` |
| stage-channel executeTask | 写（传快照） | `new Map(cache.toJSON())` → 传入 worker |
| Worker parse-walk | 读 | cache hit → 跳过 compile（logic 专有） |
| stage-channel 返回 | 写 | `cacheInstance.set(info.path, { compileInfo, logicDependencies })` |

**cache 的写权在主线程（stage-channel 写回）。Worker 只读快照——不写 cache，返回 compileRes 让主线程写。**

---

## §7 Packer 5 组件映射现状

### §7.1 映射表

| Packer 组件 | 现有代码 | 现状评估 |
|---|---|---|
| **PackerContext** | env.ts ALS（storeInfo / resetStoreInfo） | ALS-backed，非 plain object；worker 从快照重建 |
| **LoadedModule** | parse-walk 内部瞬态（不持久化） | 无独立类型——交织在 parse-walk 里 |
| **CompiledModule** | CompileInfo（logic）/ EmitModule（emit）/ scriptRes（view）/ compileRes（style） | 四车道各自表示，不统一 |
| **Packer API.loadModule** | 三车道 parse-walk（parse + walk） | 交织 compile；写本地 graph；不是纯函数 |
| **Packer API.compileModule** | transformCjs（logic）/ Vue compile（view）/ postcss（style） | 交织在 parse-walk 里 |
| **Packer API.emitEntry** | produceEntry / emitEntry（emit.ts） | 最接近形状——已有结构化 API |
| **ModuleResultCache** | model/module-result-cache.ts | logic-only；session-only；硬绑 CompileInfo |
| **invalidatedModules** | computeInvalidatedModules（invalidation.ts） | logic-only；kind=logic 过滤 |
| **Orchestrator** | build-pipeline.ts + watch-plan.ts + stage-channel.ts | stage 级编排（车道线性）；不是模块级 |

### §7.2 现状与形状的 gap

| 形状假设 | 现实 | Gap |
|---|---|---|
| PackerContext 是 plain object 参数 | ALS-backed 上下文 | 形状要包含可序列化约束 |
| load 是纯函数（不写 graph） | parse-walk 写本地 graph | 线程隔离封装了副作用；形状定义 target vs 现实 |
| Orchestrator 独占 graph/cache 写权 | worker 本地写 + 主线程合并 | 线程边界的必然分叉 |
| 全局串行 fixpoint | 三车道并行 + per-lane fixpoint | 形状要支持并行车道级 fixpoint |
| load → compile → emit 统一管线 | logic emit 推迟；view/style 即编即发 | emit 时机因车道而异 |
| LoadedModule 独立类型 | parse-walk 内部瞬态 | 需重构 parse-walk 拆 load/compile |
| CompiledModule 统一类型 | 四车道各自表示 | 需收敛 |

---

## §8 关键发现总结

### F-1 PackerContext 是 ALS-backed，非 plain object

Worker 不接收 PackerContext 参数——接收 `storeInfo` 快照，调 `resetStoreInfo` 重建 ALS。load/compile/emit 通过 ALS 隐式获取上下文。PackerContext 形状要包含可序列化约束（graph 要 toJSON/merge，cache 要 toJSON/重建）。

### F-2 graph/cache 跨线程——快照 + 合并

graph 和 cache 不能在线程间共享内存。Worker 本地写 → 序列化返回 → 主线程合并。写权在 worker（本地副本）和主线程（合并）之间分叉。这不是设计缺陷——是线程边界的必然结果。

### F-3 fixpoint 是 per-lane 并行，非全局串行

三车道并行跑各自的 parse-walk fixpoint。每个车道内部发现自己的依赖。跨车道依赖（view→logic wxs）留在 view 车道内部。Orchestrator 是"三并行车道级 fixpoint + 合并"，不是"一个全局串行 fixpoint"。

### F-4 emit 时机因车道而异

logic 按分包打包（main + subs），需要所有模块 compile 完再按桶 emit——emit 推迟到独立 stage。view/style 按 entry 打包，编完即发——emit inline 在 compile stage。形状要承认 emit 时机不统一。

### F-5 load 不是纯函数——写本地 graph

parse-walk 在 worker 内直接调 `graph.addFile()` / `graph.addDependency()`。load 写本地 graph 副本。但因为线程边界，副作用被序列化封装。形状要决定：接受"load 写本地 graph"（现实），还是定义"load 返回 deps delta"（target，需重构）。

### F-6 view/style 无模块级增量

logic 有 ModuleResultCache + invalidatedModules（模块级跳过）。view/style 只有 computeAffectedEntries（entry 级过滤）——每个受影响 entry 下所有模块全量重编。形状的"模块生命周期"目前只覆盖 logic。
