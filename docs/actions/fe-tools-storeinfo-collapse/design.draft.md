# Design Draft — fe-tools-storeinfo-collapse

Status authority: [Action Status](../STATUS.md)

> **D-SC1..6 locked**（3 待决问题解决：scratch 流方案 C state.scratch + PackerContext 流 sctx.ctx/sctx.state 注入 + resetStoreInfo 从 sctx.ctx/sctx.state 组装 + project-store.getDependencyGraph 退役）。本文档基于 [`2026-10-10-storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) §1-§8 讨论 + [`fe-tools-packer-output-abstraction`](../_archive/complete/fe-tools-packer-output-abstraction/README.md) backflow。

## 1. 现状

### 1.1 storeInfo 双角色（env.ts L179）

```ts
function storeInfo(workPath, options) {
  // L1 计算：computePathInfo + normalizeFileTypes + PackerGraph build/reconcile
  // compat 写（L209-219）：写 defaultCompilerContext singleton（load-bearing）
  return { pathInfo, configInfo, compilerOptions, dependencyGraph }  // 消耗品
}
```

- **计算角色**（canonical）：store.load → sctx.storeInfo → collaborator 读
- **ALS 填充角色**（compat 副作用）：defaultCompilerContext singleton mutate（跨 orchestrate 驻留）

### 1.2 sctx.storeInfo 冗余（6 消费方）

| 消费方 | 读 sctx.storeInfo | PackerContext/state.graph 等价 |
|---|---|---|
| config-compiler-collab L29 | pathInfo.workPath/targetPath | ctx.workPath/targetPath |
| stage-dispatcher L85 | pathInfo + compilerOptions（5 exts） | ctx.workPath/targetPath + ctx.fileTypes（5 exts） |
| npm-builder L294 | pathInfo + compilerOptions | ctx + ctx.fileTypes |
| publisher L30 | pathInfo.targetPath（scratch） | ctx.temporaryTargetPath（gap——须加） |
| dist-preparer L25 | pathInfo.targetPath（scratch） | ctx.temporaryTargetPath（gap） |
| logic-emitter L39 | storeInfo 透传 emit-engine（resetStoreInfo） | resetStoreInfo（worker ALS，阶段 3 保留） |
| config-collector L51/L55 | pathInfo + compilerOptions | ctx + ctx.fileTypes |

**唯一 gap**：pathInfo.temporaryTargetPath（TEMP scratch）—— PackerContext 无此字段。

### 1.3 compat 写消费方（Output 抽象后）

- ~~createDist/publishToDist/materialize~~（Output 抽象殁骸，已删）
- ~~publisher/dist-preparer~~（改 opts.scratch per-request，但仍读 sctx.storeInfo.pathInfo.targetPath）
- compiler/* parse-walk（经 worker resetStoreInfo，阶段 3 保留）
- 主线程 config 消费方（project-store.getDependencyGraph 等，阶段 3）

## 2. 塌缩设计

### D-SC1 — OrchestratorState 加 scratch（方案 C lock）

PackerSessionState 加 `scratch: string`（TEMP mkdtemp per-orchestrate，每次 orchestrate 覆盖）。**PackerContext 不加 temporaryTargetPath**（保持纯 I/O：workPath/targetPath FINAL）。

**scratch 流**：storeInfo 算 computePathInfo → `state.scratch = localPathInfo.targetPath`。publisher/dist-preparer 读 `sctx.state.scratch`（非 sctx.storeInfo）。

**修正分析文档**：分析文档 §3/§5 说"PackerContext 加 temporaryTargetPath"，但 temporaryTargetPath 是 TEMP（非 FINAL），加到 PackerContext 违反纯 I/O。**方案 C**——scratch 在 PackerSessionState（per-orchestrate 合法持久），PackerContext 保持纯 I/O。

### D-SC2 — collaborator 迁读 PackerContext + state.scratch（sctx.ctx/sctx.state lock）

- `sctx.storeInfo.pathInfo.workPath` → `ctx.workPath`（sctx.ctx 或 deps）
- `sctx.storeInfo.pathInfo.targetPath`（scratch TEMP）→ `state.scratch`（OrchestratorState）
- `sctx.storeInfo.compilerOptions.X` → `ctx.fileTypes.X`

PackerContext 流给 collaborator：sctx.ctx（StageChannelContext 加 ctx?）或 deps 加 ctx。

倾向 **sctx.ctx**（StageChannelContext 加 ctx?: PackerContext）——config-collector 设 sctx.ctx（storeInfo 后建）。collaborator 读 sctx.ctx。

### D-SC3 — storeInfo 改纯函数

`storeInfo(ctx: PackerContext, graph: PackerGraph)` → `void`——build/reconcile graph + 设 state.scratch。无返回值无 compat 写。

- project-store.load 改调 storeInfo（无 return，只 mutate graph + 设 state.scratch）
- 删 storeInfo 返回值
- 删 compat 写（L209-219）
- 删内部 toPackerContext（localCtx → ctx 直传）

**pathInfo 流**：storeInfo 算 computePathInfo → state.scratch = pathInfo.targetPath。ctx.temporaryTargetPath 不加（方案 C）。

### D-SC4 — 删 sctx.storeInfo + StageChannelContext.storeInfo

- 删 StageChannelContext.storeInfo 字段
- 删 sctx.storeInfo 赋值（config-collector）
- 删 storeInfo 返回值 + compat 写
- compat 写自然死

### D-SC5 — worker ALS bridge 保留 + resetStoreInfo 数据源（组装 lock）

resetStoreInfo + getters + defaultCompilerContext 保留。compiler/* parse-walk 仍读 ALS getters（阶段 3 迁）。

**logic-emitter L39 storeInfo 透传 emit-engine（resetStoreInfo）**：emit-engine 调 resetStoreInfo(params.storeInfo)。塌缩后 storeInfo 无返回值——resetStoreInfo 须从别处拿 pathInfo/configInfo。可能——resetStoreInfo 收 state.scratch + state.graph.getConfigData()？或保留 storeInfo 算 pathInfo/configInfo 给 resetStoreInfo（不返 sctx.storeInfo，只给 resetStoreInfo）。

**待决**：resetStoreInfo 数据源。storeInfo 塌缩后无返回值，但 resetStoreInfo 须 pathInfo + configInfo。可能 storeInfo 仍算 pathInfo/configInfo（内部），设 state.scratch + state.graph.configInfo，resetStoreInfo 从 state 拿。或 storeInfo 返 pathInfo/configInfo（只给 resetStoreInfo，非 sctx.storeInfo）。

### D-SC6 — 行为 0 + non-scope 守

tsc 0 + vitest 88/88 + 7-diff=0。compiler/* 不动 + env.ts ALS 门面不删 + worker 模型不动。

## 3. 塌缩路径（修正方案 C）

| 步 | 内容 | 效果 |
|---|---|---|
| 1 | OrchestratorState 加 scratch（TEMP mkdtemp） | scratch 流 |
| 2 | storeInfo 改纯函数（算 pathInfo → state.scratch + build/reconcile graph） | 无 return 无 compat 写 |
| 3 | StageChannelContext 加 ctx?: PackerContext（config-collector 设） | collaborator 读 sctx.ctx |
| 4 | collaborator 迁读 sctx.ctx + state.scratch（全 6 消费方） | 消 sctx.storeInfo 读者 |
| 5 | 删 sctx.storeInfo + StageChannelContext.storeInfo + storeInfo 返回值 + compat 写 | compat 写自然死 |

## 4. 风险

- **resetStoreInfo 数据源**（D-SC5）：storeInfo 塌缩后无返回值，resetStoreInfo 须 pathInfo + configInfo。须 design 探讨。
- **PackerContext 流时机**（D-SC2）：config-collector 设 sctx.ctx（storeInfo 后）。但 PackerContext 是 orchestrate 入参（config-collector 前）。sctx.ctx 须在 storeInfo 后设——但 collaborator 在 storeInfo 后跑。OK。
- **行为 0**：sctx.storeInfo 全 6 消费方迁——每步独立验证。

## 5. 方案 lock（3 待决问题解决）

### 5.1 scratch 流——方案 C（state.scratch）

**决策**：scratch 存 **PackerSessionState.scratch**（per-orchestrate TEMP，每次 orchestrate 覆盖），**PackerContext 不加 temporaryTargetPath**（保持 PackerContext 纯 I/O：workPath/targetPath FINAL）。

**理由**：temporaryTargetPath 是 TEMP（非 FINAL），加到 PackerContext 违反纯 I/O 定位（PackerContext.targetPath = FINAL）。scratch 是 per-orchestrate TEMP（PackerSessionState 合法持久，每次覆写）。

**流**：storeInfo 算 computePathInfo → `state.scratch = localPathInfo.targetPath`。publisher/dist-preparer 读 `sctx.state.scratch`（非 sctx.storeInfo）。

### 5.2 PackerContext 流——sctx.ctx + sctx.state 注入

**决策**：orchestrator `tasks.run({ output, ctx, state })` 注入（ctx + state 经 listr2 ctx）。StageChannelContext 加 `ctx?: PackerContext` + `state?: PackerSessionState`。collaborator 读 `sctx.ctx`（workPath/fileTypes）+ `sctx.state.scratch`。

**理由**：与 output 同（listr2 ctx 注入）。config-collector 跑前 sctx.ctx + sctx.state 已存在。collaborator 不需 deps 加 ctx/state（统一 sctx）。

**config-collector deps.state**：可删（用 sctx.state）或保留（冗余但无害）。倾向删——统一 sctx.state。

### 5.3 resetStoreInfo 数据源——从 sctx.ctx + sctx.state 组装

**决策**：logic-emitter 组装 `{ pathInfo: { workPath: sctx.ctx.workPath, targetPath: sctx.state.scratch }, configInfo: sctx.state.graph.getConfigData(), compilerOptions: sctx.ctx.fileTypes, dependencyGraph: sctx.state.graph.getInnerGraph() }` 给 emit-engine → resetStoreInfo。

**理由**：storeInfo 塌缩后无返回值，resetStoreInfo 须 pathInfo + configInfo + compilerOptions + dependencyGraph。从 sctx.ctx（workPath/fileTypes）+ sctx.state（scratch/graph）组装。resetStoreInfo 本身不变（阶段 3 保留）。

### 5.4 project-store.getDependencyGraph 退役（compat 写死额外影响）

**发现**：compat 写 `context.graph = graph`（env.ts L216）喂 `project-store.getDependencyGraph()`（返 ALS graph）。compat 写死后 defaultCompilerContext.graph 不设，getDependencyGraph 返 undefined。

**消费方**：config-collector L36 `sctx.dependencyGraph = store.getDependencyGraph()`（唯一 src/ 消费方；compiler/view/wxml/load 用 env.getDependencyGraph，worker 侧阶段 3）。

**决策**：config-collector L36 改 `sctx.dependencyGraph = state.graph.getInnerGraph()`（直接 state.graph，非 ALS）。project-store.getDependencyGraph 退役（死代码——可删或保留 stub）。

**project-store.merge/snapshot**：无 src/ 消费方（grep 确认）——可删或保留 stub（非 blocking）。

## 6. 塌缩路径（方案 lock 后）

| 步 | 内容 | 效果 |
|---|---|---|
| 1 | PackerSessionState 加 scratch + orchestrator tasks.run({output, ctx, state}) 注入 | scratch 流 + ctx/state 流 |
| 2 | storeInfo 改纯函数 `storeInfo(ctx, graph, state) → void`（算 computePathInfo → state.scratch + build/reconcile graph，无 return 无 compat 写）+ project-store.load 改 `load(ctx, opts, state) → void` | storeInfo 纯化 |
| 3 | StageChannelContext 加 ctx? + state?（config-collector 设 sctx.dependencyGraph = state.graph.getInnerGraph()） | sctx.ctx + sctx.state |
| 4 | collaborator 迁读 sctx.ctx + sctx.state.scratch（全 6 消费方）+ logic-emitter 组装 resetStoreInfoData | 消 sctx.storeInfo 读者 |
| 5 | 删 sctx.storeInfo + StageChannelContext.storeInfo + storeInfo 返回值 + compat 写 + project-store.getDependencyGraph 退役 | compat 写自然死 |

## 7. scope 取舍

采用 **B 塌缩**（概念分析 §7 选项 B）——消 sctx.storeInfo，compat 写自然死。非 A 窄 backflow（打补丁）。

**阶段 1**（此 Action scope）：storeInfo 纯化 + 消 sctx.storeInfo + 删 compat 写。
**阶段 2**（独立 follow-up）：L1 迁出。
**阶段 3**（大 initiative）：L2+L3 退役。
