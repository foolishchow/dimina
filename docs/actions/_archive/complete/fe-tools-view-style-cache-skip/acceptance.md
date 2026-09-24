# Acceptance — fe-tools-view-style-cache-skip

Status: **complete（2026-10-09）**

## A-G51 — PackerSessionState view/style cache 字段（R-G5-1, D-G5-1/D-G5-4'）

- [x] `session-state.ts` `PackerSessionState` 含 `viewCache?: Map<string, ViewCompiledModule[]>`（per-page-bundle，D-G5-4'）+ `styleCache?: Map<string, StyleCompiledModule>`（per-page bare）
- [x] watch-runner 创建实例（session-scoped）；one-shot 不创建（undefined → G4 no-op 边界延续）

## A-G52 — orchestrator state→ctx plumbing（R-G5-2, D-G5-2）

- [x] `orchestrator.ts` 镜像 logic plumbing 加 `ctx.viewCache = state.viewCache` / `ctx.styleCache = state.styleCache`（:171/:181）
- [x] one-shot ctx.viewCache/styleCache = undefined（state 无字段）→ stage-channel 写 no-op（G4 边界延续）

## A-G53 — stage-channel worker input cache 快照（R-G5-3, D-G5-2）

- [x] `stage-channel.ts` worker input 加 `viewCache`/`styleCache` 快照（bare Map 用 `new Map(c)` copy constructor——F12：非 toJSON，logic 的 ModuleResultCache 才有 toJSON）
- [x] worker 收快照 + `invalidatedModules`（已传，G5 消费）

## A-G54 — view/style cache-hit skip（R-G5-4, A-IU-4, D-G5-3/4'/5）

- [x] style `compileSS` cache-hit per-page skip（D-G5-5，跳 buildCompileCss，re-emit cached code/map）
- [x] view `compileML` cache-hit skip（**D-G5-4' per-page-bundle**：bundle cached 且 bundle 内任一 module 均未 invalidated → re-emit 原序 bundle；任一 invalidated → 全量 viewParseWalk）
- [x] cache-hit 仅当 page bundle 在 cache 且 bundle 内任一 moduleId NOT in invalidatedModules（per-page-bundle invalidation）
- [x] 测试：两次 build 同模块 → 第二次 cache-hit（跳 compile，产物字节一致）；view per-page-bundle cache-hit + bundle invalidated 场景 + style per-page 场景

## A-G55 — 行为 0 + 类型约束（R-G5-5, A-IU-5）

- [x] one-shot build 全量 diff=0（无 invalidatedModules + state.viewCache=undefined → 无 cache-hit skip → 全量编译 = G4 行为）
- [x] watch 路径 cache-hit skip：view/style 产物字节一致（P-G506 view 0 pages_* diff + style 0 .wxss diff；per-page-bundle 原序 re-emit）
- [x] tsc 0 errors；vitest 84 files / 623 tests 全绿（compile-cli-cache flaky 单跑 pass）
- [x] V-PC-5：changed files 0 `any`/`as any`/`@ts-nocheck`/`[key: string]: unknown` 新增

## Non-acceptance

- ModuleResultCache 泛型化（D-IU-3 不泛型化；后续 Packer 接入）
- logic cache / `CachedModuleResult` / `ModuleResultCache` class 改动（D-IU-3 logic 保持）
- viewParseWalk / buildCompileCss 重构（G4 守——parse-walk 不动）
- intra-build（moduleCompileCache）写回策略（RG5-4 自动解——cache-hit 跳整 parse-walk→intra-build 不查不写）
- **logic cache byte-identity**（7 logic.js diff，P-G506 pre-existing out-of-scope）——需独立 Action
- **incremental static-copy**（invalidatedModules=[] 时 build-pipeline 跳静态拷贝，pre-existing）——需独立 Action
- HMR / load-compile 分离（后续门）
- 删 `DIMINA_COMPILER_DIFF_VERIFY`（等 packer 稳定）
- watch 效率量化（cache-hit 命中率 / 编译耗时下降——观测性，非 acceptance）

## Traceability

- 本门实现 incremental-unify 的 **A-IU-3 剩余**（view/style cache 实例 + plumbing + 读）+ **A-IU-4**（cache-hit skip）。A-IU-1/A-IU-2 = G3 complete；A-IU-3 数据源+写 = G4 complete。
- **G5 反转 G4 期"全量返回"**（D-G5-3 incremental filter——cache-hit skip 不返）；G4 D-G4-1..9 决策 G5 承接（bare Map / plumbing 边界 / 跳 compile 不跳 emit）。
- G5 闭合 incremental-unify（A-IU-3 + A-IU-4 → A-IU-1..5 全 complete）。
- 行为 0 + 类型约束（A-IU-5）跨切——G5 满足本门范围（A-G55）。
