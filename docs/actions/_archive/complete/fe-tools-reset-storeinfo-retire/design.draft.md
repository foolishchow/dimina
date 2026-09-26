# Design — fe-tools-reset-storeinfo-retire

> **状态：ready**——D-RSR-1..3 已实施（行为 0 三件套 ✓）。补走 readiness review。

## D-RSR-1 — resetStoreInfo caller 退役

resetStoreInfo 4 处 src caller 删：
- logic/view/style index L280/194/59 + import 清理
- emit-engine L12

worker ctx 已传全（D-SRC-1a buildPackerContextFromOptions 传全 6 optional）——resetStoreInfo 不再 load-bearing。

resetStoreInfo 函数 + storeInfo wrapper compat 写 6 条保留（测试用 + 主线程 getter 消费方——D-SCF-3 前置）。

## D-RSR-2 — emit.ts:142 迁 ctx + produceEntry 加 ctx + emit-engine 建 ctx

**emit.ts**：
- produceEntry(L204) 加 ctx? + L209 strategy.apply(params, ctx)
- bundle.apply(L69) 加 _ctx?（noUnusedLocals——bundle 不用 ctx）
- perModule.apply(L132) 加 ctx? + L142 getWorkPath() → ctx!.workPath!
- emitEntry(L229) 加 ctx? + produceEntry(params, ctx)
- import 清理（删 getWorkPath）

**emit-engine.ts**：
- compile 建 ctx（buildPackerContextFromOptions from storeInfo.pathInfo/compilerOptions/configInfo）
- produceEntry(emitParams, ctx)
- import resetStoreInfo → buildPackerContextFromOptions + ResetStoreInfoOptions

**view/index.ts**：
- emitEntry caller L122/136/144 传 ctx

## D-RSR-3 — storeInfo wrapper compat 写保留

storeInfo wrapper compat 写 6 条（L88-94 context.pathInfo/compilerOptions/npmResolver/graph/configInfo/dependencyGraph = r.*）保留——主线程 getter 消费方未全迁（D-SCF-3 env.ts singleton 删前置）+ 测试用。

## 行为 0 论证

- resetStoreInfo caller 退役——worker ctx 已传全，不恢复 ALS 也不破坏（ctx 携带全 data）
- emit.ts:142 ctx!.workPath!——worker emit-engine 建 ctx 传 produceEntry
- storeInfo wrapper compat 写保留——行为不变

## 行为 0 三件套（已验证）

- tsc 0 + vitest 88/88（3 flaky solo pass）+ 7-diff=0 ✓
