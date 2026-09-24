# Implementation Plan — fe-tools-packer-directory-convergence

Status: **in_progress（实施授权 2026-10-09；implementation-plan 出具）**

设计门：[D-DC-1..5 locked](design.draft.md#§2-设计门formalize-locked-2026-10-09d-dc-15-锁定)
前置 review：2 批 18 轮严格收敛（R8+R9 + R17+R18 连续 0）

## §1 实施总则

- **D-DC-2 红线**：纯搬迁，函数体逐字不动；文件拆分（registry.ts → dispatch.ts + lce.ts）允许 IF 函数体逐字搬迁
- **D-DC-3 原子性红线**：stateful module（env/compatibility/renderers）搬迁须**单 commit 原子**——① 全 static import 路径更新 ② 全 dynamic `import('...')` 字符串路径更新 ③ 删旧文件——不留中间态（dual-instance 陷阱，F-R13-1）
- **每批行为 0 gate**：tsc 0 + vitest 全绿 + 6 项目 diff=0（base/subpackages/mpx-demo/vant/weui/taro-todo）+ P-DC7 函数体机械 check + P-DC7b 单实例 grep
- **每批独立 commit**，可单批 revert
- **ESM 显式后缀**：所有 import 须 `.ts`/`.js` 后缀（node --experimental-strip-types）；搬迁只改路径不改后缀

## §2 批次依赖序 + blast radius（实测）

| 批 | 子目录 | 文件数 | 导入方总数（src+test）| stateful | 风险 |
| --- | --- | --- | --- | --- | --- |
| B1a | `graph/` | 4（graph + config-fixpoint + dependency-graph + npm-resolver）| ~31（dep-graph 20 + graph 3 + config-fixpoint 3 + npm-resolver 5）| 无 | 中（dep-graph 20 大 blast）|
| B1b | `store/` | 2（env + project-store）| **~62**（env 57 = 22 src + 35 test；project-store 5）| **env（5 module-level state）** | **最高**（dual-instance 陷阱 + 最大 blast）|
| B2 | `cache/` + `registry/` | 4 cache + 3 registry（拆 dispatch/lce + renderers）| ~17（module-result-cache 6 + fingerprint 3 + invalidation 1 + compile-cache 1 + registry 1 + renderers 5）| renderers（registry Map）| 中 |
| B3 | `emit/` + `worker/` | 6 emit + 7 worker | ~16（emit 9 + worker-runtime 7）| 无 | 中 |
| B4 | `pipeline/` + `state/` | 5 pipeline + 2 state | ~15（compile-target/stages/channel/session-state）| 无 | 中 |
| B5 | `aspect/` + core 解体 | 1 aspect + 3 shared | ~10（compatibility 5 + sourcemap/expression-parser/compatibility-reference）| compatibility（cachedReference）| 中 |

**B1b 是 crux**——env.ts 57 导入方 + stateful + dual-instance 陷阱。须最谨慎。

## §3 分批步骤

### B1a — graph/ 子目录（4 文件）

**搬迁**：
| 目标 | 源 |
| --- | --- |
| `packer/graph/graph.ts` | `packer/graph.ts` |
| `packer/graph/config-fixpoint.ts` | `packer/config-fixpoint.ts` |
| `packer/graph/dependency-graph.ts` | `model/dependency-graph.ts` |
| `packer/graph/npm-resolver.ts` | `compiler/core/npm-resolver.ts` |

**import 改写**（~31 处）：
- `packer/orchestrator.ts`：`./graph.ts` → `./graph/graph.ts`；`./config-fixpoint.ts` → `./graph/config-fixpoint.ts`
- `packer/graph.ts`（迁后 `packer/graph/graph.ts`）：`../model/dependency-graph.ts` → `./dependency-graph.ts`；`../compiler/core/npm-resolver.ts` → `./npm-resolver.ts`；`../compiler/core/env.ts`（type-only PageConfig/ComponentConfig）→ `../store/env.ts`（**等 B1b 后**——但 B1a 先于 B1b，env 仍在 core/，暂保 `../store/env.ts`? 否，env 未搬。**B1a 内 env 引用暂留 `../../compiler/core/env.ts`**，B1b 再改）
- `model/*`（invalidation 等）import `./dependency-graph` → 迁后改 `../packer/graph/dependency-graph.ts`（但 model/ 文件本批不迁——只 dependency-graph 迁。故 model/invalidation.ts import 改 `../packer/graph/dependency-graph.ts`）
- `compiler/logic|view|style/` + `compiler/core/` + `__tests__/dependency-graph.spec.js` 等 import `model/dependency-graph` → `packer/graph/dependency-graph`
- `compiler/core/npm-builder.ts` import `./npm-resolver` → 迁后 `../../packer/graph/npm-resolver.ts`

**预存环处理（F-R11-1）**：graph→env `import type`（erased）；store→graph runtime。B1a 后 graph 在 packer/graph/，env 仍在 compiler/core/——环变 packer/graph→compiler/core（cross-top），B1b 后 env→packer/store 收敛为 intra-packer。type-only 全程 erased，runtime 无环。

**行为 0 gate**：tsc 0 + vitest 全绿 + 6 项目 diff=0 + grep `packer/graph/` 4 文件归位

---

### B1b — store/ 子目录（2 文件，crux）

**搬迁**：
| 目标 | 源 |
| --- | --- |
| `packer/store/env.ts` | `compiler/core/env.ts` |
| `packer/store/project-store.ts` | `model/project-store.ts` |

**⚠️ 原子性红线（env stateful，F-R13-1）**：env.ts 含 5 module-level mutable state（ALS hub）——**单 commit 原子**：
1. 更新全 static import（22 src：17 compiler + 1 model + 4 packer）→ `compiler/core/env` 改 `packer/store/env`
2. 更新全 dynamic `import('...')` 字符串（~35 test：`__tests__/*.spec.js` 的 `await import('../src/compiler/core/env.ts')`）→ `packer/store/env.ts`
3. 删 `compiler/core/env.ts` 旧文件
4. 验单实例：`grep -rn 'compiler/core/env' src/ __tests__/` = 0

**import 改写**（~62 处）：
- 17 `compiler/logic|view|style/*.ts`：`../core/env.ts` → `../../packer/store/env.ts`
- `compiler/core/*`（npm-builder/compatibility/expression-parser/sourcemap/compatibility-reference）：`./env.ts` → `../../packer/store/env.ts`（但 npm-builder B1a 已迁 packer/pipeline/，其 import 改 `../store/env.ts`）
- 4 `packer/*`（orchestrator/graph/config-fixpoint/session-state）：`../compiler/core/env.ts` → `./store/env.ts` 或 `../store/env.ts`
- `model/*`（project-store 等）：`../compiler/core/env.ts` → `../packer/store/env.ts`（project-store 本批迁，自指同子目录 `./env.ts`）
- ~35 `__tests__/*.spec.js`：static `from '../src/compiler/core/env.ts'` + dynamic `await import('../src/compiler/core/env.ts')` → `../src/packer/store/env.ts`

**env.ts 自身 import 更新**（迁后 `packer/store/env.ts`）：
- `../../model/dependency-graph.ts` → `../graph/dependency-graph.ts`（B1a 已迁）
- `../../packer/graph.ts` → `../graph/graph.ts`
- `../../packer/config-fixpoint.ts` → `../graph/config-fixpoint.ts`
- `../../packer/types.ts` → `../types.ts`

**行为 0 gate**：tsc 0 + vitest 全绿 + 6 项目 diff=0 + **P-DC7b 单实例 grep = 0** + env 相关 spec（env/module-result-cache/logic-compiler 等）全绿（ALS state 隔离会致 fail）

---

### B2 — cache/ + registry/ 子目录

**搬迁**：
| 目标 | 源 |
| --- | --- |
| `packer/cache/module-result-cache.ts` | `model/module-result-cache.ts` |
| `packer/cache/compile-cache.ts` | `model/compile-cache.ts` |
| `packer/cache/fingerprint.ts` | `model/fingerprint.ts` |
| `packer/cache/invalidation.ts` | `model/invalidation.ts` |
| `packer/registry/dispatch.ts` | `registry.ts` 拆（PackerDispatchRegistry + computeStagePlan + readLoadBindings + assertLoadBindings + filterPagesByEntries）|
| `packer/registry/lce.ts` | `registry.ts` 拆（LoaderRegistryImpl + CompileRegistryImpl + EmitRegistryImpl）|
| `packer/registry/renderers.ts` | `compiler/core/renderers.ts` |

**⚠️ 原子性（renderers stateful）**：renderers.ts 含 `rendererRegistry` Map module state——单 commit 原子（static + 删旧）。

**registry.ts 拆分**（D-DC-2 允许 IF 函数体逐字搬迁）：
- `dispatch.ts`：PackerDispatchRegistry class + createDispatchRegistry + computeStagePlan + readLoadBindings + assertLoadBindings + filterPagesByEntries
- `lce.ts`：LoaderRegistryImpl + CompileRegistryImpl + EmitRegistryImpl
- 两文件无内部互调（R10-2 验）——拆分洁净

**import 改写**（~17 处）：
- `packer/orchestrator.ts`：`import { createDispatchRegistry, computeStagePlan, readLoadBindings, LoaderRegistryImpl, CompileRegistryImpl, EmitRegistryImpl } from './registry.ts'` → 拆 2 行：`from './registry/dispatch.ts'` + `from './registry/lce.ts'`
- `packer/session-state.ts`：`../model/module-result-cache.ts` → `./cache/module-result-cache.ts`；`./types.ts` ViewCompiledModule 留
- `model/invalidation.ts`（迁后 cache/）：`./stage-order.ts`（B4 迁 pipeline/，本批仍 model/）→ 暂保 `./stage-order`，B4 再改 `../pipeline/stage-order`；`../compiler/pipeline/compile-target` → 迁后改 `../pipeline/compile-target`（B4 迁）
- `__tests__/logic-loader.spec.js`：`../src/packer/registry.js` → `../src/packer/registry/dispatch.ts` + `lce.ts`
- `__tests__/target-renderer-integration.spec.js`：`../src/compiler/core/renderers.ts` → `../src/packer/registry/renderers.ts`

**③b 消解**：compile-cache（packer/cache/）import compile-stages（compiler/pipeline/，本批未迁）→ 仍 cross-top `../compiler/pipeline/compile-stages`；B4 后 compile-stages 迁 packer/pipeline/ → intra-packer `../pipeline/compile-stages`。③b 本批部分消解（compile-cache 归 packer/cache/），B4 后全消解。

**行为 0 gate**：tsc 0 + vitest 全绿 + 6 项目 diff=0 + P-DC7b renderers 单实例 grep = 0

---

### B3 — emit/ + worker/ 子目录

**搬迁**：
| 目标 | 源 |
| --- | --- |
| `packer/emit/emit.ts` | `compiler/pipeline/emit.ts` |
| `packer/emit/emit-engine.ts` | `compiler/pipeline/emit-engine.ts` |
| `packer/emit/emit-worker-entry.ts` | `compiler/pipeline/emit-worker-entry.ts` |
| `packer/emit/build-model.ts` | `model/build-model.ts` |
| `packer/emit/convergence.ts` | `model/convergence.ts` |
| `packer/emit/publish.ts` | `compiler/pipeline/publish.ts` |
| `packer/worker/runtime.ts` | `compiler/worker-runtime/runtime.ts` |
| `packer/worker/executor.ts` | `compiler/worker-runtime/executor.ts` |
| `packer/worker/define-engine.ts` | `compiler/worker-runtime/define-engine.ts` |
| `packer/worker/context.ts` | `compiler/worker-runtime/context.ts` |
| `packer/worker/async-context-store.ts` | `compiler/worker-runtime/async-context-store.ts` |
| `packer/worker/loggers.ts` | `compiler/worker-runtime/loggers.ts` |
| `packer/worker/sinks.ts` | `compiler/worker-runtime/sinks.ts` |

**import 改写**（~16 处）：emit 9 导入方 + worker-runtime 7（互相 import 改 intra `./`）。

**emit.ts 自身 import（迁后 packer/emit/emit.ts）**：
- `../core/env.ts` → `../store/env.ts`（B1b 后）
- `../core/sourcemap.ts` → `../../shared/sourcemap.ts`（B5 后；本批暂保）
- `../worker-runtime/context.ts`（abilityALS）→ `../worker/context.ts`
- `../../shared/compile-config.ts`（effectiveJsMinify）→ 不变（packer/emit/ 到 shared/ 仍 `../../shared/`，深度同）

**convergence.ts 自身 import（迁后 packer/emit/convergence.ts）**：
- `./dependency-graph.ts`（type-only）→ `../graph/dependency-graph.ts`（B1a 后）
- `./module-result-cache.ts`（type-only）→ `../cache/module-result-cache.ts`（B2 后）
- `../compiler/pipeline/emit.ts`（③c，type-only EmitModule）→ `./emit.ts`（同子目录，**③c 消解**）

**③c 消解**：convergence（packer/emit/）import emit（packer/emit/）→ 同子目录 `./emit` ✓（本批全消解）。

**行为 0 gate**：tsc 0 + vitest 全绿 + 6 项目 diff=0

---

### B4 — pipeline/ + state/ 子目录

**搬迁**：
| 目标 | 源 |
| --- | --- |
| `packer/pipeline/compile-target.ts` | `compiler/pipeline/compile-target.ts` |
| `packer/pipeline/compile-target.types.ts` | `compiler/pipeline/compile-target.types.ts` |
| `packer/pipeline/compile-stages.ts` | `compiler/pipeline/compile-stages.ts` |
| `packer/pipeline/config-compiler.ts` | `compiler/pipeline/config-compiler.ts` |
| `packer/pipeline/stage-order.ts` | `model/stage-order.ts` |
| `packer/state/session-state.ts` | `packer/session-state.ts` |
| `packer/state/stage-channel.ts` | `compiler/pipeline/stage-channel.ts` |

**import 改写**（~15 处）：
- `packer/orchestrator.ts`：`./session-state.ts` → `./state/session-state.ts`；`../compiler/pipeline/compile-target` → `./pipeline/compile-target`；`../compiler/pipeline/stage-channel` → `./state/stage-channel`；`../compiler/pipeline/publish` → `./emit/publish`（B3 已迁）；`../compiler/pipeline/emit-engine` → `./emit/emit-engine`（B3）
- `packer/state/stage-channel.ts`（迁后）：`../../packer/types.ts` → `../types.ts`；`../../compiler/worker-runtime/executor` → `../worker/executor`（B3）
- `model/invalidation.ts`（迁后 cache/）：`./stage-order` → `../pipeline/stage-order`（③a 路径 intra-packer 化）
- `packer/cache/compile-cache.ts`（B2 迁）：`../compiler/pipeline/compile-stages` → `../pipeline/compile-stages`（**③b 全消解**）
- `__tests__/compile-target.spec.js`、`watch-runner.ts` 等 import 路径更新（注：build-pipeline.ts **不存在**——orchestrator.ts:4 自承逻辑已迁入，无文件可搬）

**stage-order 放置（F-R5-2 locked）**：`packer/pipeline/stage-order.ts`——2/3 消费者在 pipeline/ + 概念属 stage 编排 + 最小跨子目录（invalidation cache→pipeline 1 处 vs cache/ 的 2 处）

**行为 0 gate**：tsc 0 + vitest 全绿 + 6 项目 diff=0 + **P-DC8 ③b 消解 grep**（packer 内无 compiler/pipeline 反向 import）

---

### B5 — aspect/ + core 解体收尾

**搬迁**：
| 目标 | 源 |
| --- | --- |
| `packer/aspect/compatibility.ts` | `compiler/core/compatibility.ts` |
| `shared/sourcemap.ts` | `compiler/core/sourcemap.ts` |
| `shared/expression-parser.ts` | `compiler/core/expression-parser.ts` |
| `shared/compatibility-reference.ts` | `compiler/core/compatibility-reference.ts` |

**⚠️ 原子性（compatibility stateful）**：compatibility.ts 含 `cachedReference` module state——单 commit 原子。

**import 改写**（~10 处）：compatibility 5 导入方（compiler/logic/view/style + stage-channel）+ sourcemap/expression-parser/compatibility-reference 导入方。`compiler/core/` 目录本批后清空（可删目录）。

**行为 0 gate**：tsc 0 + vitest 全绿 + 6 项目 diff=0 + P-DC7b compatibility 单实例 grep = 0 + **A-DC4 `ls src/compiler/core/` = 空**

---

## §4 最终验证（B5 后全量）

| ID | 项 | 命令 | 期望 |
| --- | --- | --- | --- |
| P-DC1 | 9 子目录 | `ls -d src/packer/{graph,store,registry,state,cache,emit,worker,pipeline,aspect}/` | 9 全存在 |
| P-DC2 | model 解散 | `ls src/model/` | 空或删 |
| P-DC3 | pipeline+worker-runtime 解散 | `ls src/compiler/pipeline/ src/compiler/worker-runtime/` | 空或删 |
| P-DC4 | core 解体 | `ls src/compiler/core/` | 空或删 |
| P-DC5 | compiler 只剩 per-kind | `ls src/compiler/` | 仅 logic/view/style |
| P-DC6 | 行为 0 三件套 | tsc + vitest + 6 项目 diff | 0 / 全绿 / =0 |
| P-DC7 | 函数体机械 check | `git diff -M` + 非 import 删除行 grep | =0 |
| P-DC7b | stateful 单实例 | `grep -rn 'compiler/core/env\|compatibility\|renderers' src/ __tests__/` | =0 |
| P-DC8 | ③b/③c 消解 | `grep -rn "from '.*compiler/pipeline" src/packer/` | =0 |
| P-DC9 | 方向单向 | `grep -rn "from '.*packer/" src/compiler/logic src/compiler/view src/compiler/style` | 非零（packer→compiler 供 I/O） |
| P-DC10 | tracker + arch | tracker ③b/③c + arch stale path 更新 | done |

## §5 close（B5 + 最终验证后）

- architecture-notes：新增目录收敛条目 + 更新 stale path 引用（`grep 'pipeline/' docs/fe-tools/architecture-notes.md` 旧路径全改 packer/）
- tracker（incremental-chain-residuals.md）：③b/③c 状态 fixed（③a 已 fixed）
- STATUS.md / TODO.md / navigation sync
- close checklist + archive（`_archive/complete/`）

## §6 风险与回退

| 风险 | 缓解 |
| --- | --- |
| B1b env 57 导入方 + dual-instance | 原子单 commit + P-DC7b 单实例 grep + env 相关 spec 全绿 |
| B1a dep-graph 20 导入方 | 单 commit + tsc 全量 |
| registry.ts 拆分逻辑改嫌疑 | D-DC-2 红线 + P-DC7 函数体机械 check + git diff -M 验逐字 |
| 预存环 graph↔store（F-R11-1）| type-only erased，runtime 无环；记录为已知 |
| 每批 tsc mid-batch 红 | 每批 END 验 tsc（mid 红 OK，commit 边界绿）|
| 回退 | 每批独立 commit，`git revert <batch-commit>` 单批回退 |

## §7 依赖图

```
B1a (graph/) ─┐
              ├─→ B2 (cache/+registry/) ─→ B3 (emit/+worker/) ─→ B4 (pipeline/+state/) ─→ B5 (aspect/+core解体)
B1b (store/) ─┘
```

B1a + B1b 可并行（graph 与 store 互不依赖；但 env→graph 引用须 B1a 先或同 commit）。**建议 B1a→B1b 串行**（env 迁后引用 graph 路径定）。
