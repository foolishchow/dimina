# BuildPipeline — technical design

Action: `fe-tools-build-pipeline`  
Status: **已冻结 v1（2026-09-12）** — Action **`ready`**；**未**授权实施（须升 `in_progress`）  
Naming: **BuildPipeline**（`runBuild` 可为薄门面）

> 契约变更须同步 requirements / acceptance / README / [stages.md](./stages.md)。

## 1. 核心命题

```text
BuildPipeline  =  有结构的「一次编译」执行载体（编译承载面）
ProjectStore   =  有状态的工程/图管家（可跨 rebuild）
Session        =  唯一会话管理者（产品面）
```

`runBuild` 今日是过程体 → 目标是 Pipeline 对象（或 `pipeline.run`），**不是**第二个会话、**不是** Store。

## 2. 会话原则

> **Session（`createBundler`）是唯一会话管理者。**

```text
Session
  ├─ state.store = createProjectStore()   // RR5；始终有；load 按需
  ├─ PreviewAdapter?                      // .dev
  └─ each build: BuildPipeline({ store }).run(options)   // 按次；不长活挂 session
```

## 3. Pipeline 做什么 / 不做什么

**做：** 阶段顺序与条件；调用 Store.load（有 store 时）；预备 dist/config/npm；派 worker；materialize；触发既有 A1 lifecycle（**RR9** 零改语义）。  
**不做：** 跨 watch 活图；chokidar；dev-server；插件总线；会话管理。

## 4. 形态（RR11）

落点：`fe/tools/bundler/src/compiler/build-pipeline.js`（**P1**）

```text
createBuildPipeline({ store, lifecycle }) -> pipeline

pipeline.run({
  targetPath, workPath, useAppIdDir,
  compileConfiguration / options,
  affectedEntries?, stages?, seedPath?,
  prepareConfig?, prepareNpm?,
}) -> buildResult
```

- **BP1**：阶段表抽出；**仍用 Listr（P6）**  
- 对外：**`build()` 唯一公开编译入口**；经 **`options.store`（RR4）**；Pipeline **不**稳定 export  
- 权威阶段表：[stages.md](./stages.md)（**RR1** 已迁）

### M-A（保持，非本门独创）

有 store：`ctx.dependencyGraph = store.getDependencyGraph()`（**RR6**）；无 store：临时 create（L3）。PS1 仅挂 ctx **≠** BP1 交付（R2）。  
**FR2**：`build:start` 须剥 `store`（与 graph/lifecycle 同列）。

## 5. 与 ProjectStore

| | ProjectStore | BuildPipeline |
| --- | --- | --- |
| 落点 | `src/model/project-store.js` | `src/compiler/build-pipeline.js` |
| 首刀 | PS1 壳 + 刀 A + M-A | BP1 抽阶段表 + Listr |
| 顺序 | **RR7** 略先 | 可后或平行；**禁同 PR** |
| ready | **RR8** 可先升 | 等 RR1（已满足）后可升 |

## 6. 已确认决策表

| ID | 结论 |
| --- | --- |
| **P1 / P5 / P6** | 落点；禁混 PR；build()+Listr |
| **R2 / R4** | 挂 ctx≠BP1；cache Non-goal |
| **RR1** | stages.md 为本门 inventory 权威 |
| **RR3** | nomap 基线 = 升 in_progress 前 HEAD（实施时写入 validation） |
| **RR4–RR12** | 同 ProjectStore design §7 |

## 7. 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-12 | 初稿 → 讨论共识 → Acc Round 2 |
| 2026-09-12 | **冻结 v1**；迁 [stages.md](./stages.md)（RR1） |
| 2026-09-12 | Final Readiness：FR1 plan / FR2 / FR3；[implementation-plan.md](./implementation-plan.md) |
