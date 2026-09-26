# Acceptance — fe-tools-storeinfo-collapse

Status authority: [Action Status](../STATUS.md)

| ID | Requirement | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-SC1 | R-SC1/R-SC3 | storeInfoCtx + PackerSessionState.scratch + helper | PackerSessionState 加 scratch（TEMP mkdtemp，mutable string 非 readonly，每次 orchestrate 覆盖）+ 新增 storeInfoCtx `(ctx, graph, state) → void`（env.ts export，调旧 storeInfo 取 pathInfo → `state.scratch = r.pathInfo.targetPath!` 类型断言）+ project-store.load 改签名 `load(ctx, state) → void`（mutate state，无 return）+ **buildResetStoreInfoData(ctx, state) helper** export（env.ts，3 处 worker 统一组装，configInfo `as ConfigInfo` + 字段名转换）；**PackerContext 不加 temporaryTargetPath**（纯 I/O）；**compat 写保留 backflow**（旧 storeInfo 不动）；tsc 0 | done |
| A-SC2 | R-SC2 | collaborator 迁读 sctx.ctx + sctx.state.scratch + stage-channel L45 | StageChannelContext 加 ctx?: PackerContext + state?: PackerSessionState（orchestrator tasks.run({output, ctx, state}) 注入）+ 全 6 消费方迁读 sctx.ctx + sctx.state.scratch（config-compiler-collab/stage-dispatcher/npm-builder/publisher/dist-preparer/logic-emitter/config-collector）+ **stage-channel L45 迁** `storeInfo: sctx.storeInfo` → `storeInfo: buildResetStoreInfoData(sctx.ctx, sctx.state)`（view/style worker resetStoreInfo——F-R10-1）+ **config-collector L36 迁** `state.graph.getInnerGraph()`（非 ALS）+ **config-collector deps 删** workPath/fileTypes/state（用 sctx.ctx/sctx.state）；tsc 0 | done |
| A-SC3 | R-SC4/R-SC5 | 删殁骸 sctx.storeInfo + worker ALS 保留 | 删 StageChannelContext.storeInfo + sctx.storeInfo 赋值 + collaborator 全迁 sctx.ctx/sctx.state；grep sctx.storeInfo caller=0；worker ALS bridge 保留（resetStoreInfo + getters 非 0）；**compat 写保留 backflow**（storeInfoCtx 调旧 storeInfo，测试 fixture 依赖 ALS getter——design D-SC3 「删 compat 写」推迟为后续 initiative） | done |
| A-SC4 | R-SC6 | 行为 0 | tsc 0 + vitest 88/88 + one-shot 7-diff=0（storeInfo 全局路径→全量 7 项目） | done |
| A-SC5 | R-SC7 | Non-scope 守 | compiler/* 不动（parse-walk 仍读 ALS getters）+ env.ts ALS 门面不删（剩 config 消费方）+ worker 模型不动（resetStoreInfo 保留）+ PackerContext 构造 dedup 不处理 + scratch 内化不处理 | done |

## backflow（P-SC3 后记录）

- 阶段 2（L1 迁出）：storeInfo/buildPackerContext/normalize → 纯模块
- 阶段 3（L2+L3 退役）：compiler/* 签名加 PackerContext + worker 模型调整 + singleton/getters/Proxy/resetStoreInfo 全删
- scratch 内化：DiskOutput.publish 内化 mkdtemp（须重构 config-compiler/npm-builder 写 DiskOutput.scratch）
- PackerContext 构造 dedup（buildPackerContext/buildFixpointCtx/toPackerContext 三同质）
