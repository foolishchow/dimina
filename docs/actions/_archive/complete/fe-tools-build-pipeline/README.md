# FE Tools Build Pipeline

- Action: `fe-tools-build-pipeline`
- Status: `complete`
- Updated: 2026-09-12（BP1 已交付并归档；A-BP01..05 全 pass，消融 ×1）
- Status authority: [Action Status../../../STATUS.md)
- 关系：独立结构 Action。与 [`fe-tools-project-store`../../../fe-tools-project-store/README.md) **正交**（状态 vs 阶段执行）；总览 [`architecture-notes.md`../../../fe-tools-sidecar/architecture-notes.md)；同属 [`fe-tools-sidecar`../../../fe-tools-sidecar/README.md) 近端结构债。session 边界对齐已归档 [`fe-tools-bundler-session`](../fe-tools-bundler-session/README.md)。
- 工作分支：`feature/fe-tools-sidecar`
- 设计权威：[design.draft.md](./design.draft.md)（**已冻结 v1**）；阶段表权威：[stages.md](./stages.md)（RR1）

## Background

`runBuild`（`src/index.js`）已是硬编码流水线（init → concurrent compile → publish），并挂 A1 lifecycle；session 只**委托** `build()`。痛点是控制流挤在过程函数里，缺少可指认的「编译承载面」对象。

阶段 inventory 权威：[stages.md](./stages.md)（自归档 session `stages.draft` 迁入并改 layout 路径）。

## Goal

1. 将今日 `runBuild` 演进为 **`BuildPipeline`**（编译承载面）：阶段可指认、可注入 `ProjectStore`、行为 0 变化  
2. **按次实例**（单次 build 内有身份；不跨 watch 长活）  
3. 保留薄函数门面 `build()` / `runBuild` 亦可（内部转调 Pipeline）  
4. **不**抢 session 的会话管理权（见下「会话原则」）

## Non-goals

- 插件 / `replaceStage` API  
- 长活 Compiler/Engine 替代 session  
- 实现 ProjectStore（兄弟 Action）  
- preview / dev-server / reload  
- TS-2 IR；SharedArrayBuffer  
- 改增量语义（首刀等价抽取）  
- compile-cache / fingerprint（**R4**）  
- PS2 删闭包；ProjectStore 实现（兄弟门；可注入已有 store）

## 会话原则（与 ProjectStore 共同 · D-PS-SESSION）

> **Session（`createBundler`）是唯一会话管理者。**  
> `ProjectStore` / `BuildPipeline` 不升级为会话；它们是会话拥有或按次使用的部件。  
> 总览：[architecture-notes.md../../../fe-tools-sidecar/architecture-notes.md)

| 模式 | ProjectStore | BuildPipeline |
| --- | --- | --- |
| `.build()` | session **已持有**（createBundler 即有）；按需 `load` | **按次** `run` |
| `.watch()` / `.dev()` | **同一 Store 实例** | 每次 rebuild **按次** `run(plan)` |

禁止：再引入第三种会话级 Engine 抢 `activeLoop` / `.dev` 组装。  
**确认（2026-09-12）：** 任何 session 都创建 Store；load 按需；非进程单例。

## 三分面（同 ProjectStore）

```text
Session（唯一会话管理者）
  ├─ owns: Resolved, lifecycle, activeLoop, preview?
  ├─ owns: ProjectStore           // createBundler 即有；始终持有
  └─ uses:  BuildPipeline.run()   // 每次编译按次
```

## 命名

| 名 | 结论 |
| --- | --- |
| `runBuild`（仅过程） | 可保留为门面 |
| **BuildPipeline** | **采用**（叙事与模块名） |
| BuildRunner | 弱化阶段表，不首选 |
| 长活 Compiler/Engine | **不采用**（与 session 冲突） |

## 产品门

| 门 | 意图 |
| --- | --- |
| **BP0** | 本文 + design 共识 |
| **BP1** | 声明阶段表 + `compiler/build-pipeline` + `run`；仍用 Listr；`build()` 门面；行为 0 变化 |
| **BP2** | 可选：与 Listr 解耦的可测 runner |

## Status / 授权

- **BP1 已交付（2026-09-12）**：`src/compiler/build-pipeline.js`（createBuildPipeline({store, lifecycle}).run）+ index.js 薄委托；Listr 仍在；行为 0（nomap 94 / sourcemap 185 diff=0，对照 aa6b6508）；485 tests / 73 suites 全绿。证据见 [validation.md](./validation.md)（含 M-A 消融 §A）。
- 已 **complete / 归档**；实施证据对应审查后修订 `f1a2e591`。
- 实施见 [implementation-plan.md](./implementation-plan.md)；与 PS **禁同 PR**（P5）；PS1 已先行（`aa6b6508`）。

## Documents

| 文档 | 作用 |
| --- | --- |
| [design.draft.md](./design.draft.md) | **冻结 v1**：Pipeline 形态与边界 |
| [stages.md](./stages.md) | 阶段 inventory 权威（RR1） |
| [implementation-plan.md](./implementation-plan.md) | BP1 触达序（FR1） |
| [requirements.md](./requirements.md) | MUST（冻结） |
| [acceptance.md](./acceptance.md) | 验收 |
| [validation.md](./validation.md) | 验证计划 |
| [session-scheduling.draft.md../../../fe-tools-sidecar/session-scheduling.draft.md) | session 调度 L1–L4 + W1–W4 |
