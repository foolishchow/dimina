# Session scheduling draft

Status: **discussion consensus**（2026-09-12）  
Authority: [architecture-notes.md](./architecture-notes.md) · [`fe-tools-project-store`](../fe-tools-project-store/README.md) · [`fe-tools-build-pipeline`](../_archive/complete/fe-tools-build-pipeline/README.md)
Implements policy for **D-PS-SESSION**（session = 唯一会话管理者）。

**未授权实施**；升 ready / 改 `session/index.js` 前须另授权。

## 1. 已确认前提

| 项 | 结论 |
| --- | --- |
| 会话管理者 | 只 `createBundler` session |
| ProjectStore | **`createBundler` 即创建并持有**；非进程单例 |
| load | **按需**（见 §3） |
| BuildPipeline | **按次** `run` |
| Preview | session + `dev/`；Store 不实现 preview |

## 2. 创建

```text
createBundler(resolved)
  → state.store = createProjectStore()   // RR5；始终有实例，尚未 load
  → state.lifecycle / activeLoop = null
```

## 3. Load / Pipeline 策略（L1–L4 · 已确认）

| ID | 题 | 结论 |
| --- | --- | --- |
| **L1** | one-shot `.build` 是否每次全量 `load`？ | **是** — 对齐今日每次 `storeInfo`；同 session 连续 `.build` = 覆盖 load |
| **L2** | watch rebuild 的 load？ | **近端可以（采用）**：仍 **全量 load + 旧图 merge**（对齐今日）；`applyChanges` 属远期 / PS3+ |
| **L3** | 保留 `build()` 门面？无 session 直调？ | **可以** — 保留 `build()`；内部可注入 store。无 session 时（测例等）允许门面内 **临时 createProjectStore** |
| **L4** | `watch.stop` / `dev.close` 后 Store？ | **保留** 实例与上次图；再次 `start` 再 load 覆盖。不随 stop reset |

## 4. 三入口调度

### 4.1 `.build(overrides)`

```text
assertNoActiveLoop
merge options（compile + pipeline whitelist；lifecycle 强制 session 的）
BuildPipeline.run({ store: state.store, …options })
  // 或 build(target, work, useAppIdDir, { store: state.store, … })  // RR4
  → store.load(...)          // L1：每次全量
  → 预备 → workers → store.merge → publish
return result
```

### 4.2 `.watch(opts)`

```text
assertCanStartLoop → activeLoop = 'watch'
createBuildWatcher({ store: state.store, options: base + lifecycle, … })

start:
  Pipeline.run(store, fullOptions)     // 首次全量 load
  // PS1/W3：watch-runner 闭包仍镜像 buildResult.dependencyGraph，供 plan 使用

rebuild(plan):
  beforeBuild?(ctx)
  Pipeline.run(store, { …base, …plan.options })
  // L2：load 全量 + 旧图 merge
  // PS1：plan 仍读闭包镜像图；Store 经 **M-A** 与 ctx 同引用持有（与镜像内容一致）
  // PS2：删除闭包；plan 只读 store.getDependencyGraph()

stop:
  释 activeLoop
  store 保留（L4）
```

**活图权威：** **PS1** = Store + 闭包**双持**（W3）；**PS2** = Store **唯一**（刀 B）。勿将 §4.2 目标态提前写成 PS1 已单权威。

### 4.3 `.dev(opts)`

```text
经 session.watch 组装（不绕过）
adapter = previewAdapter ?? default
beforeBuild → adapter.setPendingReload
start → createServer → listen
lifecycle → notify publish / error
close → stop watcher + adapter.close + 清 activeLoop
store 保留（L4）
```

编译路径与 `.build` / watch rebuild **同构**（store + 按次 Pipeline）。  
Store **不**知 preview。

## 5. 调度总表

| 事件 | session | Store | Pipeline |
| --- | --- | --- | --- |
| `createBundler` | 建 store | **create**，未 load | — |
| `.build` | 检 activeLoop；组 options | **每次全量 load**（L1） | 按次 run |
| `watch.start` | 占 activeLoop | 首次全量 load | 按次 run |
| rebuild | （watcher）beforeBuild → 编译 | 全量 load + 旧图 merge（L2） | 按次 run |
| `stop` / `dev.close` | 释环；关 preview | **保留**（L4） | — |
| 无 session 的 `build()` | — | 门面内临时 store（L3） | 按次 run |
| 会话丢弃 | GC | 随 session | — |

## 6. watch / dev 接入（W1–W4 · 已确认 2026-09-12）

### 6.1 目标同构

```text
session.watch / .dev
  → createBuildWatcher({ store: state.store, … })
       start / rebuild → Pipeline.run({ store }) 或 build() 注入 store
.dev 仅多：beforeBuild→preview、lifecycle notify、close 组装
```

watch/dev **不**另造编译路径；只多占 activeLoop +（dev）preview。

### 6.2 两刀

| 刀 | 对应门 | 内容 |
| --- | --- | --- |
| **A** | **与 PS1 同交**（**W1**） | session 持有 store 并注入 watcher；编译经 store（`build()` 注入或 Pipeline）；**可**无 store 时临时 create（**W2**）；闭包 graph **仍镜像**（**W3**）——**双持，非单权威** |
| **B** | **PS2** | 删除 watch-runner 闭包活图；plan **只读** `store.getDependencyGraph()`——**Store 唯一活图权威** |

### 6.3 `.dev`

- 仍 **必须**经 `session.watch`（不绕过）  
- Store **不知** preview  
- `beforeBuild` ctx **不必**含 store（**W4**；可选附加不挡 PS1）  
- reload 仍 `synthesizeReloadLevel(plan)`  

### 6.4 `createBuildWatcher` 草图

```text
createBuildWatcher({
  store?,                // session 必传；缺省 → 临时 store（W2）
  targetPath, workPath, useAppIdDir,
  options, beforeBuild?, onRebuild?, onError?, autoListen?,
})
// FR6：内部 start/rebuild → build()/Pipeline.run 时传同一 options.store（与 RR4 同构）
```

## 7. 非目标（调度草案）

- 不在此稿实施代码  
- 不定 `applyChanges` 形状（仅占位远期）  
- 不改 activeLoop 规则 R1–R4 / R7 语义（除非另 Action）  
- 不把 preview 逻辑迁入 Store  

设计落点与首刀范围见 architecture-notes **P1–P6**（与本调度正交、已确认）。

## 8. 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-12 | 初稿；确认 L1=是、L2=近端全量+merge、L3=保留门面+临时 store、L4=stop 后保留 |
| 2026-09-12 | 交叉引用 P1–P6 |
| 2026-09-12 | **确认** W1–W4：刀 A∈PS1、临时 store、闭包镜像、dev ctx 不含 store MUST |
| 2026-09-12 | review：§4.2/§6.2 区分 PS1 双持 vs PS2 单权威 |
| 2026-09-12 | **确认 M-A**：ctx.dependencyGraph 与 Store 图同引用 |
| 2026-09-12 | Readiness Round 3：RR4/RR5（options.store / state.store）；RR6 禁 new 挂 ctx |
| 2026-09-12 | Final Readiness：FR6 watcher→同一 options.store |
