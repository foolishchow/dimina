# Implementation Plan — fe-tools-hmr-chain-residuals

Status: **in_progress（2026-10-09）**

> 前置：无 readiness blocker（D-HR-1/2/3 locked B/b/边界级）。依赖序：③∥R3 独立 → D-HR-2 → D-HR-3；D-HR-1 最大可并行先行。

## Step 0 — 准备

- [ ] 确认 H2 Phase 2 阶段函数 + registry 实现就位（`logicLoader` / `viewLoadModule` / `styleLoad`/`styleCompile`/`styleEmit` / `LoaderRegistryImpl`）
- [ ] 确认 F-HR-1..3 + ③a/b/c + R3 tracker 状态 open（draft 已入档）
- [ ] **实施期评项预研（D-HR-1 §2 待评）**：Loader 接口 vs storeInfo graph reconcile 衔接点——load 写图 vs storeInfo 写图唯一权威（PS2 约束）。选项 B 的 load 接线在 storeInfo 现有 graph 写入点内；衔接形状（Loader.dependencies → graph edge 写入点 vs storeInfo reconcile）须在 Step 1 前定型。**⚠️ one-shot 等价性为保证条件**——one-shot build() 也走 orchestrator（`index.ts:9` → orchestrator:189 `_store.load` 产 graph），Step 1 load 接线对 one-shot 同样生效；Loader 写图必须 == storeInfo.load graph 产出（one-shot diff=0 的核心保证）
- [ ] **view/style Loader 形状适配（D-HR-1 §2 待评②）**：logicLoader 是整段包装，view/style 是逐模块函数——两种形状共存于一 registry 的接口一致性方案定型
- [ ] **StageChannelContext 字段类型来源（R-HR-4 预研）**：`storeInfo` 字段类型来源未定——types.ts 现 import `emit.ts`/`dependency-graph.ts`（type-only，合规）；`storeInfo` 若需 `env.ts` 层类型 → 破“Packer 形状纪律：types.ts 不从 env.ts import”。须定型：从 `env.ts` 提取 `StoreInfo` 类型到 model/shared，或用 opaque/局部类型避免跨层 import

## Step 1 — D-HR-1 registry 接线（locked B）

| 文件 | 改动 | 要求 |
|---|---|---|
| `packer/orchestrator.ts` | load stage 前置经 `loaderRegistry.get(kind)` 取 Loader 执行发现（dependencies 写图）；衔接 storeInfo graph 权威（Step 0 预研落地） | R-HR-1 / A-HR1 |
| `packer/registry.ts` | view/style Loader 注册（`viewLoadModule`/`styleLoad` 经 Loader 接口适配——Step 0 形状适配落地） | R-HR-1 / A-HR1 |
| `packer/types.ts` | compile/emit registry 接口注册阶段函数（**dispatch 不接线**——供后续门；D-HR-1 B "生产 dispatch 仅 load"） | R-HR-1 / A-HR1 |
| 衔接点决策记录 | Loader 写图 vs storeInfo 写图唯一权威——D-HR-1-衔接 locked 形状记入 architecture-notes | 实施期评项闭合 |

**不改**：compile/emit 生产 dispatch（维持 worker 路径——非双路径 D-REG-1）；one-shot 创建点（`index.ts` / `build-pipeline.ts`）保持 undefined → no-op → diff=0。

## Step 2 — D-HR-2 L_HMR flag-gated（locked b）

| 文件 | 改动 | 要求 |
|---|---|---|
| `bin/dev.ts` | `--hmr` CLI option（默认 false）；env `DMCC_HMR=1` 备选通道 | R-HR-2 / A-HR2 |
| `session/resolve.ts` / `session/index.ts` | flag 透传 dev config → preview-adapter | R-HR-2 |
| `session/preview-adapter.ts:43` | `synthesizeReloadLevel({ ...watchCtx, buildId, enableHmr: flag })`（默认 false = 今日行为） | R-HR-2 / A-HR2 |
| tracker | D-PUSH-2 完整兑现（默认 true）激活条件——F-HR-2 fixed（通道补齐）+ 默认 true deferred（runtime 就绪后翻） | R-HR-7 |

**回退**：flag 关即回今日行为（无状态残留——flag 只影响 synthesizeReloadLevel 入参）。

## Step 3 — R-HR-4 ctx 类型收敛 + R-HR-5 下沉（小修，独立）

| 文件 | 改动 | 要求 |
|---|---|---|
| `packer/types.ts` | `StageChannelContext` typed interface 声明（~14 ctx 字段：viewCache/viewOrderList/styleCache/invalidatedModules/cache/buildModel/storeInfo/dependencyGraph/pages/allPages/compileConfig/sourcemap/sourcemapTargetPath/compatibilityWarnings）——types.ts 纯形状层（不从 env.ts import，Packer 形状纪律） | R-HR-4 / A-HR4 |
| `compiler/pipeline/stage-channel.ts` | ctx 字段断言收敛（删 `ctx as { ... }` 改 typed 引用；**result/task 局部窄化不动**——非边界 typing） | R-HR-4 / A-HR4 |
| `packer/orchestrator.ts` | 同 ctx 字段断言收敛 | R-HR-4 / A-HR4 |
| `model/`（新或 shared） | `COMPILE_STAGE_ORDER` **定义点**迁 model（`compile-target.ts:21` → model）；`compile-target.ts` 内部引用同步 | R-HR-5 / A-HR5 |
| `model/invalidation.ts:69` + `compiler/pipeline/compile-stages.ts:1` | 全消费点 import 改 model（`compiler/pipeline` import = 0 in model；compile-stages import 改 model） | R-HR-5 / A-HR5 |

**不改**：`result as`/`task as`/`loadBindings as` 局部窄化（非 R3 范围）；`model/compile-cache.ts:5`（③b residual——D-HR-1 后续门评）；`model/convergence.ts:3`（③c type-only——runtime 无害）。

**行为 0 局部保证**：R-HR-4 是类型改动（typed interface 替代 as-assertion，erased at runtime）+ R-HR-5 是常量迁移（import 路径改，运行时语义不变）→ one-shot 产物字节恒等（P-HR6 全局验）。

## Step 4 — D-HR-3 selective 链路级测试（locked 边界级）

| 文件 | 改动 | 要求 |
|---|---|---|
| 新 `__tests__/view-selective-stages.spec.js` | 两轮 build 经 stage-channel 边界：① priming（viewCache/orderList 长驻——复用 `view-selective-recompile.spec.js` 既有的 `state.viewCache = new Map()` + `build(..., { state })` 模式，IRC R1 接线保证 watch 生产 path 同）② invalidate（`invalidatedModules`）；断言 (a) selective flag 触发 (b) pageBundles 只含 dirty 子集 + orderList 全量 (c) pageBundles（dirty 子集 + cached clean 经 orderList 组装）与全量重编 pageBundles 字节恒等 (d) dirty 子集规模（IPC 经济 dump 断言） | R-HR-3 / A-HR3 |

**不起进程**（避 flaky——compile-cli-cache 先例）；覆盖 worker 序列化边界（msg → viewCompile → pageBundles → stage-channel 消费全链）。

## Step 5 — 验证（P-HR1..7）

- [ ] P-HR1 `grep -rn "loaderRegistry\.\(get\|kinds\)" src/`（非零且非测试）+ kinds/get 单测断言（logic/view/style）
- [ ] P-HR2 L_HMR flag 两态单测：默认关 payload == baseline（dev-reload.spec.js 既有 18 tests + H4 L_HMR 4 tests，复用/扩展）；开 + 增量（stages>0，非限定单 kind——dev-reload.ts:62） → L_HMR + changedStages + affectedPages
- [ ] P-HR3 view-selective-stages.spec.js pass（触发/子集/字节三断言）
- [ ] P-HR4 `grep -n "ctx as {" src/compiler/pipeline/stage-channel.ts src/packer/orchestrator.ts` ctx 字段全部经 typed 边界（grep ctx as { 在 ctx 字段集 = 0；result/task 局部窄化不计）
- [ ] P-HR5 `grep -n "pipeline/" src/model/invalidation.ts` = 0
- [ ] P-HR6 行为 0 三件套：`tsc --noEmit` 0 + vitest 全绿 + 6 项目 one-shot `diff -r` = 0
- [ ] P-HR7 tracker 状态更新：close 时 F-HR-1/3 fixed + R3 fixed + ③a fixed（③b/③c open）+ F-HR-2 fixed（通道补齐）+ 默认 true deferred（runtime 就绪）；证据链接

## Step 6 — close

- [ ] architecture-notes 回流（D-HR-1 衔接形状 + D-HR-2 激活条件 + R-HR-4 typed 边界 + R-HR-5 下沉）
- [ ] STATUS/TODO/archive 同步；validator 0/0
- [ ] residuals tracker：F-HR-1..3 fixed；R3 fixed；③a fixed（③b/③c open）；F-HR-2 **fixed（通道补齐）+ 默认 true deferred（runtime 就绪）**

## 依赖序图

```
Step 0（预研）─┬─→ Step 1（D-HR-1，M，最大）──┐
              └─→ Step 3（R-HR-4 + R-HR-5，独立）─┤
                                              Step 4（D-HR-3）→ Step 5 → Step 6
Step 2（D-HR-2，S）────────────────────────────┘
```

Step 1/2/3 可并行；Step 4 依赖 Step 1/2/3 产物（selective 触发需 registry + flag 稳态）；Step 5 全依赖；Step 6 收口。
