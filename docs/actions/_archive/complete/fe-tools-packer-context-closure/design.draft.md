# Design Draft — fe-tools-packer-context-closure

Status: **draft（2026-10-10）**

## §1 问题诊断（F-PA-4）

env.ts ALS（packerALS AsyncContextStore）conflates 两类数据：
- **I/O（PackerContext 北星）**：pathInfo（workPath/targetPath/temporaryTargetPath）+ compilerOptions（fileTypes：templateExts/styleExts/viewScriptExts/viewScriptTags/directivePrefixes）+ readContent
- **config data（OrchestratorState.graph）**：configInfo（projectInfo/appInfo/componentInfo/pageInfo/runtimeType）+ graph（PackerGraph 自包含，getComponent/getAppConfigInfo/getRuntimeType/isMiniGame）

ALS Proxy（pathInfo/configInfo）路由到 getCompilerContext()。~30 export 函数读 ALS。22 src 文件 import env。72 文件（src+test）消费。

## §2 设计门（draft 提议，formalize 待锁）

### D-PC-1 — storeInfo 闭合（基础相，R-PC-1 前置）

**PC-B1 实施探针发现**：build dir（ALS pathInfo.targetPath）≠ request.targetPath（dist）；normalized fileTypes 是 storeInfo 产物。故 storeInfo 闭合是基础相——storeInfo 须显式返回 build dir + normalized fileTypes + configInfo，消费者从显式返回读而非 ALS。

**Phase 1**（修正后）：
- PC-B1（基础）：storeInfo 闭合——storeInfo 显式返回 build dir（pathInfo.targetPath）+ normalized fileTypes（compilerOptions）+ configInfo（graph configData）；ConfigCollector 写 sctx（storeInfo 产物显式）；消 storeInfo 内 ALS getCompilerContext 写入
- PC-B2：collaborator I/O 闭合——NpmBuilder/Publisher 从 sctx 读 build dir（非 ALS getTargetPath）；ConfigCollector 从 sctx 读 normalized fileTypes
- PC-B3：parse-walk + emit-engine fileTypes 闭合——从 ctx/sctx 读 normalized fileTypes（非 ALS getStyleExts）

**PackerContext 构造点**：orchestrate/build() 入口从 request（workPath/fileTypes）+ storeInfo 产物（build dir）构造 PackerContext。build dir 由 storeInfo 设（非 request）。resolveAlias/resolveNpm 暂留 stub（D-PCS-1 deferred）。

### D-PC-2 — config data 闭合（state.graph 路由，R-PC-2）

PackerGraph 已自包含（getComponent/getAppConfigInfo/getRuntimeType/isMiniGame + getConfigData）。getPagesImpl 在 config-fixpoint（需 FixpointCtx {ctx, configData, npm}）。

**Phase 2 分相**：
- PC-B4：config-data getter 路由 graph——getAppConfigInfo/getComponent/isMiniGame/getRuntimeType → state.graph.X（collaborator + parse-walk）
- PC-B5：getPages 路由——getPagesImpl 显式 FixpointCtx（ctx + state.graph.getConfigData() + npm），消 ALS configInfo
- PC-B6：getProjectConfig/getPageConfigInfo 路由 graph

### D-PC-3 — ALS store 消除（R-PC-3）

**Phase 3**：
- PC-B7：storeInfo → 显式（ctx, state）构造（graph.build/reconcile 用 PackerContext，消 ALS getCompilerContext）
- PC-B8：runWithCompilerContext → 主线程退役（worker 路径保留 ALS 桥接，D-PCS-8）
- PC-B9：env.ts 删 packerALS + pathInfo/configInfo Proxy（主线程闭合完成）

### D-PC-4 — D-FC-2a 解锁（R-PC-4，Phase 4）

PC-B1..B9 就位后：
- orchestrate(ctx: PackerContext, state: OrchestratorState, options) → Promise<EmitEntry[]>
- orchestrator `implements PackerOrchestrator`
- result→EmitEntry[] + metadata（session 改读 state.buildModel）
- OrchestrateRequest → CompileRequest/WatchRequest

### D-PC-5 — Non-scope 边界

- renderer 注入点（A）保留
- aspect 穿线（C）保留
- L/C/E dispatch wiring（E）保留 NOT wired
- resolveAlias/resolveNpm 实体化（D-PCS-1）留 stub
- **worker 跨线程 ALS 桥接（D-PCS-8）保留**——parse-walk/wxml/compatibility-in-worker 用 worker ALS（resetStoreInfo 从 input 重建），非主线程 B 目标。B 切法只闭合主线程 ALS（packerALS）

## §3 收敛映射

**PC-B1 实施探针发现的关键 entanglement**（2026-10-10）：
- **build dir ≠ request.targetPath**：`getTargetPath()` 返 ALS pathInfo.targetPath（storePathInfo 设：env.TARGET_PATH 或 mkdtemp）= **build dir**（materialize 写入处）；request.targetPath = **dist**（publishToDist 发布处）。publishToDist(dist) 从 build dir 复制到 dist。故 collaborator（NpmBuilder/Publisher）的 getTargetPath() **不可直接映射 request.targetPath**——build dir 是 storeInfo 内部产物。
- **normalized fileTypes 是 storeInfo 产物**：getStyleExts 等读 ALS compilerOptions（normalizeFileTypes(request.fileTypes) 结果），由 storeInfo 设。parse-walk 闭合须从 storeInfo 显式取 normalized fileTypes。
- **故 storeInfo 闭合（暴露 build dir + normalized fileTypes + configInfo 显式返回）是基础相，非末相**。原 §2 phasing（PC-B1 collaborator I/O 先行）错误——collaborator targetPath 闭合依赖 storeInfo 暴露 build dir。

**修正 phasing**：
- **PC-B1（基础）**：storeInfo 闭合——storeInfo 显式返回 build dir（pathInfo.targetPath）+ normalized fileTypes（compilerOptions）+ configInfo（graph configData）；ConfigCollector 写 sctx（storeInfo 产物显式）；消 storeInfo 内 ALS getCompilerContext 写入
- **PC-B2**：collaborator I/O 闭合——NpmBuilder/Publisher 从 sctx 读 build dir（非 ALS getTargetPath）；ConfigCollector 从 sctx 读 normalized fileTypes
- **PC-B3**：parse-walk + emit-engine fileTypes 闭合——从 ctx/sctx 读 normalized fileTypes（非 ALS getStyleExts）
- **PC-B4..B6**：config data 闭合（state.graph 路由）
- **PC-B7..B9**：ALS store 消除（storeInfo 内 getCompilerContext 退役 + packerALS/Proxy 删）
- **PC-B10**：D-FC-2a 解锁

| ALS 函数 | 闭合目标 | 相 |
| --- | --- | --- |
| storeInfo（pathInfo/compilerOptions/configInfo） | 显式返回 build dir + fileTypes + configInfo | PC-B1（基础） |
| getTargetPath（build dir）| sctx.storeInfo.pathInfo.targetPath（非 request.targetPath=dist） | PC-B2 |
| getWorkPath | request.workPath（= ctx.workPath） | PC-B2 |
| getStyleExts/getTemplateExts 等 | sctx.storeInfo.compilerOptions（normalized） | PC-B3 |
| getAppConfigInfo/getComponent/isMiniGame/getRuntimeType | state.graph.X | PC-B4 |
| getPages | getPagesImpl（显式 FixpointCtx） | PC-B5 |
| getProjectConfig/getPageConfigInfo | state.graph.getConfigData | PC-B6 |
| runWithCompilerContext | 主线程退役（worker 保留） | PC-B8 |
| packerALS + pathInfo/configInfo Proxy | 删（主线程） | PC-B9 |

## §4 blast radius（须 formalize 前实测）

| 项 | 估计 | 实测方法 |
| --- | --- | --- |
| env.ts | ~30 export → 显式 ctx/state | grep export env.ts |
| src 消费者 | 22 文件 | grep from.*store/env |
| collaborator | 7（加 ctx deps） | facade-collaborator 已就位 |
| parse-walk | 3（logic/view/style） | grep getStyleExts parse-walk |
| emit-engine + graph + pipeline | ~10 文件 | grep |
| 测试 | mock env ALS 的 spec | grep storeInfo __tests__ |

## §5 行为 0 gate（每相）

- tsc 0 errors
- vitest 全绿（87/647 基线，compile-cli-cache/session-unify flaky solo pass）
- 7 项目 diff=0
- rigor check：grep ALS 函数递减 + ctx/state 显式读递增
