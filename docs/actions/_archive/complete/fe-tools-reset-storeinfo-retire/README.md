# Action — fe-tools-reset-storeinfo-retire
> **状态：complete**——resetStoreInfo 4 处退役 + storeInfo wrapper 重构 + emit.ts:142 迁 ctx + emit-engine 建 ctx + produceEntry 加 ctx。
## Scope
- resetStoreInfo 4 处 caller 删（logic/view/style index + emit-engine）
- storeInfo wrapper 删 compat 写 6 条（L88-94）
- emit.ts:142 getWorkPath → ctx 读 + produceEntry 加 ctx + emit-engine 建 ctx
## 行为 0
tsc 0 + vitest 88/88 + 7-diff=0
