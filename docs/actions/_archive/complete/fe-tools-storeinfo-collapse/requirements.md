# Requirements — fe-tools-storeinfo-collapse

Status authority: [Action Status](../../../STATUS.md)

## Problem

storeInfo 矛盾身份（消耗品 + singleton mutator）+ sctx.storeInfo 冗余投影（PackerContext + state.graph 的影子）+ compat 写 load-bearing（喂未迁 getter）。详见 [README](README.md) Background + [`storeinfo-concept-analysis.md`](../../../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) §1-§4。

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

消费方：config-compiler-collab L29 + stage-dispatcher L85 + npm-builder L294 + publisher L30（scratch）+ dist-preparer L25（scratch）+ logic-emitter L39（storeInfo 透传 emit-engine）+ config-collector L51/L55 + **stage-channel L45（view/style worker resetStoreInfo 透传——F-R10-1 修正）**。

**额外迁项**（design §5.4）：config-collector L36 `sctx.dependencyGraph = store.getDependencyGraph()` → `sctx.dependencyGraph = state.graph.getInnerGraph()`（直接 state.graph，非 ALS——compat 写死后 ALS graph 死）。

**worker resetStoreInfo 数据源**（design §5.3——F-R10-1 修正）：3 处 worker resetStoreInfo（logic emit-engine + view stage-channel L45 + style stage-channel L45）统一用 `buildResetStoreInfoData(ctx, state)` helper 组装（env.ts export），替代 sctx.storeInfo 透传。

PackerContext 流给 collaborator：**orchestrator `tasks.run({ output, ctx, state })` 注入** sctx.ctx + sctx.state（design §5.2 lock）。

### R-SC3 — storeInfoCtx 新纯函数（orchestrate 链路，3 参数 MUST）

新增 `storeInfoCtx(ctx: PackerContext, graph: PackerGraph, state: PackerSessionState)` → `void`（env.ts export，orchestrate 链路用）——算 `state.scratch = storeInfo(ctx.workPath, {graph}).pathInfo.targetPath!`（调旧 storeInfo 取 pathInfo，设 state.scratch）。**旧 storeInfo 保留**（测试 fixture 依赖 ALS getter getTemplateExts/getWorkPath 等——compat 写 load-bearing，推迟为后续 initiative；concept analysis §5 已实证「删则崩」）。

- storeInfoCtx 是 orchestrate 链路纯函数（设 state.scratch，无返回值）
- **compat 写保留 backflow**：旧 storeInfo 内 compat 写（env.ts L209-219 六条）不动——测试 fixture 105 调用点依赖 ALS getter；design D-SC3「删 compat 写」推迟为后续 initiative（与 D-NS6 R-NS8 backflow 一致）
- project-store.load 改签名 `load(ctx, state)` → `void`（mutate state，无 return）
- **scratch 类型断言**（F-R10-3）：`state.scratch = r.pathInfo.targetPath!`（PathInfo.targetPath?: string）
- **scratch mutability**（F-R10-4）：PackerSessionState.scratch `string`（非 readonly——per-orchestrate 覆盖）
- **buildResetStoreInfoData helper**（F-R10-1/F-R13-3）：env.ts export `buildResetStoreInfoData(ctx, state)`——3 处 worker resetStoreInfo 统一组装（字段名转换 + configInfo `as ConfigInfo` 断言）

### R-SC4 — 删 sctx.storeInfo + project-store.getDependencyGraph 退役（MUST）

- 删 StageChannelContext.storeInfo 字段（types.ts）
- 删 sctx.storeInfo 赋值（config-collector）
- collaborator 全迁 sctx.ctx/sctx.state（不读 sctx.storeInfo）
- grep `sctx.storeInfo` caller=0（殁骸清）
- **compat 写保留 backflow**（旧 storeInfo 内 L209-219 六条不动——测试 fixture 依赖；推迟为后续 initiative）
- **project-store.getDependencyGraph/merge/snapshot 退役**：config-collector 改 `state.graph.getInnerGraph()`（直接 state.graph，非 ALS）；ProjectStore interface 删三方法（无 src/ 消费方）。**不依赖 compat 写死**（config-collector 已迁 state.graph，与 compat 写保留并存）
- resetStoreInfo/getAppId/getTargetPath 保留（worker ALS bridge，阶段 3）

### R-SC5 — worker ALS bridge 保留（MUST）

resetStoreInfo + getters + defaultCompilerContext 保留——阶段 3 范围（gated by compiler/* 迁移 + worker 模型）。compiler/* parse-walk 仍读 ALS getters（阶段 3 迁 PackerContext 参数）。

### R-SC6 — 行为 0（MUST）

tsc 0 + vitest 88/88 + one-shot 7-diff=0。塌缩每步独立行为 0 gate。

### R-SC7 — Non-scope 守（MUST）

- compiler/* 不动（parse-walk 仍读 ALS getters）
- env.ts ALS 门面不删（compat 写保留——测试 fixture 依赖 ALS getter；留阶段 3）
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
