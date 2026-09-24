# Implementation Plan — fe-tools-hmr-emit-derive

Status: **draft（2026-10-09）**

> 待 design.draft §4 实证 + D-ED-1/D-ED-2 锁后填实。

## Step 0 — 实证（design.draft §4，升 ready 前）

- [ ] cache 序实证：ModuleResultCache 插入序 == emitBuckets.main 序?
- [ ] 闭包集实证：deriveFromGraph union == emitBuckets.main 集（去重后）?
- [ ] subs 映射实证：分包 root 下页 union 闭包 == emitBuckets.subs[root]?
- [ ] independent subs 实证（F8）：`subPages.independent: true` closure 不含 main modules（无 main 混入）

## Step 1 — deriveFromGraph 接线（R-ED-1, D-ED-1 解法 B2）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `packer/orchestrator.ts:266-296` | Logic emit task 改调 deriveFromGraph（非 ctx.emitBuckets）；main bucket = app + main pages union；subs = root 下页 union | pending |
| `model/convergence.ts` | **F15 修正**：非仅去 `.sort()`——改 deriveFromGraph 迭代源：`graph.getDependencyClosure` → cache 插入序迭代（closure set membership filter，须加 cache 迭代方法如 `entries()`/iterator）。去 `.sort()` 得 B1 graph DFS序 ≠ B2 cache插入序（F2）。if 实证 B2 序不一致 → 解法 D（order metadata） | pending |

## Step 2 — emitBuckets 移除（R-ED-5, D-ED-2 locked B **条件化**——F4：须 §4 实证 pass）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `compiler/logic/index.ts:274-297` | logicCompile 不再返 emitBuckets（移除 emitBuckets 字段） | pending |
| `compiler/pipeline/stage-channel.ts:97-99` | 移除 emitBuckets→ctx 存储 | pending |
| `packer/orchestrator.ts:268` | 移除 ctx.emitBuckets 读取 | pending |

## Step 3 — 验证（行为 0 三件套）

- [ ] tsc 0 errors
- [ ] vitest 全绿（84 files / 626 tests baseline）
- [ ] one-shot 6 项目 diff=0（deriveFromGraph 派生 == emitBuckets baseline）
- [ ] V-PC-5: 0 新 as any / 索引签名

## Step 4 — 回流

- [ ] architecture-notes: H1 条目（deriveFromGraph 接线 + emitBuckets 移除 + D-ED-2 locked B 反转 D-HMR-2 推荐 A）
- [ ] residuals tracker（如有）
- [ ] docs/fe-tools/README.md 导航补 H1 链
