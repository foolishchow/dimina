# Technical Design — fe-tools-view-style-cache-skip

Status: **draft（2026-10-08）**

## §1 现状（G4 落地后）

### §1.1 G4 已落地（数据源 + 写）

- `view/index.ts` `compileML` 返 `Promise<ViewCompiledModule[]>`（收集 viewParseWalk 的 EmitModule → 降级 base `{moduleId,kind:'view',code,map,dependencies:[]}`）
- `style/index.ts` `compileSS` 返 `Promise<StyleCompiledModule[]>`（收集 buildCompileCss 的 StyleCompileResult → 降级 base）
- `stage-channel.ts` 新增 view/style cache 写入块（guarded `if (viewCache && viewResults)`）——G4 期 ctx 无字段 → no-op
- worker input 已含 `invalidatedModules`（stage-channel:48 传，G4 期忽略）

### §1.2 现有 logic cache 闭环（参照模式）

```
orchestrator.ts:172  cache = state.moduleCache
orchestrator.ts:182  ctx.cache = cache
stage-channel.ts:47  cache: new Map(ctx.cache.toJSON())  // 快照传 worker
worker (logic):      cache hit? skip compile → 返 cached logicDependencies
                     cache miss? compile → 返 {compileRes, logicDependencies}
stage-channel.ts:71  cacheInstance.set(info.path, {compileInfo, logicDependencies})
```

G5 镜像此模式 for view/style。

### §1.3 ctx 类型（G4 已扩）

`compile-target.types.ts` 或 stage-channel 局部 `as`——ctx 已有 optional `viewCache?`/`styleCache?`（D-G4-5）。G5 填实例。

## §2 target 形状

### §2.1 PackerSessionState 字段（R-G5-1）

```typescript
// session-state.ts
interface PackerSessionState {
  // 现有
  moduleCache: ModuleResultCache  // logic（不变）
  // G5 新增
  viewCache: Map<string, ViewCompiledModule>   // bare（D-G4-3）
  styleCache: Map<string, StyleCompiledModule>  // bare
  // ...
}
```

实例化：watch-runner 创建（session-scoped）；one-shot 用临时 state（无 viewCache/styleCache → G4 no-op 边界延续）。

### §2.2 orchestrator plumbing（R-G5-2）

```typescript
// orchestrator.ts（镜像 :172/:182 logic plumbing）
const viewCache = state.viewCache
const styleCache = state.styleCache
// ctx 组装
ctx.viewCache = viewCache
ctx.styleCache = styleCache
```

### §2.3 stage-channel worker input 快照（R-G5-3）

```typescript
// stage-channel.ts input（镜像现有 cache IIFE）
viewCache: (() => { const c = (ctx as { viewCache?: { toJSON: () => [string, unknown][] } }).viewCache; return c ? new Map(c.toJSON()) : null })(),
styleCache: (() => { const c = (ctx as { styleCache?: ... }).styleCache; return c ? new Map(c.toJSON()) : null })(),
// invalidatedModules 已传（:48）
```

### §2.4 style cache-hit skip（R-G5-4，RG5-3 较简单）

```typescript
// style/index.ts compileSS（G5）
async function compileSS(pages, root, progress, options, viewCache?, invalidated?): Promise<StyleCompiledModule[]> {
  const results: StyleCompiledModule[] = []
  for (const page of pages) {
    const cached = viewCache?.get(page.path)  // cross-rebuild 读
    const isInvalidated = invalidated?.includes(page.path) ?? false
    let mod: StyleCompiledModule
    if (cached && !isInvalidated) {
      // ★ cache-hit：跳 buildCompileCss，用 cached code/map
      mod = cached  // re-emit cached（emitStyle 用 cached.code/map）
    } else {
      const result = await buildCompileCss(page, new Set(), options)
      mod = { moduleId: page.path, kind: 'style', code: result.code, map: result.map, dependencies: [] }
    }
    results.push(mod)
    // emit 不变（D-IU-2 跳 compile 不跳 emit）
    const entry = await emitStyle([{ moduleId: page.path, code: mod.code, map: mod.map }], ...)
    abilityALS.get().sink.write(entry)
    progress.completedTasks++
  }
  return results
}
```

style 非 recursive（buildCompileCss concat sub-styles 进单 code，D-G4-2）→ cache-hit per-page 直接。

### §2.5 view cache-hit skip（R-G5-4，RG5-1 待决）

**view discovery recursive**（compileViewTree:324/368 走 usingComponents → page + 各 sub-component 独立 EmitModule）。cache-hit 若跳 viewParseWalk → 丢失 sub-component 发现。

```typescript
// view/index.ts compileML（G5，RG5-1 方向 A 倾向）
async function compileML(pages, root, progress, viewCache?, invalidated?): Promise<ViewCompiledModule[]> {
  const results: ViewCompiledModule[] = []
  for (const page of pages) {
    const cached = viewCache?.get(page.path)
    const isInvalidated = invalidated?.includes(page.path) ?? false
    if (cached && !isInvalidated) {
      // ★ cache-hit page：跳 viewParseWalk，用 cached code/map emit page
      results.push(cached)
      // RG5-1 方向 A：graph.getDirectDependencies(page.path, 'component') 查 sub-components
      // → 递归 cache-hit emit（类比 logic logicDependencies:105）
      for (const subId of getDependencyGraph().getDirectDependencies(page.path, 'component')) {
        const subCached = viewCache?.get(subId)
        if (subCached && !invalidated?.includes(subId)) {
          results.push(subCached)
          // emit sub from cache
        } else {
          // sub invalidated → recompile（viewParseWalk(sub)）——需 sub ViewModule？
        }
      }
      // emit page + subs from cache
    } else {
      // cache-miss：现有路径（viewParseWalk → emitEntry + collect）
      const modules = viewParseWalk(page, { sourcemap: enableSourcemap })
      for (const mod of modules) {
        results.push({ moduleId: mod.moduleId, kind: 'view', code: mod.code, map: mod.map, dependencies: [] })
      }
      await emitEntry({ entryId: page.path, kind: 'view', modules, ... })  // emit 不变
    }
    progress.completedTasks++
  }
  return results
}
```

**RG5-1 未决点**：
- sub-component invalidated 时 recompile 需 sub 的 `ViewModule`（page 用的 ViewModule 来自 msg.pages；sub 的 ViewModule 从哪来？graph 查？viewParseWalk 递归内部构造）——**可能需 viewParseWalk 不跳 discovery 只跳 compile**（方向 C？）或 graph 查 sub ViewModule
- dependencies:[] 是否需填充（RG5-2）——若方向 A 用 graph 查，则保持 placeholder

## §3 决策（draft，待 review 拍板）

### D-G5-1: PackerSessionState viewCache/styleCache = bare Map（接 D-G4-3）

bare `Map<string, ViewCompiledModule>`/`Map<string, StyleCompiledModule>`（G4 D-G4-3 已定 bare）。G5 实例化。不泛型化（D-IU-3）。

### D-G5-2: plumbing 镜像 logic（接 D-G4-5）

`ctx.viewCache = state.viewCache` / `ctx.styleCache = state.styleCache`（镜像 :172/:182）。ctx 类型 G4 已扩 optional。G5 填实例。

### D-G5-3: cache-hit = 跳 compile 不跳 emit（接 D-IU-2）

cache-hit 用 cached code/map re-emit（emitStyle/emitEntry 调用不变）。**反转 G4 期"全量返回"**——G5 incremental filter（cache-hit 不返 cached 到 results？或返？D-IU-5"只返回 dirty"= 只返 cache-miss 编译的；cache-hit 已在 cache，stage-channel 不重写）。

### D-G5-4: view cache-hit 递归 emit = graph 'component' 边（RG5-1 方向 A，待决）

倾向方向 A：`graph.getDirectDependencies(pageId, 'component')` 查 sub-component IDs → 递归 cache-hit。不改 viewParseWalk（D-G4-1）。**RG5-1 readiness blocker**——review 拍板。

### D-G5-5: style cache-hit per-page（RG5-3）

style 非 recursive → per-page cache-hit 直接（§2.4）。已较明确。

### D-G5-6: 行为 0 边界

one-shot：无 invalidatedModules → 无 cache-hit skip → 全量编译 = G4 行为 → diff=0。watch：cache-hit skip = 效率提升（产物字节一致——cached code/map = 全量结果）。

## §4 design gate（readiness）

| RG5 | 门 | 状态 |
|---|---|---|
| RG5-1 | view cache-hit 递归 emit 语义（方向 A/B/C） | ⬜ 待决（倾向 A） |
| RG5-2 | view dependencies:[] 填充 vs placeholder | ⬜ 待决（与 RG5-1 联动；倾向 placeholder + graph 查） |
| RG5-3 | style cache-hit per-page | ✅ 较明确（design 拍板即足） |
| RG5-4 | cache-hit 与 intra-build 协同 | ⬜ 待决（倾向 cross-hit 不写 intra） |

## §5 风险

| 风险 | 缓解 |
|---|---|
| view cache-hit sub-component invalidated 时 recompile 需 ViewModule | RG5-1 待决——可能需 viewParseWalk 不跳 discovery（方向 C）或 graph 查 sub |
| cache-hit 写回 intra-build 一致性 | RG5-4 待决 |
| watch 产物顺序变更 | cache-hit re-emit 用 cached code/map → 字节一致；顺序 = pages 迭代顺序（不变） |
| behavior-0 watch 验证 | watch 路径非 no-op——靠单测 + 回归（cache-hit 触发 + 产物字节一致） |
