# Implementation Plan — fe-tools-storeinfo-collapse

Status authority: [Action Status](../STATUS.md)

## P-SC1 — PackerSessionState 加 scratch + storeInfo 改纯函数

**依赖**：无（首发）

**改动**：
1. PackerSessionState（state/session-state.ts L21）加 `scratch: string`（TEMP mkdtemp per-orchestrate，每次 orchestrate 覆盖）
2. storeInfo 改签名：`storeInfo(ctx: PackerContext, graph: PackerGraph, state: PackerSessionState)` → `void`——算 computePathInfo(ctx.workPath) → `state.scratch = pathInfo.targetPath` + build/reconcile graph（ctx 直传，删内部 toPackerContext）+ 无返回值无 compat 写
3. 删 storeInfo 返回值（`{pathInfo, configInfo, compilerOptions, dependencyGraph}`）+ 删 compat 写（env.ts L209-219 六条）
4. ProjectStore interface（project-store.ts L28）改签名 `load(ctx: PackerContext, opts: StoreInfoOptions, state: PackerSessionState)` → `void`（删 getDependencyGraph/merge/snapshot——退役；或保留 stub——倾向删）+ createProjectStore impl 同步
5. project-store.load 改 `load(ctx, opts, state)` → void（mutate state.scratch + state.graph）
6. config-collector：删 sctx.storeInfo 赋值（L35）+ sctx.dependencyGraph = state.graph.getInnerGraph()（L36，非 store.getDependencyGraph）

**resolveNpm 等价性验证**（design §4 风险）：入口 PackerContext.resolveNpm 须等价 `new NpmResolver(workPath)`（toPackerContext L263 是 stub）。P-SC1 须实证 index.ts buildPackerContext 的 resolveNpm 实现——若 stub，须修正（ctx.resolveNpm = new NpmResolver(workPath)）。

**project-store 存废**（design §5.4）：倾向保留（ProjectStore interface 改签名 + 删退役方法）——维持 deps.store 抽象边界。P-SC1 定。

**行为 0 验**：tsc 0 + vitest + 7-diff（storeInfo 全局路径→全量 7 项目）

## P-SC2 — StageChannelContext 加 ctx + state + collaborator 迁读

**依赖**：P-SC1（storeInfo 纯函数就位）

**改动**：
1. StageChannelContext（types.ts）加 `ctx?: PackerContext` + `state?: PackerSessionState`
2. orchestrator tasks.run({ output, ctx, state })（L297——与 output 同 listr2 ctx 注入）
3. collaborator 迁读（全 6 消费方）：
   - config-compiler-collab L29：sctx.storeInfo.pathInfo → sctx.ctx.workPath/targetPath + sctx.ctx.fileTypes
   - stage-dispatcher L85：sctx.storeInfo → sctx.ctx + sctx.state.scratch + sctx.ctx.fileTypes（5 exts）
   - npm-builder L294：sctx.storeInfo → sctx.ctx + sctx.state.scratch + sctx.ctx.fileTypes
   - publisher L30：sctx.storeInfo.pathInfo.targetPath（scratch）→ sctx.state.scratch
   - dist-preparer L25：sctx.storeInfo.pathInfo.targetPath（scratch）→ sctx.state.scratch
   - logic-emitter L39：`const resetStoreInfoData = buildResetStoreInfoData(sctx.ctx!, sctx.state!)` → emit input `storeInfo: resetStoreInfoData`（§5.3 helper）
   - **stage-channel L45**（F-R10-1）：`storeInfo: sctx.storeInfo` → `storeInfo: buildResetStoreInfoData(sctx.ctx as PackerContext, sctx.state as PackerSessionState)`（view/style worker resetStoreInfo 透传）
   - config-collector L51/L55：自身读 sctx.storeInfo → sctx.ctx + sctx.state.scratch
4. **config-collector deps 演进**（F-R11-2）：删 deps.workPath/fileTypes/state（用 sctx.ctx/sctx.state）+ ConfigCollectorDeps interface 改
5. EmitEntryParams（emit.ts L55）类型演进：storeInfo 字段 → resetStoreInfoData（`Parameters<typeof resetStoreInfo>[0]`）

**行为 0 验**：每 collaborator 迁独立 tsc + vitest + 7-diff

## P-SC3 — 删殁骸 + compat 写死

**依赖**：P-SC2（全 collaborator 迁完 + stage-channel L45 迁完）

**改动**：
1. 删 StageChannelContext.storeInfo 字段（types.ts）
2. 删 sctx.storeInfo 赋值（config-collector）
3. 删 storeInfo 返回值类型 + compat 写（env.ts L209-219 六条：pathInfo/compilerOptions/npmResolver/graph/configInfo/dependencyGraph）
4. compat 写自然死（无快照可 dump）
5. 删 project-store.getDependencyGraph/merge/snapshot（退役，无 src/ 消费方）
6. grep 验：sctx.storeInfo caller=0 + compat 写 caller=0 + storeInfo return = 0 + getDependencyGraph caller=0 + **stage-channel storeInfo 透传 caller=0**

**行为 0 验**：tsc 0 + vitest 88/88 + 7-diff=0 + grep caller=0

**风险**：compat 写死可能破坏 worker resetStoreInfo（若 resetStoreInfo 依赖 compat 写的 singleton）。须验证 resetStoreInfo 数据源独立（§5.3 lock——buildResetStoreInfoData helper 组装，非 ALS singleton）。

## 行为 0 三件套（每相 gate）

- **tsc**：`node ./node_modules/typescript/bin/tsc --noEmit` → 0 errors
- **vitest**：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs exec vitest run` → 全绿（flaky solo pass）
- **7 diff（one-shot）**：`node --experimental-strip-types /tmp/dc-build.mjs diff` → all 7 diff=0

## backflow（P-SC3 后记录）

- 阶段 2（L1 迁出）：storeInfo/buildPackerContext/normalize → 纯模块
- 阶段 3（L2+L3 退役）：compiler/* 签名加 PackerContext + worker 模型调整
- scratch 内化：DiskOutput.publish 内化 mkdtemp
- PackerContext 构造 dedup
