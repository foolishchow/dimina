# ProjectStore — technical design

Action: `fe-tools-project-store`  
Status: **已冻结 v1（2026-09-12）** — Action **`ready`**；**未**授权实施（须升 `in_progress`）  
Naming: **ProjectStore**（不用 GraphManager）  
Sibling: [`fe-tools-build-pipeline`../fe-tools-build-pipeline/README.md)（**BuildPipeline**）

> 契约变更须同步 requirements / acceptance / README。字段名允许同义微调（RR11），ready 后改名须改 acc。

## 1. 核心命题

```text
ProjectStore  ≠  今日 storeInfo 函数
ProjectStore  =  「storeInfo 所建立状态」的管理器（管家）
```

`storeInfo` 是动词（手续）；ProjectStore 是名词（持有者）。

## 2. 会话管理（D-PS-SESSION）

> **Session（`createBundler`）是唯一会话管理者。**  
> ProjectStore / BuildPipeline 是会话的部件，不是第二会话。

```text
Session（唯一会话管理者）
  ├─ owns: Resolved, lifecycle, activeLoop
  ├─ owns: state.store = createProjectStore()   // RR5；createBundler 即有；始终有实例
  ├─ uses:  BuildPipeline                       // 每次 build/rebuild 按次
  └─ owns?: PreviewAdapter                      // 仅 .dev
```

| 模式 | ProjectStore | BuildPipeline |
| --- | --- | --- |
| `.build()` | session **已持有**；按需 `load`（可覆盖） | **按次** |
| `.watch()` / `.dev()` | **同一实例**继续持有；rebuild 按策略 load/更新 | 每次 rebuild **按次** `run(plan)` |

**确认：** 任何 session 都创建 Store；**load 按需**；非进程单例。  
**不采用：** 会话级长活 Compiler/Engine；Pipeline/Store 自行管 activeLoop 或 preview。

## 3. 三分面

```text
session          产品承载面 + 唯一会话管理者
    │ 持有/注入 ProjectStore；按次创建 BuildPipeline
    ▼
BuildPipeline    编译承载面（今日 runBuild 演进）
    │ load / merge
    ▼
ProjectStore     工程上下文 + 依赖图权威
    │ snapshot
    ▼
worker           hydrate + 变换 + 本地补边 → 回传图
```

### ProjectStore 做 / 不做

**做：** `load`≈storeInfo；图 seed/merge/snapshot/query；（**PS1**）与 watch 闭包**双持**；（**PS2**）成为唯一活图权威；（PS3 可选）变更通知供 preview **消费**。  
**不做：** worker、dev-server、Listr、`.dev()` 组装、**会话管理**。

### BuildPipeline 做 / 不做

**做：** 阶段顺序；预备 dist/config/npm；派 worker；materialize；调用 Store。  
**不做：** 长活听文件、preview、**会话管理**。

### session 做

产品 API；activeLoop；preview-adapter；**唯一**决定 Store/Pipeline 的创建与持有策略。

## 4. 最小 API（RR11）

落点：`fe/tools/bundler/src/model/project-store.js`（**P1**）

```text
createProjectStore() -> ProjectStore

ProjectStore.load(workPath, { fileTypes?, dependencyGraph? })
  // PS1：内部调用今日 storeInfo + ALS；不改对外 getter 语义（P2）
  // RR10：L2 旧图经 options.dependencyGraph（对齐今日）

ProjectStore.snapshot()
ProjectStore.merge(graphJson)      // PS1：全量（P4）
ProjectStore.getDependencyGraph()  // 与 ctx 同引用（M-A）
```

### 接线（RR4 / RR5 / RR6）

| 项 | 冻结 |
| --- | --- |
| **RR4** | `build()` / `runBuild` 经包内私有 **`options.store`** 接收；session 传 `state.store`；无则 L3 临时 `createProjectStore()`；测例可用 `build({ store })` 验 M-A，**不**需 `session.store` |
| **RR5** | session 内部字段 **`state.store`**（不对外暴露） |
| **RR6** | `load` 后 Store 持有活图实例；`ctx.dependencyGraph = store.getDependencyGraph()`；**禁止**再 `new DependencyGraph` 挂 ctx |
| **FR2** | `build:start` 载荷可序列化：除 `dependencyGraph` / `lifecycle` 外，**须剥离 `store`**（实例不得进入事件） |
| **FR7** | `resolveCompileConfig({ apiOptions: options })` **忽略** `store`（及既有非 compile 字段）；不把 store 当编译配置 |

### Merge（**M-A**）

`Object.is(ctx.dependencyGraph, store.getDependencyGraph())`；`stage-channel.merge` 即写 Store。不采用 M-B/M-C。

**不**加入 `package.json` `exports`（**P3**）。Worker 只 hydrate 快照。

## 5. 今日管理权（备忘）

| 阶段 | 今日 | 目标归属 |
| --- | --- | --- |
| 种子 / 装载 | `storeInfo` | ProjectStore.load |
| 单次图权威 | `ctx.dependencyGraph` | **M-A** 同引用 |
| 深边 | worker 本地图 | 仍 worker；merge 经 ctx |
| watch 活图 | watch-runner 闭包 | **PS1** 双持；**PS2** 仅 Store |
| 会话 | createBundler | 仍为唯一管理者 |
| 阶段编排 | runBuild 过程体 | BuildPipeline |

## 6. 与 build-pipeline

- 正交：状态 vs 阶段表  
- **RR7**：实施 **PS1 略先**；可平行；**禁同 PR（P5）**  
- **RR8**：两门可 **分升** ready（PS 不依赖 stages）

## 7. 已确认决策表

| ID | 结论 |
| --- | --- |
| **P1–P6** | 落点；薄包装；无 exports；全量 merge；禁混 PR；`build()`+Listr |
| **M-A / R1–R4** | 同引用；文件清单；挂 ctx≠BP1；无 session.store；cache Non-goal |
| **L1–L4 / W1–W4** | 见 session-scheduling |
| **RR4–RR8** | options.store；state.store；禁 new 挂 ctx；PS1 略先；可分升 ready |
| **RR9–RR12** | A1 零改；L2 旧图形状不变；API 名见 §4；伞不随升 |

## 8. 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-12 | 初稿 → 讨论共识 → Acc Round 2 |
| 2026-09-12 | **冻结 v1**：Readiness Round 3 RR1–RR12 |
| 2026-09-12 | Final Readiness：FR2（剥 store）/ FR7；[implementation-plan.md](./implementation-plan.md) |
