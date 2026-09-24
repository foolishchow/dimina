# FE Tools View/Style Cache-Skip（G5 — incremental-unify 重激活）

- Action: `fe-tools-view-style-cache-skip`
- Status: `complete`
- Status authority: [Action Status](../../../STATUS.md)
- 前置：[`fe-tools-graph-persist`](../fe-tools-graph-persist/README.md)（**complete**；G1——storeInfo state 路径走 reconcile）
- 前置：[`fe-tools-fingerprints-persist`](../fe-tools-fingerprints-persist/README.md)（**complete**；G2——watch-plan content-based dedup）
- 前置：[`fe-tools-invalidation-all-kinds`](../fe-tools-invalidation-all-kinds/README.md)（**complete**；G3——getInvalidatedModules 泛化全 kind，D-IU-1）
- 前置：[`fe-tools-view-style-compile-res`](../fe-tools-view-style-compile-res/README.md)（**complete**；G4——view/style worker 返 ViewCompiledModule[]/StyleCompiledModule[] + stage-channel 写 ctx.viewCache/styleCache）
- 设计输入：[`fe-tools-incremental-unify`](../../deferred/fe-tools-incremental-unify/design.draft.md)（**deferred**；D-IU-2/3/4/5）

## 背景

增量前置链 G1→G2→G3→G4 已 complete。incremental-unify（deferred）的 acceptance 拆分落地：

| A-IU | 内容 | 落地 |
|---|---|---|
| A-IU-1 | getInvalidatedModules 泛化全 kind | G3 ✅ complete |
| A-IU-2 | computeInvalidatedModules 泛化 | G3 ✅ complete |
| A-IU-3 | view/style cache 接入 | G4 = 数据源+写（worker 返 + stage-channel 写）；**G5 = 实例 + plumbing + 读** |
| A-IU-4 | cache hit → skip | **G5**（view/style worker 收 cache 快照 + invalidatedModules → cache hit 跳 compile） |
| A-IU-5 | 行为 0 | G4 one-shot diff=0 ✅；G5 watch 路径 cache-hit skip（行为变更——watch 效率提升，非 no-op） |

## 目标

**view/style cache-hit skip**——闭合 incremental-unify（A-IU-3 剩余 + A-IU-4）：

1. `PackerSessionState` 加 `viewCache`/`styleCache` 字段（bare `Map<string, ViewCompiledModule>`/`Map<string, StyleCompiledModule>`，D-G4-3）
2. `orchestrator.ts` state→ctx plumbing（`ctx.viewCache = state.viewCache`，镜像现有 `ctx.cache = state.moduleCache`）
3. `stage-channel.ts` worker input 加 viewCache/styleCache 快照（bare Map 用 `new Map(c)`——F12：非 toJSON，logic 的 ModuleResultCache 才有 toJSON）
4. `view/index.ts` `compileML` + `style/index.ts` `compileSS` cache-hit skip——moduleId 在 cache 且 NOT in invalidatedModules → 跳 compile，返 cached ViewCompiledModule/StyleCompiledModule（re-emit cached code/map）

## 非目标

- 不泛型化 `ModuleResultCache`（D-IU-3；logic 保持）
- 不改 logic cache 路径（D-IU-3 logic 不变）
- 不重构 viewParseWalk / buildCompileCss（G4 守——parse-walk 不动）
- 不实现 HMR / load-compile 分离（后续门）
- 不删 `DIMINA_COMPILER_DIFF_VERIFY`（等 packer 稳定）

## 设计输入（incremental-unify D-IU-2/3/4/5）

- **D-IU-2**（ViewCompiledModule shape + cache hit 跳 compile 不跳 emit）——G4 反转：降级 base+dependencies:[]，renderBody/wxsBindings 留 undefined。**G5 须 account**：cache-hit re-emit cached code/map（不跳 emit）
- **D-IU-3**（不泛型化；view/style 各建独立 plain Map）——G4 已守（bare Map）。G5 实例化
- **D-IU-4**（intra-build + cross-rebuild 两层）——G4 = cross-rebuild 写 only。**G5 = cross-rebuild 读 + skip**；intra-build（moduleCompileCache）不变
- **D-IU-5**（只返回 dirty result）——G4 期全量返回（all dirty）。**G5 = incremental filter**（cache-hit skip 不返）

## 核心设计门（readiness blocker）

### RG5-1: view cache-hit 递归 emit 语义 + sub-recompile ViewModule（D-G4-1 deferred；F6 细化，◑ 近解）

view discovery 是**递归**——`compileML(page)` → `viewParseWalk(page)` → `compileViewTree:324/368` 走 `usingComponents` → 产 `EmitModule[]`（page + 各 sub-component 独立 entry）。G4 收集 `ViewCompiledModule[]`（page + 各 sub-component 各一条）。

cache-hit 时若跳 viewParseWalk → **丢失 sub-component 发现** → 漏 emit。**F6 细化**（近解）：
- **allCached 预检**：cache-hit 仅当 page + 全 subs（graph `getDirectDependencies(page.path,'component')`）均 cached 且均 NOT invalidated
- **ONE emitEntry bundle**：cache-hit 一次 emitEntry 含 page+subs 全部 cached modules（= cache-miss 结构，保 watch 产物粒度一致→behavior-0）
- **③ 降级**：任一 sub invalidated → page 全量 recompile（viewParseWalk 内部构造 sub ViewModule，避免 sub-recompile ViewModule 来源问题）

**residual**（验证题，非性 blocker）：① graph 'component' 边 = viewParseWalk discovered usingComponents 一致性（G3 graph 全 kind——预期一致，须测试确认）；② **modules[] 顺序一致性**（F7）：cache-hit `modules=[pageCached,...graph subs]` 顺序须 = cache-miss `viewParseWalk EmitModule[]` 顺序——倾向两路径 sort by moduleId 或验 emitEntry order-invariant。

### RG5-2: view cache-hit 是否需 dependencies:[] 填充 ✅ 已解（F6）

G4 设 `dependencies: []`（placeholder，D-G4-1）。F6 细化后：cache-hit 用 graph `getDirectDependencies(page.path,'component')` 查 sub IDs，**不消费 cached.dependencies** → **dependencies: [] 保持 placeholder**（CompiledModuleBase required 须提供值，G4 已设 `[]`）。

### RG5-3: style cache-hit（较简单）

style `buildCompileCss(page)` per-page，非递归（component sub-styles concat 进单 code，D-G4-2）。cache-hit = per-page：moduleId（page.path）cached 且 NOT invalidated → 跳 buildCompileCss，返 cached StyleCompiledModule（re-emit cached code/map）。无递归 emit 问题（单 code blob）。**已较明确**，design 拍板即足。

### RG5-4: cache-hit 与 intra-build（moduleCompileCache）协同 ✅ 自动解

D-IU-4 检查顺序：intra-build 先查 → miss 则 cross-rebuild → miss 则 compile → 写回两层。**G5 自动解**：cache-hit 跳整 parse-walk 路径（viewParseWalk/buildCompileCss）→ intra-build `moduleCompileCache`（parse-walk 内部）既不查也不写。cross-rebuild hit 不写 intra-build（intra-build 仅 compile-miss 路径写，现有行为）。**非 readiness blocker**——行为自然 fallout。

## Deliverables

1. `PackerSessionState` `viewCache`/`styleCache` 字段（bare Map）
2. `orchestrator.ts` state→ctx plumbing（view/style）
3. `stage-channel.ts` worker input viewCache/styleCache 快照
4. `view/index.ts` `compileML` cache-hit skip（RG5-1 决策后）
5. `style/index.ts` `compileSS` cache-hit skip（RG5-3）
6. 测试（cache-hit 触发 + 行为 0 + logic 回归）

## 行为 0 边界

- **one-shot build**：无 invalidatedModules（stage-channel 传 null）→ 无 cache-hit skip → 全量编译 → diff=0（与 G4 同）
- **watch 路径**：cache-hit skip = **行为变更**（watch 效率提升，非 no-op）——watch 产物仍字节一致（cached code/map = 全量编译结果）；效率 = 跳 compile

## 前置链状态

G1 ✅ → G2 ✅ → G3 ✅ → G4 ✅ → **G5 draft**（readiness gate 待 RG5-1..4 解）

## 相关

- [`fe-tools-incremental-unify`](../../deferred/fe-tools-incremental-unify/design.draft.md)（deferred；D-IU-1..5 设计输入；G5 重激活闭合 A-IU-3 剩余 + A-IU-4）
