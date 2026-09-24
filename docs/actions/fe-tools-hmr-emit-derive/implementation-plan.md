# Implementation Plan — fe-tools-hmr-emit-derive

Status: **draft（2026-10-09）**

> 待 design.draft §4 实证 + D-ED-1/D-ED-2 锁后填实。

## Step 0 — 实证（design.draft §4，升 ready 前）

- [ ] cache 序实证：ModuleResultCache 插入序 == emitBuckets.main 序?
- [ ] 闭包集实证：deriveFromGraph union == emitBuckets.main 集（去重后）?
- [ ] subs 映射实证：分包 root 下页 union 闭包 == emitBuckets.subs[root]?

## Step 1 — deriveFromGraph 接线（R-ED-1, D-ED-1 解法 B）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `packer/orchestrator.ts:266-296` | Logic emit task 改调 deriveFromGraph（非 ctx.emitBuckets）；main bucket = app + main pages union；subs = root 下页 union | pending |
| `model/convergence.ts` | deriveFromGraph 去 `.sort()`（改 cache 插入序）——if 实证需 | pending |

## Step 2 — emitBuckets 移除（R-ED-5, D-ED-2 locked B）

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
