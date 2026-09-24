# Validation — fe-tools-hmr-per-module-cache

Status: **ready（2026-10-09）**

## Validation Plan

| ID | 验证项 | 命令/方法 | 状态 |
| --- | --- | --- | --- |
| P-PMC1 | view cache per-module（A-PMC1） | grep session-state: per-module viewCache + order list | pending |
| P-PMC2 | style cache per-module（A-PMC2） | grep session-state: per-module styleCache | pending |
| P-PMC3 | bundle 重建字节一致（A-PMC3） | watch diff=0 vs per-page-bundle | pending |
| P-PMC4 | 行为 0 三件套（A-PMC4） | vitest + tsc + 6 项目 diff=0 | pending |
| P-PMC5 | per-module invalidation（A-PMC5） | grep view/index: per-module invalidation | pending |
| P-PMC6 | V-PC-5 | changed files 0 新 as any / 0 索引签名 | pending |

## 行为 0 三件套

- **vitest**：全量 spec 全绿
- **tsc**：`tsc --noEmit` 0 errors
- **diff=0**：one-shot 6 项目 + watch 字节恒等（per-module 派生 == per-page-bundle）

## 实证结果（design.draft §4，DONE ✓）

| 实证 | 方法 | 判据 | 结果 |
| --- | --- | --- | --- |
| order list 完整性 | viewParseWalk 序捕获 | 完整 | **PASS ✓** |
| cache-hit 字节一致 | per-module + order list 重建 | diff=0 | **PASS ✓**（actual probe 3 项目） |
| page 结构变边界 | order list 失效条件 | 明确 | **CLARIFY**（F-H3-2: .wxml vs .js） |
| page 结构变边界 | order list 失效条件 | 明确 |
