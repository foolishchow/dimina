# Architecture notes — session / ProjectStore / BuildPipeline

Status: **discussion consensus**（2026-09-12）  
Authority pointers: [`fe-tools-project-store`](../fe-tools-project-store/README.md) · [`fe-tools-build-pipeline`](../fe-tools-build-pipeline/README.md) · 已归档 session

## 唯一会话管理者

> **Session（`createBundler`）是唯一会话管理者。**  
> `ProjectStore` / `BuildPipeline` 是会话的部件，不升级为会话，也不另立长活 Engine 抢权。

```text
Session（长活产品面）
  ├─ Resolved · lifecycle · activeLoop
  ├─ ProjectStore                 // createBundler 即创建并持有（始终有实例）
  ├─ PreviewAdapter?              // 仅 .dev
  └─ BuildPipeline.run(...)       // 每次编译按次创建并执行
         │
         ▼
    ProjectStore.load / merge     // load 按需
         │                        // 活图：PS1 = Store + watch 闭包镜像双持；PS2 起 Store 唯一权威
         ▼
    workers（hydrate + 变换）
```

| 问题 | 答案 |
| --- | --- |
| 谁管会话？ | **只 session** |
| 谁管工程状态/图？ | **ProjectStore**（装载与 merge 归宿）；**PS1** 下 watch 仍可闭包**镜像**图（W3）；**PS2** 起 Store 为唯一活图权威 |
| 谁跑一次编译的阶段？ | **BuildPipeline**（按次） |
| 谁管 preview？ | **session + dev/**（Store 最多发变更通知） |
| Store 何时创建？ | **`createBundler` 即创建并持有**（任何 session 都有）；**load 按需**（见调度草案）。非进程单例 |
| 活图何时单权威？ | **PS2**（删 watch-runner 闭包镜像）；勿把 PS1 写成已单权威 |

## Session 调度（已确认 L1–L4）

细则：[session-scheduling.draft.md](./session-scheduling.draft.md)

| ID | 结论 |
| --- | --- |
| **L1** | `.build` **每次**全量 `load` |
| **L2** | watch rebuild 近端：**全量 load + 旧图 merge**；`applyChanges` 远期 |
| **L3** | 保留 `build()` 门面；无 session 时可临时 createStore |
| **L4** | `stop`/`close` 后 **保留** Store 实例与图 |

### watch / dev（W1–W4）

| ID | 结论 |
| --- | --- |
| **W1** | 刀 A（注入 store 进 watcher）**与 PS1 同交** |
| **W2** | watcher **允许**无 store → 临时 create（直测） |
| **W3** | 刀 A **保留**闭包 graph 镜像；**PS2** 再删并改为 plan 只读 Store |
| **W4** | `.dev` `beforeBuild` ctx **不必**含 store |

细则：[session-scheduling.draft.md](./session-scheduling.draft.md) §6。

```text
createBundler → 必有 store（未 load）
.build / watch.start / rebuild → Pipeline.run(store) / build(注入 store) → load（策略见上）→ …
stop/close → 释 activeLoop；store 保留
.dev = session.watch + preview（编译路径同构）
```

## 命名

| 概念 | 采用名 |
| --- | --- |
| storeInfo 状态管家 | **ProjectStore**（≠ storeInfo 函数） |
| runBuild 编译承载面 | **BuildPipeline**（runBuild 可作门面） |
| 产品会话 | **session** / `createBundler`（已有） |

## 已确认设计点（P1–P6 · 2026-09-12）

| ID | 结论 |
| --- | --- |
| **P1** | Store → `src/model/project-store.js`；Pipeline → `src/compiler/build-pipeline.js` |
| **P2** | PS1 薄包装 storeInfo+ALS；getters 不动；**不含** PS2 |
| **P3** | 不新增公开 `exports` |
| **P4** | merge 首刀 **全量** |
| **P5** | PS1 / BP1 不硬依赖；**禁混 PR** |
| **P6** | `build()` 唯一公开编译入口；BP1 留 Listr |
| **M-A** | `ctx.dependencyGraph` 与 Store 持有图**同引用**；channel.merge 即写 Store |
| **R1** | PS1 文件清单：project-store + session + watch-runner + build/runBuild 接线；不抽阶段表 |
| **R2** | runBuild 内挂 M-A **≠** BP1 |
| **R3** | PS1 **不**暴露 `session.store` |
| **R4** | compile-cache 两门 Non-goal |
| **RR4** | `options.store`（包内）；无则临时 store |
| **RR5** | session 内部 `state.store` |
| **RR6** | ctx 挂 Store 图；禁止再 `new` 挂 ctx |
| **RR7** | 实施 PS1 略先；禁同 PR |
| **RR8** | 两门可分升 ready |
| **RR12** | 伞 `fe-tools-sidecar` 不随子门自动升 ready |
| **FR2** | `build:start` 剥 `store` |
| **FR5** | 两门已同升 ready（2026-09-12）；实施另授 in_progress |

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-12 | 初稿：三分 + 唯一会话管理者 |
| 2026-09-12 | **确认**：Store 于 `createBundler` 即创建持有；load 按需；非进程单例 |
| 2026-09-12 | **确认** L1–L4；链到 session-scheduling.draft.md |
| 2026-09-12 | **确认** P1–P6（落点 / PS1 范围 / exports / merge / 顺序 / build 门面） |
| 2026-09-12 | **确认** W1–W4（watch/dev 接入两刀） |
| 2026-09-12 | review：澄清 PS1 双持 vs PS2 单权威措辞 |
| 2026-09-12 | **确认 M-A** |
| 2026-09-12 | **确认 R1–R4**；两门 requirements/acceptance/validation 草稿 |
| 2026-09-12 | Readiness Round 3：RR1–RR12；stages → build-pipeline/stages.md；设计冻结 v1 |
| 2026-09-12 | Final Readiness FR1–FR9；implementation-plan；待升 ready |
