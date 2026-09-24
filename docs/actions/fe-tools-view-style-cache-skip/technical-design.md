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
  // G5 新增（optional——one-shot state 不 init → undefined → G4 no-op 边界延续；watch-runner init 实例）
  viewCache?: Map<string, ViewCompiledModule>   // bare（D-G4-3）
  styleCache?: Map<string, StyleCompiledModule>  // bare
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

### §2.5 view cache-hit skip（R-G5-4，RG5-1 待决）

**view discovery recursive**（compileViewTree:324/368 走 usingComponents → page + 各 sub-component 独立 EmitModule）。cache-hit 若跳 viewParseWalk → 丢失 sub-component 发现。

```typescript
// view/index.ts compileML（G5，RG5-1 方向 A + ③）——viewCompile 传 msg.viewCache/msg.invalidatedModules（F4）
async function compileML(pages, root, progress, viewCache?, invalidated?): Promise<ViewCompiledModule[]> {
  const results: ViewCompiledModule[] = []  // 只返 cache-miss（D-G5-3/D-IU-5）
  for (const page of pages) {
    // ★ 预检查：page + 全 subs 须均 cached 且均 NOT invalidated（F6：先查再 emit，避免 sub invalidated 时 page 已 emit → double-emit）
    const pageCached = viewCache?.get(page.path)
    const pageInvalid = invalidated?.includes(page.path) ?? false
    const subIds = getDependencyGraph().getDirectDependencies(page.path, 'component')  // page 的 component deps
    const subEntries = subIds.map(id => ({ id, cached: viewCache?.get(id), invalid: invalidated?.includes(id) ?? false }))
    const allCached = pageCached && !pageInvalid && subEntries.every(e => e.cached && !e.invalid)
    if (allCached) {
      // ★ cache-hit：page + 全 subs 均 cached 无 invalidated——ONE emitEntry bundle（F6：保 emit 粒度= cache-miss，watch 产物结构一致）
      const modules = [pageCached, ...subEntries.map(e => e.cached)].map(m => ({ moduleId: m.moduleId, code: m.code, map: m.map }))
      await emitEntry({ entryId: page.path, kind: 'view', modules, /* transform/sourcemap/filename/relPrefix 同 cache-miss */ })
      // 不 push——D-G5-3 cache-hit 不返
    } else {
      // cache-miss（含③ 降级：任一 sub invalidated → page 全量 recompile，sub cache-hit 优化仅当 page+全 subs cached 生效）
      const modules = viewParseWalk(page, { sourcemap: enableSourcemap })
      for (const mod of modules) {
        results.push({ moduleId: mod.moduleId, kind: 'view', code: mod.code, map: mod.map, dependencies: [] })
      }
      await emitEntry({ entryId: page.path, kind: 'view', modules, ... })  // emit 不变（与 cache-miss 同结构）
    }
    progress.completedTasks++
  }
  return results  // 只 cache-miss（dirty）
}
```

**RG5-1 未决点**（含 sub-problem，已 F6 细化）：
- **emit 粒度保 matter**（F6）：cache-hit 须 ONE emitEntry bundle page+subs（= cache-miss 结构），不能 per-module 分别 emit（否则 watch 产物结构差异→behavior-0 破坏）。cache-hit 仅当 page + 全 subs cached 且均 NOT invalidated——任一 sub invalidated → ③ 降级全量 recompile（simplest + 保 emit 结构）
- **sub-recompile ViewModule 来源**（RG5-1 core sub-problem）：③ 降级避免此问题——sub invalidated → page 全量 viewParseWalk（viewParseWalk 内部构造 sub ViewModule），不走单独 sub recompile。**倾向③**（simplest + sound + 保 emit 结构）
- dependencies:[] 是否需填充（RG5-2）——若方向 A + ③，cache-hit 用 graph 查 sub IDs，不依赖 cached.dependencies → 保持 placeholder

## §3 决策（draft，待 review 拍板）

### D-G5-1: PackerSessionState viewCache/styleCache = bare Map（接 D-G4-3）

bare `Map<string, ViewCompiledModule>`/`Map<string, StyleCompiledModule>`（G4 D-G4-3 已定 bare）。G5 实例化。不泛型化（D-IU-3）。

### D-G5-2: plumbing 镜像 logic（接 D-G4-5）

`ctx.viewCache = state.viewCache` / `ctx.styleCache = state.styleCache`（镜像 :172/:182）。ctx 类型 G4 已扩 optional。G5 填实例。

### D-G5-3: cache-hit = 跳 compile 不跳 emit + 不返 results（接 D-IU-2/D-IU-5）

cache-hit 用 cached code/map re-emit（emitStyle/emitEntry 调用不变——跳 compile 不跳 emit，D-IU-2）。**反转 G4 期“全量返回”**——G5 incremental filter：**cache-hit 不返 cached 到 results**（D-IU-5 只返回 dirty= 只返 cache-miss 新编译的；cache-hit 已在 main-thread cache，stage-channel 不重写）。worker `results` 数组只收集 cache-miss 编译产物。

### D-G5-4: view cache-hit = graph 'component' 边 + allCached 预检 + ③ 降级（RG5-1 F6 细化，◑ 近解）

F6 细化：cache-hit 用 `graph.getDirectDependencies(pageId, 'component')` 查 sub IDs；**allCached 预检**（page+全 subs cached 无 invalidated）→ ONE emitEntry bundle（保粒度）；任一 sub invalidated → ③ page 全量 recompile（viewParseWalk 内部构造 sub ViewModule）。不改 viewParseWalk（D-G4-1）。**RG5-1 residual**（验证题，非性 blocker）：① graph 边 = viewParseWalk discovery 一致性 ② modules[] 顺序一致性（F7，倾向 sort by moduleId 两路径）。

### D-G5-5: style cache-hit per-page（RG5-3）

style 非 recursive → per-page cache-hit 直接（§2.4）。已较明确。

### D-G5-6: 行为 0 边界

one-shot：无 invalidatedModules → 无 cache-hit skip → 全量编译 = G4 行为 → diff=0。watch：cache-hit skip = 效率提升（产物字节一致——cached code/map = 全量结果）。

## §4 design gate（readiness）

| RG5 | 门 | 状态 |
|---|---|---|
| RG5-1 | view cache-hit 递归 emit 语义 + sub-recompile ViewModule（F6 细化：allCached 预检 + ③ 降级 + ONE emitEntry bundle 保粒度） | ◑ 近解（residual ① graph 'component' 边 = viewParseWalk discovery 一致性；② F7 modules[] 顺序一致性 cache-hit `[page,...graph subs]` vs cache-miss viewParseWalk EmitModule[] 顺序——倾向两路径 sort by moduleId 或验 emitEntry order-invariant；均验证题，非性 blocker） |
| RG5-2 | view dependencies:[] 填充 vs placeholder | ✅ 已解（F6：cache-hit 用 graph 查 sub IDs，不消费 cached.dependencies→保持 placeholder） |
| RG5-3 | style cache-hit per-page | ✅ 较明确（design 拍板即足） |
| RG5-4 | cache-hit 与 intra-build 协同 | ✅ 自动解（cache-hit 跳整 parse-walk→intra-build 不查不写；非 readiness blocker） |

## §5 风险

| 风险 | 缓解 |
|---|---|
| view cache-hit sub-component invalidated 时 recompile 需 ViewModule | RG5-1 待决——可能需 viewParseWalk 不跳 discovery（方向 C）或 graph 查 sub |
| cache-hit 写回 intra-build 一致性 | RG5-4 待决 |
| watch 产物顺序变更 | cache-hit re-emit 用 cached code/map → 字节一致；顺序 = pages 迭代顺序（不变） |
| behavior-0 watch 验证 | watch 路径非 no-op——靠单测 + 回归（cache-hit 触发 + 产物字节一致） |
