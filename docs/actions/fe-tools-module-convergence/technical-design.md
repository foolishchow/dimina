# Technical Design — fe-tools-module-convergence

Status: **draft（2026-09-21）** — D-MC-* 待定（需 review 冻结）。

权威参考：[Experience-Review.md](../../Experience-Review.md)

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

### §0.4 职责边界方向（待 review 冻结）

**核心问题：code 要不要上图？**

| 选项 | graph 职责 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **A: graph = 结构权威** ✅ 已选 | node + edge + entry 集 + 文件归属；**不含 code** | graph 轻量；IPC 只传结构；code 由 fs module/cache 管 | 给定 entry 无法单从 graph 取 code → emit；两维度查询 |
| B: graph = 完整 module graph | node + edge + code + sourcemap + deps | 单一维度：entry → 遍历 graph → code → emit | graph 重；IPC 传 code（体量大）；D-MF-2 推翻；stale edge 零容忍 |
| C: graph = 结构 + code 引用 | node + edge + `codeRef`（指向 cache/Store）；code 不内联 | graph 中量；IPC 传结构 + 引用；code 在 Store 侧 | code 仍跨维度查；引用一致性新问题 |

**已选 A**（2026-09-21 讨论）：

- M2 已用 A 跑通增量（cache 独立于 graph，D-MF-2 不推翻）
- IPC 成本：worker ephemeral，graph snapshot 每次传；A 只传结构（轻），B 传结构+code（重）
- stale edge 容忍度：A 多编不漏（安全），B 多编进产物（diff≠0，M2 F15 已证）
- 无即时消费者需要 code 在图上（HMR deferred 另门）
- **D-MF-2 不推翻**：graph = 结构权威，code 留在 cache

**对 convergence 伞的影响：**

- MC0 graph 正确性 → **核心价值**（stale edge/node 清理 + closure 一致）
- MC1 GraphNode code → **deferred**（code 不上图；等 HMR 或另一个真实消费者出现时再做）
- MC2 view 入图 → **deferred**（view 不需要 code 上图）
- MC3 BuildModel 派生 → **保留**（entry → graph 取 module 集 → cache 取 code → emit；单一派生路径）

### §0.5 watch 变化分流流程（目标态）

无论选 A/B/C，watch 变化后的分流流程须清晰：

```text
file change
    │
    ├─ app.json / page.json 变？
    │   └─► graph 结构变化（storeInfo 重建 / merge diff）
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

## §1 继承

来自 [`fe-tools-module-centric` technical-design](../_archive/complete/fe-tools-module-centric/technical-design.md) D-MF-1 / D-MF-2：

- **D-MF-1**：方案 A；`moduleId = CompileInfo.path`；logic-only → 本伞扩展到 view。
- **D-MF-2**：缓存宿主不挂图节点 → **本伞推翻此条款**：MC1 后 node 持有 code，图成为 Module 宿主。此推翻需在 review 中显式确认。

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
  // 缺：code, sourcemap, deps
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
const compileResCache = new Map<string, unknown>()  // view cache（无消费方？待查）
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

## §3 设计方向（待 review 冻结）

### §3.0 D-MC-0: Graph 正确性（前置）

**已知问题：**

| 问题 | 事实 | 影响 |
| --- | --- | --- |
| stale edge | `addDependency`（L68-82）只 `kinds.add(kind)` → Set 只增；无 `removeDependency` API | 删 require 后旧边残留；增量 rebuild 脏图 |
| stale node | watch merge 不删 node（`storeInfo` 全量重建才清） | 删 page 后 node 残留 |
| closure 不一致 | cache hit 跳编译时，transitive dep 边不更新 | M2 已用 `cached.logicDependencies` 规避 logic；但 graph 边仍 stale |

**方向：**
- 补 `removeDependency(from, to, kind?)` API 或增量 rebuild 时先清后加。
- 补 `removeNode(id)` 或 merge 时 diff node 集。
- graph 边须与 `cached.logicDependencies` 一致——cache hit 模块的 graph 边用 cached dep list 回填。

### §3.1 D-MC-1: GraphNode 扩字段

```ts
interface GraphNode {
  id: string
  type: string
  entry: boolean
  packageRoot: string | null
  files: Set<string>
  // 新增（MC1）
  code?: string           // logic 编译结果（worker 回填）
  sourcemap?: string | null
  deps?: Set<string>       // logicDependencies（M2 捕获的 require/import dep ID）
}
```

- logic worker 编译后，`compileRes` + `logicDependencies` 回填 node。
- `ModuleResultCache` 退化为 **session 覆盖层**：
  - cache hit = `node.code` 存在 + `!invalidatedModules.has(id)`
  - cache miss = 全量重算 → 回填 node
  - **不再独立序列化**（cache = 图的快照；toJSON 已有 `nodes` 数组）

### §3.2 D-MC-2: view Module 入图

- `scriptRes` 的 `Map<modulePath, code>` → `node.code`（view kind node）。
- view Module 的 component 依赖已入图边（`kind = 'component'`，`addDependency` 已调用）。
- `compileResCache` 退化或删除（需查消费方）。

### §3.3 D-MC-3: BuildModel 从图派生

```text
entry (entryId)
  → graph.getModulesForEntry(entryId)  // 遍历 entry node 的依赖闭包
  → [EmitModule]                       // { moduleId: node.id, code: node.code, map: node.sourcemap }
  → emitEntry(modules, strategy)
  → BuildModel entry
```

- `BuildModel.add` 散装 entries 退居兼容（watch 路径可能仍直传）。

### §3.4 IPC 成本

- MC1 后，cache snapshot = `graph.toJSON()`（已有 `nodes` 数组，含 `code` 字段后增大）。
- 与 M2 的 `cache.toJSON()` + `dependencyGraph.toJSON()` 双传相比，**合并为单次 `graph.toJSON()`**——IPC 帧数减少。
- `code` 字段增大 snapshot 体量；dirty-only 更新策略沿用 M2（仅 dirty 模块回传）。

## §4 接口表（待 review 细化）

| 组件 | 变更 |
| --- | --- |
| `dependency-graph.ts` | MC0: 补 `removeDependency`/`removeNode`；MC1: GraphNode 扩 `code`/`sourcemap`/`deps`；`getModule(id)` 返回完整 node |
| `module-result-cache.ts` | 退化为图 node 覆盖层；或删除（由 graph node 直接持有） |
| `logic/index.ts` | `logicCompile` 回填 `node.code`；cache hit 走 `node.deps` |
| `view/index.ts` | `scriptRes` → `node.code`；`compileResCache` 退化 |
| `build-model.ts` | 新增 `deriveFromGraph(graph, entryId)` 派生路径 |
| `emit.ts` | 不变（消费 `EmitModule` 契约不变） |
| `stage-channel.ts` | input 合并 `graph.toJSON()`（含 code）；不再双传 cache |
| `watch-plan.ts` | 不变（`getInvalidatedModules` 已有） |

## §5 行为 0 守卫

- 每子门独立 diff：nomap 94 + sourcemap 185 产物 diff=0。
- 全量 vitest 绿。
- `node.code` 存在与否不影响 transform/emit 输出（仅影响是否跳过重算）。

## 待定议题

| ID | 议题 | 选项 |
| --- | --- | --- |
| D-MC-0 | graph 与 fs module 职责边界：code 要不要上图？ | **A 已选**（2026-09-21）：graph=结构权威，code 不上图，沿用 M2 D-MF-2 不推翻。B/C deferred（HMR 或另一消费者出现时再评估） |
| D-MC-1 | MC1 GraphNode code 子门 → deferred | code 不上图；MC1 deferred |
| D-MC-2 | MC2 view 入图子门 → deferred | view 不需要 code 上图；MC2 deferred |
| D-MC-3 | view `compileResCache` 是 within-build cache（非 cross-rebuild）；保留不动 | 保留不动（TD §2.3 已查实） |
| D-MC-4 | `BuildModel.add` 散装 entries 是删除还是退居兼容？ | A: 删除 / B: 兼容（watch 直传保留） |
| D-MC-5 | MC0 graph 正确性实施方式：removeDependency + removeNode + merge diff？ | 待 review 冻结 |
