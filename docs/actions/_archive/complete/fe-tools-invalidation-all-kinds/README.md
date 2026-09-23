# fe-tools-invalidation-all-kinds

- Status: `complete`
- Created: 2026-10-07
- ID: `fe-tools-invalidation-all-kinds`

## Problem

`DependencyGraph.getInvalidatedModules(filePath)` 硬编码 `kind=logic`（两处）：
1. owner 收集：`if (kinds.has('logic')) pending.push(owner)` — 只推 logic owner
2. 闭包遍历：`getDirectDependents(id, 'logic')` — 只沿 logic 边

后果：改 `.wxml`/`.wxss` → 算不出受影响 view/style 模块 → 增量基础不成立。这是增量前置链的 **G3**。

## Goal

去掉 `kind=logic` 硬编码——owner 全推 + 全 kind dependents 闭包（= incremental-unify **D-IU-1**）。`getInvalidatedModules` / `computeInvalidatedModules` 返回**全 kind** module IDs。签名不变，调用方零改动。

## Deliverables

| # | File | Change |
|---|---|---|
| 1 | `src/model/dependency-graph.ts` | `getInvalidatedModules` 去 2 处 `kind=logic` 过滤（D-G3-1） |
| 2 | `__tests__/dependency-graph.spec.js` | 更新 2 测试（wxml → view owner 进集；component 边 → page 进集，D-IV-6/7 反转）+ 新增 view/style 覆盖（D-G3-4） |
| 3 | `src/packer/types.ts` | invalidatedModules 字段 JSDoc 注释更新（`logic moduleCache 失效集` → `全 kind 失效模块列表`）；签名不变（D-G3-3，incidental） |
| 4 | `src/model/invalidation.ts` | `computeInvalidatedModules` JSDoc 更新：去 `logic Module 集/仅 logic 边/D-IV-6 kind=logic/logic moduleId 列表` → `全 kind Module 集/全 kind 边/D-IU-1 全 kind/全 kind moduleId 列表`；函数体不变（D-G3-2，incidental） |

## Dependencies

- [`fe-tools-incremental-unify`](../../deferred/fe-tools-incremental-unify/design.draft.md)（**deferred**；**D-IU-1 已拍板**——本门实现它的 getInvalidatedModules 泛化部分；G3 完结即满足 incremental-unify 的 **A-IU-1/A-IU-2**；A-IU-3/4 归 G4/G5 未启，A-IU-5/6 跨切（G3 已满足本门范围 A-G34/A-G35，G4/G5 闭合整体），G5 重激活时追溯）
- [`fe-tools-module-invalidation`](../fe-tools-module-invalidation/README.md)（**complete**；D-IV-6/7 原始 logic-only 决策，本门反转）
- [`fe-tools-graph-persist`](../fe-tools-graph-persist/README.md)（**complete**；G1——图持久，getInvalidatedModules 读活图）
- [`fe-tools-fingerprints-persist`](../fe-tools-fingerprints-persist/README.md)（**complete**；G2——watch-plan 已接入）

## Non-goals

- view/style ModuleResultCache 接入（D-IU-2, D-IU-3 = **G4+G5**，另门）
- view/style worker 返回 compileRes（D-IU-2 = **G4**，另门）
- watch-runner 创建 view/style cache（D-IU-4, D-IU-5 = **G5**，另门）
- ModuleResultCache 泛型化（后续 Packer 接入）
- `computeAffectedEntries` 改动（entry 级早已全 kind）
- `invalidation.ts` `computeInvalidatedModules` **函数体**代码变更（行为自动随 graph 泛化；JSDoc 注释更新见 D-G3-3/交付物 row 4，非行为变更）

## Constraints

- 签名不变：`getInvalidatedModules(file: string): string[]` / `computeInvalidatedModules(graph, changedFiles)` / `packer/graph.ts` 委托 / `watch-plan.ts` 类型注解——全部零改动。
- 行为 0：首次 build 产物字节完全不变（`getInvalidatedModules` 只在 watch 路径执行）。
- 反转 D-IV-6/7 有明确授权来源（incremental-unify D-IU-1 已拍板），不属"无设计变更授权"。
- 不加 `any` / `as any` / `@ts-nocheck` / `[key: string]`。

## Closure conditions

- A-G31..5 全部 ✅；
- 首次 build diff=0（全量 7 项目）；
- vitest 全绿（含更新后的 dependency-graph.spec.js）；
- 回流 architecture-notes。

## References

- Status authority: [Action Status](../../../STATUS.md)
- 前置：[`fe-tools-incremental-unify`](../../deferred/fe-tools-incremental-unify/design.draft.md)（D-IU-1）
- [Experience-Review.md](../../../../Experience-Review.md) §12 行为 0 全量验证
- [`fe-tools-module-invalidation`](../fe-tools-module-invalidation/README.md)（D-IV-6/7 原始决策）
