# FE Tools Derive From Graph（子门 MC3a）

- Action: `fe-tools-derive-from-graph`
- Status: `complete`
- Updated: 2026-09-21
- Status authority: [Action Status](../../../STATUS.md)
- 伞：[`fe-tools-module-convergence`](../fe-tools-module-convergence/README.md)（MC3a）
- 文档：[README](README.md) · [validation](validation.md)

## 问题

Packer 的核心形状——「entry → 遍历 graph → 取 module 集 → 取 code」——不存在。给定 entry，无法从 GraphNode + ModuleResultCache 派生 `[EmitModule]`。

## Goal

创建 `deriveFromGraph(graph, cache, entryId)` 函数——Packer 核心形状。

## 实施

| 变更 | 文件 |
| --- | --- |
| 补 `getDependencyClosure(entryId)` API（BFS all-kind outgoing，含 entryId） | `model/dependency-graph.ts` |
| 新增 `deriveFromGraph(graph, cache, entryId)` 函数 | `model/convergence.ts`（新增） |

## 设计要点

- **只读**：不改 graph、不改 cache、不碰 emit/transform/bundle
- 遍历**所有 kind** outgoing 边（`'logic'` + `'app'` + `'component'`）——`'app'`/`'component'` 目标也有 `.js`（logic module）
- 非 logic 模块由 `cache.get(id)` 自然过滤
- **闭包含 `entryId` 自身**
- 不替代 streaming emit（MC3b deferred）

## 验收

- A-MC3a: `deriveFromGraph` 函数 → **pass**（见 validation）
- 行为 0：纯新增只读函数，不改任何现有流；vitest 598 pass + 9 new
