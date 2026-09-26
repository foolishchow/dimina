# Design
## D-RSR-1 resetStoreInfo caller 删（worker ctx 已传全——不再 load-bearing）
## D-RSR-2 storeInfo wrapper 删 compat 写 6 条（L88-94）——纯 compute 返 data
## D-RSR-3 emit.ts:142 getWorkPath → ctx.workPath + produceEntry 加 ctx + emit-engine 建 ctx（buildPackerContextFromOptions from storeInfo）
