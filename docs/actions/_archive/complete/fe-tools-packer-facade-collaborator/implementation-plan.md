# Implementation Plan — fe-tools-packer-facade-collaborator

Status: **in_progress（2026-10-10；FC-P0..P6 + D-FC-2b 完成，D-FC-2a/P7a/P7b deferred to B）**

设计门：[D-FC-1..5 locked](design.draft.md#§2-设计门draft-提议formalize-待锁)
前置 review：4 批 19 轮严格收敛（R5+R6 / R9+R10+R11 / R14+R15 / R18+R19 四组连续 0）

## §0 实施进度（2026-10-10）

| 相 | 状态 | 证据 |
| --- | --- | --- |
| FC-P0 类型来源（ProjectStore + Lifecycle export） | ✓ COMPLETE | tsc 0 + 7 diff=0 |
| FC-P1 DistPreparer + ConfigCompiler | ✓ COMPLETE | 2 collaborator + 委托 run |
| FC-P2 NpmBuilder 接线（有状态每次 new） | ✓ COMPLETE | collaborator + builtPackages 不跨 build 泄漏 |
| FC-P3 ConfigCollector（写 9 sctx 字段） | ✓ COMPLETE | collaborator + ctx→sctx 统一 |
| FC-P4 StageDispatcher（loadBindings→sctx） | ✓ COMPLETE | collaborator + createStageTask 搬迁 + compile-target.spec test-sync |
| FC-P5 LogicEmitter（ctx→sctx 统一） | ✓ COMPLETE | collaborator |
| FC-P6 Publisher | ✓ COMPLETE | 7 collaborator 全抽完 |
| D-FC-2b registry 私有化 + logic-loader.spec test-sync | ✓ COMPLETE | createPackerOrchestrator 仅返 { orchestrate } + types.ts 删 3 字段 |
| D-FC-2a orchestrate 签名落地 + implements + result→EmitEntry[] | ✗ DEFERRED to B | 被 D-FC-4 阻塞：北星 `(ctx: PackerContext, state, options) → EmitEntry[]` 需 ALS→PackerContext 闭合（B 切法，design 自承 B 留后）+ result reconcile 依赖 session buildModel 消费（B 额域） |
| P7a/P7b CompileRequest/WatchRequest 收敛 | ✗ DEFERRED to B | 入口签名收敛与 D-FC-2a 签名落地耦合（build() 是 union 入口，签名对齐须待 B） |

**完成态**：orchestrator.ts 429→321 行（7 业务块 + createStageTask 出，保留 Listr task 序 + createPackerOrchestrator + result 合 + webviewRenderer + printCompatibilityWarnings）。7 collaborator 全在对应域子目录。tsc 0 + vitest 647 pass（compile-cli-cache/session-unify flaky solo pass）+ 7 项目 diff=0。

**B-deferred 残留**（D-FC-2a + P7a/P7b）：facade 契约签名落地依赖 ALS→PackerContext 闭合（B 切法）+ OrchestratorState.buildModel 演进。B 就位后：(1) orchestrate 签名对齐 `(ctx, state, options)` + `implements PackerOrchestrator`；(2) result→EmitEntry[] + metadata 伴随（session 改读 state.buildModel）；(3) OrchestrateRequest→CompileRequest/WatchRequest。

## §1 实施总则

- **D-FC-1 rigor 红线**：collaborator 须搬入完整业务逻辑（sctx 字段设置 + lifecycle 事件 + 错误处理），非 forward-only 包壳。orchestrator task body 仅 `await collaborator.run(sctx, deps...)`
- **D-FC-1 状态分类**：6 无状态 collaborator（ConfigCollector/DistPreparer/ConfigCompiler/StageDispatcher/LogicEmitter/Publisher）在 `createPackerOrchestrator` 闭包内一次构造复用；NpmBuilder **有状态每次 build 重新构造**（`builtPackages`/`packageDependencies` 不跨 build 泄漏）
- **D-FC-1 sctx 字段所有权**：按 [sctx 所有权矩阵](design.draft.md#d-fc-1--collaborator-抽取logic-搬迁非包壳) 推导 deps——ConfigCollector 写 9 字段 + StageDispatcher 写 6+loadBindings + LogicEmitter 读 buildModel/storeInfo/pages/compileConfig/sourcemap/sourcemapTargetPath + Publisher 读 buildModel + createStageTask 读 buildModel/compatibilityWarnings/pages
- **D-FC-1 ctx→sctx 统一**：现状 LogicEmitter L37-38 + ConfigCollector L23 用 `ctx.X`（未 cast）——collaborator 搬迁须统一 `sctx.X`（先 `const sctx = ctx as StageChannelContext`）
- **D-FC-1 loadBindings 迁移**：`let loadBindings`（L147 跨 task mutable 闭包）→ `sctx.loadBindings` 字段（StageDispatcher 写，result 读 `.appId`）
- **D-FC-4 ALS 保留**：collaborator 内部可调 ALS 读（`getWorkPath()`/`getPages()`/`getAppConfigInfo()`/`isMiniGame()`/`runWithCompilerContext()`），不改 ALS 为 PackerContext 入参（B 切法留后）
- **D-FC-5 Non-scope 守**：renderer 副作用注册（L64-72）+ aspect 穿线 + printCompatibilityWarnings + previousCompatibilityWarnings Map + L/C/E dispatch NOT wired 全保留原样
- **每相独立 commit + 行为 0 gate**：tsc 0 + vitest 全绿（87/647 基线）+ 7 项目 diff=0 + rigor check（grep collaborator.run 非 0 + git diff -M 逻辑体搬迁 + ALS 保留 grep 非 0）
- **类型来源前置**：P1 前须先 export `ProjectStore`（packer/store/project-store.ts 加 interface）+ `Lifecycle`（迁 shared/lifecycle.ts 或 types.ts export）

## §2 类型来源前置（P0）

| 类型 | 现状 | 处理 |
| --- | --- | --- |
| `ProjectStore` | `createProjectStore` 返回 inferred，无 export interface | `packer/store/project-store.ts` 加 `export interface ProjectStore { load(w: string, o: unknown): Record<string, unknown>; getDependencyGraph(): DependencyGraph }` |
| `Lifecycle` | orchestrator.ts:14 inline `type Lifecycle`，无 export | 迁 `shared/lifecycle.ts` 或 `types.ts` export `interface Lifecycle { emit(e, p): Promise<void>; isolatedListenerErrors: boolean }` |
| `BuildModel` | class（emit/build-model.ts:17）✓ | 无需改 |
| `CompileTarget`/`PagesInfo` | compile-target.types.ts ✓ | 无需改 |
| `LoaderRegistry`/`CompileRegistry`/`EmitRegistry`/`PackerDispatchRegistry` | types.ts ✓ | 无需改 |
| `BuildCollaborator<Deps>` + 7 *Deps | 新形状 | types.ts ADD（D-FC-5 纪律校正：新维度 ADD 非改既有 SHAPE） |

**行为 0 gate**：P0 后 tsc 0 + vitest 全绿 + 7 项目 diff=0（纯类型声明新增，无运行时改）

## §3 分相序（FC-P1..P7b）

依赖序：P1/P2 无 sctx 依赖 → P3 设 sctx → P4 写 sctx → P5 读 → P6 → P7a/b 入口收敛最后。

### FC-P1 — DistPreparer + ConfigCompiler（trivial，无 sctx 依赖）

| collaborator | 源 | 目标 | deps |
| --- | --- | --- | --- |
| DistPreparer | orchestrator.ts initPhases[1]（createDist + DIST_PREPARED） | `packer/emit/dist-preparer.ts` | seedPath? + lifecycle |
| ConfigCompiler | orchestrator.ts initPhases[2]（compileConfig + CONFIG_COMPILED，条件 shouldPrepareConfig） | `packer/pipeline/config-compiler-collab.ts` | lifecycle |

- 两者纯 createDist/compileConfig 调用，无 sctx 读写
- orchestrator task body 改 `await distPreparer.run(sctx, deps)` + `await configCompiler.run(sctx, deps)`
- **行为 0 gate**：tsc 0 + vitest + 7 项目 diff=0

### FC-P2 — NpmBuilder 接线（有状态每次 new）

| collaborator | 源 | 目标 | deps |
| --- | --- | --- | --- |
| NpmBuilder | orchestrator.ts initPhases[3]（`new NpmBuilder(...).buildNpmPackages()` + NPM_BUILT，条件 shouldPrepareNpm） | `packer/pipeline/npm-builder.ts`（已存在，加 collaborator 接线） | workPath + targetPath + dependencyGraph（从 sctx 读） + lifecycle |

- **NpmBuilder 有状态**：每次 _orchestrate 内 `new NpmBuilder(workPath, targetPath, sctx.dependencyGraph)`（**不在 createPackerOrchestrator 闭包构造**——builtPackages/packageDependencies 跨 build 泄漏）
- 读 sctx.dependencyGraph（P3 设，但 NpmBuilder 在 initPhases 先于 ConfigCollector？验实际序——initPhases[3] 在 initPhases[0] 后，dependencyGraph 已设 ✓）
- **行为 0 gate**

### FC-P3 — ConfigCollector（最复杂，设 sctx 供 P4-P6 读）

| collaborator | 源 | 目标 | deps |
| --- | --- | --- | --- |
| ConfigCollector | orchestrator.ts initPhases[0]（store.load + 9 sctx 字段设置 + loaderRegistry.kinds 派发 + ALS 读 + CONFIG_COLLECTED） | `packer/store/config-collector.ts` | store + state + lifecycle + loaderRegistry + fileTypes? + invalidatedModules? + viewCache? + viewOrderList? + styleCache? |

- 写 sctx：buildModel/cache/dependencyGraph/invalidatedModules/loadedModules/storeInfo/styleCache/viewCache/viewOrderList（9 字段）
- 读 ALS：getPages()/isMiniGame()/getWorkPath()
- ctx→sctx 统一：L23 `ctx.storeInfo` → `sctx.storeInfo`
- **行为 0 gate**

### FC-P4 — StageDispatcher（写 sctx.loadBindings + pages 等）

| collaborator | 源 | 目标 | deps |
| --- | --- | --- | --- |
| StageDispatcher | orchestrator.ts compile task + createStageTask（readLoadBindings + computeStagePlan + createStageTask per stage + runCompileStage/renderers 委托） | `packer/pipeline/stage-dispatcher.ts` | dispatchRegistry + compileTarget + affectedEntries? + lifecycle + parallel |

- 写 sctx：loadBindings（**消跨 task mutable 闭包**）+ allPages + pages + compatibilityWarnings + compileConfig/sourcemap/sourcemapTargetPath
- createStageTask 内嵌（或搬 stage-dispatcher.ts）
- **行为 0 gate**

### FC-P5 — LogicEmitter（读 sctx）

| collaborator | 源 | 目标 | deps |
| --- | --- | --- | --- |
| LogicEmitter | orchestrator.ts Logic emit task（deriveLogicBuckets + executeTask(emitEngine) per bucket + buildModel.add + STAGE_ERROR F-PA-6 特例） | `packer/emit/logic-emitter.ts` | state + pages + compileConfigOpts + sourcemap + sourcemapTargetPath? + storeInfo + buildModel + lifecycle |

- 读 sctx：compileConfig/pages/sourcemap/sourcemapTargetPath（P4 写）+ buildModel（P3 设，写 .add）+ storeInfo（P3 设）
- ctx→sctx 统一：L37-38 `ctx.buildModel`/`ctx.storeInfo` → `sctx.buildModel`/`sctx.storeInfo`
- **行为 0 gate**

### FC-P6 — Publisher（读 sctx.buildModel）

| collaborator | 源 | 目标 | deps |
| --- | --- | --- | --- |
| Publisher | orchestrator.ts 写入产物 task（materialize + publishToDist + BUNDLE_PUBLISHED） | `packer/emit/publisher.ts` | targetPath + useAppIdDir + seedPath? + skipMaterialize? + buildModel + lifecycle |

- 读 sctx.buildModel（P3 设 + P4/P5 add，materialize 消费）
- **行为 0 gate**

### FC-P7a — CompileRequest 收敛（build 入口）

- `OrchestrateRequest` ~19 字段 → `CompileRequest`（workPath/targetPath/useAppIdDir/compileOptions/fileTypes/stages/sourcemap/minify...）
- orchestrate 真调用方 `src/index.ts`（build wrapper）+ `__tests__/logic-loader.spec.js`（测试 mock）改
- build() 下游（bin/dev.ts、session/runner.ts、session/index.ts）经 build() 间接触
- **行为 0 gate**

### FC-P7b — WatchRequest 收敛（dev session 入口）

- `WatchRequest`（= CompileRequest + affectedEntries/invalidatedModules/seedPath/incremental/configChanged）
- dev session 适配器改
- **行为 0 gate**

## §4 facade 契约落地（D-FC-2a/2b，P7 后或并行）

### D-FC-2a — orchestrate 签名落地（北星不改）

- orchestrator `implements PackerOrchestrator`（消解 orchestrator.ts:6 自承 D-OR-7 张力）
- 签名 `(ctx: PackerContext, state: OrchestratorState, options: OrchestrateOptions) → Promise<EmitEntry[]>` 对齐 types.ts:416
- **result reconcile 锁**：buildResult 落地 EmitEntry[] 形状——buildModel.entries 即 EmitEntry[] + 顶层 metadata（appId/name/path/dependencyGraph）伴随返回。result 消费处（session/index.ts buildModel/appId）同步对齐

### D-FC-2b — registry 私有化（须北星 interface 改）

- types.ts `PackerOrchestrator` interface 删 `loaderRegistry`/`compileRegistry`/`emitRegistry` 3 字段（D-FC-5 纪律校正：facade 收敛核心非 shape 重设计）
- `createPackerOrchestrator` 返回仅 `{ orchestrate }`
- **logic-loader.spec test-sync**：`__tests__/logic-loader.spec.js:140-147` 6 处 `orch.loaderRegistry/compileRegistry/emitRegistry.get` 断言须改（删 registry 伸手，改验 orchestrate 行为）

## §5 blast radius（实测）

| 项 | 估计 | 实测方法 |
| --- | --- | --- |
| orchestrator.ts | 429 → ~120-150 行（7 业务块搬迁 + createStageTask 出） | git diff -M + wc -l |
| collaborator 新文件 | 7（store/config-collector + emit/dist-preparer + pipeline/config-compiler-collab + pipeline/npm-builder 接线 + pipeline/stage-dispatcher + emit/logic-emitter + emit/publisher） | find |
| types.ts | ADD BuildCollaborator<Deps> + 7 *Deps + CompileRequest/WatchRequest + 删 registry 3 字段 | grep |
| 调用方 | orchestrate 真调用方 = src/index.ts + logic-loader.spec；build() 下游 = bin/dev + session/runner + session/index（间接）；result 消费 = session/index.ts（buildModel/appId） | grep orchestrate / build( / result.appId |
| 测试 | logic-loader.spec 6 处 registry 伸手断言（D-FC-2b） | grep loaderRegistry.get __tests__ |
| 类型 export | ProjectStore + Lifecycle 新 export | grep |

## §6 行为 0 gate（每相）

- **tsc 0 errors**：`node ./node_modules/typescript/bin/tsc --noEmit`
- **vitest 全绿**：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs exec vitest run`（87/647 基线，compile-cli-cache + session-unify flaky solo pass）
- **7 项目 diff=0**：`node --experimental-strip-types /tmp/dc-build.mjs diff`（air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui）
- **rigor check**：`grep 'await.*\.run(' orchestrator.ts` 非 0 + collaborator 文件含原逻辑体（git diff -M）+ `grep 'getWorkPath\|getPages\|getAppConfigInfo\|isMiniGame' src/packer/{store,emit,pipeline}/` 非 0（ALS 保留）+ NpmBuilder 每次 new 验（grep `new NpmBuilder` 在 _orchestrate 内非闭包）

## §7 回滚

每相独立 commit，可单相 revert。行为 0 gate 失败即 revert 该相，不累积。
