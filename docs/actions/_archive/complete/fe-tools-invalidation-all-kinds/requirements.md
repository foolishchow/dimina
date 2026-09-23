# Requirements — fe-tools-invalidation-all-kinds

Status: **complete（2026-10-07）**

## Background

`DependencyGraph.getInvalidatedModules(filePath)` 当前硬编码 `kind=logic`（dependency-graph.ts:111-129）：

```typescript
for (const [owner, kinds] of ownerKinds) {
    if (kinds.has('logic')) pending.push(owner)   // ← 只推 logic owner
}
for (const dependent of this.getDirectDependents(id, 'logic')) {  // ← 只走 logic 边
```

- 改 `.wxml`（view kind）→ `fileKinds` 有 entry 但无 logic → owner 不推 → 返回 `[]`
- 改 component 的 `.js` → 闭包只沿 logic 边 → 依赖它的 page（component 边）不进集

这是 `fe-tools-module-invalidation`（complete）D-IV-6/7 的原始决策（当时 logic-only）。增量前置链 G3 要求泛化到全 kind。

## Problem

watch rebuild 改 `.wxml`/`.wxss` → `computeInvalidatedModules` 算不出 view/style 模块 → 即使 G4/G5 接入 view/style cache，invalidation 集合永远是空的 → 增量不成立。

## Requirements

### R-G3-1（MUST）— getInvalidatedModules 全 kind（D-IU-1）

`getInvalidatedModules(filePath)` 去掉两处 `kind=logic` 硬编码：
1. owner 收集：不再 `if (kinds.has('logic'))`——全 kind owner 都推入 pending
2. 闭包遍历：不再 `getDirectDependents(id, 'logic')`——调无 kind 参数版 `getDirectDependents(id)`（全 kind dependents）

返回受影响的全 kind module IDs（不只 logic）。

### R-G3-2（MUST）— 签名不变，调用方零改动

- `getInvalidatedModules(file: string): string[]` 签名不变
- `computeInvalidatedModules(graph, changedFiles)` 签名不变（invalidation.ts 函数体零变更——行为自动随 graph 泛化；JSDoc 注释更新见 D-G3-3）
- `packer/graph.ts` 委托（`this.graph.getInvalidatedModules(file)`）不变
- `watch-plan.ts` 类型注解 + 调用不变
- `packer/types.ts` interface 声明不变

### R-G3-3（MUST）— 测试更新（含 D-IV-6/7 反转授权）

`dependency-graph.spec.js` 更新：
- `getInvalidatedModules: wxml → empty`（现断言）→ **反转**：wxml → view owner 进集
- `getInvalidatedModules: component.js → page NOT`（现断言 D-IV-6）→ **反转**：page 进集（全 kind 闭包沿 component 边）
- 新增：wxss → style owner 进集；component `.wxml` 变更 → 依赖页 moduleId 进集；同模块多文件（js/wxml/wxss）任一变更 → 模块进集
- 保留：shared JS → moduleId + logic dependents（回归）；page.js → page moduleId（回归）；unknown → `[]` 不抛（D-IV-3）

反转授权来源：`fe-tools-incremental-unify` design.draft.md **D-IU-1 已拍板**（deferred 但设计定稿）。本门实现它。

### R-G3-4（MUST）— 行为 0

`getInvalidatedModules` 只在 watch 路径执行（watch-plan → computeInvalidatedModules）。examples 一次性 build 不触发 → 全量 7 项目 diff=0（one-shot 路径 `cached` 为空 → `logic/index.ts:82` skip 分支不进入 → 全量编译，与 G3 无关）。

watch 路径功能影响（**非 no-op，需明示**）：moduleId 跨 kind **共享**——同一页模块（如 `pages/foo/index`）同时拥有 `.js`(logic)+`.wxml`(view)+`.wxss`(style)（view `compile.ts:37`、style `parse-walk.ts:282`、logic `index.ts:124` 同 namespace `addFile`）。G3 后 `.wxml`/`.wxss` 变更会把该共享 moduleId 放进 `invalidatedModules`；logic worker 运行时 `invalidatedModules.has(currentPath)` **会命中** → 翻转 skip→recompile（保守过失效，非 no-op）。

行为 0 仍成立，经两条机制：
1. 纯 view/style 变更：`computeStagesForFiles`（watch-plan.ts）按 changedFiles 的 kind 算 stages → stages={view}/{style} → logic stage 不执行 → 不消费 `invalidatedModules`；
2. logic 涉及的变更：`invalidatedModules` 只可能**扩大**（superset；skip 仅当 NOT in set）→ 永不欠失效 → 重编译相同源 → 字节一致 + 图边从不变 AST 重建一致（`clearOutgoingEdges` + `addDependency`）。

边界：watch 效率回归（保守过失效多算重编译）不在 diff=0 覆盖内（同 G1/G2——diff=0 只证 one-shot build；watch 行为由单测 + 审阅证明）。

### R-G3-5（MUST）— 类型约束

无 `any` / `as any` / `@ts-nocheck` / `[key: string]`（新代码）。

## Non-scope

- view/style ModuleResultCache 接入（D-IU-2/3 = G4+G5）
- worker 返回 compileRes（G4）
- watch-runner view/style cache 实例（G5）
- ModuleResultCache 泛型化
- `computeAffectedEntries`（已全 kind）
- `invalidation.ts` 函数体代码变更（JSDoc 注释更新见 D-G3-3，非行为变更）
