# FE Tools ProjectStore

- Action: `fe-tools-project-store`
- Status: `complete`
- Updated: 2026-09-12（**PS1+PS2 已交付并归档**：壳 + 刀 A + M-A + 删闭包镜像；Store 唯一活图权威；PS3 订阅/applyChanges 未实施）
- Status authority: [Action Status](../../../STATUS.md)
- 关系：独立结构 Action（**不是** umbrella 子门）。背景 [`fe-tools-sidecar`](../../../fe-tools-sidecar/README.md)；总览 [`architecture-notes.md`](../../../fe-tools-sidecar/architecture-notes.md)；与已归档 [`fe-tools-bundler-session`../fe-tools-bundler-session/README.md)、[`fe-tools-bundler-layout`../fe-tools-bundler-layout/README.md)、[`fe-tools-worker-architecture`../fe-tools-worker-architecture/README.md) 对齐；兄弟 [`fe-tools-build-pipeline`../fe-tools-build-pipeline/README.md)（**已 complete 归档**）。
- 工作分支：`feature/fe-tools-sidecar`
- 设计权威：[design.draft.md](./design.draft.md)（**已冻结 v1**；RR1–RR12 已确认；字段名可同义微调）

## Background

今日工程上下文没有「管家」名词：

- `storeInfo()` 是**一次手续**（扫工程 → 填 ALS/上下文 → 种子 `DependencyGraph`）
- 单次 build 的图权威在 `runBuild` 的 Listr `ctx.dependencyGraph`
- 深边在 **worker** 内写入本地副本，经 `stage-channel.merge` 并回主线程
- watch 跨 rebuild 的活图在 **`watch-runner` 闭包变量**里
- session **不管图**，只透传 `dependencyGraph` option

结果：图与装载状态**分段持有**，没有统一生命周期对象；也无法干净地服务 watch/dev 长活。

本门目标是引入 **`ProjectStore`**：管理「今日 `storeInfo` 所建立的那套状态」（含图权威），而不是把 `storeInfo` 函数改个名。

## Goal

1. 引入 **ProjectStore** 作为主线程工程上下文 + **依赖图权威** 的管家  
2. 今日 `storeInfo` 降为 Store 内部（或 pipeline 调用的）**load 手续**，≠ Store 本身  
3. 与 **BuildPipeline**、**session** 三分职责清晰；**session 为唯一会话管理者**  
4. 行为 0 变化优先；增量 `applyChanges` / 订阅为后续门，不阻塞首刀壳层

## Non-goals

- 不把 ProjectStore 做成 session / 通用 core / 会话管理者  
- 不起 worker、不起 `dev-server`、不实现 reload 协议  
- 不做 TS-2 IR；不引入 SharedArrayBuffer 共享堆  
- 不抽 `runBuild` 阶段表（属兄弟 [`fe-tools-build-pipeline`../fe-tools-build-pipeline/README.md)；**R1**）
- 不引入第二套会话级 Compiler/Engine 与 session 抢权  
- 默认不新增稳定 npm `exports` 子路径（若暴露 API 另议）  
- **PS1 不**暴露 `session.store`（**R3**）  
- **不**改 compile-cache / fingerprint（**R4**；另候）

## 会话管理原则（共识 · D-PS-SESSION）

> **Session（`createBundler`）是唯一会话管理者。**  
> ProjectStore / BuildPipeline **不**升级为会话；它们是会话拥有或按次使用的部件。

| 角色 | 生命周期 | 管什么 |
| --- | --- | --- |
| **session** | 产品会话长活 | Resolved、lifecycle、activeLoop、对外 API；**`createBundler` 即创建并持有 Store**；按次 `Pipeline.run`；`.dev` 挂 preview |
| **ProjectStore** | **随 session 始终存在**（非可选）；**load 按需** | 工程上下文 + 图权威 |
| **BuildPipeline** | **按次**（一次 build/rebuild 一个） | 阶段表与派工；驱动 Store.load/merge；跑完可弃 |

```text
Session（唯一会话管理者）
  ├─ owns: Resolved, lifecycle, activeLoop
  ├─ owns: ProjectStore           // createBundler 即有；始终持有
  ├─ uses:  BuildPipeline.run     // 每次编译按次创建
  └─ owns?: PreviewAdapter        // 仅 .dev
```

**确认（2026-09-12）：** Store 不是「仅 watch/dev 才建」；**任何 session 都创建**。空 Store 在首次 `load` 前几乎无工程状态；**不**做进程级单例。

**禁止：** Pipeline 或 Store 自行 listen 文件系统、自行 `.dev()`、或再包一层「会话级 Engine」取代 session。

## 三分职责（共识）

| 层 | 职责 | 不是它的事 |
| --- | --- | --- |
| **ProjectStore** | 装载结果的持有与图权威：`load`≈storeInfo、seed/merge/snapshot/query | 派 worker；Listr；HTTP/ws；产品 `.dev`；**管会话** |
| **BuildPipeline** | **编译承载面**（今日 `runBuild` 演进目标）：阶段顺序、预备、派 worker、materialize | 产品态组装；preview；**管会话**；长活听文件 |
| **session** | **产品承载面 + 唯一会话管理者** | 重写装载；图算法实现 |

因果链：

```text
session →（按次）BuildPipeline.run(options, store)
  → ProjectStore.load(...)
  → 预备（dist / config / npm）
  → workers（hydrate；深边；回传）
  → ProjectStore.merge(...)
  → materialize + publish
```

## 命名

| 名 | 结论 |
| --- | --- |
| GraphManager | **弃用** |
| **ProjectStore** | **采用**（状态管家） |
| **BuildPipeline** | **采用**（编译承载面对象；另见 build-pipeline Action） |
| 长活 Compiler/Engine | **不采用**（与 session 抢会话权） |

## 与今日代码的映射（现状 → 目标）

| 今日 | 目标 |
| --- | --- |
| `storeInfo()` | `store.load(...)` 内部手续或委托 |
| `ctx.dependencyGraph` + `stage-channel.merge` | **M-A（已确认）**：`ctx.dependencyGraph` 与 Store 持有图为**同一引用**；channel.merge 即写入 Store；无需阶段末回写 |
| `watch-runner` 闭包 `dependencyGraph` | **PS1**：保留镜像（W3）与 Store **双持**；**PS2**：删除闭包，Store 唯一 |
| `runBuild` 过程体 | `BuildPipeline.run`（build-pipeline 门） |
| `createBundler` | **仍为**唯一会话管理者；**即创建并持有** ProjectStore（load 按需） |

## 与兄弟工作的边界

| 工作 | 关系 |
| --- | --- |
| [`fe-tools-build-pipeline`../fe-tools-build-pipeline/README.md) | 抽阶段表 / Pipeline 对象；共用 D-PS-SESSION；调 Store（**已 complete 归档**） |
| graphDelta | Store.merge 输入形状；可后置 |
| TS-2 IR | deferred |

## 产品门

| 门 | 意图 |
| --- | --- |
| **PS0** | 本文 + design 共识 |
| **PS1** | 壳层 + 接线（**R1**）：`project-store`；session 持有/注入；watch 刀 A；`options.store` + **M-A**；闭包双持；**不含** PS2 / 阶段表 / `session.store` |
| **PS2** | **删除**闭包镜像；活图 **唯一**权威为 Store；plan 只读 Store；getter 收归另议 |
| **PS3** | 可选：订阅 / 轻量 metadata（供 preview 消费） |

## Status / 授权

- 当前 **`ready`**：需求 / 设计 v1 / 计划 / 验收 / 验证足以执行。  
- **未**授权改代码；升 `in_progress` 须另授，并按 RR3 记 nomap 基线。  
- 实施见 [implementation-plan.md](./implementation-plan.md)；与 BP **禁同 PR**（P5）。

## Documents

| 文档 | 作用 |
| --- | --- |
| [design.draft.md](./design.draft.md) | **冻结 v1**：分层、接线 RR4–RR6、API |
| [implementation-plan.md](./implementation-plan.md) | PS1 触达序（FR1） |
| [requirements.md](./requirements.md) | MUST（冻结） |
| [acceptance.md](./acceptance.md) | 验收 |
| [validation.md](./validation.md) | 验证计划 |
| [session-scheduling.draft.md](../../../fe-tools-sidecar/session-scheduling.draft.md) | session 调度 L1–L4 + W1–W4 |
