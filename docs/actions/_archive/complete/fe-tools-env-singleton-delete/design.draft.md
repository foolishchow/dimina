# Design — fe-tools-env-singleton-delete

> **状态：ready**——D-ESD-1..4 不可逾越阻塞（component function 不可序列化）。补走 readiness review。

## 背景

cleanup-final D-SRC-3 env.ts singleton 删。前置 action 已完成 packer 层 getter caller 迁 state.graph（A0-A5a）+ compiler 层 fallback delete（fallback-als-delete）+ resetStoreInfo caller 退役（reset-storeinfo-retire）。

## D-ESD-1 — src getter caller 迁 ctx（已完成前置）

packer 层已迁 state.graph（graph.ts L158-178 自带 getComponent/getAppConfigInfo/getRuntimeType/isMiniGame + dispatch/config-collector/config-compiler/orchestrator 用 state.graph）。compiler 层已 fallback delete。

## D-ESD-2 — runtime 改候选 b（阻塞）

runtime.ts L31 candidate a → candidate b。须 compile 内调 successPayload + runtime 读 compileResult。**阻塞**：component function 不可序列化——worker ctx 建立须 ALS component。

## D-ESD-3 — storeInfo wrapper compat 写删（阻塞）

须主线程 getter caller 全迁。**阻塞**：component getter 保留 ALS（不可序列化）。

## D-ESD-4 — env.ts singleton 删（阻塞）

env.ts 删 defaultCompilerContext + Proxy + 20 getters。**阻塞**：component/resolveAlias function getter 须 ALS（不可序列化）。

## 不可逾越阻塞（A0 research 核心结论确认）

**component function 不可序列化**：
- ctx.component 是 (src) => unknown function——postMessage 不可序列化
- worker 经 storeInfo data（buildResetStoreInfoData）——storeInfo data 含 pathInfo/configInfo/compilerOptions/dependencyGraph（可序列化）——**不含 component**
- worker 无 state.graph（state.graph 在主线程）——无法重建 component
- resetStoreInfo 退役后 worker ALS 无数据——但 component 须 ALS

**L2/L3 退役物理边界**：function getter（component/resolveAlias）不可序列化——须保留 ALS。env.ts singleton 不可完全删。
