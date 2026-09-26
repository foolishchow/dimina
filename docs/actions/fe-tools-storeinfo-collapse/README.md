# fe-tools-storeinfo-collapse

- Action: `fe-tools-storeinfo-collapse`
- Status: `draft`
- Created: 2026-10-10
- Status authority: [Action Status](../STATUS.md)
- 设计门：[design.draft.md](design.draft.md)（D-SC1..N 待 review lock）
- 实施计划：[implementation-plan.md](implementation-plan.md)（P-SC1..N 分相）
- 验证：[validation.md](validation.md)
- 背景：[`docs/fe-tools/2026-10-10-storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) §1-§7（概念分析）+ [`fe-tools-packer-output-abstraction`](../_archive/complete/fe-tools-packer-output-abstraction/README.md)（backflow：compat 写 output-path 消费方死）

## Background

`fe-tools-packer-north-star-evolution`（D-NS-1..6）闭合后揭示 **storeInfo compat 写 load-bearing**（P-NS6 audit）。`fe-tools-packer-output-abstraction` 完成后，compat 写的 **output-path 消费方全死**（createDist/publishToDist/materialize 殁骸拆除；publisher/dist-preparer 改 opts.scratch per-request）——storeInfo 塌缩的前置条件满足。

**storeInfo 矛盾身份**（概念分析 §1.2/§2）：`storeInfo(workPath, options)` 同时是「一次性消耗品」（返回值 bundle，pipeline 当轮用完）+「singleton 持久 mutator」（compat 写 `defaultCompilerContext`，跨 orchestrate 驻留，永不 reset）。一个函数不该同时是「用完即弃的产物」+「留下隐式驻留态的副作用」。

**sctx.storeInfo 冗余实证**（概念分析 §3）：collaborator 从 `sctx.storeInfo` 读的全部字段，对照 PackerContext + state.graph——除 `pathInfo.temporaryTargetPath` 外**全冗余**（workPath/targetPath 在 PackerContext；compilerOptions 在 PackerContext.fileTypes；configInfo/dependencyGraph 在 state.graph D-NS-1 accessors）。

**根因链**（概念分析 §4）：storeInfo 矛盾身份 → 产出 sctx.storeInfo（消耗品具象）+ compat 写（singleton mutator 具象）→ sctx.storeInfo 冗余于 PackerContext + state.graph → compat 写 load-bearing（喂未迁 getter）→ env.ts 三层混合承载。

## Goal

消除 storeInfo 的矛盾身份与 sctx.storeInfo 冗余投影，使 storeInfo 成为**纯 state.graph mutator**（PackerContext → state.graph build/reconcile，无返回值无 singleton 副作用），concept 从 3 塌缩至 2（**PackerContext + state.graph**）；**compat 写自然死**（无快照可 dump）。worker ALS bridge（resetStoreInfo + getters）保留——阶段 3 范围。

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

- R-SC1 MUST：PackerContext 加 `temporaryTargetPath`（关闭唯一 gap——sctx.storeInfo.pathInfo.temporaryTargetPath）
- R-SC2 MUST：collaborator 迁读 PackerContext（`sctx.storeInfo.pathInfo.X` → `ctx.X`；`sctx.storeInfo.compilerOptions.X` → `ctx.fileTypes.X`）——全 6 消费方
- R-SC3 MUST：storeInfo 签名改纯函数（`storeInfo(ctx: PackerContext, state.graph) → void`——build/reconcile graph，无返回值无 compat 写）
- R-SC4 MUST：删 sctx.storeInfo 字段（StageChannelContext.storeInfo）+ 删 storeInfo 返回值 + 删 compat 写（env.ts L209-219）
- R-SC5 MUST：worker ALS bridge 保留（resetStoreInfo + getters 不动——阶段 3）
- R-SC6 MUST：行为 0（tsc 0 + vitest 88/88 + one-shot 7-diff=0）
- R-SC7 MUST：non-scope 守（compiler/* 不动 + env.ts ALS 门面不删 + worker 模型不动）

## Proposed design

详见 [design.draft.md](design.draft.md)。核心塌缩路径（概念分析 §5）：

1. PackerContext 加 temporaryTargetPath（+ scratch 流——Output 抽象后 opts.scratch 从 ctx.temporaryTargetPath）
2. PackerContext 流给 collaborator（经 sctx.ctx 或 deps）
3. collaborator 迁读 PackerContext（全 6 消费方）
4. storeInfo 改纯函数（PackerContext → state.graph build/reconcile，无 return 无 compat 写）
5. 删 sctx.storeInfo + storeInfo 返回值 + compat 写

**关键洞察**：compat 写不是独立问题——它是 sctx.storeInfo 冗余投影的副作用。消除 sctx.storeInfo，compat 写自然死。

## Readiness gaps

- **scratch 流待决**：Output 抽象后 publisher/dist-preparer 用 `opts.scratch`（per-request sctx.storeInfo.pathInfo.targetPath）。塌缩删 sctx.storeInfo 后，scratch 从哪？PackerContext.temporaryTargetPath（computePathInfo mkdtemp）？但 PackerContext 是 orchestrate 入参（config-collector 前）。须 design 探讨 scratch 流（ctx.temporaryTargetPath 何时设）。
- **temporaryTargetPath 时机**：computePathInfo 在 storeInfo 跑（config-collector）。PackerContext 是入口参数（config-collector 前）。temporaryTargetPath 须在 storeInfo 后设——但 PackerContext immutable。design 待决。

## Closure conditions

- 全 MUST Acceptance passed with evidence（A-SC1..N）
- 行为 0 三件套绿（tsc 0 + vitest 88/88 + 7-diff=0）
- grep `sctx.storeInfo` caller=0 + `compat 写` caller=0 + `storeInfo.*return` = 0
- worker ALS bridge 保留（resetStoreInfo + getters 非 0）
- backflow：阶段 2（L1 迁出）+ 阶段 3（worker ALS 退役）+ scratch 内化 留 follow-up
