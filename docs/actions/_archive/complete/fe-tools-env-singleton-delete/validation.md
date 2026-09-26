# Validation — fe-tools-env-singleton-delete

Status authority: [Action Status](../../../STATUS.md)

## 不可逾越阻塞（A0 research 核心结论确认）

component function 不可序列化——L2/L3 退役须保留 ALS for function getter（component/resolveAlias）。env.ts singleton 不可完全删。

| ID | Check | Status |
| --- | --- | --- |
| V-ESD-1 | R-ESD-1..5 覆盖 | partial——packer 层已迁 state.graph（A0-A5a），env.ts singleton 删不可逾越阻塞 |
| V-ESD-2 | 行为 0 | n/a——无代码改动（阻塞确认） |
| V-ESD-3 | D-ESD-1..4 | D-ESD-1 done（前置），D-ESD-2/3/4 阻塞 |
| V-ESD-4 | 跨权威（A0 research + component 不可序列化） | done |
| V-ESD-5 | L2/L3 退役物理边界确认 | done |
| V-ESD-6 | 行为 0（前置 action 已验证） | done |

## 跨权威 trace

- A0 research 核心结论：worker ctx 直传 function 不可序列化——保留 ALS for function getter
- component (src) => unknown——postMessage 不可序列化
- worker 经 storeInfo data——不含 component
- worker 无 state.graph——无法重建 component
- resetStoreInfo 退役后 worker ALS 无数据——component 须 ALS

## 已完成（前置 action）

- packer 层 getter caller 迁 state.graph（A0-A5a）
- compiler 层 fallback delete（fallback-als-delete）
- resetStoreInfo caller 退役（reset-storeinfo-retire）
