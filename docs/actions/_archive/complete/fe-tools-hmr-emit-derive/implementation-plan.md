# Implementation Plan — fe-tools-hmr-emit-derive

Status: **complete（2026-10-09）**

> 待 design.draft §4 实证 + D-ED-1/D-ED-2 锁后填实。

## Step 0 — 实证（design.draft §4，升 ready 前）— **DONE ✓**

- [x] cache 序实证：ModuleResultCache 插入序 == emitBuckets.main 序? — **PASS ✓**
- [x] 闭包集实证：deriveFromGraph union == emitBuckets.main 集（去重后）? — **PASS ✓**
- [x] subs 映射实证：分包 root 下页 union 闭包 == emitBuckets.subs[root]? — **FAIL → 解法 E cross-bucket dedup**
- [x] independent subs 实证（F8）：`subPages.independent: true` closure 不含 main modules（无 main 混入）— **N/A**（base 无 independent；code-level reasoning）

## Step 1 — deriveFromGraph 接线（R-ED-1, D-ED-1 解法 B2+E）— **DONE ✓**

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `model/convergence.ts` | deriveFromGraph 改 B2 cache 插入序迭代（非 graph closure .sort()）；新增 `deriveLogicBuckets`（main closure union + sub closure union MINUS main cross-bucket dedup E） | **done** |
| `model/module-result-cache.ts` | 加 `entries()` 有序迭代方法（B2 cache 插入序） | **done** |
| `packer/orchestrator.ts:266-296` | Logic emit task 改调 `deriveLogicBuckets`（非 ctx.emitBuckets）；guard 改 `!pages \|\| !compileConfigOpts`（partial-stage safe） | **done** |

## Step 2 — emitBuckets 移除（R-ED-5, D-ED-2 locked B **条件化**——F4：须 §4 实证 pass）— **DONE ✓**

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `compiler/logic/index.ts:274-297` | logicCompile 不再返 emitBuckets（移除 emitBuckets 字段 + return） | **done** |
| `compiler/pipeline/stage-channel.ts:97-99` | 移除 emitBuckets→ctx 存储（D-ER-3 dead） | **done** |
| `packer/orchestrator.ts:268` | 移除 ctx.emitBuckets 读取（改调 deriveLogicBuckets） | **done** |

## Step 3 — 验证（行为 0 三件套）— **DONE ✓**

- [x] tsc 0 errors
- [x] vitest 全绿（84 files / 626 tests；compile-cli-cache flaky timeout 已知，单独重跑 pass）
- [x] one-shot 6 项目 diff=0（deriveLogicBuckets 派生 == emitBuckets baseline）
- [x] V-PC-5: 0 新 as any / 索引签名

## Step 4 — 回流

- [x] architecture-notes: H1 条目（deriveFromGraph 接线 + emitBuckets 移除 + D-ED-2 locked B 反转 D-HMR-2 推荐 A + B2 cache 插入序 + E cross-bucket dedup）
- [x] residuals tracker（如有）
- [x] docs/fe-tools/README.md 导航补 H1 链
