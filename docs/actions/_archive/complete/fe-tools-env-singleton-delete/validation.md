# Validation — fe-tools-env-singleton-delete

Status authority: [Action Status](../../../STATUS.md)

## Scope 决策（partial——不可逾越阻塞）

D-SCF-3 不可完全删 env.ts singleton——**component function 不可序列化**（A0 research 核心结论）。

## 不可逾越阻塞

**component function 不可序列化**：
- `ctx.component` 是 `(src) => unknown` function——postMessage 不可序列化
- worker 经 storeInfo data（buildResetStoreInfoData）——storeInfo data 含 pathInfo/configInfo/compilerOptions/dependencyGraph（可序列化）——**不含 component**
- worker 无 state.graph（state.graph 在主线程）——worker 无法重建 component
- resetStoreInfo 退役后 worker ALS 无数据——但 component 须 ALS（不可序列化）

**A0 research 核心结论确认**：L2/L3 退役须保留 ALS for function getter（component/resolveAlias）。env.ts singleton 不可完全删——须保留 component ALS getter（+ configInfo for component appInfo）。

## 已完成

- packer 层 getter caller 已迁 state.graph（graph/orchestrator/config-compiler/dispatch/config-collector/project-store——A0-A5a 已完成）
- compiler 层 fallback delete 已完成（fallback-als-delete）
- resetStoreInfo caller 退役（reset-storeinfo-retire）

## 推迟（不可逾越阻塞）

- env.ts singleton 完全删——component function 不可序列化
- worker ctx 建立改 storeInfo data——component 须 ALS
- runtime 改候选 b——须 compile 返 ctx.graph（component 阻塞连锁）

| ID | Check | Status |
| --- | --- | --- |
| V-ESD-1 | R-ESD-1..5 覆盖 | partial——packer 层已迁 state.graph（A0-A5a），env.ts singleton 删不可逾越阻塞 |
| V-ESD-2 | 行为 0 | n/a——无代码改动（阻塞确认） |
