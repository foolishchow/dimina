# Technical Design — fe-tools-module-invalidation

Status: **草案决策已冻结（2026-09-19）** — T1–T7 按讨论默认封口；已实施 complete（2026-09-20）。

## 1. 继承（不可再议）

来自 [`fe-tools-module-centric` technical-design](../fe-tools-module-centric/technical-design.md) D-MF-1：

| # | 条款 |
| --- | --- |
| 1 | `entryId` ≠ `moduleId`（概念；字符串今日可重合） |
| 2 | 方案 A：`moduleId` = logic `CompileInfo.path` |
| 3 | 仅 logic：`kind=logic` file 边 owner + logic dependents 闭包 |
| 4 | view/style 排除 |
| 5 | page 规范形迁移另门 |
| 6 | 新查询 API；不拆 node 表 |
| 7 | 不替换 `getAffectedEntries` |

## 2. 语义（冻结）

### 2.1 算法

```text
getInvalidatedModules(filePath) → string[]   // sorted

file = normalizeFilePath(filePath)
seed = { owner | fileKinds[file][owner] contains 'logic' }
pending = [...seed]; visited = {}; out = {}
while pending:
  id = pop
  if id in visited: continue
  visited.add(id); out.add(id)
  for dep in getDirectDependents(id, 'logic'):
    pending.push(dep)
return [...out].sort()
```

批量：

```text
computeInvalidatedModules(graph, changedFiles) → string[]  // sorted unique
= union of getInvalidatedModules(f) for f in changedFiles, then sort
```

### 2.2 行为锚点

| 变更 | 本 API | Entry API（不变） |
| --- | --- | --- |
| 共享 `/utils/x.js` | 含 `/utils/x` + logic 上游 dependents | 受影响页 |
| `pages/foo/index.js` | 含 `pages/foo/index`（方案 A）+ logic dependents | 含该页等 |
| `pages/foo/index.wxml` | **空集**（无 logic file 边） | 含该页等 |
| `components/leaf/index.js` | 含 leaf moduleId；**不**沿 `component` 边进页 moduleId | 沿 component 爬到页 |

### 2.3 与 Entry API 分工

| API | 粒度 | 用途 |
| --- | --- | --- |
| `getInvalidatedModules` / `computeInvalidatedModules` | logic Module | M2 清缓存 / 只重编脏 JS |
| `getAffectedEntries` / `computeAffectedEntries` | Entry | 现有页级计划 |

## 3. 决策（冻结 v1）

| ID | 决策 | 来自 |
| --- | --- | --- |
| **D-IV-1** | 名称：`getInvalidatedModules(filePath): string[]`（排序）；批量：`computeInvalidatedModules(graph: { getInvalidatedModules: (f: string) => string[] }, changedFiles): string[]`（排序去重；`graph` 用结构类型，对齐 `computeAffectedEntries` 鸭子类型） | T4 |
| **D-IV-2** | **双挂**：实例方法在 `DependencyGraph`；批量在 `model/invalidation.ts`（并列 `computeAffectedEntries`） | T3 |
| **D-IV-3** | 空列表 → `[]`；未知文件 → 跳过、不抛 | 确认默认 |
| **D-IV-4** | 本门 MUST = API + 单测；**不**改 watch / compile-cache 接线 | T6 |
| **D-IV-5** | logic 编译 / emit 字符串 **零变化**；仅新增查询 | 行为 0 |
| **D-IV-6** | 闭包 **只** 沿 `kind=logic` 的 dependents；**不**走 `component` / `app` | T1 |
| **D-IV-7** | seed 条件：该 owner 对该文件的 kinds **含** `logic` | T2 |
| **D-IV-8** | 路径：`normalizeFilePath` = `path.resolve`；与现有 `fileOwners` 一致；不另造 workPath 特规 | T5 |
| **D-IV-9** | 单测：手搓 `DependencyGraph` 为主（扩展 `dependency-graph.spec.js`；`build-stages.spec.js` 可加经 `build()` 全链路断言）；不强制每案全量 `build` | T7 |

## 4. 明确不做

- 改 `modDefine` / CompileInfo.path 形
- view scriptRes 键进返回集
- 沿 component 边把 page 标进脏 Module 集
- ModuleCache、拆图、PackerContext
- 本门改 watch 接线

## 待定

**无**（T1–T7 已按默认冻结）。升 `ready` / `in_progress` 另授。
