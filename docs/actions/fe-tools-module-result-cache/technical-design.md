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
| `CompileInfo` | 7 字段：`{path, code, map?, sourceFile, extraInfoCode?, component?, usingComponents?}`；path = moduleId（方案 A） |
| `hasCompileInfo` | build 内去重（同次 build 不重编同模块）；跨 build 不保留 |
| worker 生命周期 | `executor.ts:24` 每 task `new Worker()` + `:29` `terminate()`；**不跨 build 复用**——`WorkerPool` 仅限流 |
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
- **缓存完整 `CompileInfo`**（7 字段：`path, code, map?, sourceFile, extraInfoCode?, component?, usingComponents?`）——非仅 emit 4 字段；cache hit 须保留 `sourceFile`/`component`/`usingComponents` 供遍历/元数据。
- **类型引用**：`CompileInfo` 定义在 `compiler/logic/index.ts`；`model/module-result-cache.ts` 用 **type-only import**（`import type { CompileInfo }`）——对齐 `model/` 既有 3 处 `compiler/` type import 模式（`compile-cache`/`invalidation`/`project-store`）；不引入运行时依赖。

### 3.2 持久策略（D-RC-2）

**决策：α — session-only（watch 长驻）**

- watch 是主场景；进程内跨 rebuild 复用；进程退出丢弃。
- `createWatchBuildPlan` 返回 `fingerprints: new Map()`（空占位；注释「M2 后续接入」指 build-model M2，非本 Action）。
- β（序列化持久）需模块级 fingerprint 下沉（依赖 Module 大对象统一，属另门）；β 作为后续门。

### 3.3 worker 回填（D-RC-3）

**决策：I — cache snapshot 经 IPC 传入 ephemeral worker；主线程管缓存实例**

- **worker 生命周期**（源码事实）：`executor.ts:24` 每 `executeTask` `new Worker()`；`:29,39,43` 任务后 `worker.terminate()`。worker **不跨 build 复用**——`WorkerPool` 仅并发限流。cache 不能靠 worker 自维护。
- **cache 实例**：主线程 `ModuleResultCache`（session-scoped，随 `activeStore` 同生命周期在 watch-runner 创建）。
- **IPC 传入**：cache snapshot（`[moduleId, CompileInfo][]` 或 `toJSON()`）经 `msg` 传入 worker——同 `dependencyGraph.toJSON()` / `storeInfo` 模式。同时传 `invalidatedModules: string[]`（dirty 集，小）。
- **`buildJSByPath` 内消费**：worker 收到 cache snapshot + dirty 集 → `if snapshot.has(moduleId) && !invalidatedModules.has(moduleId) → 用 cached CompileInfo（skip transform）` → 否则 transform → `compileRes.push(info)`。
- **返回**（**协议变更**）：worker 响应消息增加 `compileRes` 字段（`CompileInfo[]`，cached + dirty 全量）。`logicCompile` / `engine.compile` 返回 `CompileInfo[]` → `runWorker` `postMessage({ success, ..., compileRes })` → `executeTask` resolve → `runCompileStage` → 主线程从 `compileRes` 更新 cache（idempotent：cached 覆写同值，dirty 写入新值）。**非经 sink/emit**——sink 仍发 EmitEntry（转换后 4 字段），与 cache 更新正交。
- **IPC 成本**：输入 = cache snapshot（∝ 全模块 code 量）+ dirty 集（小）；输出 = EmitEntry（sink，同今日）+ compileRes（response 新增）。**省的是 compute（skip transform），非 IPC**。

### 3.4 失效触发（D-RC-4）

**决策：`createWatchBuildPlan`（watch-plan.ts）**

- 同位加 `computeInvalidatedModules`（2 行）；与现有 `computeAffectedEntries` 并列。
- `dependencyGraph` 结构类型加 `getInvalidatedModules: (f: string) => string[]`（M1 已交付）。
- 流入路径：`options.invalidatedModules` → `build()` → pipeline → `compileJS({ cache, invalidatedModules })` → `buildJSByPath` 内消费。
- **cache 实例生命周期**：watch-runner 创建 `ModuleResultCache()`（同 `activeStore`）；经 `build(options: { ..., cache })` → pipeline `msg` → worker `logicCompile` → `compileJS({ cache, invalidatedModules })`。首次 build：cache 空 → 全量编译 → worker 响应含 `compileRes` → 主线程填充 cache。rebuild：cache 有上次结果 → 传 snapshot + dirty 集 → worker skip clean → 响应含 `compileRes`（cached + dirty）→ 主线程更新 cache（idempotent）。

### 3.5 两级过滤全景

```text
文件变更 → computeAffectedEntries (Entry 级) → 过滤页（现有）
         → computeInvalidatedModules (Module 级) → 脏模块集（M1 + M2）
           ↓
buildJSByPath(page) [worker: cache snapshot + dirtySet]:
  for each module in page:
    if snapshot.has(moduleId) && moduleId NOT in dirtySet:
      → 用 cached CompileInfo (skip transform)     ← M2 新增
    else:
      → transform → compileRes.push(info)           ← 现有
  return compileRes  [cached + dirty]

主线程: response.compileRes → cache.set(每个 moduleId, info)    ← M2 新增
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
| `watch/watch-runner.ts` | 重建调度；**cache 实例创建**（同 `activeStore` 生命周期）→ 传 `build(options.cache)` |
| `compiler/worker-runtime/executor.ts` | ephemeral worker（`new Worker()`+`terminate()`/task）；cache snapshot 经 IPC 传入；**响应 resolve 含 `compileRes`**（协议变更） |

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
| **D-RC-3** | worker 回填：**I** — cache snapshot 经 IPC 传入 ephemeral worker（同 `dependencyGraph.toJSON()` 模式）；主线程管缓存实例；worker 只编译脏模块；**响应消息增加 `compileRes` 字段**（协议变更）→ 主线程更新 cache（省 compute 非 IPC） |
| **D-RC-4** | 失效触发：`createWatchBuildPlan`（watch-plan.ts）同位加 `computeInvalidatedModules`；dirty 集经 `options` 流入 `compileJS` |

## 待定

**无**（D-RC-1..4 已冻结）。升 `in_progress` 另授。
