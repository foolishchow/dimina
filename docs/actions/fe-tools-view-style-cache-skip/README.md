# FE Tools View/Style Cache-Skip（G5 — incremental-unify 重激活）

- Action: `fe-tools-view-style-cache-skip`
- Status: `draft`
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-graph-persist`](../_archive/complete/fe-tools-graph-persist/README.md)（**complete**；G1——storeInfo state 路径走 reconcile）
- 前置：[`fe-tools-fingerprints-persist`](../_archive/complete/fe-tools-fingerprints-persist/README.md)（**complete**；G2——watch-plan content-based dedup）
- 前置：[`fe-tools-invalidation-all-kinds`](../_archive/complete/fe-tools-invalidation-all-kinds/README.md)（**complete**；G3——getInvalidatedModules 泛化全 kind，D-IU-1）
- 前置：[`fe-tools-view-style-compile-res`](../_archive/complete/fe-tools-view-style-compile-res/README.md)（**complete**；G4——view/style worker 返 ViewCompiledModule[]/StyleCompiledModule[] + stage-channel 写 ctx.viewCache/styleCache）
- 设计输入：[`fe-tools-incremental-unify`](../_archive/deferred/fe-tools-incremental-unify/design.draft.md)（**deferred**；D-IU-2/3/4/5）

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
3. `stage-channel.ts` worker input 加 viewCache/styleCache 快照（镜像现有 `cache: new Map(c.toJSON())`）
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

### RG5-1: view cache-hit 递归 emit 语义（D-G4-1 deferred）

view discovery 是**递归**——`compileML(page)` → `viewParseWalk(page)` → `compileViewTree:324/368` 走 `usingComponents` → 产 `EmitModule[]`（page + 各 sub-component 独立 entry）。G4 收集 `ViewCompiledModule[]`（page + 各 sub-component 各一条）。

cache-hit 时若跳 viewParseWalk → **丢失 sub-component 发现** → 漏 emit。**待决**：
- 方向 A（D-G4-1 推荐）：cache-hit 用 `graph.getDirectDependencies(pageId, 'component')` 查 sub-component IDs → 递归 cache-hit emit（类比 logic `logicDependencies:105` recursive emit）。若 sub-component 也 cached → emit from cache；若 invalidated → recompile 该 sub。
- 方向 B：cache-hit 粒度 = 整 page（page + sub-components 作一 blob cache）——但 G4 已 per-module cache，需重构 cache shape（违反 D-G4-3 bare）。
- 方向 C：cache-hit 不跳 viewParseWalk discovery，只跳 Vue compileTemplate——但 parse-walk 是昂贵部分， defeating purpose。

**倾向方向 A**（graph 'component' 边递归，不改 viewParseWalk）。G5 design 须拍板。

### RG5-2: view cache-hit 是否需 dependencies:[] 填充

G4 设 `dependencies: []`（placeholder，D-G4-1）。若 RG5-1 选方向 A（graph 查询），则 cache-hit 不依赖 cached.dependencies（直接查 graph）→ **dependencies: [] 保持 placeholder**。若选依赖 cached.dependencies → G5 须在 compile 时填充（从 compileViewTree discovered usingComponents）。**与 RG5-1 联动**。

### RG5-3: style cache-hit（较简单）

style `buildCompileCss(page)` per-page，非递归（component sub-styles concat 进单 code，D-G4-2）。cache-hit = per-page：moduleId（page.path）cached 且 NOT invalidated → 跳 buildCompileCss，返 cached StyleCompiledModule（re-emit cached code/map）。无递归 emit 问题（单 code blob）。**已较明确**，design 拍板即足。

### RG5-4: cache-hit 与 intra-build（moduleCompileCache）协同

D-IU-4 检查顺序：intra-build 先查 → miss 则 cross-rebuild → miss 则 compile → 写回两层。G5 加 cross-rebuild 读。intra-build（view/style parse-walk 内 moduleCompileCache）不变。**待决**：cache-hit 写回 intra-build？或 cross-rebuild hit 不写 intra-build（intra-build 仅 compile miss 写）？

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

- [`fe-tools-incremental-unify`](../_archive/deferred/fe-tools-incremental-unify/design.draft.md)（deferred；D-IU-1..5 设计输入；G5 重激活闭合 A-IU-3 剩余 + A-IU-4）
