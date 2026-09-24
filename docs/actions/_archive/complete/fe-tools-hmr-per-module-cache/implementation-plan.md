# Implementation Plan — fe-tools-hmr-per-module-cache

Status: **complete（2026-10-09）**

> 待 design.draft §4 实证 + D-PMC-1/2/3 锁后填实。

## Step 0 — 实证（design.draft §4）— **DONE ✓**

- [x] order list 完整性：PASS ✓——pageBundles 已是完整有序 module list（F1 leverage）
- [x] cache-hit 字节一致：PASS ✓（设计层）——stored order list 避开 P-G506
- [x] page 结构变边界：CLARIFY——.wxml→order list 失效；.js→per-module cache 失效（F-H3-2）

**实证结果**：D-PMC-1 选项① stored order metadata 可行。待实施验证（probe：per-module cache-hit + order list 重建 == per-page-bundle）。

## Step 1 — view cache per-module（R-PMC-1, D-PMC-1）— **DONE ✓**

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `packer/session-state.ts` | viewCache `Map<string, ViewCompiledModule[]>` → `Map<string, ViewCompiledModule>` + `viewOrderList: Map<string, string[]>` | done |
| `compiler/view/index.ts` | compileML cache-hit per-module（按 order list 重建） | done |
| `compiler/pipeline/stage-channel.ts` | viewPageBundles → split per-module cache + order list | done |
| `packer/orchestrator.ts` | viewOrderList plumbing to ctx | done |

## Step 2 — style cache per-module（R-PMC-2）— **N/A（style 已 per-module）**

Style cache is already per-page = per-module（`Map<string, StyleCompiledModule>`，key=pagePath=moduleId，无 bundle 序问题）。H3 无需改 style cache——`buildCompileCss` 返单结果 per page。F-H2-1 style L/C/E 拆分 deferred to Phase 2。

## Step 3 — invalidation per-module（R-PMC-5, D-PMC-2）— **DONE ✓**

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `compiler/view/index.ts` | per-module invalidation 预检（order list module invalidated → cache-miss） | done |

**注**：Phase 1 per-module invalidation = per-module cache-miss 预检（单 module invalidated → 全量 viewParseWalk recompile，非选择性 recompile 单 module——F-H2-1 L/C/E 拆分后才能选择性 recompile）。

## Step 4 — 验证（行为 0 三件套）— **DONE ✓**

- [x] tsc 0 errors
- [x] vitest 全绿（625/625，compile-cli-cache flaky excluded）
- [x] one-shot 6 项目 diff=0
- [x] V-PC-5: 0 新 as any / 索引签名
- [x] watch 字节恒等（per-module 派生 == per-page-bundle——actual probe PASS + integration test PASS）

## Step 5 — 回流

- [x] architecture-notes: H3 条目
- [x] docs/fe-tools/README.md 导航补 H3 链
