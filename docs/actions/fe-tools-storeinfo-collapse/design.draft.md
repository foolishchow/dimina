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

### D-SC3 — storeInfoCtx 新纯函数（orchestrate 链路，3 参数 lock）

新增 `storeInfoCtx(ctx: PackerContext, graph: PackerGraph, state: PackerSessionState)` → `void`（env.ts export）——算 `state.scratch = storeInfo(ctx.workPath, {graph}).pathInfo.targetPath!`（调旧 storeInfo 取 pathInfo，设 state.scratch）。**旧 storeInfo 保留**（compat 写 load-bearing，测试 fixture 依赖——concept analysis §5 实证「删则崩」；推迟为后续 initiative，与 D-NS6 R-NS8 backflow 一致）。

- project-store.load 改签名 `load(ctx, state)` → `void`（mutate state，无 return）
- **compat 写保留 backflow**：旧 storeInfo 内 compat 写（env.ts L209-219 六条）不动——design 原 D-SC3「删 compat 写」经实施期实证 REVERT（105 测试调用点依赖 ALS getter）。推迟为后续 initiative。
- storeInfoCtx 无返回值（orchestrate 链路纯函数，仅设 state.scratch）
- graph.build L69 收 PackerContext，不读 targetPath——实证可行；graph.build L73 自建 `new NpmResolver(ctx.workPath)`，不读 ctx.resolveNpm——实证安全，§4 resolveNpm 风险已删
- **scratch 类型断言**（F-R10-3）：`state.scratch = r.pathInfo.targetPath!`（PathInfo.targetPath?: string）
- **scratch mutability**（F-R10-4）：PackerSessionState.scratch 须 mutable（per-orchestrate 覆盖）—— `scratch: string`（非 readonly）

**pathInfo 流**：storeInfoCtx 调旧 storeInfo 算 computePathInfo → state.scratch = pathInfo.targetPath!。ctx.temporaryTargetPath 不加（方案 C）。

### D-SC4 — 删 sctx.storeInfo + StageChannelContext.storeInfo + project-store.getDependencyGraph 退役

- 删 StageChannelContext.storeInfo 字段
- 删 sctx.storeInfo 赋值（config-collector）
- collaborator 全迁 sctx.ctx/sctx.state（不读 sctx.storeInfo）
- grep `sctx.storeInfo` caller=0（殁骸清）
- **compat 写保留 backflow**（旧 storeInfo 内 compat 写不动——推迟为后续 initiative）
- **project-store.getDependencyGraph/merge/snapshot 退役**：config-collector 改 `state.graph.getInnerGraph()`（直接 state.graph，非 ALS）；ProjectStore interface 删三方法。**不依赖 compat 写死**（config-collector 已迁 state.graph，与 compat 写保留并存）

### D-SC5 — worker ALS bridge 保留 + resetStoreInfo 数据源（§5.3 lock）

resetStoreInfo + getters + defaultCompilerContext 保留。compiler/* parse-walk 仍读 ALS getters（阶段 3 迁）。

**logic-emitter L39 storeInfo 透传 emit-engine（resetStoreInfo）**：塌缩后 storeInfo 无返回值，resetStoreInfo 须 pathInfo + configInfo + compilerOptions + dependencyGraph。**§5.3 lock**——logic-emitter 组装 resetStoreInfoData 从 sctx.ctx + sctx.state（字段名转换见 §5.3）。resetStoreInfo 本身不变（阶段 3 保留）。

### D-SC6 — 行为 0 + non-scope 守

tsc 0 + vitest 88/88 + 7-diff=0。compiler/* 不动 + env.ts ALS 门面不删 + worker 模型不动。

## 3. 塌缩路径（deprecated——见 §6 lock 后版本）

> §3 是方案 A 修正前残留，已被 §6（方案 lock 后）取代。保留标题以维持序号。

## 4. 风险

- **project-store 存废**（§5.4）：getDependencyGraph/merge/snapshot 全退役，project-store 退化为 storeInfo 薄包。存废决策（删则 config-collector 直调 storeInfo；保留则 ProjectStore interface 改签名 `load(ctx, opts, state) → void`）——P-SC1 定。
- **行为 0**：sctx.storeInfo 全 6 消费方迁 + getDependencyGraph 迁 + stage-channel L45 迁——每步独立验证。
- **compilerOptions 字段名转换**（§5.3）：PackerFileTypes.directivePrefixes ≠ normalizeFileTypes.templateDirectivePrefixes——buildResetStoreInfoData helper 统一转换。
- **listr2 ctx 流到 stage-channel**（§5.2）：sctx.ctx/sctx.state 须经 listr2 task ctx 流到 stage-channel（L37 窄化）——须验 orchestrator task 闭包的 ctx 是 listr2 注入 ctx（非 deps）。

~~resolveNpm 等价性~~（F-R10-2 删）：实证 graph.build L73 自建 `new NpmResolver(ctx.workPath)`，不读 ctx.resolveNpm；buildPackerContext L286 resolveNpm = stub（与 toPackerContext L263 同）——ctx 直传行为等价，风险取消。

## 5. 方案 lock（3 待决问题解决）

### 5.1 scratch 流——方案 C（state.scratch）

**决策**：scratch 存 **PackerSessionState.scratch**（per-orchestrate TEMP，每次 orchestrate 覆盖），**PackerContext 不加 temporaryTargetPath**（保持 PackerContext 纯 I/O：workPath/targetPath FINAL）。

**理由**：temporaryTargetPath 是 TEMP（非 FINAL），加到 PackerContext 违反纯 I/O 定位（PackerContext.targetPath = FINAL）。scratch 是 per-orchestrate TEMP（PackerSessionState 合法持久，每次覆写）。

**流**：storeInfo 算 computePathInfo → `state.scratch = localPathInfo.targetPath`。publisher/dist-preparer 读 `sctx.state.scratch`（非 sctx.storeInfo）。

### 5.2 PackerContext 流——sctx.ctx + sctx.state 注入

**决策**：orchestrator `tasks.run({ output, ctx, state })` 注入（ctx + state 经 listr2 ctx）。StageChannelContext 加 `ctx?: PackerContext` + `state?: PackerSessionState`。collaborator 读 `sctx.ctx`（workPath/fileTypes）+ `sctx.state.scratch`。

**理由**：与 output 同（listr2 ctx 注入）。config-collector 跑前 sctx.ctx + sctx.state 已存在。collaborator 不需 deps 加 ctx/state（统一 sctx）。

**config-collector deps 演进**（F-R11-2 修正）：deps { store, state, lifecycle, loaderRegistry, workPath, fileTypes, invalidatedModules } 塌缩后：
- `workPath` → 删（用 sctx.ctx.workPath）
- `fileTypes` → 删（用 sctx.ctx.fileTypes）
- `state` → 删（用 sctx.state）
- 保留 store/lifecycle/loaderRegistry/invalidatedModules

**listr2 ctx 流到 stage-channel**（F-R12-2）：sctx.ctx/sctx.state 须经 listr2 task ctx 流到 stage-channel（L37 `ctx as unknown as StageChannelContext` 窄化）。orchestrator task 闭包收 listr2 注入 ctx（含 ctx/state）→ runCompileStage({ ctx }) → stage-channel 窄化 sctx.ctx/sctx.state 可见。须验 stage-channel L45 buildResetStoreInfoData(sctx.ctx, sctx.state) sctx 字段非 undefined。

### 5.3 resetStoreInfo 数据源——buildResetStoreInfoData helper（3 处调用 lock）

**决策**：抽 `buildResetStoreInfoData(ctx: PackerContext, state: PackerSessionState): Parameters<typeof resetStoreInfo>[0]` helper（env.ts export，resetStoreInfo 旁）。**3 处 worker resetStoreInfo 调用点**统一用 helper 组装（F-R10-1 修正——scope 扩展覆盖 view/style）：

| 调用点 | 透传文件 | worker 入口 |
|---|---|---|
| logic stage | logic-emitter L39 → emit-engine L11 | emit-engine `resetStoreInfo(params.storeInfo)` |
| view stage | stage-channel L45（`input.storeInfo`） | view/index.ts L192 `resetStoreInfo(m.storeInfo)` |
| style stage | stage-channel L45（`input.storeInfo`） | style/index.ts L57 `resetStoreInfo(m.storeInfo)` |

**组装**：

```ts
function buildResetStoreInfoData(ctx: PackerContext, state: PackerSessionState): Parameters<typeof resetStoreInfo>[0] {
  return {
    pathInfo: { workPath: ctx.workPath, targetPath: state.scratch },
    configInfo: state.graph.getConfigData() as ConfigInfo,  // GraphConfigData → ConfigInfo 断言（F-R11-1）
    compilerOptions: {
      templateExts: ctx.fileTypes.templateExts,
      templateDirectivePrefixes: ctx.fileTypes.directivePrefixes,  // 字段名转换（F-R6-1）
      styleExts: ctx.fileTypes.styleExts,
      viewScriptExts: ctx.fileTypes.viewScriptExts,
      viewScriptTags: ctx.fileTypes.viewScriptTags,
    },
    dependencyGraph: state.graph.getInnerGraph(),
  }
}
```

**调用**：
- logic-emitter L39：`const resetStoreInfoData = buildResetStoreInfoData(sctx.ctx!, sctx.state!)` → emit input `storeInfo: resetStoreInfoData`
- stage-channel L45：`storeInfo: buildResetStoreInfoData(sctx.ctx as PackerContext, sctx.state as PackerSessionState)`（view/style stage 统一透传点）

**理由**：storeInfo 塌缩后无返回值，3 处 worker resetStoreInfo 须 pathInfo + configInfo + compilerOptions + dependencyGraph。抽 helper DRY（F-R13-3）+ 统一字段名转换（F-R6-1）+ 统一类型断言（F-R11-1 configInfo `as ConfigInfo`）。

**字段名转换**（F-R6-1 修正）：resetStoreInfo opts.compilerOptions 类型是 `ReturnType<typeof normalizeFileTypes>`（字段 `templateDirectivePrefixes`），但 PackerFileTypes 用 `directivePrefixes`。helper 组装时字段名转换（`directivePrefixes` → `templateDirectivePrefixes`），否则 worker compilerOptions.templateDirectivePrefixes 得 undefined，parse-walk 退化。

**类型断言**（F-R11-1 修正）：
- configInfo：`getConfigData()` 返 `GraphConfigData`，resetStoreInfo opts.configInfo: `ConfigInfo` → `as ConfigInfo`（storeInfo 现状 L218 同断言）
- pathInfo.targetPath：`state.scratch` 是 `string`（non-undefined），pathInfo 推导 `{workPath: string, targetPath: string}`——无需断言

**pathInfo**：resetStoreInfo L229-248 只 set context.pathInfo + 读 pathInfo.workPath（npmResolver），不读 temporaryTargetPath。组装 pathInfo `{workPath, targetPath: state.scratch}` 足够（temporaryTargetPath 非必需——worker getTargetPath L401 只读 targetPath）。resetStoreInfo 本身不变（阶段 3 保留）。

### 5.4 project-store.getDependencyGraph 退役（与 compat 写保留并存）

**发现**：compat 写 `context.graph = graph`（env.ts L216）原喂 `project-store.getDependencyGraph()`（返 ALS graph）。**compat 写保留 backflow**（旧 storeInfo 不动），但 getDependencyGraph 退役仍成立——config-collector 已迁 `state.graph.getInnerGraph()`（直接 state.graph，非 ALS）。

**消费方**：config-collector 原 L36 `sctx.dependencyGraph = store.getDependencyGraph()`（唯一 src/ 消费方；compiler/view/wxml/load 用 env.getDependencyGraph，worker 侧阶段 3）。

**决策**：config-collector 改 `sctx.dependencyGraph = state.graph.getInnerGraph()`（直接 state.graph）。project-store.getDependencyGraph 退役（ProjectStore interface 删——无 src/ 消费方）。

**project-store.merge/snapshot**：无 src/ 消费方（grep 确认）——可删或保留 stub（非 blocking）。

**project-store 存废决策**：load 改签名后 getDependencyGraph/merge/snapshot 全退役，project-store 退化为 storeInfo 单调用薄包。**倾向保留**（ProjectStore interface 改签名 `load(ctx, state) → void`，删 getDependencyGraph/merge/snapshot）——维持 config-collector `deps.store` 抽象边界；删 project-store 则 config-collector 直调 storeInfo，deps.store 退役。P-SC1 定（倾向保留——最小改动）。

## 6. 塌缩路径（方案 lock 后）

| 步 | 内容 | 效果 |
|---|---|---|
| 1 | PackerSessionState 加 scratch + orchestrator tasks.run({output, ctx, state}) 注入 | scratch 流 + ctx/state 流 |
| 2 | 新增 storeInfoCtx `(ctx, graph, state) → void`（调旧 storeInfo 取 pathInfo → state.scratch；旧 storeInfo 保留，compat 写 backflow）+ project-store.load 改 `load(ctx, state) → void` | orchestrate 链路纯函数 |
| 3 | StageChannelContext 加 ctx? + state?（config-collector 设 sctx.dependencyGraph = state.graph.getInnerGraph()） | sctx.ctx + sctx.state |
| 4 | collaborator 迁读 sctx.ctx + sctx.state.scratch（全 6 消费方）+ logic-emitter 组装 resetStoreInfoData | 消 sctx.storeInfo 读者 |
| 5 | 删 sctx.storeInfo + StageChannelContext.storeInfo + project-store.getDependencyGraph 退役（compat 写保留 backflow——推迟为后续 initiative） | sctx.storeInfo 殁骸清 |

## 7. scope 取舍

采用 **B 塌缩**（概念分析 §7 选项 B）——消 sctx.storeInfo。**compat 写保留 backflow**（实施期实证：105 测试调用点依赖 ALS getter，删则崩——与 D-NS6 R-NS8 backflow 一致），推迟为后续 initiative。

**阶段 1**（此 Action scope）：storeInfoCtx 新纯函数 + 消 sctx.storeInfo + project-store.getDependencyGraph 退役。**compat 写保留 backflow**（推迟为后续 initiative）。
**阶段 2**（独立 follow-up）：L1 迁出。
**阶段 3**（大 initiative）：L2+L3 退役。
