# Technical Design — fe-tools-module-convergence

Status: **draft（2026-09-21）** — D-MC-* 待定（需 review 冻结）。

权威参考：[Experience-Review.md](../../Experience-Review.md)

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
| D-MC-1 | GraphNode 扩字段后 `toJSON()` 体量增大——是否 dirty-only snapshot？ | A: 全量（简单） / B: dirty-only（省 IPC） |
| D-MC-2 | `ModuleResultCache` 是删除还是退化为覆盖层？ | A: 删除（图直接持有） / B: 退化为覆盖层（热路径 cache hit 不走 IPC） |
| D-MC-3 | view `compileResCache` 有无消费方？需 source-audit。 | 待查 |
| D-MC-4 | `BuildModel.add` 散装 entries 是删除还是退居兼容？ | A: 删除 / B: 兼容（watch 直传保留） |
