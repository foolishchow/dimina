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
| publisher L30 | pathInfo.targetPath（scratch） | state.scratch（方案 C——PackerContext 不加 temporaryTargetPath） |
| dist-preparer L25 | pathInfo.targetPath（scratch） | state.scratch（方案 C） |
| logic-emitter L39 | storeInfo 透传 emit-engine（resetStoreInfo） | resetStoreInfo（worker ALS，阶段 3 保留） |
| config-collector L51/L55 | pathInfo + compilerOptions | ctx + ctx.fileTypes |

**唯一 gap**：pathInfo.temporaryTargetPath（TEMP scratch）—— PackerContext 无此字段（方案 C：存 state.scratch，非 ctx.temporaryTargetPath）。

### 1.3 compat 写消费方（Output 抽象后）

- ~~createDist/publishToDist/materialize~~（Output 抽象殁骸，已删）
- ~~publisher/dist-preparer~~（改 opts.scratch per-request，但仍读 sctx.storeInfo.pathInfo.targetPath）
- compiler/* parse-walk（经 worker resetStoreInfo，阶段 3 保留）
- 主线程 config 消费方（project-store.getDependencyGraph 等，阶段 3）

## 2. 塌缩设计

### D-SC1 — PackerSessionState 加 scratch（方案 C lock）

PackerSessionState 加 `scratch: string`（TEMP mkdtemp per-orchestrate，每次 orchestrate 覆盖；PackerSessionState 是 OrchestratorState 的实现类——state/session-state.ts L21）。**PackerContext 不加 temporaryTargetPath**（保持纯 I/O：workPath/targetPath FINAL）。

**scratch 流**：storeInfo 算 computePathInfo → `state.scratch = localPathInfo.targetPath`。publisher/dist-preparer 读 `sctx.state.scratch`（非 sctx.storeInfo）。

**修正分析文档**：分析文档 §3/§5 说"PackerContext 加 temporaryTargetPath"，但 temporaryTargetPath 是 TEMP（非 FINAL），加到 PackerContext 违反纯 I/O。**方案 C**——scratch 在 PackerSessionState（per-orchestrate 合法持久），PackerContext 保持纯 I/O。

### D-SC2 — collaborator 迁读 PackerContext + state.scratch（sctx.ctx/sctx.state 注入 lock）

- `sctx.storeInfo.pathInfo.workPath` → `sctx.ctx.workPath`
- `sctx.storeInfo.pathInfo.targetPath`（scratch TEMP）→ `sctx.state.scratch`（PackerSessionState）
- `sctx.storeInfo.compilerOptions.X` → `sctx.ctx.fileTypes.X`（字段名见 R-SC2 映射）

PackerContext 流给 collaborator：**orchestrator `tasks.run({ output, ctx, state })` 注入**（listr2 ctx）——见 §5.2。StageChannelContext 加 `ctx?: PackerContext` + `state?: PackerSessionState`。collaborator 读 sctx.ctx + sctx.state（非 config-collector 设——orchestrator 入口注入，config-collector 跑前已存在）。

### D-SC3 — storeInfo 改纯函数（3 参数 lock）

`storeInfo(ctx: PackerContext, graph: PackerGraph, state: PackerSessionState)` → `void`——build/reconcile graph（ctx 直传，graph.build 不读 targetPath 见 §5.1 实证）+ 算 computePathInfo(ctx.workPath) → `state.scratch`。无返回值无 compat 写。

- project-store.load 改签名 `load(ctx, opts, state)` → `void`（mutate state.scratch + state.graph，无 return）
- 删 storeInfo 返回值（`{pathInfo, configInfo, compilerOptions, dependencyGraph}`）
- 删 compat 写（env.ts L209-219，6 条：pathInfo/compilerOptions/npmResolver/graph/configInfo/dependencyGraph）
- 删内部 toPackerContext（localCtx → ctx 直传；graph.build L69 收 PackerContext，不读 targetPath——实证可行）
- **resolveNpm 等价性须验**（§4 风险）：入口 PackerContext.resolveNpm 须等价 localCtx.npmResolver（`new NpmResolver(workPath)`）——toPackerContext L263 是 stub（`(src, _baseFile) => src`）。须实证入口 ctx.resolveNpm 非退化。

**pathInfo 流**：storeInfo 算 computePathInfo → state.scratch = pathInfo.targetPath。ctx.temporaryTargetPath 不加（方案 C）。

### D-SC4 — 删 sctx.storeInfo + StageChannelContext.storeInfo

- 删 StageChannelContext.storeInfo 字段
- 删 sctx.storeInfo 赋值（config-collector）
- 删 storeInfo 返回值 + compat 写
- compat 写自然死

### D-SC5 — worker ALS bridge 保留 + resetStoreInfo 数据源（§5.3 lock）

resetStoreInfo + getters + defaultCompilerContext 保留。compiler/* parse-walk 仍读 ALS getters（阶段 3 迁）。

**logic-emitter L39 storeInfo 透传 emit-engine（resetStoreInfo）**：塌缩后 storeInfo 无返回值，resetStoreInfo 须 pathInfo + configInfo + compilerOptions + dependencyGraph。**§5.3 lock**——logic-emitter 组装 resetStoreInfoData 从 sctx.ctx + sctx.state（字段名转换见 §5.3）。resetStoreInfo 本身不变（阶段 3 保留）。

### D-SC6 — 行为 0 + non-scope 守

tsc 0 + vitest 88/88 + 7-diff=0。compiler/* 不动 + env.ts ALS 门面不删 + worker 模型不动。

## 3. 塌缩路径（deprecated——见 §6 lock 后版本）

> §3 是方案 A 修正前残留，已被 §6（方案 lock 后）取代。保留标题以维持序号。

## 4. 风险

- **resolveNpm 等价性**（D-SC3）：入口 PackerContext.resolveNpm 须等价 `new NpmResolver(workPath)`。toPackerContext L263 是 stub。须实证入口 ctx.resolveNpm 实现（index.ts buildPackerContext）——P-SC1 验证条目。
- **project-store 存废**（§5.4）：getDependencyGraph/merge/snapshot 全退役，project-store 退化为 storeInfo 薄包。存废决策（删则 config-collector 直调 storeInfo；保留则 ProjectStore interface 改签名 `load(ctx, opts, state) → void`）——P-SC1 定。
- **行为 0**：sctx.storeInfo 全 6 消费方迁 + getDependencyGraph 迁——每步独立验证。
- **compilerOptions 字段名转换**（§5.3）：PackerFileTypes.directivePrefixes ≠ normalizeFileTypes.templateDirectivePrefixes——logic-emitter 组装须字段名转换。

## 5. 方案 lock（3 待决问题解决）

### 5.1 scratch 流——方案 C（state.scratch）

**决策**：scratch 存 **PackerSessionState.scratch**（per-orchestrate TEMP，每次 orchestrate 覆盖），**PackerContext 不加 temporaryTargetPath**（保持 PackerContext 纯 I/O：workPath/targetPath FINAL）。

**理由**：temporaryTargetPath 是 TEMP（非 FINAL），加到 PackerContext 违反纯 I/O 定位（PackerContext.targetPath = FINAL）。scratch 是 per-orchestrate TEMP（PackerSessionState 合法持久，每次覆写）。

**流**：storeInfo 算 computePathInfo → `state.scratch = localPathInfo.targetPath`。publisher/dist-preparer 读 `sctx.state.scratch`（非 sctx.storeInfo）。

### 5.2 PackerContext 流——sctx.ctx + sctx.state 注入

**决策**：orchestrator `tasks.run({ output, ctx, state })` 注入（ctx + state 经 listr2 ctx）。StageChannelContext 加 `ctx?: PackerContext` + `state?: PackerSessionState`。collaborator 读 `sctx.ctx`（workPath/fileTypes）+ `sctx.state.scratch`。

**理由**：与 output 同（listr2 ctx 注入）。config-collector 跑前 sctx.ctx + sctx.state 已存在。collaborator 不需 deps 加 ctx/state（统一 sctx）。

**config-collector deps.state**：可删（用 sctx.state）或保留（冗余但无害）。倾向删——统一 sctx.state。

### 5.3 resetStoreInfo 数据源——从 sctx.ctx + sctx.state 组装（字段名转换 lock）

**决策**：logic-emitter 组装 resetStoreInfoData 给 emit-engine → resetStoreInfo：

```ts
{
  pathInfo: { workPath: sctx.ctx.workPath, targetPath: sctx.state.scratch },
  configInfo: sctx.state.graph.getConfigData(),
  compilerOptions: {
    templateExts: sctx.ctx.fileTypes.templateExts,
    templateDirectivePrefixes: sctx.ctx.fileTypes.directivePrefixes,  // 字段名转换
    styleExts: sctx.ctx.fileTypes.styleExts,
    viewScriptExts: sctx.ctx.fileTypes.viewScriptExts,
    viewScriptTags: sctx.ctx.fileTypes.viewScriptTags,
  },
  dependencyGraph: sctx.state.graph.getInnerGraph(),
}
```

**理由**：storeInfo 塌缩后无返回值，resetStoreInfo 须 pathInfo + configInfo + compilerOptions + dependencyGraph。从 sctx.ctx（workPath/fileTypes）+ sctx.state（scratch/graph）组装。

**字段名转换**（F-R6-1 修正）：resetStoreInfo opts.compilerOptions 类型是 `ReturnType<typeof normalizeFileTypes>`（字段 `templateDirectivePrefixes`），但 PackerFileTypes 用 `directivePrefixes`。组装时须字段名转换（`directivePrefixes` → `templateDirectivePrefixes`），否则 worker compilerOptions.templateDirectivePrefixes 得 undefined，parse-walk 退化。

**pathInfo**：resetStoreInfo L229-248 只 set context.pathInfo + 读 pathInfo.workPath（npmResolver），不读 temporaryTargetPath。组装 pathInfo `{workPath, targetPath: state.scratch}` 足够（temporaryTargetPath 非必需——worker getTargetPath L401 只读 targetPath）。resetStoreInfo 本身不变（阶段 3 保留）。

### 5.4 project-store.getDependencyGraph 退役（compat 写死额外影响）

**发现**：compat 写 `context.graph = graph`（env.ts L216）喂 `project-store.getDependencyGraph()`（返 ALS graph）。compat 写死后 defaultCompilerContext.graph 不设，getDependencyGraph 返 undefined。

**消费方**：config-collector L36 `sctx.dependencyGraph = store.getDependencyGraph()`（唯一 src/ 消费方；compiler/view/wxml/load 用 env.getDependencyGraph，worker 侧阶段 3）。

**决策**：config-collector L36 改 `sctx.dependencyGraph = state.graph.getInnerGraph()`（直接 state.graph，非 ALS）。project-store.getDependencyGraph 退役（死代码——可删或保留 stub）。

**project-store.merge/snapshot**：无 src/ 消费方（grep 确认）——可删或保留 stub（非 blocking）。

**project-store 存废决策**：load 改签名后 getDependencyGraph/merge/snapshot 全退役，project-store 退化为 storeInfo 单调用薄包。**倾向保留**（ProjectStore interface 改签名 `load(ctx, opts, state) → void`，删 getDependencyGraph/merge/snapshot）——维持 config-collector `deps.store` 抽象边界；删 project-store 则 config-collector 直调 storeInfo，deps.store 退役。P-SC1 定（倾向保留——最小改动）。

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
