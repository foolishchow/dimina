# FE Tools Graph Correctness（子门 MC0）

- Action: `fe-tools-graph-correctness`
- Status: `complete`
- Updated: 2026-09-21
- Status authority: [Action Status](../../../STATUS.md)
- 伞：[`fe-tools-module-convergence`](../fe-tools-module-convergence/README.md)（MC0）
- 文档：[README](README.md) · [validation](validation.md)

## 问题

`DependencyGraph` 有三类正确性问题：
- **stale edge**：`addDependency` 只增不删，删 require 后旧边残留
- **stale node**：watch `storeInfo` merge 不删 node，删 page 后 node 残留（merge 可复活）
- **closure 不一致**：cache hit 跳编译时 transitive dep 边不更新

## Goal

让 GraphNode 成为可靠的结构权威（D-MC-0 选 A：code 不上图）。

## 实施（D-MC-5 冻结）

| 变更 | 文件 |
| --- | --- |
| 补 `clearOutgoingEdges(id, kind?)` API | `model/dependency-graph.ts` |
| 补 `removeNode(id)` API（级联清理 deps/dependents/fileOwners/fileKinds） | `model/dependency-graph.ts` |
| `storeInfo` merge 后删 stale page/component node（`type` 判断，非 `entry===true`） | `compiler/core/env.ts` |
| dirty 模块 AST walk 前清 outgoing 'logic' 边 | `compiler/logic/index.ts` |

## 验收

- A-MC0: graph stale edge/node 清理 + 增量 closure 一致 → **pass**（见 validation）
- 行为 0：`fe/packages` 空 diff；vitest 598 pass

## 关键设计决策

- stale node 判定：`type: 'page'` 或 `type: 'component'`（component `entry: false`，不能用 `entry === true`）
- `merge()` 保持纯加法语义；node diff 在 `storeInfo` 层
- cache hit 边不清（安全，over-inclusive）
