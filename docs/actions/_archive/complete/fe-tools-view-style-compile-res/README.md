# fe-tools-view-style-compile-res

- Status: `complete`
- Created: 2026-10-07
- ID: `fe-tools-view-style-compile-res`

## Problem

view/style worker 当前 `compile` 返回 `void`——编译产物在 worker 内**inline emit**（view 经 `emitEntry`、style 经 `sink.write`），不返回模块级编译结果。

`stage-channel.ts` 的 cache 写入块**已泛化**（`if (cacheInstance && compileRes) { cacheInstance.set(...) }`），对 view/logic/style 三车道都执行——**前提是 worker 返回 `compileRes`**。但只有 logic worker 返回（`logic/index.ts:62` `{ compileRes, logicDependencies }`）；view（`view/index.ts:viewCompile` 返回 `Promise<void>`）和 style（`style/index.ts:styleCompile` 返回 `Promise<void>`）都不返回。

后果：G3 让 `getInvalidatedModules` 覆盖全 kind → 失效集现在**含 view/style moduleId**，但 view/style cache 永远空（无数据源）→ 无 cache 可咨询 → view/style 增量不落地（watch rebuild 仍全量重编译 view/style）。这是增量前置链的 **G4**。

## Goal

view/style worker 像 logic 一样返回模块级编译结果：

- view 返回 `ViewCompiledModule[]`（`packer/types.ts:118` D-PCS-10，shape 已存在）
- style 返回 `StyleCompiledModule[]`（`packer/types.ts:125` D-PCS-10）
- stage-channel 写入 `ctx.viewCache` / `ctx.styleCache`（guarded optional chaining——无实例时 no-op）

为 **G5**（watch-runner 创建 view/style cache 实例 + orchestrator state→ctx plumbing + cache hit → skip = incremental-unify 重激活）备**数据源**。G4 单独不产生可观察的增量效果（无 cache 实例 → 写 no-op），但铺好 return + write 结构，G5 接入即激活。

## Design inputs

- `fe-tools-incremental-unify`（deferred）design.draft.md **D-IU-2**（ViewCompiledModule shape + dependencies compile 时产出 + cache hit 跳 compile 不跳 emit）
- `fe-tools-incremental-unify` **D-IU-3**（不泛型化 ModuleResultCache；view/style 各建独立 plain Map 实例，value 类型不同）
- `fe-tools-incremental-unify` **D-IU-4**（intra-build moduleCompileCache + cross-rebuild 新 cache 两层共存）
- `fe-tools-incremental-unify` **D-IU-5**（只返回 dirty result，IPC 增量）
- `packer/types.ts` `CompiledModule` discriminated union（`LogicCompiledModule | ViewCompiledModule | StyleCompiledModule`，D-PCS-10，类型已存在）

## Deliverables

| # | File | Change |
|---|---|---|
| 1 | `src/compiler/view/index.ts` | `compileML` 收集 `ViewCompiledModule[]`（base 字段，dependencies: []，renderBody?/wxsBindings? 留 undefined，D-G4-1 降级）；`viewCompile` 返回 `{ viewCompileResults }`（successPayload 由 runtime 合并，勿 spread）；emit 路径不变 |
| 2 | `src/compiler/style/index.ts` | `compileSS` 收集 `StyleCompiledModule[]`（base，dependencies: []，styleScopeId? 留 undefined，D-G4-2 降级）；`styleCompile` 返回 `{ styleCompileResults }`；styleEngine 用默认 successPayload（不补）；emit 路径不变 |
| 3 | `src/compiler/pipeline/stage-channel.ts` | 新增 view/style cache 写入块（`const viewCache = ctx.viewCache; if (viewCache && viewCompileResults) { ... }`，guarded） |
| 4 | ctx 类型（`compile-target.types.ts` 或 stage-channel 局部 `as`） | optional `viewCache?: Map<string, ViewCompiledModule>` / `styleCache?: Map<string, StyleCompiledModule>` |
| 5 | `__tests__/` | stage-channel 单测：注入 mock ctx.viewCache/styleCache 验证 `set` 调用；view/style worker 返回 shape 断言 |

## Dependencies

- [`fe-tools-invalidation-all-kinds`](../fe-tools-invalidation-all-kinds/README.md)（**complete**；G3——getInvalidatedModules 覆盖全 kind，失效集含 view/style moduleId）
- [`fe-tools-incremental-unify`](../../deferred/fe-tools-incremental-unify/design.draft.md)（**deferred**；D-IU-2/3/4/5 设计输入——本门实现 view/style 部分）
- [`fe-tools-packer-core-shape`](../fe-tools-packer-core-shape/README.md)（**complete**；D-PCS-10 CompiledModule discriminated union——ViewCompiledModule/StyleCompiledModule 类型来源）
- [`fe-tools-module-result-cache`](../fe-tools-module-result-cache/README.md)（**complete**；M2 D-RC-1..3 logic cache 闭环——**参照模式（非前置：G4 不碰 ModuleResultCache，D-IU-3 logic cache 保持）**）

## Non-goals

- watch-runner 创建 view/style cache 实例（**G5**）
- `PackerSessionState` 加 `viewCache`/`styleCache` 字段（**G5**）
- `orchestrator.ts` state→ctx plumbing for view/style（**G5**）
- cache hit → skip（跳过 compile，**G5** = incremental-unify 重激活 A-IU-4）
- ModuleResultCache 泛型化（后续 Packer 接入；D-IU-3 明示不泛型化）
- view/style emit 改 deferred（保留 inline emit；G4 只增返回值不改 emit）
- logic cache 改动（`CachedModuleResult`/`ModuleResultCache` 不变——D-IU-3 logic cache 保持）

## Readiness gates（review R1-R3 修正后状态）

- **RG4-1 ✅ 已解**（降级，D-G4-1）：`viewParseWalk` 返 `EmitModule`（`emit.ts:8` = `{moduleId, code, map, extraInfoCode?}`，无 renderBody/wxsBindings/dependencies/kind）→ ViewCompiledModule 只填 base + dependencies；renderBody?/wxsBindings? 留 undefined（optional；G5 cache-hit 用最终 code/map，不需中间解析产物）
- **RG4-2 ✅ 已解**（降级，D-G4-2）：`buildCompileCss` 返 `StyleCompileResult`（`{code, map}`，无 dependencies/styleScopeId）→ StyleCompiledModule 只填 base（dependencies: []，style 合理：buildCompileCss concat sub-styles 进单 code → cache-hit 重 emit 即足，不需 dep traversal）；styleScopeId? 留 undefined（无实现源）；styleEngine 用默认 successPayload（不补）
- **RG4-3 ✅ 已解**（bare，D-G4-3）：cache value = bare `ViewCompiledModule`/`StyleCompiledModule`（dependencies 已在 CompiledModuleBase，反转 D-IU-2 双存冗余）
- **RG4-4 ✅ 已解**（dependencies: []，第 3 轮 F21/F22/F23 修正）：CompiledModuleBase required 字段须提供值。**style `[]` 合理**（buildCompileCss concat sub-styles 进单 code，cache-hit 重 emit 即足）。**view `[]` placeholder**（discovery recursive—compileViewTree:324/368 走 usingComponents；G5 cache-hit 语义未定 A-IU-4，若跳 compileViewTree 须 dep traversal 类比 logic logicDependencies:105 → dependencies 可能被 G5 消费；若需从 graph.getDirectDependencies(id,'component') 查 :369，非 viewParseWalk 重构）。G3 已用 graph 边 invalidation。
- **RG4-5**（待 impl 审）：ctx plumbing 边界——G4 仅 ctx TYPE(optional/as) + 写；state 字段 + orchestrator plumbing + watch-runner 实例 = G5；G4 期 ctx.viewCache 永远 undefined → 写 no-op → 行为 0；G4 不在 orchestrator 加 plumbing（D-G4-7/F14）
- **RG4-6**（待 impl 审）：emit 不变——只 push+return，emit 调用点原样；不双 emit / 不改顺序 / 不改字节

## Constraints

- 行为 0：one-shot build 产物字节完全不变（`ctx.viewCache/styleCache` 在 G4 期未设 → 写 no-op → 无行为变更）。
- emit 路径不变：view/style 仍 inline emit；G4 只**额外**返回 compiled result 供 cache。
- 只返回 dirty result（D-IU-5）：view/style worker 只返回 invalidated 模块（G5 接 cache hit 后；G4 期 view/style worker 当前不读 invalidatedModules（stage-channel 已传但忽略）→ 全量返回 = 当前行为，但返回 shape 就位）。
- 不加 `any` / `as any` / `@ts-nocheck` / `[key: string]`（新代码）。`as { viewCompileResults?: ... }` 结构断言允许（与 stage-channel 现有 `(result as { compileRes? })` 同模式）。

## Closure conditions

- A-G41..5 全部 ✅；
- 首次 build diff=0（全量 7 项目）；
- vitest 全绿（含 stage-channel 写入单测）；
- 回流 architecture-notes。

## References

- Status authority: [Action Status](../../../STATUS.md)
- 前置：[`fe-tools-invalidation-all-kinds`](../fe-tools-invalidation-all-kinds/README.md)（G3 complete）
- 设计输入：[`fe-tools-incremental-unify`](../../deferred/fe-tools-incremental-unify/design.draft.md)（D-IU-2/3/4/5）
- 类型来源：[`fe-tools-packer-core-shape`](../fe-tools-packer-core-shape/README.md)（D-PCS-10 CompiledModule）
- [Experience-Review.md](../../../../Experience-Review.md) §12 行为 0 全量验证
