# Technical Design — fe-tools-view-style-compile-res

Status: **ready（2026-10-08）**

> **本门为 `draft`**——§2 target 为设计草稿（基于 incremental-unify D-IU-2/3/4/5）；§3 决策标 design-gate（RG4-1..6）须 review 解决后定稿升 `ready`。

## §1 现状

### §1.1 stage-channel cache 写入块（已泛化）

```typescript
// stage-channel.ts — M2 D-RC-3
const cacheInstance = ctx.cache          // logic ModuleResultCache
const compileRes = result.compileRes    // logic worker 返回
const logicDeps = result.logicDependencies
if (cacheInstance && compileRes) {
    for (const info of compileRes) {
        const deps = logicDeps?.[info.path] ?? []
        cacheInstance.set(info.path, { compileInfo: info, logicDependencies: deps })
    }
}
```

此块读 `result.compileRes`（logic 字段名）+ `result.logicDependencies` + value shape `{compileInfo, logicDependencies}`——**logic 专用**。view/style 须**新增镜像块**（不同字段名 `viewCompileResults`/`styleCompileResults` + 不同 cache `ctx.viewCache`/`ctx.styleCache` + 不同 value shape `ViewCompiledModule`/`StyleCompiledModule`）。distinct 字段名**必要**（非风格）——防现有 logic 块 `if (result.compileRes)` 误抓 view/style 结果（logic value shape `{compileInfo, logicDependencies}` 与 ViewCompiledModule/StyleCompiledModule 不同，复用 `compileRes` 会被错处理）。logic 块就位；view/style 块 = G4 新增（§2.3）。

### §1.2 logic cache 闭环（参照模式）

```
orchestrator.ts:172  cache = state.moduleCache        // PackerSessionState
orchestrator.ts:182  ctx.cache = cache                // state→ctx plumbing
stage-channel        input.cache = new Map(ctx.cache.toJSON())  // 快照传入 worker
worker (logic):      cache hit? skip → cached.compileInfo + cached.logicDependencies
                     cache miss? compile → return { compileRes, logicDependencies }
stage-channel:       cache.set(info.path, { compileInfo, logicDependencies })  // 写回
```

G4 = 把这条闭环的"worker 返回 + stage-channel 写"两步复刻到 view/style。**state→ctx plumbing + 实例创建 = G5**。

### §1.3 view worker 现状（返回 void）

```typescript
// view/index.ts
async function viewCompile({ msg, progress, config }): Promise<void> {
    // ...
    await compileML(m.pages.mainPages, null, progress)   // emitEntry 内联
    for (const [root, subPages] of ...) {
        await compileML(subPages.info, root, progress)
    }
    clearViewCaches()
}
function viewSuccessPayload({ logger }) {
    return { dependencyGraph: ..., compatibilityWarnings: ... }
}
// engine.compile = viewCompile（返回 void）；successPayload 提供图+警告
```

`compileML` 内 `emitEntry({ entryId: page.path, kind: 'view', modules, transform, ... })`——`modules` 来自 `viewParseWalk(page, ...)`。**compiled 数据（modules）存在于调用点，但未返回。**

**注（review R1 F1）**：`EmitModule`（`emit.ts:8-13`）= `{ moduleId, code, map, extraInfoCode? }`——**无** `dependencies`/`renderBody`/`wxsBindings`/`kind`。`renderBody`/`wxsBindings` 在 `viewParseWalk` 内部 `buildWxsDeclarations`（`view/parse-walk.ts:1278`）产生但**不挂到 EmitModule**（用于内部 wxs replacement 后丢弃）。故 ViewCompiledModule 的 `renderBody?`/`wxsBindings?` 在 G4 **降级**留 `undefined`（见 D-G4-1）。

### §1.4 style worker 现状（返回 void）

```typescript
// style/index.ts
async function compileSS(pages, root, progress, options): Promise<void> {
    for (const page of pages) {
        const result = await buildCompileCss(page, new Set(), options)  // { code, map }
        const entry = await emitStyle([{ moduleId: page.path, code: result.code, map: result.map }], ...)
        const { sink } = abilityALS.get()
        sink.write(entry)   // inline emit
    }
}
async function styleCompile({ msg, progress, config }): Promise<void> { /* compileSS loops */ }
// styleEngine 用 defineEngine 默认 successPayload（不覆盖即返 dependencyGraph；无 compatibilityWarnings）
```

`buildCompileCss`（`style/parse-walk.ts:63`）产 `StyleCompileResult`（:35-38）= `{ code, map }`——**无** `dependencies`/`styleScopeId`。`@import` 处理（:476）是 CSS URL rewriting（`@import url(/abs)` 路径替换），**非 module dep**；style 实际 module dep = component sub-modules via graph 'component' 边（`buildCompileCss:84-90` 已查得）。`styleScopeId` 全局无实现源（仅 `packer/types.ts:127` 声明）。故 StyleCompiledModule `dependencies: []`（G5 不消费，见 D-G4-2）、`styleScopeId?` 留 `undefined`。

**注（review R1 F4）**：`styleEngine` 用 `defineEngine` **默认 `successPayload`**（`define-engine.ts:28` 返 `dependencyGraph`），非“无 successPayload”——`result.dependencyGraph` 已由默认提供，G4 不补。

### §1.5 类型已存在（packer/types.ts D-PCS-10）

```typescript
interface CompiledModuleBase {
    moduleId: string; kind: ModuleKind; code: string; map: string | null; dependencies: string[]
}
interface ViewCompiledModule extends CompiledModuleBase {
    kind: 'view'; renderBody?: { start: number; end: number }; wxsBindings?: WxsBinding[]
}
interface StyleCompiledModule extends CompiledModuleBase {
    kind: 'style'; styleScopeId?: string
}
type CompiledModule = LogicCompiledModule | ViewCompiledModule | StyleCompiledModule
```

**类型位置已定**（packer/types.ts，D-PCS-10）。G4 只消费，不定义。

### §1.6 现有 logic cache value 形状（参照，不改）

```typescript
// module-result-cache.ts（logic 专用，D-IU-3 不改）
interface CachedModuleResult { compileInfo: CompileInfo; logicDependencies: string[] }
class ModuleResultCache { map: Map<string, CachedModuleResult>; ... }
```

`CompileInfo`（logic/index.ts）= `{ path, code, map?, sourceFile, extraInfoCode?, component?, usingComponents? }`——与 `LogicCompiledModule` shape **不同**（key `path` vs `moduleId`；字段集不同）。D-IU-3 明示 logic cache 保持不变，view/style 用独立 plain Map（不复用 `ModuleResultCache` class）。

## §2 Target（草稿，基于 D-IU-2/3/4/5）

### §2.1 view worker 返回 ViewCompiledModule[]

```typescript
// view/index.ts
async function compileML(pages, root, progress): Promise<ViewCompiledModule[]> {
    const results: ViewCompiledModule[] = []
    for (const page of pages) {
        const modules = viewParseWalk(page, { sourcemap: enableSourcemap })
        // ★ EmitModule = { moduleId, code, map, extraInfoCode? }（无 renderBody/wxsBindings/dependencies/kind）
        //   降级（D-G4-1）：基础字段映射 + kind 硬编码（D-PCS-10 判别字段）
        //   renderBody?/wxsBindings? 留 undefined（optional；G5 cache-hit 用最终 code/map re-emit，不需中间解析产物）
        //   dependencies: []（CompiledModuleBase required 字段；G5 cache-hit 语义未定（A-IU-4）——
        //     view discovery recursive（compileViewTree:324/368 走 usingComponents），G5 若跳 compileViewTree 须 dep traversal
        //     （类比 logic logicDependencies:105 递归 emit deps）；dependencies 可能被 G5 消费。[] 是 placeholder；若需从 graph 查（:369））
        for (const m of modules) {
            results.push({
                moduleId: m.moduleId, kind: 'view', code: m.code, map: m.map ?? null,
                dependencies: [],
            })
        }
        await emitEntry({ ..., modules, ... })   // emit 不变
        progress.completedTasks++
    }
    return results
}
async function viewCompile({ msg, progress, config }): Promise<{ viewCompileResults: ViewCompiledModule[] }> {
    // ★ compile 只返回 { viewCompileResults }；successPayload 由 runtime.ts:30 单独调并合并
    //   （Object.assign(response, compileResult)）——勿在此 spread successPayload（会 double-flush logger）
    const viewCompileResults: ViewCompiledModule[] = []
    viewCompileResults.push(...await compileML(m.pages.mainPages, null, progress))
    for (const [root, subPages] of ...) {
        viewCompileResults.push(...await compileML(subPages.info, root, progress))
    }
    clearViewCaches()
    return { viewCompileResults }
}
```

### §2.2 style worker 返回 StyleCompiledModule[]

```typescript
// style/index.ts
async function compileSS(pages, root, progress, options): Promise<StyleCompiledModule[]> {
    const results: StyleCompiledModule[] = []
    for (const page of pages) {
        const result = await buildCompileCss(page, new Set(), options)   // { code, map }
        // ★ StyleCompileResult = { code, map }（无 dependencies/styleScopeId）
        //   降级（D-G4-2）：dependencies: []（G5 不消费 style deps——buildCompileCss 已 concat 全部 component
        //     sub-styles 进单 code，cache-hit 重 emit cached code 即足，不需 dep traversal）；styleScopeId? 留 undefined
        results.push({
            moduleId: page.path, kind: 'style', code: result.code, map: result.map ?? null,
            dependencies: [],
        })
        const entry = await emitStyle([{ moduleId: page.path, code: result.code, map: result.map }], ...)
        abilityALS.get().sink.write(entry)   // emit 不变
        progress.completedTasks++
    }
    return results
}
async function styleCompile({ msg, progress, config }): Promise<{ styleCompileResults: StyleCompiledModule[] }> {
    // ★ compile 只返回 { styleCompileResults }；styleEngine 用 defineEngine 默认 successPayload
    //   （define-engine.ts:28 返 dependencyGraph）——runtime.ts:30 自动合并，勿在此返 successPayload 字段
    const styleCompileResults: StyleCompiledModule[] = []
    styleCompileResults.push(...await compileSS(m.pages.mainPages, null, progress, styleOptions))
    for (const [root, subPages] of ...) {
        styleCompileResults.push(...await compileSS(subPages.info, root, progress, styleOptions))
    }
    clearStyleCaches()
    return { styleCompileResults }
}
```

### §2.3 stage-channel 写 view/style cache（guarded）

```typescript
// stage-channel.ts — 现有 logic 块不变，新增两块
const viewCache = (ctx as { viewCache?: Map<string, ViewCompiledModule> }).viewCache
const viewCompileResults = (result as { viewCompileResults?: ViewCompiledModule[] }).viewCompileResults
if (viewCache && viewCompileResults) {
    for (const m of viewCompileResults) { viewCache.set(m.moduleId, m) }   // bare（D-G4-3 已解）
}
// styleCache 同理
```

guarded——G4 期 `ctx.viewCache/styleCache` 未设（G5 才 plumb）→ no-op。

### §2.4 ctx 类型扩展（optional）

`ctx` 当前是 `Record<string, unknown>`（stage-channel `RunCompileStageParams.ctx`）。G4 用 `as` 结构断言读 `viewCache`/`styleCache`（与现有 `(ctx as { cache? }).cache` 同模式）。若需正式类型，`compile-target.types.ts` 加 optional 字段——**design gate（RG4-5）**决定是局部 `as` 还是扩 ctx 类型。

## §3 决策（design-gate 标记）

### D-G4-1: view worker 返回 ViewCompiledModule[]——降级方案（解 RG4-1/4/6）

`compileML` 收集 `ViewCompiledModule[]` 返回；emit 不变。**降级**（review R1 F1 定）：`viewParseWalk` 返回 `EmitModule[]`（`emit.ts:8` = `{ moduleId, code, map, extraInfoCode? }`）——**无** `dependencies`/`renderBody`/`wxsBindings`/`kind`。故 ViewCompiledModule 只填**基础字段**（`moduleId`/`kind:'view'`（D-PCS-10 判别字段硬编码）/`code`/`map`）+ `dependencies: []`（review R2 F15/F17 → 第 3 轮 F21/F22 修正）：CompiledModuleBase required 字段须提供值。**G5 cache-hit 语义未定（A-IU-4）**——view **discovery 是 recursive**（`compileViewTree:324/368` 递归走 usingComponents 收集 component/wxs 子模块），非“emit 非 recursive”（F21 纠正：emit 非递归但 discovery 递归）。故 G5 view cache-hit 若跳 compileViewTree 须 dep traversal（类比 logic `logicDependencies` :105 递归 emit deps）→ `dependencies` **可能被 G5 消费**（非“不消费”）。G4 设 `[]` 为 minimal placeholder（不 break G4 行为 0）；若 G5 需，从 `graph.getDirectDependencies(id,'component')` 查（:369 已用，**非 viewParseWalk 重构**，F22）。G3 已用 graph 边做 invalidation。）；`renderBody?`/`wxsBindings?` **留 `undefined`**（optional 合法）。依据：G5 cache-hit 用**最终 code/map** re-emit（跳 compile 不跳 emit），不需中间解析产物 `renderBody`/`wxsBindings`（它们是 walk 内部 wxs replacement 中间态，re-emit 不消费）。**反转 D-IU-2 全字段期望**——D-IU-2 假设 ViewCompiledModule 全字段填充 + dependencies 收集，G4 降级为 base + `dependencies: []`。

### D-G4-2: style worker 返回 StyleCompiledModule[]——降级 + 默认 successPayload（解 RG4-2/4/6）

`compileSS` 收集 `StyleCompiledModule[]` 返回；emit 不变。**降级**：`buildCompileCss`（`style/parse-walk.ts:63`）返 `StyleCompileResult`（:35 = `{ code, map }`）——**无** `dependencies`/`styleScopeId`。故 StyleCompiledModule 只填**基础字段** + `dependencies: []`（**纠正 review R2 F16**：style module deps 实为 component sub-modules via graph 'component' 边（`buildCompileCss:84-90` 已查得），**非 @import**（:476 是 CSS URL rewriting）；G5 cache-hit **不消费 style deps（合理）**——`buildCompileCss` 已 concat 全部 component sub-styles 进单 `code`，cache-hit 重 emit cached code 即足，不需 dep traversal（**与 view 不同**：view discovery recursive 各 sub-module 独立 entry，G5 可能需 dep traversal，见 D-G4-1）；故 G4 设 `[]`）；`styleScopeId?` **留 `undefined`**（无实现源，optional）。**styleEngine 用 `defineEngine` 默认 `successPayload`**（`define-engine.ts:28` 返 `dependencyGraph`）——`result.dependencyGraph` 已由默认提供，**G4 不补 successPayload**（review R1 F4 纠正：“styleEngine 无 successPayload 须补”主张错误）。`styleCompile` 只返回 `{ styleCompileResults }`，runtime.ts:30 自动合并默认 successPayload。

### D-G4-3: cache value = bare CompiledModule（解 RG4-3）

`Map<string, ViewCompiledModule>` / `Map<string, StyleCompiledModule>`（bare，非 wrapped）。**反转 D-IU-2 双存**：D-IU-2 原文 wrapped `{ module: ViewCompiledModule; dependencies: string[] }`（双存），G4 选 bare。依据 = `dependencies` 已在 `CompiledModuleBase`（`packer/types.ts:103`），双存冗余；G5 invalidation 查询读 `cached.dependencies` 已足。bare 满足 G5 查询需求（同字段，单存）。

### D-G4-4: 不复用 ModuleResultCache class（= D-IU-3）

view/style 用独立 `Map<string, ViewCompiledModule>` / `Map<string, StyleCompiledModule>`（plain Map，非 `ModuleResultCache` class——后者 logic 专用，value `CachedModuleResult` shape 不同）。"统一"是功能层面（三车道都有模块级增量），非类型层面。泛型化留 Packer 接入。

### D-G4-5: ctx plumbing 边界 = G5（design-gate RG4-5）

G4 仅扩展 ctx TYPE（optional `viewCache?`/`styleCache?`，或局部 `as`）+ stage-channel 写。`PackerSessionState.viewCache/styleCache` 字段 + `orchestrator.ts:182` 等价 plumbing（`ctx.viewCache = state.viewCache`）+ watch-runner 创建实例 = **G5**。G4 期 ctx 字段永远 `undefined` → 写 no-op → 行为 0。

### D-G4-6: emit 不变（design-gate RG4-6）

G4 只增 worker 返回值 + stage-channel 写块；**不改 emit 路径**（view 仍 `emitEntry` inline；style 仍 `sink.write` inline）。确认：不双 emit、不改产物顺序、不改字节。`compileML`/`compileSS` 的 emit 调用点原样保留，仅在外层包 `results.push(...)` + `return results`。

### D-G4-7: 行为 0 边界

G4 期 `ctx.viewCache/styleCache` 未设 → stage-channel 写 no-op → 无行为变更 → diff=0。worker 返回额外数据不改变 emit 输出 → 字节一致。**collection（`for (m of modules) results.push`）是 read-only 遍历已返 in-memory modules（无 I/O/无 mutation/无 ordering 变更）→ emit 调用点不变**（review 第 4 轮 F30）。watch 路径：无 cache 实例 → 全量编译不变（直到 G5）。边界：watch 效率不变不在 diff=0 覆盖内。**注（review R3 F14）**：G4 不得在 `orchestrator.ts` 加 view/style plumbing（即使 `state.viewCache` undefined → 仍 no-op 安全，但 plumbing 属 G5）。

### D-G4-8: A-IU-3 拆分授权（解 review R2 F7）

incremental-unify A-IU-3（“view/style ModuleResultCache 接入”，D-IU-2+D-IU-3）是单一 acceptance criterion。G4 拆为：**数据源 + 写路径**（worker 返 compileRes + stage-channel 写）= G4；**实例 + plumbing + cache-hit skip**（PackerSessionState 字段 + orchestrator state→ctx + watch-runner 实例 + skip）= G5。此拆分是 G4 design 决策（非 incremental-unify 显式授权），G5 重激活时承接 A-IU-3 剩余 + A-IU-4 skip → incremental-unify 闭合。

### D-G4-9: D-IU-4 两层 cache boundary（解 review 第 5 轮 F32）

D-IU-4（intra-build moduleCompileCache + cross-rebuild 新 cache 两层共存）。G4 = cross-rebuild **写 only**（stage-channel `ctx.viewCache.set`，guarded no-op 无实例）；intra-build（`moduleCompileCache` parse-walk 内）**不变**；cross-rebuild **读** + skip = **G5**（cache-hit 查 cross-rebuild cache）。G4 不实现 D-IU-4 的“检查顺序”（intra→cross→compile→writeback）——只做 cross writeback；读 + 两层协同 = G5。与 D-G4-5 ctx plumbing boundary 同类（G4 写 hook，G5 实例 + 读）。

## §4 伪代码（实施，待 gate 定稿）

降级方案已定（D-G4-1/2）；§2.1/§2.2/§2.3 伪代码已按降级修正（compile 只返新字段；successPayload 由 runtime 合并；renderBody/wxsBindings/styleScopeId 留 undefined）。待 readiness review 复检后冻结为 implementation-plan step。

## §5 风险

| 风险 | 缓解 |
|---|---|
| `viewParseWalk` 返 `EmitModule`（无 renderBody/wxsBindings/dependencies）；`buildCompileCss` 返 `StyleCompileResult`（无 dependencies/styleScopeId） | D-G4-1/2 **降级**：base 字段映射 + `dependencies: []`（G5 不消费）；renderBody/wxsBindings/styleScopeId 留 undefined（optional）；不重构 parse-walk（review R2 F15/F16/F17） |
| emit 双发或顺序变 | D-G4-6 emit 不变——只 push+return，emit 调用点原样；行为 0 diff=0 验证 |
| compile 返回值误 spread successPayload（double-flush logger） | D-G4-1/2：compile 只返 `{ viewCompileResults }`/`{ styleCompileResults }`；successPayload 由 runtime.ts:30 单独调（review R1 F3） |
| cache value bare vs wrapped 取舍 | D-G4-3 **已决** bare（反转 D-IU-2 双存，dependencies 已在 CompiledModuleBase） |
| ctx `as` 断言扩散 | 与 stage-channel 现有 `(result as { compileRes? })` 同模式（非 `as any`）；RG4-5 决定局部 `as` vs 扩 ctx 类型 |
| G4 无可观察增量效果（写 no-op） | 预期——G4 是数据源 + 写 hook 铺设；G5 接入激活。可观察性经 stage-channel 单测（mock ctx 验证 set 调用）保证 |
