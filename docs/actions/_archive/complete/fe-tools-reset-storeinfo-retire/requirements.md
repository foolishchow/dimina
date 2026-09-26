# Requirements — fe-tools-reset-storeinfo-retire

承接 cleanup-final D-SRC-2 resetStoreInfo 退役 + emit.ts:142 迁 ctx + emit-engine 建 ctx。

## R-RSR-1 — resetStoreInfo 4 处 caller 退役

resetStoreInfo 4 处 src caller 删（logic/view/style index L280/194/59 + emit-engine L12）——worker ctx 已传全（D-SRC-1a）不再 load-bearing。resetStoreInfo 函数 + import 保留（测试用——custom-file-types.spec.js 等）。

## R-RSR-2 — emit.ts:142 迁 ctx + produceEntry 加 ctx + emit-engine 建 ctx

- produceEntry(L204) 加 ctx? + strategy.apply(params, ctx) + perModule L142 getWorkPath → ctx!.workPath!
- bundle.apply 加 _ctx?（noUnusedLocals——bundle 不用 ctx）
- emitEntry 加 ctx? + produceEntry(params, ctx) + caller L122/136/144 传 ctx
- emit-engine compile 建 ctx（buildPackerContextFromOptions from storeInfo）+ produceEntry(emitParams, ctx)

## R-RSR-3 — storeInfo wrapper compat 写 6 条保留

storeInfo wrapper compat 写 6 条（L88-94）保留——主线程 getter 消费方未全迁（D-SCF-3 env.ts singleton 删前置）+ 测试用。

## R-RSR-4 — 行为 0

tsc 0 + vitest 88/88 + 7-diff=0。

## 前置关系

- 承接 cleanup-final D-SRC-2
- 是 env-singleton-delete 前置（resetStoreInfo 退役须 worker ctx 已传全）
