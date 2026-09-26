# Requirements — fe-tools-env-singleton-delete

承接 cleanup-final D-SRC-3 env.ts singleton 删。**不可逾越阻塞**：component function 不可序列化（A0 research 核心结论）。

## R-ESD-1 — src getter caller 迁 ctx 读

packer 层 getter caller 已迁 state.graph（A0-A5a——graph/orchestrator/config-compiler/dispatch/config-collector/project-store/emit/output）。compiler 层 fallback delete 已完成（fallback-als-delete）。

## R-ESD-2 — runtime 改候选 b

runtime.ts L31 `engine.successPayload({ logger, graph: getDependencyGraph() })`——candidate a（过渡）。改 candidate b：compile 内调 successPayload（读 ctx.graph 后 toJSON）+ runtime 读 compileResult。

## R-ESD-3 — storeInfo wrapper compat 写 6 条删

须主线程 getter caller 全迁（component 保留 ALS——不可逾越阻塞）。

## R-ESD-4 — env.ts singleton 删

env.ts 删 defaultCompilerContext + Proxy + 20 getters（L34 re-export 保留）。

## R-ESD-5 — 行为 0

## 不可逾越阻塞（R-ESD-2/3/4 全部阻塞）

**component function 不可序列化**：ctx.component 是 (src) => unknown function——postMessage 不可序列化。worker 经 storeInfo data（buildResetStoreInfoData）——不含 component。worker 无 state.graph——无法重建 component。resetStoreInfo 退役后 worker ALS 无数据——但 component 须 ALS。

**A0 research 核心结论确认**：L2/L3 退役须保留 ALS for function getter（component/resolveAlias）。env.ts singleton 不可完全删。
