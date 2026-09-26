# fe-tools-storeinfo-collapse

- Action: `fe-tools-storeinfo-collapse`
- Status: `in_progress`
- Created: 2026-10-10
- Status authority: [Action Status](../STATUS.md)
- 设计门：[design.draft.md](design.draft.md)（**D-SC1..6 locked**——3 待决问题解决：scratch 流方案 C state.scratch + PackerContext 流 sctx.ctx/sctx.state + resetStoreInfo 组装 + project-store.getDependencyGraph 退役）
- 实施计划：[implementation-plan.md](implementation-plan.md)（P-SC1..N 分相）
- 验证：[validation.md](validation.md)
- 背景：[`docs/fe-tools/2026-10-10-storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) §1-§7（概念分析）+ [`fe-tools-packer-output-abstraction`](../_archive/complete/fe-tools-packer-output-abstraction/README.md)（backflow：compat 写 output-path 消费方死）

## Background

`fe-tools-packer-north-star-evolution`（D-NS-1..6）闭合后揭示 **storeInfo compat 写 load-bearing**（P-NS6 audit）。`fe-tools-packer-output-abstraction` 完成后，compat 写的 **output-path 消费方全死**（createDist/publishToDist/materialize 殁骸拆除；publisher/dist-preparer 改 opts.scratch per-request）——storeInfo 塌缩的前置条件满足。

**storeInfo 矛盾身份**（概念分析 §1.2/§2）：`storeInfo(workPath, options)` 同时是「一次性消耗品」（返回值 bundle，pipeline 当轮用完）+「singleton 持久 mutator」（compat 写 `defaultCompilerContext`，跨 orchestrate 驻留，永不 reset）。一个函数不该同时是「用完即弃的产物」+「留下隐式驻留态的副作用」。

**sctx.storeInfo 冗余实证**（概念分析 §3）：collaborator 从 `sctx.storeInfo` 读的全部字段，对照 PackerContext + state.graph——除 `pathInfo.temporaryTargetPath` 外**全冗余**（workPath/targetPath 在 PackerContext；compilerOptions 在 PackerContext.fileTypes；configInfo/dependencyGraph 在 state.graph D-NS-1 accessors）。

**根因链**（概念分析 §4）：storeInfo 矛盾身份 → 产出 sctx.storeInfo（消耗品具象）+ compat 写（singleton mutator 具象）→ sctx.storeInfo 冗余于 PackerContext + state.graph → compat 写 load-bearing（喂未迁 getter）→ env.ts 三层混合承载。

## Goal

消除 storeInfo 的矛盾身份与 sctx.storeInfo 冗余投影，使 storeInfoCtx 成为**纯 orchestrate 链路函数**（PackerContext → state.scratch + state.graph，无返回值），concept 从 3 塌缩至 2（**PackerContext + state.graph**）；**compat 写保留 backflow**（旧 storeInfo 不动——测试 fixture 依赖 ALS getter，推迟为后续 initiative）。worker ALS bridge（resetStoreInfo + getters）保留——阶段 3 范围。

## Non-goals

- **阶段 2 L1 迁出**（storeInfo/buildPackerContext/normalize → 纯模块；env.ts 退化为 ALS 门面 + worker 桥接）——独立 follow-up（纯模块卫生）
- **阶段 3 L2+L3 退役**（compiler/* parse-walk 签名加 PackerContext 参数 + worker 模型调整 + singleton/getters/Proxy/resetStoreInfo 全删）——大 initiative，gated by compiler/* 迁移 + worker 模型
- **PackerContext 构造 dedup**（buildPackerContext/buildFixpointCtx/toPackerContext 三同质构造器）——独立 follow-up
- **worker ALS bridge 不动**（resetStoreInfo + getters 保留，阶段 3）
- **compiler/* 不动**（parse-walk 仍读 ALS getters，阶段 3 迁）
- **scratch 内化**（DiskOutput.publish 用 opts.scratch per-request，未内化 mkdtemp）——Output 抽象 follow-up，须重构 config-compiler/npm-builder 写 DiskOutput.scratch

## Design inputs

- 概念分析：[`2026-10-10-storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) §1-§8（三概念定位 + 冗余实证 + 塌缩路径）
- Output 抽象（backflow）：[`fe-tools-packer-output-abstraction`](../_archive/complete/fe-tools-packer-output-abstraction/README.md)（compat 写 output-path 消费方死——createDist/publishToDist/materialize 殁骸 + publisher/dist-preparer 改 opts.scratch）
- 北星 D-NS-1：Graph 5 accessors（getAppId/getAppName/getAppConfigInfo/getConfigData/getPageConfigInfo）——state.graph 是 config 源
- PackerContext 现状：纯 I/O 能力 interface（workPath/targetPath/readContent/resolveAlias/resolveNpm/fileTypes）
- storeInfo 现状：env.ts L179（双角色）+ L209-219 compat 写 + L229 resetStoreInfo（worker 桥接）

## Requirements

- R-SC1 MUST：PackerSessionState 加 `scratch`（TEMP mkdtemp per-orchestrate；**PackerContext 不加 temporaryTargetPath**——保持纯 I/O，temporaryTargetPath 是 TEMP 非 FINAL）
- R-SC2 MUST：collaborator 迁读 `sctx.ctx`（PackerContext）+ `sctx.state.scratch`（`sctx.storeInfo.pathInfo.X` → `sctx.ctx.X`；`sctx.storeInfo.compilerOptions.X` → `sctx.ctx.fileTypes.X`；scratch → `sctx.state.scratch`）——全 6 消费方 + config-collector L36 getDependencyGraph 迁
- R-SC3 MUST：storeInfo 签名改纯函数（`storeInfo(ctx, graph, state) → void`——3 参数，build/reconcile graph，无返回值无 compat 写）
- R-SC4 MUST：删 sctx.storeInfo 字段（StageChannelContext.storeInfo）+ 删 storeInfo 返回值 + 删 compat 写（env.ts L209-219 六条）+ project-store.getDependencyGraph/merge/snapshot 退役
- R-SC5 MUST：worker ALS bridge 保留（resetStoreInfo + getters 不动——阶段 3；resetStoreInfo 数据源从 sctx.ctx+sctx.state 组装，字段名转换）
- R-SC6 MUST：行为 0（tsc 0 + vitest 88/88 + one-shot 7-diff=0）
- R-SC7 MUST：non-scope 守（compiler/* 不动 + env.ts ALS 门面不删 + worker 模型不动）

## Proposed design

详见 [design.draft.md](design.draft.md)。核心塌缩路径（概念分析 §5）：

1. PackerSessionState 加 scratch + orchestrator tasks.run({output, ctx, state}) 注入（scratch 流 + ctx/state 流）
2. storeInfo 改纯函数 `storeInfo(ctx, graph, state) → void`（算 computePathInfo → state.scratch + build/reconcile graph，无 return 无 compat 写）+ project-store.load 改签名
3. StageChannelContext 加 ctx? + state?（config-collector 设 sctx.dependencyGraph = state.graph.getInnerGraph()）
4. collaborator 迁读 sctx.ctx + sctx.state.scratch（全 6 消费方）+ logic-emitter 组装 resetStoreInfoData（字段名转换）
5. 删 sctx.storeInfo + StageChannelContext.storeInfo + storeInfo 返回值 + compat 写 + project-store.getDependencyGraph 退役

**关键洞察**：compat 写不是独立问题——它是 sctx.storeInfo 冗余投影的副作用。消除 sctx.storeInfo，**compat 写保留 backflow**（实施期实证：105 测试调用点依赖 ALS getter，推迟为后续 initiative）。

## Readiness gaps

**3 项**（design §4 风险，P-SC1/P-SC2 验证条目）：

1. **project-store 存废**：getDependencyGraph/merge/snapshot 全退役，project-store 退化为 storeInfo 薄包。存废决策（倾向保留——ProjectStore interface 改签名）P-SC1 定。
2. **compilerOptions 字段名转换**：PackerFileTypes.directivePrefixes ≠ normalizeFileTypes.templateDirectivePrefixes——buildResetStoreInfoData helper 统一转换。
3. **listr2 ctx 流到 stage-channel**：sctx.ctx/sctx.state 须经 listr2 task ctx 流到 stage-channel（L37 窄化）——须验 stage-channel 可见 sctx.ctx/sctx.state。

## Closure conditions

- 全 MUST Acceptance passed with evidence（A-SC1..N）
- 行为 0 三件套绿（tsc 0 + vitest 88/88 + 7-diff=0）
- grep `sctx.storeInfo` caller=0（殁骸清）；**compat 写保留 backflow**（旧 storeInfo 不动——推迟为后续 initiative）
- worker ALS bridge 保留（resetStoreInfo + getters 非 0）
- backflow：阶段 2（L1 迁出）+ 阶段 3（worker ALS 退役）+ scratch 内化 留 follow-up
