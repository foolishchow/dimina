# Design draft — fe-tools-incremental-target

Status: **草案（2026-09-14）** — **未冻结**；升 ready 前须拍板 §待定

## 与 CompileTarget 的关系

| 层 | 全量（已交付） | 增量（本门） |
| --- | --- | --- |
| 静态形态 | `createCompileTarget(runOptions)` | 同；`requestedStages` 可来自增量契约而非全量默认 |
| 动态绑定 | `readLoadBindings` | 同（collect-config 后） |
| 派生 | `deriveStagePlan(target, bindings, { cwd, filteredPages })` | `filteredPages` / stages 的**权威输入**改由增量契约提供，不再仅靠 pipeline 私过滤 |

## 候选契约形状（待定 ①）

**方案 A — 仍走 `build(options)`，但字段语义升格**

- 保留 `stages` / `affectedEntries` / `seedPath` / `prepare*` 字段名（行为 0 友好）；
- 成文：这些字段是 **CompileTarget 输入的权威增量补丁**，不是「管线随便再算一遍的提示」；
- `deriveStagePlan`（或旁路 `applyIncrementalPatch`）显式消费 `affectedEntries`；pipeline 删除平行 `filterPagesByEntries` 私算。

**方案 B — 显式 `incremental` 对象**

```js
build(targetPath, workPath, useAppIdDir, {
  incremental: { stages, affectedEntries, seedPath, prepareConfig, prepareNpm },
  // …
})
```

- 契约更清晰；session 白名单与 watch/cache 生产者一次改齐；
- 迁移面大于 A。

**建议（未拍板）**：先 A（行为 0、改动面小），结构判据锁「derive 显式消费 affectedEntries + 双生产者共用阶段词汇」；若白名单仍过脏再开 B。

## 职责表（草案）

| 关注点 | 归属 |
| --- | --- |
| 变更 → stages / affectedEntries | watch-plan / compile-cache（生产者）；共用 `COMPILE_STAGE_ORDER` 单源 |
| 增量字段 → CompileTarget / derive | compile-target（或薄 `incremental.js`） |
| session 白名单 | session/runner 对齐新契约 |
| Listr / worker | 不动（Non-goal） |

## 待定（升 ready 前）

| # | 议题 | 建议 |
| --- | --- | --- |
| **①** | 契约形状 A vs B | **A** |
| **②** | S3 compile-cache 是否与 I1 同 PR | **同 Action 内 I2 门**，可分 PR 禁混 |
| **③** | S4 单源落点 | `compile-target.js` 导出 `COMPILE_STAGE_ORDER`，compile-stages / invalidation / watch 改引用 |
| **④** | dev-reload 是否本门必改 | 若仅透传 `plan.options`，随 I1 契约自动对齐；专测锁定 |

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | 草案：A/B 契约；待定 ①–④ |
