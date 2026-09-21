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
  logicCache = new ModuleResultCache()
  viewCache = new ModuleResultCache()    // 新增
  styleCache = new ModuleResultCache()   // 新增

worker input:
  logicCache: new Map(logicCache.toJSON())
  viewCache: new Map(viewCache.toJSON())   // 新增
  styleCache: new Map(styleCache.toJSON()) // 新增

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

## §3 讨论

### Q-1: getDirectDependents kind 参数

现有 `getDirectDependents(id, 'logic')` 改成什么？

**选项 A**：去掉 kind 参数——`getDirectDependents(id)` 返回全 kind dependents。
**选项 B**：加可选 kind 参数——`getDirectDependents(id, kinds?)`，不传时全 kind。

**倾向 A**：getInvalidatedModules 内部直接调 `getDirectDependents(id)` 不传 kind。现有 `getDirectDependents` 签名已有可选 kinds 参数，不传 = 全 kind。只需删 `getInvalidatedModules` 内的 `'logic'` 硬编码。

### Q-2: view compile result 形状

view parse-walk 的 compile result 是什么？

**现状**：view parse-walk 内部产 `scriptRes`（Map<moduleId, code>）+ `renderRes`（render code + map）+ `wxsBindings`。直接进 emitEntry。

**倾向**：提取为 `ViewCompiledModule`（from Packer 形状）——`{ moduleId, kind: 'view', code, map, dependencies, renderBody?, wxsBindings? }`。worker 返回 `ViewCompiledModule[]`，stage-channel 写 cache。

**问题**：view emit 是 inline（即编即发）。cache 存了 ViewCompiledModule 后，cache hit 时跳过 compile，但还需要 emit。emit 从哪拿 code？

**倾向**：cache hit 时 worker 从 cache 取 ViewCompiledModule，直接 emit（跳过 compile，不跳过 emit）。

### Q-3: ModuleResultCache 泛型化

现有 `ModuleResultCache` class 非泛型，`CachedModuleResult = { compileInfo: CompileInfo, logicDependencies: string[] }`。

**选项 A**：泛型化现有 class——`ModuleResultCache<V = CompiledModule>`。logic 用 `ModuleResultCache<LogicCompiledModule>`，view 用 `ModuleResultCache<ViewCompiledModule>`。
**选项 B**：不改现有 class，新建 view/style cache（不同 value 类型）。

**倾向 A**：泛型化。Packer 形状已定义 `ModuleResultCache<V>`。现有 class 泛型化后 logic 也能用新形状。

**问题**：泛型化后 `CachedModuleResult` 类型怎么处理？logic 现有 `{ compileInfo, logicDependencies }` → 变成 `{ module: LogicCompiledModule, dependencies: string[] }`？需要重构现有 cache 写入/读取。

### Q-4: intra-build cache vs cross-rebuild cache

view 有 `moduleCompileCache`（intra-build dedup）。ModuleResultCache（cross-rebuild）和它什么关系？

**倾向**：两层共存——intra-build cache 防同 build 内重复编译；cross-rebuild cache 防跨 build 重复编译。cache hit 顺序：先查 intra-build（Map，快），再查 cross-rebuild（ModuleResultCache，需序列化）。

**简化**：可以合并——intra-build cache 改用 ModuleResultCache 实例（per-build 副本）。但 watch rebuild 时 cross-rebuild cache 替代 intra-build。

### Q-5: IPC 消息增大

worker 返回值增加 view/style compile result 后 IPC 消息增大。

**倾向**：只返回 invalidated 的 result（dirty）。现有 logic 只返回 dirty compileRes。view/style 同理——只返回 invalidated modules 的 compile result。

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
// worker 返回值新增 viewCompileResults / styleCompileResults
for (const result of workerResult.viewCompileResults ?? []) {
  caches.view.set(result.moduleId, {
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
