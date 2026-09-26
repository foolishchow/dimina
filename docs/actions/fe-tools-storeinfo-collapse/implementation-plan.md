# Implementation Plan — fe-tools-storeinfo-collapse

Status authority: [Action Status](../STATUS.md)

## P-SC1 — OrchestratorState 加 scratch + storeInfo 改纯函数

**依赖**：无（首发）

**改动**：
1. OrchestratorState（state/session-state.ts）加 `scratch: string`（TEMP mkdtemp per-orchestrate）
2. storeInfo 改签名：`storeInfo(ctx: PackerContext, graph: PackerGraph, state: { scratch })` → `void`——算 computePathInfo → state.scratch = pathInfo.targetPath + build/reconcile graph（无返回值无 compat 写）
3. 删 storeInfo 返回值 + 删 compat 写（env.ts L209-219）+ 删内部 toPackerContext
4. project-store.load 改调 storeInfo（无 return，mutate graph + state.scratch）
5. config-collector：sctx.storeInfo 赋值改 storeInfo 调用（无 sctx.storeInfo）

**resetStoreInfo 数据源**（D-SC5 待决）：storeInfo 内部算 pathInfo/configInfo，设 state.scratch + state.graph.configInfo。resetStoreInfo 从 state 拿（state.scratch + state.graph.getConfigData()）？或 storeInfo 返 pathInfo/configInfo 给 resetStoreInfo（非 sctx.storeInfo）。design lock 后定。

**行为 0 验**：tsc 0 + vitest + 7-diff（storeInfo 全局路径→全量 7 项目）

## P-SC2 — StageChannelContext 加 ctx + collaborator 迁读

**依赖**：P-SC1（storeInfo 纯函数就位）

**改动**：
1. StageChannelContext 加 `ctx?: PackerContext`（types.ts）
2. config-collector 设 sctx.ctx（storeInfo 后建 PackerContext 设 sctx.ctx）
3. collaborator 迁读（全 6 消费方）：
   - config-compiler-collab L29：sctx.storeInfo.pathInfo → sctx.ctx.workPath/targetPath
   - stage-dispatcher L85：sctx.storeInfo → sctx.ctx + state.scratch
   - npm-builder L294：sctx.storeInfo → sctx.ctx + state.scratch
   - publisher L30：sctx.storeInfo.pathInfo.targetPath（scratch）→ state.scratch
   - dist-preparer L25：sctx.storeInfo.pathInfo.targetPath（scratch）→ state.scratch
   - logic-emitter L39：storeInfo 透传 emit-engine → resetStoreInfo（D-SC5 lock 后）
   - config-collector L51/L55：自身读 sctx.storeInfo → sctx.ctx

**行为 0 验**：每 collaborator 迁独立 tsc + vitest + 7-diff

## P-SC3 — 删殁骸 + compat 写死

**依赖**：P-SC2（全 collaborator 迁完）

**改动**：
1. 删 StageChannelContext.storeInfo 字段（types.ts）
2. 删 sctx.storeInfo 赋值（config-collector）
3. 删 storeInfo 返回值类型 + compat 写（env.ts L209-219）
4. compat 写自然死（无快照可 dump）
5. grep 验：sctx.storeInfo caller=0 + compat 写 caller=0 + storeInfo return = 0

**行为 0 验**：tsc 0 + vitest 88/88 + 7-diff=0 + grep caller=0

**风险**：compat 写死可能破坏 worker resetStoreInfo（若 resetStoreInfo 依赖 compat 写的 singleton）。须验证 resetStoreInfo 数据源独立（D-SC5）。

## 行为 0 三件套（每相 gate）

- **tsc**：`node ./node_modules/typescript/bin/tsc --noEmit` → 0 errors
- **vitest**：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs exec vitest run` → 全绿（flaky solo pass）
- **7 diff（one-shot）**：`node --experimental-strip-types /tmp/dc-build.mjs diff` → all 7 diff=0

## backflow（P-SC3 后记录）

- 阶段 2（L1 迁出）：storeInfo/buildPackerContext/normalize → 纯模块
- 阶段 3（L2+L3 退役）：compiler/* 签名加 PackerContext + worker 模型调整
- scratch 内化：DiskOutput.publish 内化 mkdtemp
- PackerContext 构造 dedup
