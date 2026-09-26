# Design Draft — fe-tools-storeinfo-collapse

Status authority: [Action Status](../STATUS.md)

> D-SC1..N 待 review lock。本文档基于 [`2026-10-10-storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) §1-§8 讨论 + [`fe-tools-packer-output-abstraction`](../_archive/complete/fe-tools-packer-output-abstraction/README.md) backflow。

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

### D-SC1 — PackerContext 加 temporaryTargetPath

PackerContext interface 加 `temporaryTargetPath: string`（TEMP 构建目录，computePathInfo mkdtemp per-request）。关闭唯一 gap。

**scratch 流（关键待决）**：Output 抽象后 publisher/dist-preparer 用 `opts.scratch`（per-request）。塌缩后 scratch = `ctx.temporaryTargetPath`。

**时机问题**：computePathInfo 在 storeInfo 跑（config-collector）。PackerContext 是 orchestrate 入参（index.ts buildPackerContext，config-collector 前）。temporaryTargetPath 须在 storeInfo 后设——但 PackerContext immutable（入口参数）。

**方案 A（ctx 可变）**：PackerContext 改 mutable（temporaryTargetPath optional，storeInfo 后设）。但 PackerContext 是 interface（值传递），mutable 不优雅。

**方案 B（storeInfo 算 pathInfo 再建 ctx）**：orchestrate 入口不建完整 PackerContext。config-collector 调 storeInfo（算 pathInfo + graph），然后用 pathInfo 建完整 PackerContext 设 sctx.ctx。storeInfo 返回 pathInfo（或 mutate state.pathInfo）。

**方案 C（state.scratch）**：scratch 存 OrchestratorState（state.scratch = computePathInfo mkdtemp）。publisher/dist-preparer 读 state.scratch。PackerContext 不加 temporaryTargetPath。

倾向 **方案 C**——scratch 是 per-orchestrate TEMP（OrchestratorState 合法持久），非 PackerContext I/O 能力。PackerContext 保持纯 I/O（workPath/targetPath FINAL）。scratch 在 state。

但——分析文档说"PackerContext 加 temporaryTargetPath（关闭唯一 gap）"。但 temporaryTargetPath 是 TEMP（非 FINAL）。PackerContext.targetPath 是 FINAL。混 TEMP + FINAL 到 PackerContext 违反 PackerContext 纯 I/O 定位。

方案 C 更对——scratch 在 state（OrchestratorState），非 PackerContext。temporaryTargetPath 不加到 PackerContext。

**修正**：D-SC1 改——scratch 存 state.scratch（OrchestratorState），PackerContext 不加 temporaryTargetPath。storeInfo 算 pathInfo → state.scratch = pathInfo.targetPath。publisher/dist-preparer 读 state.scratch（非 sctx.storeInfo）。

### D-SC2 — collaborator 迁读 PackerContext + state.scratch

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

### D-SC5 — worker ALS bridge 保留

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

## 5. 待决问题

1. **scratch 流方案**（A ctx.mutable / B storeInfo 建 ctx / C state.scratch）——倾向 C（scratch 在 state，PackerContext 纯 I/O）
2. **resetStoreInfo 数据源**（storeInfo 内部算 pathInfo/configInfo 给 resetStoreInfo？或从 state 拿？）
3. **PackerContext 流**（sctx.ctx vs deps.ctx）——倾向 sctx.ctx
4. **config-collector sctx.storeInfo L51/L55 自身读**（config-collector 设 sctx.storeInfo 后又读——须迁 sctx.ctx）

## 6. scope 取舍

采用 **B 塌缩**（概念分析 §7 选项 B）——消 sctx.storeInfo，compat 写自然死。非 A 窄 backflow（打补丁）。

**阶段 1**（此 Action scope）：storeInfo 纯化 + 消 sctx.storeInfo + 删 compat 写。
**阶段 2**（独立 follow-up）：L1 迁出。
**阶段 3**（大 initiative）：L2+L3 退役。
