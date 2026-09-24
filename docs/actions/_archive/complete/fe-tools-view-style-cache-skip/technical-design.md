# Technical Design — fe-tools-view-style-cache-skip

Status: **complete（2026-10-09）**

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
  // G5 新增（optional——one-shot state 不 init → undefined → G4 no-op 边界延续；watch-runner init 实例）
  // D-G5-4'：viewCache = per-page-bundle（ViewCompiledModule[]——存 viewParseWalk 完整有序 bundle，cache-hit re-emit 原序保字节一致）
  viewCache?: Map<string, ViewCompiledModule[]>   // per-page-bundle（D-G5-4'，反转 D-G4-3 per-module）
  styleCache?: Map<string, StyleCompiledModule>   // per-page bare（D-G4-3，style 无 transitive subs）
  // ...
}
```

实例化：watch-runner 创建（session-scoped，cross-rebuild）；one-shot state **不 init**（`viewCache`/`styleCache` = `undefined`）→ orchestrator plumbing `ctx.viewCache = undefined` → stage-channel 写 no-op（G4 D-G4-7 边界延续）→ one-shot 全量编译 → diff=0。

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
// stage-channel.ts input——view/style cache 是 bare Map（D-G5-1/D-G4-3），无 toJSON（F12 纠正：不能镜像 logic IIFE 的 c.toJSON()——logic 的 ModuleResultCache 有 toJSON，bare Map 没有）
viewCache: (() => { const c = (ctx as { viewCache?: Map<string, unknown> }).viewCache; return c ? new Map(c) : null })(),
styleCache: (() => { const c = (ctx as { styleCache?: Map<string, unknown> }).styleCache; return c ? new Map(c) : null })(),
// logic cache IIFE（:47）仍用 toJSON——ModuleResultCache 有该方法；view/style bare Map 用 new Map(c) copy constructor
// invalidatedModules 已传（:48）
```

### §2.4 style cache-hit skip（R-G5-4，RG5-3 较简单）

```typescript
// style/index.ts compileSS（G5）——viewCompile 传 msg.styleCache/msg.invalidatedModules（F4）
async function compileSS(pages, root, progress, options, styleCache?, invalidated?): Promise<StyleCompiledModule[]> {
  const results: StyleCompiledModule[] = []  // 只返 cache-miss（D-G5-3/D-IU-5：cache-hit 不返——已在 main-thread cache，stage-channel 不重写）
  for (const page of pages) {
    const cached = styleCache?.get(page.path)  // cross-rebuild 读
    const isInvalidated = invalidated?.includes(page.path) ?? false
    if (cached && !isInvalidated) {
      // ★ cache-hit：跳 buildCompileCss，用 cached code/map re-emit（不 push——D-G5-3）
      const entry = await emitStyle([{ moduleId: page.path, code: cached.code, map: cached.map }], ...)
      abilityALS.get().sink.write(entry)
    } else {
      // cache-miss：编译 + push（stage-channel 写 cache）
      const result = await buildCompileCss(page, new Set(), options)
      const mod: StyleCompiledModule = { moduleId: page.path, kind: 'style', code: result.code, map: result.map, dependencies: [] }
      results.push(mod)
      const entry = await emitStyle([{ moduleId: page.path, code: mod.code, map: mod.map }], ...)
      abilityALS.get().sink.write(entry)
    }
    progress.completedTasks++
  }
  return results  // 只 cache-miss（dirty）
}
```

style 非 recursive（buildCompileCss concat sub-styles 进单 code，D-G4-2）→ cache-hit per-page 直接。

### §2.5 view cache-hit skip（R-G5-4，**D-G5-4' per-page-bundle——实施期 P-G506 验证反转 F6**）

**实施期发现**（P-G506 watch byte-identity 验证）：F6 原设计用 `graph.getDirectDependencies(page,'component')` 重建 sub 集不可行——graph 'component' 边仅 **direct**（非 transitive），且 **不含 wxs modules**（wxs 走 'view' kind 边），且**序不一致**（graph 序 vs viewParseWalk DFS 插入序）→ cache-hit bundle 缺 transitive subs + wxs → 字节差异（实测 base/pages_index.js b1=10525 vs b2=3049）。

**D-G5-4' 解**：viewCache 改 **per-page-bundle**——cache value = `ViewCompiledModule[]`（= viewParseWalk 完整有序 EmitModule[]，page+transitive subs+wxs 全量）。cache-hit 直接 re-emit 该存储 bundle（原序原集→字节一致）。invalidation = bundle 内任一 module invalidated → cache-miss 全量 viewParseWalk。

```typescript
// view/index.ts compileML（G5 D-G5-4'）——viewCompile 传 msg.viewCache/msg.invalidatedModules
async function compileML(pages, root, progress, viewCache?, invalidated?): Promise<{ results: ViewCompiledModule[], pageBundles: Array<{pagePath, modules}> }> {
  const results: ViewCompiledModule[] = []  // 只返 cache-miss（D-G5-3/D-IU-5）
  const pageBundles: Array<{ pagePath: string; modules: ViewCompiledModule[] }> = []  // 供 stage-channel 写 per-page-bundle cache
  for (const page of pages) {
    // ★ cache-hit 预检：page bundle cached 且 bundle 内任一 module 均未 invalidated
    const cachedBundle = viewCache?.get(page.path)  // ViewCompiledModule[] | undefined
    const bundleInvalidated = cachedBundle ? cachedBundle.some(m => invalidated?.includes(m.moduleId) ?? false) : false
    if (cachedBundle && !bundleInvalidated) {
      // ★ cache-hit：跳 viewParseWalk，re-emit 原序 bundle（= cache-miss 结构，保 watch 产物粒度+字节一致）
      const modules = cachedBundle.map(m => ({ moduleId: m.moduleId, code: m.code, map: m.map }))
      await emitEntry({ entryId: page.path, kind: 'view', modules, /* transform/sourcemap/filename/relPrefix 同 cache-miss */ })
      // 不 push——D-G5-3 cache-hit 不返
    } else {
      // cache-miss（bundle 未 cached 或任一 module invalidated → 全量 viewParseWalk）
      const modules = viewParseWalk(page, { sourcemap: enableSourcemap })
      const viewMods = modules.map(mod => ({ moduleId: mod.moduleId, kind: 'view', code: mod.code, map: mod.map, dependencies: [] }))
      results.push(...viewMods)
      pageBundles.push({ pagePath: page.path, modules: viewMods })  // 存 per-page-bundle
      await emitEntry({ entryId: page.path, kind: 'view', modules, ... })
    }
    progress.completedTasks++
  }
  return { results, pageBundles }  // results 只 cache-miss；pageBundles 供 stage-channel 写 cache
}
```

**stage-channel 写入**（per-page-bundle，反转 G4 D-G4-3 per-module）：
```typescript
// stage-channel.ts——view 写块读 result.viewPageBundles
const viewPageBundles = result.viewPageBundles  // Array<{pagePath, modules}>
if (viewCache && viewPageBundles) {
  for (const b of viewPageBundles) viewCache.set(b.pagePath, b.modules)  // per-page-bundle
}
```

**viewCompile 返回 shape**（G5 扩 G4）：`{ viewCompileResults: ViewCompiledModule[], viewPageBundles: Array<{pagePath, modules}> }`（viewCompileResults 仍返 cache-miss dirty 供兼容；viewPageBundles 供 stage-channel 写 cache）。

## §3 决策（draft，待 review 拍板）

### D-G5-1: PackerSessionState viewCache/styleCache = bare Map（接 D-G4-3）

bare `Map<string, ViewCompiledModule>`/`Map<string, StyleCompiledModule>`（G4 D-G4-3 已定 bare）。G5 实例化。不泛型化（D-IU-3）。

### D-G5-2: plumbing 镜像 logic（接 D-G4-5）

`ctx.viewCache = state.viewCache` / `ctx.styleCache = state.styleCache`（镜像 :172/:182）。ctx 类型 G4 已扩 optional。G5 填实例。

### D-G5-3: cache-hit = 跳 compile 不跳 emit + 不返 results（接 D-IU-2/D-IU-5）

cache-hit 用 cached code/map re-emit（emitStyle/emitEntry 调用不变——跳 compile 不跳 emit，D-IU-2）。**反转 G4 期“全量返回”**——G5 incremental filter：**cache-hit 不返 cached 到 results**（D-IU-5 只返回 dirty= 只返 cache-miss 新编译的；cache-hit 已在 main-thread cache，stage-channel 不重写）。worker `results` 数组只收集 cache-miss 编译产物。

### D-G5-4': view cache-hit = per-page-bundle（实施期反转 D-G5-4 F6，P-G506 验证驱动）

**实施期 P-G506 watch byte-identity 验证发现**：D-G5-4 原设计（F6：`graph.getDirectDependencies(page,'component')` 重建 sub 集）不可行——graph 'component' 边仅 direct（非 transitive）、不含 wxs modules、序不一致 → cache-hit bundle 缺内容（实测 b1=10525 vs b2=3049 字节）。

**D-G5-4' 解**：viewCache = **per-page-bundle**（`Map<string, ViewCompiledModule[]>`），cache value = viewParseWalk 完整有序 EmitModule[]（page+transitive subs+wxs）。cache-hit re-emit 存储的原序 bundle → 字节一致（同集同序同 input→emitEntry 确定性输出）。invalidation = bundle 内任一 module moduleId ∈ invalidated → cache-miss 全量 viewParseWalk。**RG5-1 residual 消解**（① graph 一致性 + ② F7 顺序均不再相关——直接存原序 bundle）。

style 仍 per-page bare（D-G4-3/D-G5-5，无 transitive subs）。

### D-G5-5: style cache-hit per-page（RG5-3）

style 非 recursive → per-page cache-hit 直接（§2.4）。已较明确。

### D-G5-6: 行为 0 边界

one-shot：无 invalidatedModules → 无 cache-hit skip → 全量编译 = G4 行为 → diff=0。watch：cache-hit skip = 效率提升（产物字节一致——cached code/map = 全量结果）。

## §4 design gate（readiness）

| RG5 | 门 | 状态 |
|---|---|---|
| RG5-1 | view cache-hit 递归 emit 语义 | ✅ 已解（D-G5-4' per-page-bundle——存 viewParseWalk 完整有序 bundle，cache-hit re-emit 原序→字节一致。反转 F6 graph 重建：P-G506 验证发现 graph direct-only + 无 wxs + 序不一致→不可行） |
| RG5-2 | view dependencies:[] 填充 vs placeholder | ✅ 已解（D-G5-4'：cache-hit 不消费 graph/dependencies，直接用存储 bundle→保持 placeholder） |
| RG5-3 | style cache-hit per-page | ✅ 已解（D-G5-5 per-page bare，0 .wxss diff 实测） |
| RG5-4 | cache-hit 与 intra-build 协同 | ✅ 自动解（cache-hit 跳整 parse-walk→intra-build 不查不写） |

## §5 风险

| 风险 | 缓解 |
|---|---|
| view cache-hit sub-component 重建 | ✅ D-G5-4' per-page-bundle 消解——存原序 bundle，不重建 |
| cache-hit 写回 intra-build 一致性 | ✅ RG5-4 自动解 |
| watch 产物字节一致 | ✅ P-G506 实测：view 0 pages_* diff + style 0 .wxss diff（per-page-bundle 原序 re-emit） |
| behavior-0 watch 验证 | ✅ P-G503 one-shot diff=0（6 项目）；P-G506 view/style byte-identity confirmed |
| logic cache + static-copy byte-identity（pre-existing，out-of-scope） | 已记录为 residual——logic cache（7 logic.js diff，G4 baseline 同样）+ static-copy（invalidatedModules=[] 时跳拷贝）均为 pre-G5 既有，需独立 Action |
