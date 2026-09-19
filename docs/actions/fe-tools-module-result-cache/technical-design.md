# Technical Design — fe-tools-module-result-cache

Status: **ready（2026-09-20）** — D-RC-1..4 冻结；改 `src` / `in_progress` 另授。

## 1. 继承

来自 [`fe-tools-module-centric` technical-design](../fe-tools-module-centric/technical-design.md) D-MF-1 / D-MF-2：

| # | 条款 |
| --- | --- |
| 2 | 方案 A：`moduleId` = logic `CompileInfo.path` |
| 3 | 仅 logic（M1 范围）；view/style 排除 |
| 5 | page 规范形迁移另门 |
| 6 | 新 API；不拆 node 表 |
| 7 | 不替换 `getAffectedEntries` |

D-MF-2：`DependencyGraph` 不挂 code；**M2 另定缓存宿主**。

## 2. 现状

| 资产 | 现状 |
| --- | --- |
| `buildJSByPath`（logic/index.ts） | 递归收集 `compileRes: CompileInfo[]`；无跨 rebuild 缓存 |
| `CompileInfo` | `{path, code, map, extraInfoCode}`；path = moduleId（方案 A） |
| `hasCompileInfo` | build 内去重（同次 build 不重编同模块）；跨 build 不保留 |
| M1 `computeInvalidatedModules` | 返回脏 moduleId 集；**无消费方** |
| 旧 [`fe-tools-module-cache`](../_archive/complete/fe-tools-module-cache/README.md) | 已归档；显式不做 logic `compileResCache` 内容寻址（D-MC-3 选项 B） |
| `ProjectStore` | 唯一活图权威；图序列化/恢复已有 |
| `compileResCache`（view） | view-compiler 失败缓存 + minify key（旧 module-cache 交付） |

## 3. 设计方向（冻结 v1）

### 3.1 缓存宿主（D-RC-1）

**决策：B — 独立 `ModuleResultCache` 对象**

- D-MF-2 明确「M2 另定宿主」；不挂图节点；不混 Store 图职责。
- 形态：`class ModuleResultCache { get(moduleId): CompileInfo | undefined; set(moduleId, info): void; has(moduleId): boolean; delete(moduleId): void; clear(dirtySet): void; size: number }`
- 落点：`model/module-result-cache.ts`（并列 `dependency-graph.ts` / `invalidation.ts`）。
- 注入点：`compileJS(pages, root, mainCompileRes, progress, { cache?, invalidatedModules? })` — 可选参数；不传时退化为全量重算。

### 3.2 持久策略（D-RC-2）

**决策：α — session-only（watch 长驻）**

- watch 是主场景；进程内跨 rebuild 复用；进程退出丢弃。
- `createWatchBuildPlan` 已预留 `fingerprints: new Map()`（注释「M2 后续接入」）。
- β（序列化持久）需模块级 fingerprint 下沉（依赖 Module 大对象统一，属另门）；β 作为后续门。

### 3.3 worker 回填（D-RC-3）

**决策：I — IPC 回填 + 主线程管缓存**

- 缓存在主线程 `ModuleResultCache` 实例。
- `createWatchBuildPlan` 只传 dirty 集（`string[]`，小）给 worker。
- `buildJSByPath` 内消费：`if cache.has(moduleId) && !invalidatedModules.has(moduleId) → 用 cached CompileInfo（skip transform）`。
- worker 只编译 dirty 模块 → 返回 compileRes → 主线程更新 cache。
- IPC 成本：dirty 集小；返回量 = 只重编脏模块（远小于全量）。

### 3.4 失效触发（D-RC-4）

**决策：`createWatchBuildPlan`（watch-plan.ts）**

- 同位加 `computeInvalidatedModules`（2 行）；与现有 `computeAffectedEntries` 并列。
- `dependencyGraph` 结构类型加 `getInvalidatedModules: (f: string) => string[]`（M1 已交付）。
- 流入路径：`options.invalidatedModules` → `build()` → pipeline → `compileJS({ cache, invalidatedModules })` → `buildJSByPath` 内消费。

### 3.5 两级过滤全景

```text
文件变更 → computeAffectedEntries (Entry 级) → 过滤页（现有）
         → computeInvalidatedModules (Module 级) → 脏模块集（M1 + M2）
           ↓
buildJSByPath(page):
  for each module in page:
    if cache.has(moduleId) && moduleId NOT in dirtySet:
      → 用 cached CompileInfo (skip transform)     ← M2 新增
    else:
      → transform → cache.set(moduleId, info)       ← M2 新增
```

**不替换 Entry API**（D-MF-1 条款 7）：`affectedEntries` 决定编哪些页；`invalidatedModules` 决定页内哪些模块重编。两层正交。

### 3.6 行为 0 守卫

- `compileJS` 新增可选参数 `{ cache?, invalidatedModules? }`——不传时退化为全量重算。
- `buildJSByPath` cache 检查仅当 `cache` 传入时触发——不传 cache 不分支。
- emit / `modDefine` 字符串零变化（D-IV-5 同理）。
- 全量 build（无 cache）产物 diff=0。

## 4. 与现状的接口

| 资产 | 角色 |
| --- | --- |
| `model/dependency-graph.ts` | M1 `getInvalidatedModules` 已交付（M2 只消费） |
| `model/invalidation.ts` | M1 `computeInvalidatedModules` 已交付（M2 只消费） |
| `model/module-result-cache.ts` | **M2 新增**：`ModuleResultCache` 类 |
| `compiler/logic/index.ts` | `buildJSByPath` / `compileJS` — M2 接入点（cache 检查 + 跳过 transform） |
| `watch/watch-plan.ts` | `createWatchBuildPlan` — M2 触发点（加 `computeInvalidatedModules`） |
| `ProjectStore` | 图权威（不挂 code；D-MF-2） |
| `watch/watch-runner.ts` | 重建调度（M2 不改接线；plan 产出 dirty 集） |

## 5. 明确不做

- view / style 结果缓存
- fingerprint 下沉模块级
- HMR patch 产物
- 改 `modDefine` / emit 字符串
- 拆图、PackerContext
- 复活旧 `fe-tools-module-cache` 的缩 scope（D-MF-3）

## 决策（冻结 v1）

| ID | 决策 |
| --- | --- |
| **D-RC-1** | 缓存宿主：**B** — 独立 `ModuleResultCache` 对象（`model/module-result-cache.ts`）；不挂图节点、不混 Store |
| **D-RC-2** | 持久策略：**α** — session-only（watch 长驻）；β 需 fingerprint 下沉（另门） |
| **D-RC-3** | worker 回填：**I** — 主线程管缓存；worker 只收 dirty 集、只编译脏模块；IPC 回填后主线程更新 cache |
| **D-RC-4** | 失效触发：`createWatchBuildPlan`（watch-plan.ts）同位加 `computeInvalidatedModules`；dirty 集经 `options` 流入 `compileJS` |

## 待定

**无**（D-RC-1..4 已冻结）。升 `in_progress` 另授。
