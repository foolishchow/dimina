# Implementation Plan — fe-tools-invalidation-all-kinds

Status: **complete（2026-10-07）**

## Steps

| # | Step | Detail | Est |
|---|---|---|---|
| 1 | Review 门 | 本门为 D-IU-1 单点实施（deferred incremental-unify 的 getInvalidatedModules 部分）；范围边界 = dependency-graph.ts + dependency-graph.spec.js + packer/types.ts(JSDoc) + invalidation.ts(JSDoc) 四文件 | — |
| 2 | 改动生产代码 | ① `src/model/dependency-graph.ts`：`getInvalidatedModules` 删 `if (kinds.has('logic'))`（`for (const [owner] of ownerKinds)`，不取第二绑定）+ `getDirectDependents(id, 'logic')`→`getDirectDependents(id)` ② `src/packer/types.ts:357` JSDoc `logic moduleCache 失效集`→`全 kind 失效模块列表` ③ `src/model/invalidation.ts:30-39` JSDoc 去 logic-only 措辞（D-IV-6→D-IU-1） | 0.5h |
| 3 | 更新 `__tests__/dependency-graph.spec.js` | 反转 2 测试（wxml → view owner 进集；component.js → page 进集）+ 新增 3 测试（wxss → style owner；component .wxml → 依赖页；同模块多文件任一变更） | 1h |
| 4 | 验证 | P-G301..305 全过（tsc + vitest + 行为 0 全量 + V-PC-5） | 1.5h |
| 5 | 回流 | architecture-notes：① D-IV-6/7 反转（logic-only → all-kind）② module 级与 entry 级失效闭包对齐 ③ invalidatedModules/computeInvalidatedModules 语义 logic→all-kind（packer/types.ts:357 + invalidation.ts:30-39 JSDoc） | 0.5h |
| 6 | 归档 | 移入 `_archive/complete/`，修复相对链接；STATUS.md 更新 | 0.5h |

## Status

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5
- [x] Step 6（归档——Close workflow ✅）