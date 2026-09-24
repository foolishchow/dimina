# Design Draft — fe-tools-packer-directory-convergence

Status: **complete（2026-10-09）**

## §1 问题诊断（来自 [retrospect](../../../../fe-tools/2026-10-09-packer-facade-aspect-retrospect.md)）

### 1.1 packer 域散落全景

| 当前位置 | 文件 | 域 | 问题 |
| --- | --- | --- | --- |
| `packer/` (6) | types, orchestrator, registry, session-state, graph, config-fixpoint | packer ✓ | 已就位（但无子目录） |
| `model/` (9) | dependency-graph, build-model, module-result-cache, fingerprint, invalidation, convergence, project-store, compile-cache, stage-order | **全 packer** | 命名误导——无独立 "model" 层 |
| `compiler/pipeline/` (9) | compile-target(.types), compile-stages, stage-channel, emit(-engine/-worker-entry), config-compiler, publish | **全 packer** | 名实不符——是 packer 编排非 compiler |
| `compiler/worker-runtime/` (7) | runtime, executor, define-engine, context, async-context-store, loggers, sinks | **全 packer** | D-PCS-8 通用 worker 是 packer 派发机制 |
| `compiler/core/` (8, 混合) | renderers, npm-builder, env, compatibility | packer | 混合袋——packer 域 + shared/compiler 混杂 |
| `compiler/core/` | sourcemap, expression-parser, compatibility-reference | shared | 应去 shared/ |
| `compiler/logic,view,style/` | per-kind transforms | **compiler 域** | 留 compiler/（不迁） |

**散落数**：packer 域 ~27 文件散在 4 处 + core/ 混合袋。

### 1.2 散落后果

1. **跨层 import 温床**（③b/③c residual；③a 已 fixed）：
   - ③a `model/invalidation.ts:69` → `compiler/pipeline/compile-target`（COMPILE_STAGE_ORDER）—— chain-residuals 已 fixed（迁 model/stage-order）
   - ③b `model/compile-cache.ts:5` → `compiler/pipeline/compile-stages`（runtime）
   - ③c `model/convergence.ts:3` → `compiler/pipeline/emit`（type-only）
   - 根因：model/ 与 compiler/pipeline/ 未按域收敛，反向 import
2. **D/C 重构缺干净素材**：D（collaborator 抽取）/ C（aspect）从散落 4 处拼凑，blast radius 不可控
3. **北星 6 组件无物理落地**：types.ts 声明 6 组件，目录结构未对应——类型层是文档，物理结构是现实

## §2 设计门（**formalize locked 2026-10-09**；D-DC-1..5 锁定）

### D-DC-1 — 子目录 mirror 北星 6 组件形状（locked）

子目录结构对应 packer README "6 组件形状" + 支撑结构：

| 子目录 | 北星组件 | 内容 |
| --- | --- | --- |
| `graph/` | ② Graph | graph.ts + config-fixpoint.ts + dependency-graph.ts |
| `store/` | ① PackerContext | env.ts（ALS impl）+ project-store.ts |
| `registry/` | ④ 3 registry + renderer 派发 | dispatch.ts（拆自 registry.ts）+ lce.ts（拆自 registry.ts）+ renderers.ts |
| `state/` | ⑤ OrchestratorState + pipeline ctx | session-state.ts + stage-channel.ts |
| `cache/` | OrchestratorState 支撑 | module-result-cache.ts + compile-cache.ts + fingerprint.ts + invalidation.ts |
| `emit/` | D-PCS-7 Emitter 域 | emit.ts + emit-engine.ts + emit-worker-entry.ts + build-model.ts + convergence.ts + publish.ts |
| `worker/` | D-PCS-8 通用 worker | runtime/executor/define-engine/context/async-context-store/loggers/sinks |
| `pipeline/` | stage 编排支撑 | compile-target(.types) + compile-stages + config-compiler + stage-order |
| `aspect/` | C 轮 aspect home（预留） | compatibility.ts |

顶层留：`types.ts`（北星形状）+ `orchestrator.ts`（PackerOrchestrator）+ `README.md`

### D-DC-2 — 纯搬迁红线（无逻辑改）（locked）

**红线**：本 Action 只做文件位置搬迁 + import 路径改写。函数体、逻辑、类型签名**不动**。**文件拆分允许** IF 函数体逐字搬迁（无合并/改签名）——`registry.ts → dispatch.ts + lce.ts` 是结构归位非逻辑改。验证：
- tsc 0（路径改写后类型检查）
- 6 项目 diff=0（逻辑零改 → 产物字节不变）
- 函数体 git diff 机械 check（`git diff -M` + 非 import 删除行=0；非旧 `--stat` 行数估）

**禁止**：借机重构函数体 / 改类型 / 抽 collaborator / 抽 aspect（那是 D/C 轮）。若搬迁中发现需重构，记入 tracker residual，不在本 Action 做。

### D-DC-3 — 分批搬迁序（按依赖序 + 每批行为 0 gate）（locked）

按子目录依赖序（底层先行），每批 tsc + vitest + 6 项目 diff 行为 0 gate：

| 批 | 子目录 | 文件 | 依赖说明 |
| --- | --- | --- | --- |
| B1 | `graph/` + `store/` | graph.ts, config-fixpoint.ts, dependency-graph.ts, env.ts, project-store.ts | 底层（graph + I/O），无 packer 内部依赖 |
| B2 | `cache/` + `registry/` | module-result-cache, compile-cache, fingerprint, invalidation + registry.ts 拆 dispatch/lce + renderers | 依赖 graph/store |
| B3 | `emit/` + `worker/` | emit(-engine/-worker-entry), build-model, convergence, publish + worker-runtime 7 文件 | 依赖 cache/registry + worker |
| B4 | `pipeline/` + `state/` | compile-target(.types), compile-stages, config-compiler + session-state, stage-channel | 依赖 emit/worker |
| B5 | `aspect/` | compatibility.ts（+ core/ 解体：sourcemap/expression-parser 去 shared/compiler） | 收尾 |

每批结束：tsc 0 + vitest 全绿 + 6 项目 diff=0（行为 0 gate）+ grep 验子目录归位。

**⚠️ 原子性红线（stateful module 搬迁）**：env.ts / compatibility.ts / renderers.ts 含 module-level mutable state——**dual-instance 陷阱**：每批搬此类文件须**单 commit 原子**完成（① 更新全 static import 路径 ② 更新全 dynamic `import('...')` 字符串路径 ③ 删旧文件），不留中间态。旧文件若残留 + 新旧路径并存 → ESM 双实例 → ALS state 隔离 → 行为破（vitest 会 catch 但须 prevent）。验：`grep -rn "compiler/core/env" src/ __tests__/` = 0（旧路径全清）。

### D-DC-4 — packer→compiler 跨域依赖保留（locked）

搬迁后 `compiler/logic|view|style/` 仍 import `packer/store/env.ts` 等——**这是真依赖**（domain 用 I/O 环境 + graph + worker），非散落。packer 提供 I/O 给 compiler 域消费，**方向正确**（packer→compiler 单向）。保留，不消除。

**验证方向**：`grep -rn "from '.*packer/" src/compiler/logic src/compiler/view src/compiler/style` 非零且方向单向（packer→compiler）。反向（compiler→packer 内部非 I/O）须消除。

### D-DC-5 — compiler per-kind 子结构不动（locked）

本 Action 只收敛 packer 域 + 解体 `compiler/core/`。`compiler/logic|view|style/` 内部子结构调整（parse-walk 拆分 / registry-impl 形状等）**不在本 Action**——留待后续（D/C 轮或独立 Action）。

## §3 收敛映射（完整表）

### 3.1 packer/ 子目录归位

| 目标 | 源文件 | 北星组件 |
| --- | --- | --- |
| `packer/types.ts` | `packer/types.ts`（留） | 北星形状 |
| `packer/orchestrator.ts` | `packer/orchestrator.ts`（留） | PackerOrchestrator |
| `packer/graph/graph.ts` | `packer/graph.ts` | ② Graph |
| `packer/graph/config-fixpoint.ts` | `packer/config-fixpoint.ts` | ② Graph |
| `packer/graph/dependency-graph.ts` | `model/dependency-graph.ts` | ② Graph |
| `packer/graph/npm-resolver.ts` | `compiler/core/npm-resolver.ts` | path resolution（config-fixpoint 消费） |
| `packer/store/env.ts` | `compiler/core/env.ts` | ① PackerContext |
| `packer/store/project-store.ts` | `model/project-store.ts` | ① PackerContext |
| `packer/registry/dispatch.ts` | `registry.ts` 拆（PackerDispatchRegistry + computeStagePlan + readLoadBindings） | ④ registry |
| `packer/registry/lce.ts` | `registry.ts` 拆（Loader/Compile/Emit RegistryImpl） | ④ registry |
| `packer/registry/renderers.ts` | `compiler/core/renderers.ts` | ④ renderer 派发 |
| `packer/state/session-state.ts` | `packer/session-state.ts` | ⑤ OrchestratorState |
| `packer/state/stage-channel.ts` | `compiler/pipeline/stage-channel.ts` | ⑤ pipeline ctx |
| `packer/cache/module-result-cache.ts` | `model/module-result-cache.ts` | cache |
| `packer/cache/compile-cache.ts` | `model/compile-cache.ts` | cache |
| `packer/cache/fingerprint.ts` | `model/fingerprint.ts` | 失效 |
| `packer/cache/invalidation.ts` | `model/invalidation.ts` | 失效 |
| `packer/emit/emit.ts` | `compiler/pipeline/emit.ts` | D-PCS-7 |
| `packer/emit/emit-engine.ts` | `compiler/pipeline/emit-engine.ts` | D-PCS-7 |
| `packer/emit/emit-worker-entry.ts` | `compiler/pipeline/emit-worker-entry.ts` | D-PCS-7 |
| `packer/emit/build-model.ts` | `model/build-model.ts` | emit 装配 |
| `packer/emit/convergence.ts` | `model/convergence.ts` | emit 装配 |
| `packer/emit/publish.ts` | `compiler/pipeline/publish.ts` | emit 物化 |
| `packer/worker/runtime.ts` | `compiler/worker-runtime/runtime.ts` | D-PCS-8 |
| `packer/worker/executor.ts` | `compiler/worker-runtime/executor.ts` | D-PCS-8 |
| `packer/worker/define-engine.ts` | `compiler/worker-runtime/define-engine.ts` | D-PCS-8 |
| `packer/worker/context.ts` | `compiler/worker-runtime/context.ts` | D-PCS-8 |
| `packer/worker/async-context-store.ts` | `compiler/worker-runtime/async-context-store.ts` | D-PCS-8 |
| `packer/worker/loggers.ts` | `compiler/worker-runtime/loggers.ts` | D-PCS-8 |
| `packer/worker/sinks.ts` | `compiler/worker-runtime/sinks.ts` | D-PCS-8 |
| `packer/pipeline/compile-target.ts` | `compiler/pipeline/compile-target.ts` | stage 编排 |
| `packer/pipeline/compile-target.types.ts` | `compiler/pipeline/compile-target.types.ts` | stage 编排 |
| `packer/pipeline/compile-stages.ts` | `compiler/pipeline/compile-stages.ts` | stage 编排 |
| `packer/pipeline/config-compiler.ts` | `compiler/pipeline/config-compiler.ts` | stage 编排 |
| `packer/pipeline/stage-order.ts` | `model/stage-order.ts` | COMPILE_STAGE_ORDER 常量（**formalize 锁**：放 pipeline/ 非 cache/——2/3 消费者在 pipeline + 概念属 stage 编排 + 最小跨子目录 import=1 vs cache/ 的 2） |
| `packer/aspect/compatibility.ts` | `compiler/core/compatibility.ts` | C 轮 home |

### 3.2 compiler/core/ 解体

| 源文件 | 目标 | 说明 |
| --- | --- | --- |
| `core/renderers.ts` | `packer/registry/renderers.ts` | renderer 派发（packer） |
| `core/npm-resolver.ts` | `packer/graph/npm-resolver.ts` | path resolution（config-fixpoint 主消费，graph 域） |
| `core/npm-builder.ts` | `packer/pipeline/npm-builder.ts` | orchestration sub-step（imports env，intra-packer） |
| `core/env.ts` | `packer/store/env.ts` | I/O 环境（ALS impl） |
| `core/compatibility.ts` | `packer/aspect/compatibility.ts` | aspect |
| `core/sourcemap.ts` | `shared/sourcemap.ts` | sourcemap 工具（shared infra） |
| `core/expression-parser.ts` | `shared/expression-parser.ts` | transform util（shared infra；不建 compiler/utils/ 以守 D-DC-5） |
| `core/compatibility-reference.ts` | `shared/compatibility-reference.ts` | reference data（shared infra） |

### 3.3 compiler/ 收敛后

```
src/compiler/
  ├─ logic/   (index, parse-walk, transform, registry-impl, worker-entry)
  ├─ view/    (index, parse-walk, worker-entry, wxml/*)
  └─ style/   (index, parse-walk, emit, worker-entry)
```

## §4 风险评估

| 维度 | 评估 |
| --- | --- |
| 规模 | ~27 文件迁移 + ~100+ import 路径改写（含 `__tests__/` 10+ spec 导入被搬路径——env/renderers/compatibility/dependency-graph 等同步更新） |
| blast radius | env.ts（22 导入方：17 compiler + 1 model + 4 packer）+ `__tests__/`（10+ spec 导入被搬路径）/ compatibility.ts（5）/ emit.ts（9）—— 实测值 |
| 行为 0 | critical（ESM 显式后缀 + tsc 全量验）；但 diff=0 应成立（逻辑零改，只 import 行变） |
| 分批 | 5 批（B1-B5），每批行为 0 gate，避免一次性大爆炸 |
| 回退 | 每批独立 commit，可单批 revert |
| 预存逻辑环 | packer/graph ↔ packer/store（graph→store `import type` PageConfig/ComponentConfig erased；store→graph runtime PackerGraph/DependencyGraph/config-fixpoint）—— 搬迁后 intra-packer 不恶化（type-only 经 `import type` + node strip-types erased，runtime 无环）。非本 Action 引入，记录为已知 |

## §5 与既有 residual 关系

| 本 Action | 既有 residual |
| --- | --- |
| R-DC-7 ③b/③c 消解 | ③a 已 fixed（chain-residuals，非本 Action）；③b/③c 本 Action 同域归位消解 |
| 目录收敛 | F-PA-1..6 散落温床解（设计模式缺陷本体留 D/C 轮） |
| 北星 6 组件物理落地 | types.ts 北星 → 目录对应（D-PCS 形状落地） |

## §6 已闭合项（R1 review 修正）

- npm-builder → `packer/pipeline/npm-builder.ts`（orchestration sub-step，imports env → intra-packer）
- expression-parser → `shared/expression-parser.ts`（不建 compiler/utils/，守 D-DC-5）
- compatibility-reference → `shared/compatibility-reference.ts`
- sourcemap → `shared/sourcemap.ts`
- build-pipeline.ts：**phantom**——源文件不存在（4 处引用全为注释；file 早已删，逻辑迁入 orchestrator.ts:4 自承）。从收敛表删除
- stage-order.ts → `packer/pipeline/stage-order.ts`（补入 §3.1）
