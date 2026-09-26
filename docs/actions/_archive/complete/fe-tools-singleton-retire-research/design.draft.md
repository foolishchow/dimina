# Design Draft — fe-tools-singleton-retire-research

> **状态：complete**——D-SR-1..6 已 lock + 行为 0（git diff=0）。A5 singleton/Proxy 退役实施拆分规划。

## 1. 研究结论

A5 须解决 3 项 A4 未决：

1. **graph 可变单例 worker 透传**：已实施（successPayload + mergeDelta）——A5 退役须 ctx.graph 替代 ALS
2. **形状纪律冲突**：候选 a 锁定（扩 PackerContext optional graph）——候选 b/c 不可行（worker 无 OrchestratorState / parse-walk 非 collaborator）
3. **A5 scope 大**：须拆分（D-SR-1..6 渐进 atomic）

## 2. A5 实施拆分规划（D-SR-1..6）

### D-SR-1 — PackerContext 扩 optional 字段（形状纪律候选 a 锁定）

- PackerContext 加 optional：`graph?: Graph` + `appId?: string` + `component?: (src) => unknown`（F-R3-1：getComponent 返回 unknown 非 Module|null）+ `configInfo?: Record<string, unknown>` + `npmResolver?: NpmResolver`（F-R3-2：getNpmResolver 返回实例非 function——ctx.resolveNpm 签名不匹配，须加实例字段）
- resolveAlias 闭包 appInfo（`resolveAlias: (src) => resolveAppAlias(src, ctx.configInfo?.appInfo)`）——非 stub
- resolveNpm 保留（A0 stub `(src) => src`——A5 实体化须 ctx.npmResolver 实例，resolveNpm function 保留 stub or 闭包 npmResolver）
- **D-PCS-1/D-PCS-6 放宽**：graph 加 optional（形状纪律冲突——A5 实体化须）
- **注释修改**（F-R2-2）：types.ts:103 注释「graph/moduleCache/invalidatedModules 不在 PackerContext（D-PCS-6）」须删/改（graph 加 optional 后注释过时）
- buildPackerContextFromOptions 扩：从 storeInfo 重建 graph 实例（restoreFromSnapshot）+ appInfo + component getter

### D-SR-2 — parse-walk ALS 残留 31 处迁移到 ctx 读

- getDependencyGraph()→ctx.graph（12 处写入——addFile/addDependency/getDirectDependencies）
- getComponent()→ctx.component（3 处读）
- getAppId()→ctx.appId（3 处读）
- getNpmResolver()/resolveAppAlias()/getAppConfigInfo()/isMiniGame()→ctx 字段（logic 5 处）
- **ctx optional + fallback ALS**（渐进）：先加 ctx optional + fallback ALS，后 D-SR-4 退役 ALS
- **完全迁移**（F-R3-3）：D-SR-2 须完全迁移（无 fallback ALS）后 D-SR-4 才能退役 resetStoreInfo（ALS 不再 load-bearing——同 A4 F-R3-2 修正）

### D-SR-3 — successPayload 3 处修改为 ctx.graph

- logicSuccessPayload（index.ts:304）：`dependencyGraph: ctx.graph.toJSON()`
- viewSuccessPayload（index.ts:214）：同
- defineEngine 默认（define-engine.ts:28）：同
- **successPayload 签名矛盾**（F-R2-1）：当前签名 `(ctx: { logger })`——只接收 logger；默认实现 `() => ({...})` 无参（不读 logger）。D-SR-3 须扩签名接收 graph——**候选**：`{ logger, graph }` or 接收完整 PackerContext

### D-SR-4 — worker resetStoreInfo 4 处退役

- logic/index.ts:279 + view/index.ts:192 + style/index.ts:59 + emit-engine.ts:12
- D-SR-2 完全迁移后 ctx.graph 必传——resetStoreInfo 不再 load-bearing
- resetStoreInfo 函数删 + compat 写 6 条删

### D-SR-5 — __tests__ 107 caller + getPages 21 caller 迁移

- 107 caller：改 ctx 直传（buildPackerContextFromOptions from storeInfo() 返回值 + graph 实例）
- 22 getPages caller：改 ctx.configInfo.pages or 显式传 pages
- **分批 atomic**（测试 fixture 大量）

### D-SR-6 — storeInfo wrapper 重构 + env.ts singleton 删

- storeInfo wrapper 删 compat 写 6 条（纯 compute——返 storeInfo data）
- env.ts 删 defaultCompilerContext + pathInfo/configInfo Proxy + 20 getters（F-R4-1：实际 20 非 15）
- **L34 re-export 保留**（F-R4-3：env-compute.ts re-export——buildPackerContext/storeInfoCtx/buildResetStoreInfoData/getAppStyleScopeId/getContentByPath 须保留，非 getter）
- **D-SR-4 + D-SR-5 完成后**（caller=0）安全删

## 3. 迁移顺序 + 门控

1. **D-SR-1** PackerContext 扩 optional（graph/appId/component/configInfo + resolveAlias 闭包 appInfo）
2. **D-SR-2** parse-walk ALS 残留 31 处迁移 ctx 读（ctx optional + fallback ALS——渐进）
3. **D-SR-3** successPayload 3 处修改为 ctx.graph
4. **D-SR-4** worker resetStoreInfo 4 处退役（ctx.graph 必传——D-SR-2 完全迁移后）
5. **D-SR-5** __tests__ 107 caller + getPages 21 caller 迁移
6. **D-SR-6** storeInfo wrapper 重构 + env.ts singleton 删

## 4. 风险

- **D-SR-1 PackerContext 形状扩**：D-PCS-1/D-PCS-6 放宽（graph 加 optional）——形状纪律冲突
- **D-SR-2 resolveAppAlias 实体化**：A0 R8 行为 0 守护——ctx.resolveAlias 须闭包 appInfo（非 stub）
- **D-SR-2 graph 可变单例**：ctx.graph 须传实例（非 data）——worker 重建 graph 实例 + parse-walk 写入 + successPayload toJSON 回传 + 主线程 mergeDelta 合并
- **D-SR-5 测试 fixture 大量**：107 caller 分批 atomic
- **D-SR-3 successPayload 签名扩**：当前只接收 { logger }——须扩接收 ctx.graph

## 5. 跨权威一致性

- **A0（worker-ctx-direct）**：ctx optional + fallback ALS 模式——A5 实体化 ctx 必传
- **A2/A3（view/style parse-walk）**：独立函数透传链——A5 ALS 残留迁移同模式
- **A4（compat-write-retire-research）**：D-CWR-1..6 规划——A5 细化（D-SR-1..6）
- **D-PCS-1/D-PCS-6**：PackerContext 形状——A5 放宽（graph optional）
- **D-LR-4**：A5 原 scope——refined 为 research（graph 可变单例 + 形状纪律决策）

## 6. 结论

A5 research 产出 D-SR-1..6（A5 singleton/Proxy 退役实施拆分）。形状纪律候选 a 锁定（扩 PackerContext optional graph）。graph 可变单例 worker 透传机制已实施（successPayload + mergeDelta）。A5 实施须 A5 research 锁定后 formalize 独立 Action（实施性——D-SR-1..6 atomic 渐进）。
