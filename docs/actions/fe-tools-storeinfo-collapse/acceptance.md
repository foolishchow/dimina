# Acceptance — fe-tools-storeinfo-collapse

Status authority: [Action Status](../STATUS.md)

| ID | Requirement | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-SC1 | R-SC1/R-SC3 | storeInfo 纯函数 + PackerSessionState.scratch | PackerSessionState 加 scratch（TEMP mkdtemp，每次 orchestrate 覆盖）+ storeInfo 改纯函数（`storeInfo(ctx, graph, state) → void`，算 computePathInfo → state.scratch + build/reconcile graph，无返回值无 compat 写）+ project-store.load 改签名 `load(ctx, opts, state) → void`（mutate state，无 return）；**PackerContext 不加 temporaryTargetPath**（纯 I/O）；resolveNpm 等价性验证（入口 ctx.resolveNpm 非 stub）；tsc 0 | pending |
| A-SC2 | R-SC2 | collaborator 迁读 sctx.ctx + sctx.state.scratch | StageChannelContext 加 ctx?: PackerContext + state?: PackerSessionState（orchestrator tasks.run({output, ctx, state}) 注入）+ 全 6 消费方迁读 sctx.ctx + sctx.state.scratch（config-compiler-collab/stage-dispatcher/npm-builder/publisher/dist-preparer/logic-emitter/config-collector）+ **config-collector L36 迁** `sctx.dependencyGraph = state.graph.getInnerGraph()`（非 ALS getDependencyGraph——compat 写死后 ALS graph 死）；tsc 0 | pending |
| A-SC3 | R-SC4/R-SC5 | 删殁骸 + compat 写死 + worker ALS 保留 | 删 StageChannelContext.storeInfo + sctx.storeInfo 赋值 + storeInfo 返回值 + compat 写（env.ts L209-219 六条：pathInfo/compilerOptions/npmResolver/graph/configInfo/dependencyGraph）；compat 写自然死（无快照可 dump）；project-store.getDependencyGraph/merge/snapshot 退役（无 src/ 消费方）；worker ALS bridge 保留（resetStoreInfo + getters 非 0）；grep sctx.storeInfo caller=0 + compat 写 caller=0 | pending |
| A-SC4 | R-SC6 | 行为 0 | tsc 0 + vitest 88/88 + one-shot 7-diff=0（storeInfo 全局路径→全量 7 项目） | pending |
| A-SC5 | R-SC7 | Non-scope 守 | compiler/* 不动（parse-walk 仍读 ALS getters）+ env.ts ALS 门面不删（剩 config 消费方）+ worker 模型不动（resetStoreInfo 保留）+ PackerContext 构造 dedup 不处理 + scratch 内化不处理 | pending |

## backflow（P-SC3 后记录）

- 阶段 2（L1 迁出）：storeInfo/buildPackerContext/normalize → 纯模块
- 阶段 3（L2+L3 退役）：compiler/* 签名加 PackerContext + worker 模型调整 + singleton/getters/Proxy/resetStoreInfo 全删
- scratch 内化：DiskOutput.publish 内化 mkdtemp（须重构 config-compiler/npm-builder 写 DiskOutput.scratch）
- PackerContext 构造 dedup（buildPackerContext/buildFixpointCtx/toPackerContext 三同质）
