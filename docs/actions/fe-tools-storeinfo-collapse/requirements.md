# Requirements — fe-tools-storeinfo-collapse

Status authority: [Action Status](../STATUS.md)

## Problem

storeInfo 矛盾身份（消耗品 + singleton mutator）+ sctx.storeInfo 冗余投影（PackerContext + state.graph 的影子）+ compat 写 load-bearing（喂未迁 getter）。详见 [README](README.md) Background + [`storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) §1-§4。

Output 抽象完成后，compat 写的 output-path 消费方全死（createDist/publishToDist/materialize 殁骸 + publisher/dist-preparer 改 opts.scratch）——但 compat 写仍 load-bearing（喂 compiler/* parse-walk 经 worker resetStoreInfo + 主线程 config 消费方如 project-store.getDependencyGraph）。塌缩消除 sctx.storeInfo，compat 写自然死。

## Requirements

### R-SC1 — PackerContext 加 temporaryTargetPath（MUST）

PackerContext interface 加 `temporaryTargetPath: string`（TEMP 构建目录，computePathInfo mkdtemp per-request）。关闭 sctx.storeInfo.pathInfo.temporaryTargetPath 唯一 gap。

**scratch 流**：Output 抽象后 publisher/dist-preparer 用 `opts.scratch`（per-request）。塌缩后 scratch = `ctx.temporaryTargetPath`（computePathInfo mkdtemp）。但 PackerContext 是 orchestrate 入参（config-collector 前），temporaryTargetPath 须在 storeInfo 后设——design 待决（ctx 可变？或 scratch 流经 state？或 storeInfo 改先算 pathInfo 再建 ctx？）。

### R-SC2 — collaborator 迁读 PackerContext（MUST）

全 6 sctx.storeInfo 消费方迁读 PackerContext：
- `sctx.storeInfo.pathInfo.workPath` → `ctx.workPath`
- `sctx.storeInfo.pathInfo.targetPath` → `ctx.temporaryTargetPath`（TEMP scratch）或 `ctx.targetPath`（FINAL）
- `sctx.storeInfo.compilerOptions.templateExts` → `ctx.fileTypes.templateExts`
- `sctx.storeInfo.compilerOptions.styleExts` → `ctx.fileTypes.styleExts`
- `sctx.storeInfo.compilerOptions.viewScriptExts` → `ctx.fileTypes.viewScriptExts`
- `sctx.storeInfo.compilerOptions.viewScriptTags` → `ctx.fileTypes.viewScriptTags`
- `sctx.storeInfo.compilerOptions.templateDirectivePrefixes` → `ctx.fileTypes.directivePrefixes`

消费方：config-compiler-collab L29 + stage-dispatcher L85 + npm-builder L294 + publisher L30（scratch）+ dist-preparer L25（scratch）+ logic-emitter L39（storeInfo 透传 emit-engine）+ config-collector L51/L55。

PackerContext 流给 collaborator：经 sctx.ctx（StageChannelContext）或 deps。

### R-SC3 — storeInfo 改纯函数（MUST）

`storeInfo(ctx: PackerContext, state.graph)` → `void`——build/reconcile graph（config fixpoint），**无返回值无 compat 写**。storeInfo 退化为 graph bootstrap 函数。

- 删 storeInfo 返回值（`{pathInfo, configInfo, compilerOptions, dependencyGraph}`）
- 删 compat 写（env.ts L209-219，写 defaultCompilerContext）
- 删内部 toPackerContext（localCtx → ctx 直传）
- project-store.load 改调 storeInfo（无 return，只 mutate state.graph）

### R-SC4 — 删 sctx.storeInfo + compat 写（MUST）

- 删 StageChannelContext.storeInfo 字段（types.ts）
- 删 sctx.storeInfo 赋值（config-collector L35）
- 删 storeInfo 返回值 + compat 写
- compat 写自然死（无快照可 dump）——**不需单独迁 getter 消费方**（概念分析 §5 关键洞察）

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
