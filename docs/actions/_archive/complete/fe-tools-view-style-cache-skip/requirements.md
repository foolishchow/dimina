# Requirements — fe-tools-view-style-cache-skip

Status: **complete（2026-10-09）**

## R-G5-1: PackerSessionState view/style cache 字段

`PackerSessionState`（`session-state.ts`）新增 `viewCache: Map<string, ViewCompiledModule>` + `styleCache: Map<string, StyleCompiledModule>`（bare value，D-G4-3；不泛型化，D-IU-3）。实例由 watch-runner 创建（session-scoped，cross-rebuild）。one-shot build 不创建实例（G4 期 no-op 边界延续）。

## R-G5-2: orchestrator state→ctx plumbing

`orchestrator.ts` 镜像现有 logic plumbing（`cache = state.moduleCache; ctx.cache = cache`，:172/182）加 view/style：`ctx.viewCache = state.viewCache` / `ctx.styleCache = state.styleCache`。G4 期 ctx 类型已扩 optional（D-G4-5）——G5 填实例。

## R-G5-3: stage-channel worker input cache 快照

`stage-channel.ts` worker input 为 view/style 加快照——bare Map 用 `new Map(c)` copy constructor（**F12：非 toJSON**——logic 的 `ModuleResultCache` 有 `toJSON` 方法，view/style bare `Map` 没有；logic IIFE `(() => { const c = ctx.cache; return c ? new Map(c.toJSON()) : null })()` 仍用于 logic，view/style 用 `(() => { const c = ctx.viewCache; return c ? new Map(c) : null })()`）。worker 收快照 + `invalidatedModules`（已传，G4 期忽略）。

## R-G5-4: view/style cache-hit skip（A-IU-4）

`view/index.ts` `compileML` + `style/index.ts` `compileSS` cache-hit skip——moduleId 在 cache 快照 且 NOT in invalidatedModules → 跳 compile（viewParseWalk / buildCompileCss），返 cached `ViewCompiledModule`/`StyleCompiledModule`（re-emit cached code/map；不跳 emit，D-IU-2）。只返回 dirty result（D-IU-5）——cache-hit 不返 cached（已在前）；cache-miss 返新编译。

**view cache-hit 递归 emit 语义** = RG5-1 设计门（readiness blocker）。**style cache-hit** = per-page 非 recursive（RG5-3，较简单）。

## R-G5-5: 行为 0 + 类型约束

- one-shot build diff=0（无 invalidatedModules → 无 cache-hit skip → 全量编译 = G4 行为）
- watch 路径：cache-hit skip = 效率提升（watch 产物字节一致——cached code/map = 全量结果）
- tsc 0 errors；vitest 全绿
- V-PC-5：无 `any`/`as any`/`@ts-nocheck`/`[key: string]` 索引签名新增（`as { viewCache? }` 结构断言允许，与 stage-channel 现有模式同）
