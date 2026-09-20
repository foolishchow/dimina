# Technical Design — fe-tools-module-convergence

Status: **complete（2026-09-21）** — D-MC-0..5 已冻结；近端 MC0 + MC3a。

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

## §0 Graph 与 ModuleResult 职责边界

### §0.0 术语

| 术语 | 定义 | 代码对应 | 管什么 |
| --- | --- | --- | --- |
| **GraphNode** | 结构表示（graph 侧） | `model/dependency-graph.ts: GraphNode` | node + edge + entry + files + type + packageRoot |
| **ModuleResult** | 内容表示（cache/fs 侧） | `model/module-result-cache.ts: CachedModuleResult` | code + sourcemap + logicDependencies |

一个「模块」（可变换单位，如 `utils/helper`）同时有 **GraphNode**（它在图里的结构身份）和 **ModuleResult**（它的编译内容）。两者是同一模块的两个视图。

### §0.1 两个维度

| 维度 | 主体 | 管什么 | 现状 |
| --- | --- | --- | --- |
| **GraphNode 维度**（小程序维度） | `DependencyGraph` | entry 集（page/component/app）、声明 dep 边（usingComponents）、文件归属（addFile）、编译发现的 transitive dep 边（require/import） | 有结构 + 文件归属；**无 code** |
| **ModuleResult 维度**（文件维度） | `CompileInfo` / `scriptRes` / `ModuleResultCache` | 源文件内容（.js/.ts/.wxml）、编译结果 code + sourcemap、require/import dep 列表 | 有 code + dep list；**游离于 graph** |

### §0.2 watch 变化分流

watch 变化触发两类变更，且互相交叉：

| 变化类型 | 触发源 | 影响范围 | 例子 |
| --- | --- | --- | --- |
| **GraphNode 结构变化** | `app.json` / `page.json` / `project.config.json` | entry 集（增删页）、声明 dep 边（usingComponents）、node 增删 | 新增 page → 新 node；删 component → 边断 |
| **ModuleResult 内容变化** | `.js` / `.ts` / `.wxml` / `.wxss` | module code 变、transitive dep 变（增删 require） | 改 `require('utils/b')` → dep 边变；改 code → cache 失效 |

**交叉点：**

- ModuleResult 变化 → 可能触发 GraphNode 变化（新增 `require` = 新 dep 边；删 `require` = stale edge）
- GraphNode 结构变化 → 可能触发 ModuleResult 变化（新增 page = 新 module 要编译）

### §0.3 当前职责混乱

GraphNode 与 ModuleResult 的职责**没有清晰边界**：

1. **dep 边归属不清**：`addDependency` 在 graph 上调（L310/332/357/382），但 dep 发现发生在 ModuleResult 编译时（AST walk）。GraphNode 持有 dep 边，但边的内容（require/import 路径）来自 fs module。
2. **ModuleResult code 归属不清**：GraphNode 有 node 但无 code；ModuleResult 有 code 但无结构。给定 entry，无法从 GraphNode 遍历到 ModuleResult code——必须跨两个维度查。
3. **stale 清理归属不清**：ModuleResult 删了 `require`，但 GraphNode 边不删（无 `removeDependency`）——GraphNode 结构与 ModuleResult 实际依赖不一致。
4. **ModuleResult cache 归属不清**：`ModuleResultCache` 持有 `{ compileInfo, logicDependencies }`——code + dep list 都在 cache 里，但 cache 游离于 graph。ModuleResult cache hit 时 dep 发现用 `cached.logicDependencies`（M2 F15），不用 graph 边——GraphNode 边在 cache hit 时已不可信。

### §0.4 职责边界方向（已冻结）

**核心问题：code 要不要上图？**

| 选项 | graph 职责 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **A: graph = 结构权威** ✅ 已选 | node + edge + entry 集 + 文件归属；**不含 code** | graph 轻量；IPC 只传结构；code 由 fs module/cache 管 | 给定 entry 无法单从 graph 取 code → emit；两维度查询 |
| B: graph = 完整 module graph | node + edge + code + sourcemap + deps | 单一维度：entry → 遍历 graph → code → emit | graph 重；IPC 传 code（体量大）；D-MF-2 推翻；stale edge 零容忍 |
| C: graph = 结构 + code 引用 | node + edge + `codeRef`（指向 cache/Store）；code 不内联 | graph 中量；IPC 传结构 + 引用；code 在 Store 侧 | code 仍跨维度查；引用一致性新问题 |

**已选 A**（2026-09-21 讨论；2026-09-20 复确认持 A）：

- M2 已用 A 跑通增量（cache 独立于 graph，D-MF-2 不推翻）
- IPC 成本：worker ephemeral，graph snapshot 每次传；A 只传结构（轻），B 传结构+code（重）
- stale edge 容忍度：A 多编不漏（安全），B 多编进产物（diff≠0，M2 F15 已证）
- 无即时消费者需要 code 在图上（HMR deferred 另门）
- **D-MF-2 不推翻**：graph = 结构权威，code 留在 cache

> **命名澄清（防撞车）**：此处 **D-MC-0「选项 A」= code 不上图**。  
> **不是**「同 GraphNode 上 `logicCode`/`viewCode` 双字段上图」——该方案曾作讨论候选，**已否决**（与 D-MC-0 A 冲突；本伞不采纳）。

**对 convergence 伞的影响：**

- MC0 graph 正确性 → **核心价值**（stale edge/node 清理 + closure 一致）
- MC1 GraphNode code → **deferred**（code 不上图；等 HMR 或另一个真实消费者出现时再做）
- MC2 view 入图 → **deferred**（view 不需要 code 上图）
- MC3a deriveFromGraph → **保留**（只读派生函数：entry → graph → modules → code → [EmitModule]）
- MC3b 搬 emit 到主线程 → **deferred**（打破 streaming；行为 0 风险高）
- MC3c view/style 派生 → **deferred**

### §0.5 watch 变化分流流程（目标态）

D-MC-0 已选 A；watch 变化后的分流流程须清晰：

```text
file change
    │
    ├─ app.json / page.json 变？
    │   └─► graph 结构变化（storeInfo 重建 + stale entry node 清理）
    │       └─► entry 集 / 声明 dep 变 → 影响哪些 entry 要编
    │
    ├─ .js / .ts 变？
    │   └─► fs module 内容变化
    │       ├─► code 变 → cache 失效 → 重编译
    │       └─► require/import 变 → graph dep 边变（须同步清理 stale）
    │
    └─ .wxml / .wxss 变？
        └─► view/style module 变
            └─► 重编译（graph 结构不变）
```

**关键约束**：fs module 的 require/import 变化必须同步到 graph 边——这是 MC0 graph 正确性的核心。

### §0.6 数据流向：build vs watch

#### 关键事实：emit 是 streaming

emit（`BuildModel.add`）通过 `onOutput` 回调发生——worker 执行**期间**（streaming via sink），在 worker 返回**之前**。GraphNode merge + ModuleResult cache update 发生在 worker 返回**之后**（`executeTask` resolve 后）。

```text
// executor.ts
worker.on('message', (message) => {
    if (message.type === 'output') → onOutput(entry) → BuildModel.add  // ← 期间（streaming）
    if (message.success) → resolve({ dependencyGraph, compileRes, logicDependencies })  // ← 返回后
})
```

#### Build 模式（单次编译，无 cache）

```text
storeInfo → GraphNode 全量创建（fresh）
    │
    ▼
worker 执行（streaming）
    │
    ├── compile → ModuleResult（CompileInfo[]）
    │       │
    │       ▼
    ├── emitEntry → sink → postMessage(output) ──► main: onOutput → BuildModel.add
    │                                                      （streaming，期间）
    │
    ├── 编译完成 → postMessage(success, { dependencyGraph, compileRes, logicDependencies })
    │
    ▼
main: resolve → merge GraphNode + update cache                    （返回后）
    │
    ▼
materialize
```

方向：**GraphNode 先建 → worker 执行期间 emit（streaming）→ worker 返回后 merge GraphNode + update cache → materialize**

#### Watch 模式（增量，有 cache）

```text
file change
    │
    ▼
查询 GraphNode（computeInvalidatedModules → dirty 集）
    │
    ▼
worker 执行（streaming，带 cache snapshot + invalidatedModules）
    │
    ├── cache hit → 用 ModuleResult（cached.compileInfo + cached.logicDependencies）
    ├── cache miss → 重编译 → 产出新 ModuleResult + addDependency
    │       │
    │       ▼
    ├── emitEntry → sink → postMessage(output) ──► main: onOutput → BuildModel.add
    │                                                      （streaming，期间）
    │
    ├── 编译完成 → postMessage(success, { dependencyGraph, compileRes, logicDependencies })
    │
    ▼
main: resolve → merge GraphNode（仅 dirty 边）+ update cache（仅 dirty ModuleResult） （返回后）
    │
    ▼
materialize
```

方向：**查 GraphNode → worker 执行期间 emit（streaming，cache hit/dirty）→ worker 返回后 merge GraphNode + update cache → materialize**

#### 对比

| | emit 时机 | GraphNode 参与 emit？ | ModuleResult 参与 emit？ | merge/update 时机 |
| --- | --- | --- | --- | --- |
| Build | worker 期间（streaming） | ❌ 不参与 | ✅ compileRes → emitEntry → sink | worker 返回后 |
| Watch | worker 期间（streaming） | ❌ 不参与（只用于算 dirty） | ✅ compileRes → emitEntry → sink | worker 返回后 |

**emit 现在完全用 ModuleResult（streaming），不用 GraphNode。** 两个模式一致：emit 在前，merge/update 在后。

#### 对 MC3b 的影响

MC3b（搬 emit 到主线程；BuildModel 从 GraphNode 派生）要求：

1. emit 发生在 GraphNode merge **之后**——因为派生需要最新的 GraphNode 结构
2. 但当前 emit 是 **streaming**（worker 期间），merge 在 **worker 返回后**——emit 在 merge 之前

**矛盾**：streaming emit 依赖 ModuleResult（已有），不依赖 GraphNode；MC3b 派生依赖 GraphNode（须先 merge）。

**MC3b 须改变时序**：从 `worker 期间 emit → 返回后 merge` 改为 `worker 返回 → merge GraphNode → 从 GraphNode 派生 → emit`。这**打破 streaming emit 模式**——须缓冲全部 module，等 GraphNode merge 后再 emit。

#### §0.6 补充审查发现（2026-09-21）

##### F-SIM-1：三个 stage 并发跑

```ts
// build-pipeline.ts L195
newListr(compileTasks, { concurrent: true })
```

view + logic + style worker **同时启动**，streaming emit（`BuildModel.add`）交错，graph merge 也交错（非确定性顺序，但同步调用无 race）。

MC3b 影响：emit 派生须在**全部 stage** merge 后（不是单 stage merge 后），因为 BuildModel 是跨 stage 的。

##### F-SIM-2：worker 做 compile + emit 两件事

```ts
// logic/index.ts — logicCompile 内部
compileJS(...) → CompileInfo[]           // compile
writeCompileRes(compileRes) → emitEntry  // emit（含 mergeSourcemap + esbuild transform）
  → sink.write → postMessage(output)     // streaming
return { compileRes, logicDependencies }  // 返回 raw ModuleResult
```

worker 不只编译，还做 emit（transform + bundle）。MC3b 如果要「从 GraphNode 派生 emit」，须把 emit（transform + bundle）从 worker 搬到主线程，或改 worker 协议为两阶段（compile → 返回 → emit 指令）。

##### F-SIM-3：EmitEntry ≠ CompileInfo

| streaming（onOutput） | final message（resolve） |
| --- | --- |
| `EmitEntry`（entry 级，已 bundle + transform） | `CompileInfo[]`（module 级，raw） |
| `{ entryId, kind, files: [{path, code}], sourcemaps }` | `{ path, code, map, ... }[]` |

两种数据**不同维度**——EmitEntry 是产物（已打包），CompileInfo 是模块（未打包）。MC3b 派生须在主线程做 CompileInfo → EmitEntry 转换（即 `writeCompileRes` + `emitEntry` 逻辑搬主线程）。

##### F-SIM-4：只有 logic 返回 compileRes

| stage | 返回 compileRes？ | 返回 dependencyGraph？ | 更新 cache？ |
| --- | --- | --- | --- |
| logic | ✅ `{ compileRes, logicDependencies }` | ✅ `successPayload` | ✅ stage-channel 更新 |
| view | ❌ `void` | ✅ `successPayload` | ❌ |
| style | ❌ `void` | ❌ 无 `successPayload` | ❌ |

ModuleResultCache 只被 logic 更新。view 有自己的 within-build `compileResCache`（不改 ModuleResultCache）。style 不碰 cache。

MC3b 影响：MC3b 派生只涉及 logic（有 compileRes + cache）；view/style 不走 ModuleResultCache 路径，MC3b 须分别处理或排除。

##### F-SIM-5：watch 模式 storeInfo 重建 + merge

```ts
// env.ts storeInfo
context.dependencyGraph = createInitialDependencyGraph()  // fresh（app.json 结构）
if (options.dependencyGraph) {
    context.dependencyGraph.merge(options.dependencyGraph)  // merge 旧 snapshot（含 transitive 边）
}
```

fresh + merge → **stale node 可通过 merge 复活**（删了的 page 如果在旧 snapshot 有 node，merge 会加回来）。这是 MC0 stale node 的根因。

##### MC3b 影响汇总

MC3b 不只是「打破 streaming」——还要：

1. 把 emit（transform + bundle）从 worker 搬到主线程（或改两阶段协议）
2. 处理三 stage 并发（emit 派生须在全部 stage merge 后）
3. 从 CompileInfo（module 级）→ EmitEntry（entry 级）的转换搬到主线程
4. MC3b 派生只涉及 logic（有 compileRes + cache）；view/style 须分别处理或排除

这是 MC3b 的核心架构约束，须在子门 TD 中明确。

> **注（2026-09-21）**：以上 F-SIM-1..5 + MC3b 影响汇总描述的是 **MC3b**（搬 emit 到主线程）的约束，已 **deferred**。MC3a（deriveFromGraph 只读函数）无此约束——它只读 graph + cache，不碰 emit/transform/bundle，不打破 streaming。F-SIM-1..5 的审查发现是 MC3 拆分决策的依据。

## §1 继承

来自 [`fe-tools-module-centric` technical-design](../fe-tools-module-centric/technical-design.md) D-MF-1 / D-MF-2：

- **D-MF-1**：方案 A；`moduleId = CompileInfo.path`；logic-only。本伞继承，不改。
- **D-MF-2**：缓存宿主不挂图节点 → **不推翻**（D-MC-0 选 A）。graph = 结构权威，code 留在 ModuleResultCache。

## §2 当前资产盘点

### §2.1 GraphNode（空壳）

```ts
// model/dependency-graph.ts
interface GraphNode {
  id: string           // moduleId（= CompileInfo.path）
  type: string         // 'page' | 'component' | 'app'
  entry: boolean      // 是否入口
  packageRoot: string | null
  files: Set<string>   // 归属源文件
  // 不含 code/sourcemap/deps（D-MC-0 选 A：code 不上图）
}
```

### §2.2 CompileInfo（logic 游离结果）

```ts
// compiler/logic/index.ts
export interface CompileInfo {
  path: string          // = moduleId
  code: string
  map?: string | null
  sourceFile: string | null
  extraInfoCode?: string
  component?: boolean
  usingComponents?: Record<string, string>
}
```

### §2.3 scriptRes（view 游离结果）

```ts
// compiler/view/index.ts
const scriptRes = new Map<string, string>()  // modulePath → code
const compileResCache = new Map<string, unknown>()  // view within-build cache；消费方 source-audit → MC3c（本伞 Uncovered）
```

### §2.4 ModuleResultCache（M2 半步资产）

```ts
// model/module-result-cache.ts
interface CachedModuleResult {
  compileInfo: CompileInfo
  logicDependencies: string[]
}
// session-only α；IPC 回填 I
```

### §2.5 EmitModule（消费契约）

```ts
// pipeline/emit.ts
export interface EmitModule {
  moduleId: string
  code: string
  map: string | null
  extraInfoCode?: string
}
// emit 消费 { moduleId, code, map }；与表示解耦 ✓
```

### §2.6 BuildModel（entry 级产物）

```ts
// model/build-model.ts
entries: Map<string, { entryId, kind, files: [{path, code}], sourcemaps?: [{path, map}] }>
// entry 级，非 module 级
```

## §3 设计方向（D-MC-0..5 已冻结）

### §3.0 MC0: Graph 正确性（前置）

**已知问题：**

| 问题 | 事实 | 影响 |
| --- | --- | --- |
| stale edge | `addDependency`（L68-82）只 `kinds.add(kind)` → Set 只增；无 `removeDependency` API | 删 require 后旧边残留；增量 rebuild 脏图 |
| stale node | watch merge 不删 node（`storeInfo` 全量重建才清；F-SIM-5 merge 可复活 stale node） | 删 page 后 node 残留 |
| closure 不一致 | cache hit 跳编译时，transitive dep 边不更新 | M2 已用 `cached.logicDependencies` 规避 logic dep discovery；但 graph 边仍 stale |

**D-MC-5 冻结：MC0 实施方式**

- **stale edge**：dirty 模块 AST walk 前，清其 outgoing 'logic' 边，然后 walk 重新加。需补 `clearOutgoingEdges(id, kind?)` API。cache hit 模块的边不清（其 require 未变）。调用点在 worker 内 `logic/index.ts`（worker 的 graph 是 storeInfo snapshot）。
- **stale node**：`storeInfo` merge 后，对比 `createInitialDependencyGraph()` 新建的节点集（`type: 'page'` 或 `type: 'component'`），删除旧 snapshot merge 回来但不在新建集中的 **page 型 / component 型** node。注意：component 节点 `entry: false`（`env.ts:872` 只设 `type: 'component'`），不能用 `entry === true` 判断。非 entry 模块节点（`type: 'module'`，如 `utils/helper`）保留——编译时重新发现/验证。需补 `removeNode(id)` API，须级联清理 `dependencies`/`dependents`/`fileOwners`/`fileKinds`。**不在 `merge()` 方法本身做 diff**——`merge()` 保持纯加法语义（主线程 merge worker 返回值时须保留新发现节点）。
- **closure 一致**：dirty 模块边清+重建 = fresh；cache hit 模块边不碰 = stale 但不影响正确性（cache hit 用 `cached.logicDependencies` 不用 graph 边）。`computeInvalidatedModules` 用 `getDirectDependents`（incoming 边）——incoming 边的 staleness 只影响 dirty 集是否 over-inclusive（安全）。

### §3.1 MC3a: deriveFromGraph 函数（Packer 核心形状）

```ts
/**
 * deriveFromGraph — Packer 核心形状：entry → 遍历 GraphNode → 取 module 集 → ModuleResult 取 code → [EmitModule]
 * 只读：不改 graph、不改 cache、不碰 emit/transform/bundle。
 */
function deriveFromGraph(
  graph: DependencyGraph,
  cache: ModuleResultCache,
  entryId: string,
): EmitModule[] {
  // 1. 从 entry node 出发，遍历所有 kind outgoing 边的依赖闭包
  //    不按 kind 过滤——'app' 和 'component' 边的目标也是 logic module（有 .js）
  //    非 logic 模块（view/style）不在 ModuleResultCache 中，cache.get(id) 自然过滤
  const moduleIds = graph.getDependencyClosure(entryId)
  // 2. 对每个 moduleId，从 ModuleResult 取 code + map
  const modules: EmitModule[] = []
  for (const id of moduleIds) {
    const cached = cache.get(id)
    if (!cached) continue  // 非 logic 模块（view/style）不在 cache → 跳过
    modules.push({
      moduleId: id,
      code: cached.compileInfo.code,
      map: cached.compileInfo.map || null,
      extraInfoCode: cached.compileInfo.extraInfoCode,
    })
  }
  return modules
}
```

- **只读**：不改 graph、不改 cache、不调 `emitEntry`、不做 transform/bundle。
- **返回 `[EmitModule]`**：与 `pipeline/emit.ts` 的 `ModuleCollection` 契约一致。
- **依赖 MC0**：`getDependencyClosure(entryId)` 须返回正确的依赖闭包（MC0 修复 stale edge 后才可靠）。遍历**所有 kind** outgoing 边（`'logic'` + `'app'` + `'component'`）——`'app'` 和 `'component'` 目标也有 `.js`（logic module），须包含。非 logic 模块由 `cache.get(id)` 自然过滤。**闭包含 `entryId` 自身**——entry 的自有 code（如 `pages/index/index.js`）也是 logic module，须包含在返回结果中。
- **不替代 streaming**：MC3a 是独立新增函数；streaming emit（worker 内 `writeCompileRes` → `emitEntry`）不动。MC3b（搬 emit 到主线程）deferred。
- **用途**：提供「从 graph + cache 重建 module 集」的能力——Packer 形状。未来 MC3b 可用此函数替代 streaming。

## §4 接口表（D-MC-0..5 已冻结）

| 组件 | MC0 变更 | MC3a 变更 |
| --- | --- | --- |
| `dependency-graph.ts` | 补 `clearOutgoingEdges(id, kind?)` / `removeNode(id)` API | 新增 `getDependencyClosure(entryId)`（遍历所有 kind outgoing 边闭包） |
| `compiler/core/env.ts` | `storeInfo` merge 后调 `removeNode` 删 stale page 型 / component 型 node | 不变 |
| `module-result-cache.ts` | 不变 | 不变（deriveFromGraph 只读 cache.get） |
| `logic/index.ts` | dirty 模块 AST walk 前调 `clearOutgoingEdges` 清 outgoing 'logic' 边 | 不变 |
| `view/index.ts` | 不变 | 不变（MC3c deferred） |
| `build-model.ts` | 不变 | 不变（MC3a 是独立函数，不碰 BuildModel.add） |
| `pipeline/emit.ts` | 不变 | 不变（MC3a 返回 EmitModule[]，不调 emitEntry） |
| `stage-channel.ts` | 不变 | 不变 |
| `watch-plan.ts` | 不变 | 不变 |
| `model/convergence.ts`（新增） | — | `deriveFromGraph(graph, cache, entryId)` 函数 |

## §5 行为 0 守卫

- 每子门独立 diff：nomap + sourcemap 产物 diff=0。
- 全量 vitest 绿。
- MC0：清边/删 node 不影响产物（边仅影响 dirty 集计算 = over-inclusive 安全）。
- MC3a：纯新增只读函数，不改任何现有流。

## 待定议题（D-MC-0..5 已冻结）

| ID | 议题 | 冻结结果 |
| --- | --- | --- |
| D-MC-0 | code 要不要上图？ | **A 已选**：graph=结构权威，code 不上图，D-MF-2 不推翻。B/C deferred。**否决**「双字段上图」（`logicCode`/`viewCode`）——与本 A 冲突 |
| D-MC-1 | MC1 GraphNode code | **deferred**：code 不上图；等 HMR 或另一消费者出现时再评估 |
| D-MC-2 | MC2 view 入图 | **deferred**：同 MC1 |
| D-MC-3 | view `compileResCache` | **保留不动**：within-build cache（非 cross-rebuild），不退化到 graph node |
| D-MC-4 | `BuildModel.add` 散装 entries | **deferred 到 MC3b**：MC3a 是只读函数，不碰 `BuildModel.add`。MC3b（搬 emit）时再评估 |
| D-MC-5 | MC0 实施方式 | **已冻结**：dirty 模块 AST walk 前清 outgoing 'logic' 边（`clearOutgoingEdges`）；`storeInfo` merge 后删 stale page 型 / component 型 node（`type: 'page'` 或 `type: 'component'`，非 `entry === true`——component `entry: false`）（`removeNode`，级联清理 deps/dependents/fileOwners/fileKinds）；非 entry 模块节点保留；`merge()` 保持纯加法语义；cache hit 边不清（安全） |
