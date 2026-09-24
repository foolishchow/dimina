# Design Draft — fe-tools-packer-directory-convergence

Status: **draft（2026-10-09）**

## §1 问题诊断（来自 [retrospect](../../fe-tools/2026-10-09-packer-facade-aspect-retrospect.md)）

### 1.1 packer 域散落全景

| 当前位置 | 文件 | 域 | 问题 |
| --- | --- | --- | --- |
| `packer/` (6) | types, orchestrator, registry, session-state, graph, config-fixpoint | packer ✓ | 已就位（但无子目录） |
| `model/` (9) | dependency-graph, build-model, module-result-cache, fingerprint, invalidation, convergence, project-store, compile-cache, stage-order | **全 packer** | 命名误导——无独立 "model" 层 |
| `compiler/pipeline/` (10) | compile-target(.types), compile-stages, stage-channel, emit(-engine/-worker-entry), config-compiler, publish, build-pipeline | **全 packer** | 名实不符——是 packer 编排非 compiler |
| `compiler/worker-runtime/` (7) | runtime, executor, define-engine, context, async-context-store, loggers, sinks | **全 packer** | D-PCS-8 通用 worker 是 packer 派发机制 |
| `compiler/core/` (8, 混合) | renderers, npm-builder, env, compatibility | packer | 混合袋——packer 域 + shared/compiler 混杂 |
| `compiler/core/` | sourcemap, expression-parser, compatibility-reference | shared/compiler | 应去 shared/ 或 compiler/utils/ |
| `compiler/logic,view,style/` | per-kind transforms | **compiler 域** | 留 compiler/（不迁） |

**散落数**：packer 域 ~27 文件散在 4 处 + core/ 混合袋。

### 1.2 散落后果

1. **跨层 import 温床**（③a/b/c residual）：
   - ③a `model/invalidation.ts:69` → `compiler/pipeline/compile-target`（COMPILE_STAGE_ORDER）—— chain-residuals 已 fixed（迁 model/stage-order）
   - ③b `model/compile-cache.ts:5` → `compiler/pipeline/compile-stages`（runtime）
   - ③c `model/convergence.ts:3` → `compiler/pipeline/emit`（type-only）
   - 根因：model/ 与 compiler/pipeline/ 未按域收敛，反向 import
2. **D/C 重构缺干净素材**：D（collaborator 抽取）/ C（aspect）从散落 4 处拼凑，blast radius 不可控
3. **北星 6 组件无物理落地**：types.ts 声明 6 组件，目录结构未对应——类型层是文档，物理结构是现实

## §2 设计门（draft 提议，formalize 锁定）

### D-DC-1 — 子目录 mirror 北星 6 组件形状

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
| `pipeline/` | stage 编排支撑 | compile-target(.types) + compile-stages + config-compiler + build-pipeline(legacy) |
| `aspect/` | C 轮 aspect home（预留） | compatibility.ts |

顶层留：`types.ts`（北星形状）+ `orchestrator.ts`（PackerOrchestrator）+ `README.md`

### D-DC-2 — 纯搬迁红线（无逻辑改）

**红线**：本 Action 只做文件位置搬迁 + import 路径改写。函数体、逻辑、类型签名**不动**。验证：
- tsc 0（路径改写后类型检查）
- 6 项目 diff=0（逻辑零改 → 产物字节不变）
- 函数体 git diff 仅 import 行 + 文件位置（`git diff --stat` 行数 ~= import 改写数）

**禁止**：借机重构函数体 / 改类型 / 抽 collaborator / 抽 aspect（那是 D/C 轮）。若搬迁中发现需重构，记入 tracker residual，不在本 Action 做。

### D-DC-3 — 分批搬迁序（按依赖序 + 每批行为 0 gate）

按子目录依赖序（底层先行），每批 tsc + vitest + 6 项目 diff 行为 0 gate：

| 批 | 子目录 | 文件 | 依赖说明 |
| --- | --- | --- | --- |
| B1 | `graph/` + `store/` | graph.ts, config-fixpoint.ts, dependency-graph.ts, env.ts, project-store.ts | 底层（graph + I/O），无 packer 内部依赖 |
| B2 | `cache/` + `registry/` | module-result-cache, compile-cache, fingerprint, invalidation + registry.ts 拆 dispatch/lce + renderers | 依赖 graph/store |
| B3 | `emit/` + `worker/` | emit(-engine/-worker-entry), build-model, convergence, publish + worker-runtime 7 文件 | 依赖 cache/registry + worker |
| B4 | `pipeline/` + `state/` | compile-target(.types), compile-stages, config-compiler, build-pipeline + session-state, stage-channel | 依赖 emit/worker |
| B5 | `aspect/` | compatibility.ts（+ core/ 解体：sourcemap/expression-parser 去 shared/compiler） | 收尾 |

每批结束：tsc 0 + vitest 全绿 + 6 项目 diff=0（行为 0 gate）+ grep 验子目录归位。

### D-DC-4 — packer→compiler 跨域依赖保留

搬迁后 `compiler/logic|view|style/` 仍 import `packer/store/env.ts` 等——**这是真依赖**（domain 用 I/O 环境 + graph + worker），非散落。packer 提供 I/O 给 compiler 域消费，**方向正确**（packer→compiler 单向）。保留，不消除。

**验证方向**：`grep -rn "from '.*packer/" src/compiler/logic src/compiler/view src/compiler/style` 非零且方向单向（packer→compiler）。反向（compiler→packer 内部非 I/O）须消除。

### D-DC-5 — compiler per-kind 子结构不动

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
| `packer/pipeline/build-pipeline.ts` | `compiler/pipeline/build-pipeline.ts` | legacy live |
| `packer/aspect/compatibility.ts` | `compiler/core/compatibility.ts` | C 轮 home |

### 3.2 compiler/core/ 解体

| 源文件 | 目标 | 说明 |
| --- | --- | --- |
| `core/renderers.ts` | `packer/registry/renderers.ts` | renderer 派发（packer） |
| `core/npm-builder.ts` | `packer/pipeline/npm-builder.ts` 或 `packer/store/` | orchestration sub-step |
| `core/env.ts` | `packer/store/env.ts` | I/O 环境（ALS impl） |
| `core/compatibility.ts` | `packer/aspect/compatibility.ts` | aspect |
| `core/sourcemap.ts` | `shared/sourcemap.ts` | sourcemap 工具 |
| `core/expression-parser.ts` | `compiler/utils/expression-parser.ts` 或 `shared/` | transform util |
| `core/compatibility-reference.ts` | `shared/` 或 `packer/aspect/` | reference data |

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
| 规模 | ~27 文件迁移 + ~100+ import 路径改写 |
| blast radius | env.ts（36 导入方）/ compatibility.ts（14）/ emit.ts（21）高 |
| 行为 0 | critical（ESM 显式后缀 + tsc 全量验）；但 diff=0 应成立（逻辑零改，只 import 行变） |
| 分批 | 5 批（B1-B5），每批行为 0 gate，避免一次性大爆炸 |
| 回退 | 每批独立 commit，可单批 revert |

## §5 与既有 residual 关系

| 本 Action | 既有 residual |
| --- | --- |
| R-DC-7 ③a/b/c 消解 | ③a 已 fixed（chain-residuals）；③b/③c 本 Action 同域归位消解 |
| 目录收敛 | F-PA-1..6 散落温床解（设计模式缺陷本体留 D/C 轮） |
| 北星 6 组件物理落地 | types.ts 北星 → 目录对应（D-PCS 形状落地） |

## §6 待 formalize 锁定项

- D-DC-1..5 门锁定（formalize 审）
- npm-builder 归 packer/pipeline/ 还是 store/（待定）
- expression-parser 去 shared/ 还是 compiler/utils/（待定）
- build-pipeline.ts（legacy）是否随迁或单独清死码（待定）
