# Requirements — fe-tools-packer-context-closure

Status: **draft（2026-10-10）**

## 背景

F-PA-4（retrospect high）：三种 ctx 模型未 reconcile——PackerContext（I/O 北星）几乎不构造，_orchestrate 通篇调 env.ts ALS 全局（getWorkPath/getPages/getAppConfigInfo）。ALS（env.ts ~30 函数）conflates I/O（paths/fileTypes）+ config data（pages/appConfig/components）。facade-collaborator D-FC-2a（orchestrate 签名 `(ctx: PackerContext, state, options) → EmitEntry[]` + implements）因此被阻塞，deferred to B。

graph-bootstrap 已让 PackerGraph 自包含（getComponent/getAppConfigInfo/getRuntimeType/isMiniGame 委托 graph）。als-store 已统一 ALS 工具。facade-collaborator 7 collaborator 就位（收 deps，可加 ctx）。

### R-PC-1 — I/O 闭合（PackerContext 贯穿）

env.ts I/O 函数（getWorkPath/getTargetPath/getContentByPath/getStyleExts/getTemplateExts/getViewScriptExts/getViewScriptTags/getTemplateDirectivePrefixes/isTemporaryTargetPath/getAppStyleScopeId）→ 显式 PackerContext 字段读。collaborator + parse-walk + emit-engine + graph + pipeline 消费者收 PackerContext，消 ALS I/O 直调。

### R-PC-2 — config data 闭合（OrchestratorState.graph 路由）

env.ts config-data 函数（getPages/getAppConfigInfo/getComponent/isMiniGame/getRuntimeType/getProjectConfig/getPageConfigInfo）→ OrchestratorState.graph 路由（PackerGraph 已自包含）+ 显式 FixpointCtx（getPagesImpl）。collaborator + parse-walk 消费者收 state.graph，消 ALS config 直调。

### R-PC-3 — ALS store 消除（runWithCompilerContext 退役）

storeInfo/resetStoreInfo/runWithCompilerContext → 显式 ctx + state 构造，消 packerALS store。worker 路径（snapshot 重建）保留 ALS 作跨线程桥接（D-PCS-8 worker 内置）——主线程闭合，worker ALS 桥接保留（Non-scope E 切法 dispatch wiring 关联）。

### R-PC-4 — D-FC-2a 解锁（facade 签名落地）

R-PC-1/2/3 就位后：orchestrate 签名 `(ctx: PackerContext, state: OrchestratorState, options: OrchestrateOptions) → Promise<EmitEntry[]>` + `implements PackerOrchestrator` + result→EmitEntry[] reconcile（session 改读 state.buildModel）+ OrchestrateRequest→CompileRequest/WatchRequest（解锁 facade-collaborator deferred 项）。

### R-PC-5 — 行为 0

纯结构重构（ALS 读 → ctx/state 读，无语义改）。每相独立 commit + 行为 0 gate。ALS 值与 ctx/state 值同源（storeInfo 设）→ 产物不变。

### R-PC-6 — Non-scope 边界

- 不动 renderer 注入点（A 切法）
- 不抽 aspect（C 切法）
- 不接 L/C/E dispatch wiring（E 切法）
- 不实体化 resolveAlias/resolveNpm（D-PCS-1 deferred——B 闭合 I/O 壳，resolver 实体化留后）
- worker 跨线程 ALS 桥接保留（D-PCS-8）
