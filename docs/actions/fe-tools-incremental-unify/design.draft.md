# Design Draft — fe-tools-incremental-unify

> 本文件是设计草稿，非正式文档。用于讨论 Q-1..Q-5 后产出正式 technical-design。

## §1 现状分析

### §1.1 getInvalidatedModules（dependency-graph.ts）

```typescript
getInvalidatedModules(filePath: string): string[] {
  const ownerKinds = this.fileKinds.get(normalizedPath)
  if (!ownerKinds) return []
  const pending: string[] = []
  for (const [owner, kinds] of ownerKinds) {
    if (kinds.has('logic')) pending.push(owner)  // ← 只推 logic owner
  }
  const visited = new Set<string>()
  while (pending.length > 0) {
    const id = pending.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const dependent of this.getDirectDependents(id, 'logic')) {  // ← 只走 logic 边
      pending.push(dependent)
    }
  }
  return [...visited].sort()
}
```

### §1.2 logic cache 闭环

```
watch-runner start:
  cache = new ModuleResultCache()           // logic only

worker input:
  cache: new Map(cache.toJSON())            // 快照传入

worker parse-walk (logic):
  cache hit? → skip compile → 返回 cached logicDependencies
  cache miss? → compile → 返回 { compileRes, logicDependencies }

stage-channel:
  cache.set(info.path, { compileInfo, logicDependencies })  // 写 cache
```

### §1.3 view parse-walk 现状

```typescript
// view/parse-walk.ts
function compileML(entryId, source, ...) {
  // parse WXML → Document
  // walk → 发现 include/wxs/usingComponents
  // Vue compileTemplate → render code
  // wxs replacement
  // → emitEntry → onOutput 回传（inline emit）
  // 没有"返回 compile result"的独立步骤
}
```

view 的 compile result（render code + map + wxsBindings）直接进 emitEntry，没有独立提取。

### §1.4 style parse-walk 现状

```typescript
// style/parse-walk.ts
function compileSS(entryId, source, ...) {
  // parse WXSS → postcss/less
  // walk @import
  // minifyCss
  // → emitEntry → onOutput 回传（inline emit）
  // compileRes = { code, map } 存在 moduleCompileCache（intra-build）
}
```

style 有 `compileRes`（intra-build cache），但 worker 不返回它给主线程。

## §2 target 形状

### §2.1 getInvalidatedModules 泛化

```typescript
// target: 去掉 kind=logic 过滤
getInvalidatedModules(filePath: string): string[] {
  const ownerKinds = this.fileKinds.get(normalizedPath)
  if (!ownerKinds) return []
  const pending: string[] = []
  for (const [owner, kinds] of ownerKinds) {
    // 全 kind——不再 if (kinds.has('logic'))
    pending.push(owner)
  }
  const visited = new Set<string>()
  while (pending.length > 0) {
    const id = pending.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    // 全 kind——不再 getDirectDependents(id, 'logic')
    for (const dependent of this.getDirectDependents(id)) {
      pending.push(dependent)
    }
  }
  return [...visited].sort()
}
```

### §2.2 view/style cache 闭环

```
watch-runner start:
  cache = new ModuleResultCache()            // logic（字段名不变——现有 stage-channel 读 ctx.cache）
  viewCache = new Map(...)                   // 新增（独立实例，value 类型不同）
  styleCache = new Map(...)                  // 新增

worker input:
  cache: new Map(cache.toJSON())             // logic（字段名不变）
  viewCache: new Map(viewCache.toJSON())     // 新增
  styleCache: new Map(styleCache.toJSON())   // 新增

注：现有 ctx.cache 字段名不变（logic cache）。新增 viewCache / styleCache 字段——不重命名现有 cache 为 logicCache，避免不必要改动。

worker parse-walk (view):
  invalidatedModules 含 view module? → cache miss → compile → 返回 { viewCompileRes, dependencies }
  cache hit? → skip compile → 返回 cached result

stage-channel:
  viewCache.set(moduleId, { viewCompileRes, dependencies })  // 写 cache
```

### §2.3 cache value 形状

```typescript
// 泛型化方案
interface ModuleResultCache<V = CompiledModule> {
  get(moduleId: string): { module: V; dependencies: string[] } | undefined
  set(moduleId: string, result: { module: V; dependencies: string[] }): void
  // ...
}

// logic cache: ModuleResultCache<LogicCompiledModule>
// view cache:  ModuleResultCache<ViewCompiledModule>
// style cache: ModuleResultCache<StyleCompiledModule>

// 但现有 ModuleResultCache 是 class（非泛型），CachedModuleResult = { compileInfo, logicDependencies }
// 泛型化需要重构现有 class
```

## §3 决策（已拍板）

### D-IU-1: getInvalidatedModules 泛化——删 `kind=logic` 硬编码

现有 `getDirectDependents(id, 'logic')` 硬编码 kind。改为不传 kind——返回全 kind dependents。

```typescript
// 现在
for (const [owner, kinds] of ownerKinds) {
  if (kinds.has('logic')) pending.push(owner)   // ← 只推 logic owner
}
for (const dependent of this.getDirectDependents(id, 'logic')) {  // ← 只走 logic 边

// 改后
for (const [owner, _kinds] of ownerKinds) {
  pending.push(owner)                            // ← 全 kind owner
}
for (const dependent of this.getDirectDependents(id)) {  // ← 全 kind 边
```

不改签名，只删 `'logic'` 硬编码。现有 `getDirectDependents` 不传 kind 已返回全 kind。

### D-IU-2: view compile result 形状——ViewCompiledModule（已定）

提取为 `ViewCompiledModule`（from Packer 形状）——`{ moduleId, kind: 'view', code, map, dependencies, renderBody?, wxsBindings? }`。worker 返回 `ViewCompiledModule[]`，stage-channel 写 cache。

cache hit 时 worker 从 cache 取 ViewCompiledModule，直接 emit（跳过 compile，不跳过 emit）。

**dependencies 来源**：`dependencies: string[]` 是该 view 模块依赖的子模块 ID 集（include/wxs/usingComponents 引用的目标）。现有 `compileViewTree` 不直接产出此信息——从两个来源获取：

1. **compile 时产出**：`compileViewTree` 内部已发现 include/wxs/usingComponents（用于 walk），将这些依赖 ID 收集到 `dependencies` 数组即可——不引入新逻辑，只收集已有信息。
2. **Graph 查询（备选）**：`graph.getDirectDependents(moduleId)` 返回全 kind dependents，可 filter 出 view 子模块。

推荐方案 1（compile 时产出）——避免跨模块查询，保持 worker 自包含。`kind: 'view'` 硬编码。

**dependencies 双存说明**：cache 层 `{ module: ViewCompiledModule; dependencies: string[] }` 和 ViewCompiledModule 自身的 `dependencies: string[]` 是同一数据。cache 层 `dependencies` 用于 invalidation 查询（watch-runner 查哪些 module 依赖变了）；ViewCompiledModule.`dependencies` 用于 interface conformance（CompiledModuleBase 契约）。同一数据两处用途，不引入不一致。

### D-IU-3: cache 不泛型化——view/style 各建独立 cache

不泛型化现有 ModuleResultCache class。view/style 各建独立 cache 实例，value 类型不同：

```typescript
// logic cache（不变）
cache: ModuleResultCache  // value = { compileInfo, logicDependencies }

// view cache（新增）
viewCache: Map<string, { module: ViewCompiledModule; dependencies: string[] }>

// style cache（新增）
styleCache: Map<string, { module: StyleCompiledModule; dependencies: string[] }>
```

“统一”是在功能层面（三车道都有模块级增量），不是在类型层面。泛型化留给后续 Packer 接入。

### D-IU-4: intra-build + cross-rebuild 两层共存

| 层 | 用途 | 生命周期 | 实现 |
|---|---|---|---|
| intra-build（moduleCompileCache） | 同一 build 内去重 | per-build（worker 内存 Map） | 不变 |
| cross-rebuild（新 cache） | 跨 build 跳过 | session-scoped | 新增 |

检查顺序：intra-build 先查（快，内存）→ miss 则 cross-rebuild（序列化快照）→ miss 则 compile → 写回两层。

### D-IU-5: 只返回 dirty result

只返回 invalidated 的 result（dirty）。现有 logic 只返回 dirty compileRes。view/style 同理——只返回 invalidated modules 的 compile result。IPC 增量 = 改动模块数 × 单个 result 大小，和 logic 行为一致。

## §4 伪代码

```typescript
// model/dependency-graph.ts
getInvalidatedModules(filePath: string): string[] {
  const ownerKinds = this.fileKinds.get(normalizedPath)
  if (!ownerKinds) return []
  const pending: string[] = []
  for (const [owner, _kinds] of ownerKinds) {
    pending.push(owner)  // 全 kind
  }
  const visited = new Set<string>()
  while (pending.length > 0) {
    const id = pending.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const dependent of this.getDirectDependents(id)) {  // 全 kind
      pending.push(dependent)
    }
  }
  return [...visited].sort()
}

// watch-runner.ts
const caches = {
  logic: new ModuleResultCache<LogicCompiledModule>(),
  view: new ModuleResultCache<ViewCompiledModule>(),   // 新增
  style: new ModuleResultCache<StyleCompiledModule>(), // 新增
}

// stage-channel.ts
// 现状：worker 返回值是 Record<string, unknown>（executor.ts 无类型）。
// stage-channel 用 `as { ... }` 结构断言读取（如 `(result as { compileRes?: ... }).compileRes`）。
// view/style 结果仍走同一 as-cast 模式——不引入 `as any`，用 `as { viewCompileResults?: ... }`。
// cache 从 ctx 提取（和现有 logic cache 提取同一模式）
const viewCache = (ctx as { viewCache?: Map<string, { module: ViewCompiledModule; dependencies: string[] }> }).viewCache
const styleCache = (ctx as { styleCache?: Map<string, { module: StyleCompiledModule; dependencies: string[] }> }).styleCache
// worker 返回值新增 viewCompileResults / styleCompileResults
for (const result of (workerResult as { viewCompileResults?: Array<{ moduleId: string; compiled: ViewCompiledModule; dependencies: string[] }> }).viewCompileResults ?? []) {
  viewCache?.set(result.moduleId, {
    module: result.compiled,
    dependencies: result.dependencies,
  })
}
```

## §5 风险

| 风险 | 缓解 |
|---|---|
| getInvalidatedModules 泛化后闭包变大——返回更多 module IDs | 预期——view/style 边也走闭包 |
| view parse-walk 提取 compile result 需改 emit 路径 | 只提取返回值，不改 emit 逻辑 |
| ModuleResultCache 泛型化影响现有 logic cache | 逐步泛型化——先加 view/style，后迁移 logic |
| IPC 消息增大 | 只返回 dirty result |
| 行为 0——cache 逻辑可能改变产物顺序 | cache 只影响跳过 compile，不改产物内容 |
