# Implementation Plan — fe-tools-hmr-per-module-cache

Status: **draft（2026-10-09）**

> 待 design.draft §4 实证 + D-PMC-1/2/3 锁后填实。

## Step 0 — 实证（design.draft §4）— **DONE ✓**

- [x] order list 完整性：PASS ✓——pageBundles 已是完整有序 module list（F1 leverage）
- [x] cache-hit 字节一致：PASS ✓（设计层）——stored order list 避开 P-G506
- [x] page 结构变边界：CLARIFY——.wxml→order list 失效；.js→per-module cache 失效（F-H3-2）

**实证结果**：D-PMC-1 选项① stored order metadata 可行。待实施验证（probe：per-module cache-hit + order list 重建 == per-page-bundle）。

## Step 1 — view cache per-module（R-PMC-1, D-PMC-1）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `packer/session-state.ts:23` | viewCache `Map<string, ViewCompiledModule[]>` → `Map<string, ViewCompiledModule>` + order list `Map<string, string[]>` | pending |
| `compiler/view/index.ts` | compileML cache-hit per-module（按 order list 重建） | pending |

## Step 2 — style cache per-module（R-PMC-2）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `packer/session-state.ts` | styleCache per-page → per-module | pending |
| `compiler/style/index.ts` | compileSS cache-hit per-module | pending |

## Step 3 — invalidation per-module（R-PMC-5, D-PMC-2）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `compiler/view/index.ts` | 单 module dirty → 单 cache-miss（非全 bundle） | pending |

## Step 4 — 验证（行为 0 三件套）

- [ ] tsc 0 errors
- [ ] vitest 全绿
- [ ] one-shot 6 项目 diff=0
- [ ] watch 字节恒等（per-module 派生 == per-page-bundle）
- [ ] V-PC-5: 0 新 as any / 索引签名

## Step 5 — 回流

- [ ] architecture-notes: H3 条目
- [ ] docs/fe-tools/README.md 导航补 H3 链
