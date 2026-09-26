# Requirements — fe-tools-storeinfo-collapse

Status authority: [Action Status](../STATUS.md)

## Problem

storeInfo 矛盾身份（消耗品 + singleton mutator）+ sctx.storeInfo 冗余投影（PackerContext + state.graph 的影子）+ compat 写 load-bearing（喂未迁 getter）。详见 [README](README.md) Background + [`storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) §1-§4。

Output 抽象完成后，compat 写的 output-path 消费方全死（createDist/publishToDist/materialize 殁骸 + publisher/dist-preparer 改 opts.scratch）——但 compat 写仍 load-bearing（喂 compiler/* parse-walk 经 worker resetStoreInfo + 主线程 config 消费方如 project-store.getDependencyGraph）。塌缩消除 sctx.storeInfo，compat 写自然死。

## Requirements

### R-SC1 — PackerSessionState 加 scratch（MUST）

PackerSessionState（state/session-state.ts L21，OrchestratorState 实现类）加 `scratch: string`（TEMP 构建目录，computePathInfo mkdtemp per-orchestrate，每次覆写）。**PackerContext 不加 temporaryTargetPath**（保持纯 I/O：workPath/targetPath FINAL；temporaryTargetPath 是 TEMP 非 FINAL，加到 PackerContext 违反纯 I/O 定位——design D-SC1/§5.1 lock）。

**scratch 流**：Output 抽象后 publisher/dist-preparer 用 `opts.scratch`（per-request）。塌缩后 scratch = `sctx.state.scratch`（storeInfo 算 computePathInfo → state.scratch）。orchestrator `tasks.run({ output, ctx, state })` 注入 sctx.state（design §5.2 lock）。

### R-SC2 — collaborator 迁读 PackerContext + state.scratch（MUST）

全 6 sctx.storeInfo 消费方迁读 `sctx.ctx`（PackerContext）+ `sctx.state.scratch`（PackerSessionState）：
- `sctx.storeInfo.pathInfo.workPath` → `sctx.ctx.workPath`
- `sctx.storeInfo.pathInfo.targetPath`（scratch TEMP）→ `sctx.state.scratch`
- `sctx.storeInfo.compilerOptions.templateExts` → `sctx.ctx.fileTypes.templateExts`
- `sctx.storeInfo.compilerOptions.styleExts` → `sctx.ctx.fileTypes.styleExts`
- `sctx.storeInfo.compilerOptions.viewScriptExts` → `sctx.ctx.fileTypes.viewScriptExts`
- `sctx.storeInfo.compilerOptions.viewScriptTags` → `sctx.ctx.fileTypes.viewScriptTags`
- `sctx.storeInfo.compilerOptions.templateDirectivePrefixes` → `sctx.ctx.fileTypes.directivePrefixes`（字段名变：templateDirectivePrefixes → directivePrefixes）

消费方：config-compiler-collab L29 + stage-dispatcher L85 + npm-builder L294 + publisher L30（scratch）+ dist-preparer L25（scratch）+ logic-emitter L39（storeInfo 透传 emit-engine）+ config-collector L51/L55。

**额外迁项**（design §5.4）：config-collector L36 `sctx.dependencyGraph = store.getDependencyGraph()` → `sctx.dependencyGraph = state.graph.getInnerGraph()`（直接 state.graph，非 ALS——compat 写死后 ALS graph 死）。

PackerContext 流给 collaborator：**orchestrator `tasks.run({ output, ctx, state })` 注入** sctx.ctx + sctx.state（design §5.2 lock）。

### R-SC3 — storeInfo 改纯函数（3 参数 MUST）

`storeInfo(ctx: PackerContext, graph: PackerGraph, state: PackerSessionState)` → `void`——build/reconcile graph（ctx 直传，graph.build 不读 targetPath）+ 算 computePathInfo(ctx.workPath) → `state.scratch`，**无返回值无 compat 写**。storeInfo 退化为 graph bootstrap 函数。

- 删 storeInfo 返回值（`{pathInfo, configInfo, compilerOptions, dependencyGraph}`）
- 删 compat 写（env.ts L209-219，6 条：pathInfo/compilerOptions/npmResolver/graph/configInfo/dependencyGraph）
- 删内部 toPackerContext（localCtx → ctx 直传；graph.build 收 PackerContext 不读 targetPath——实证 graph.ts L69）
- project-store.load 改签名 `load(ctx, opts, state)` → `void`（mutate state.scratch + state.graph，无 return）
- **resolveNpm 等价性须验**（design §4 风险）：入口 PackerContext.resolveNpm 须等价 `new NpmResolver(workPath)`（toPackerContext L263 是 stub）

### R-SC4 — 删 sctx.storeInfo + compat 写（MUST）

- 删 StageChannelContext.storeInfo 字段（types.ts）
- 删 sctx.storeInfo 赋值（config-collector L35）
- 删 storeInfo 返回值 + compat 写
- compat 写自然死（无快照可 dump）——**不需单独迁 worker ALS getter**（概念分析 §5 关键洞察；resetStoreInfo/getAppId/getTargetPath 保留，阶段 3）
- **须迁 project-store.getDependencyGraph**（design §5.4）：compat 写死后 ALS graph undefined，config-collector L36 改 state.graph.getInnerGraph()。project-store.getDependencyGraph/merge/snapshot 退役（无 src/ 消费方）

### R-SC5 — worker ALS bridge 保留（MUST）

resetStoreInfo + getters + defaultCompilerContext 保留——阶段 3 范围（gated by compiler/* 迁移 + worker 模型）。compiler/* parse-walk 仍读 ALS getters（阶段 3 迁 PackerContext 参数）。

### R-SC6 — 行为 0（MUST）

tsc 0 + vitest 88/88 + one-shot 7-diff=0。塌缩每步独立行为 0 gate。

### R-SC7 — Non-scope 守（MUST）

- compiler/* 不动（parse-walk 仍读 ALS getters）
- env.ts ALS 门面不删（compat 写死后剩 config 消费方——project-store.getDependencyGraph 等——留阶段 3）
- worker 模型不动（resetStoreInfo 保留）
- PackerContext 构造 dedup 不处理（buildPackerContext/buildFixpointCtx/toPackerContext 三同质——独立 follow-up）
- scratch 内化不处理（DiskOutput.publish 用 opts.scratch per-request——Output 抽象 follow-up）

## Constraints

- 行为 0 原则：所有重构保持字节完全相同的输出，通过完整 vitest
- 行为 0 全量验证：更改 env.ts/storeInfo/PackerContext 等全局路径 → 必须全量 7 项目 diff（含 air-battle）
- tsc 调用：`node ./node_modules/typescript/bin/tsc --noEmit`
- pnpm：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs exec vitest run`
- no any / no `[key: string]: unknown`（ts-migration 方向）
- Node ESM 后缀必须

## Non-scope

详见 [README](README.md) Non-goals。

## backflow（塌缩后记录）

- 阶段 2（L1 迁出）：storeInfo/buildPackerContext/normalize → 纯模块；env.ts 退化为 ALS 门面 + worker 桥接
- 阶段 3（L2+L3 退役）：compiler/* 签名加 PackerContext + worker 模型调整 + singleton/getters/Proxy/resetStoreInfo 全删
- scratch 内化：DiskOutput.publish 内化 mkdtemp（须重构 config-compiler/npm-builder 写 DiskOutput.scratch）
- PackerContext 构造 dedup（三同质构造器）
