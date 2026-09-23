# Acceptance — fe-tools-view-style-cache-skip

Status: **draft（2026-10-08）**

## A-G51 — PackerSessionState view/style cache 字段（R-G5-1, D-G5-1）

- [ ] `session-state.ts` `PackerSessionState` 含 `viewCache: Map<string, ViewCompiledModule>` + `styleCache: Map<string, StyleCompiledModule>`（bare，D-G4-3）
- [ ] watch-runner 创建实例（session-scoped）；one-shot 不创建（G4 no-op 边界延续）

## A-G52 — orchestrator state→ctx plumbing（R-G5-2, D-G5-2）

- [ ] `orchestrator.ts` 镜像 logic plumbing 加 `ctx.viewCache = state.viewCache` / `ctx.styleCache = state.styleCache`
- [ ] one-shot ctx.viewCache/styleCache = undefined（state 无字段）→ stage-channel 写 no-op（G4 边界延续）

## A-G53 — stage-channel worker input cache 快照（R-G5-3, D-G5-2）

- [ ] `stage-channel.ts` worker input 加 `viewCache`/`styleCache` 快照（镜像 `cache: new Map(c.toJSON())`）
- [ ] worker 收快照 + `invalidatedModules`（已传，G5 消费）

## A-G54 — view/style cache-hit skip（R-G5-4, A-IU-4, D-G5-3/4/5）

- [ ] style `compileSS` cache-hit per-page skip（RG5-3，跳 buildCompileCss，re-emit cached）
- [ ] view `compileML` cache-hit skip（RG5-1 F6：allCached 预检 page+全 subs cached 无 invalidated → ONE emitEntry bundle；任一 sub invalidated → ③ 全量 recompile）
- [ ] cache-hit 仅当 moduleId 在 cache 且 NOT in invalidatedModules（view 额外：page + 全 subs 均 cached 无 invalidated——F6 allCached 预检）
- [ ] 测试：两次 build 同模块 → 第二次 cache-hit（跳 compile，产物字节一致）；view allCached 场景 + sub invalidated ③ 降级场景

## A-G55 — 行为 0 + 类型约束（R-G5-5, A-IU-5）

- [ ] one-shot build 全量 diff=0（无 invalidatedModules → 无 cache-hit skip → 全量编译 = G4 行为）
- [ ] watch 路径 cache-hit skip：产物字节一致（cached code/map = 全量结果；P-G506 两 Build 比对）
- [ ] tsc 0 errors；vitest 全绿
- [ ] V-PC-5：无 `any`/`as any`/`@ts-nocheck`/`[key: string]` 新增

## Non-acceptance

- ModuleResultCache 泛型化（D-IU-3 不泛型化；后续 Packer 接入）
- logic cache / `CachedModuleResult` / `ModuleResultCache` class 改动（D-IU-3 logic 保持）
- viewParseWalk / buildCompileCss 重构（G4 守——parse-walk 不动）
- view cache-hit sub-component invalidated recompile 的 ViewModule 来源（RG5-1 待决——若方向 A 不足，可能需 viewParseWalk discovery 保留）
- intra-build（moduleCompileCache）写回策略（RG5-4 待决）
- HMR / load-compile 分离（后续门）
- 删 `DIMINA_COMPILER_DIFF_VERIFY`（等 packer 稳定）
- watch 效率量化（cache-hit 命中率 / 编译耗时下降——观测性，非 acceptance）

## Traceability

- 本门实现 incremental-unify 的 **A-IU-3 剩余**（view/style cache 实例 + plumbing + 读）+ **A-IU-4**（cache-hit skip）。A-IU-1/A-IU-2 = G3 complete；A-IU-3 数据源+写 = G4 complete。
- **G5 反转 G4 期"全量返回"**（D-G5-3 incremental filter——cache-hit skip 不返）；G4 D-G4-1..9 决策 G5 承接（bare Map / plumbing 边界 / 跳 compile 不跳 emit）。
- G5 闭合 incremental-unify（A-IU-3 + A-IU-4 → A-IU-1..5 全 complete）。
- 行为 0 + 类型约束（A-IU-5）跨切——G5 满足本门范围（A-G55）。
