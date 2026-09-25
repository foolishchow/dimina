# Requirements — fe-tools-packer-facade-collaborator

Status: **draft（2026-10-09）**

## 背景

packer 架构 retrospect（[F-PA-1..6](../../fe-tools/2026-10-09-packer-facade-aspect-retrospect.md)）发现 orchestrator 是 god object：`_orchestrate` 同时干 7 类业务活（store.load / createDist / compileConfig / npmBuilder / stage 派发 / deriveLogicBuckets+emitEngine / materialize+publishToDist）+ 公开 4 registry + `OrchestrateRequest` ~19 字段透传。北星契约 `PackerOrchestrator.orchestrate(ctx, state, options) → EmitEntry[]`（`types.ts:416`）**根本没落地**——实际签名 `_orchestrate(request: OrchestrateRequest) → Record<string, unknown>`，签名/入参/返回全不符。

目录收敛（fe-tools-packer-directory-convergence complete）已把 packer/ 9 子目录就位，给本 Action 干净素材。

### R-FC-1 — collaborator 抽取（F-PA-1 落地）

orchestrator `_orchestrate` 7 业务块下沉到**拥有逻辑的 collaborator**（每 collaborator 拥有一类业务活的完整逻辑，非包壳）：

| collaborator | 拥有的逻辑（迁入）| 现位置 |
| --- | --- | --- |
| ConfigCollector | init phase 1「收集配置信息」：`store.load(workPath, {fileTypes, graph})` → storeInfo + sctx 字段设置（buildModel/storeInfo/dependencyGraph/cache/viewCache/viewOrderList/styleCache/loadedModules/invalidatedModules）+ `loaderRegistry.kinds()` 派发 + `getPages()`/`isMiniGame()` ALS 读 + CONFIG_COLLECTED 事件 | orchestrator.ts initPhases[0] |
| DistPreparer | init phase 2「准备产物目录」：`createDist(seedPath)` + DIST_PREPARED 事件 | orchestrator.ts initPhases[1] |
| ConfigCompiler | init phase 3「编译配置信息」：`compileConfig()` + CONFIG_COMPILED 事件 | orchestrator.ts initPhases[2]（条件 shouldPrepareConfig）|
| NpmBuilder | init phase 4「构建 npm 包」：`new NpmBuilder(...).buildNpmPackages()` + NPM_BUILT 事件（NpmBuilder 已是 class，仅需接线）| orchestrator.ts initPhases[3]（条件 shouldPrepareNpm）|
| StageDispatcher | 「编译项目」task：`readLoadBindings()` + `computeStagePlan()` + `createStageTask` per stage + runCompileStage/renderers 委托 | orchestrator.ts compile task + createStageTask |
| LogicEmitter | 「Logic emit」task：`deriveLogicBuckets` + `executeTask(emitEngine)` per bucket + buildModel.add + STAGE_ERROR（F-PA-6 特例路径）| orchestrator.ts Logic emit task |
| Publisher | 「写入编译产物」task：`materialize` + `publishToDist` + BUNDLE_PUBLISHED 事件 | orchestrator.ts 写入产物 task |

**rigor 红线**：每 collaborator 须搬入完整业务逻辑（含 sctx 字段设置、lifecycle 事件发射、错误处理），orchestrator task body 仅 `await collaborator.run(sctx, deps...)`。禁止 forward-only 包壳。

### R-FC-2 — facade 契约落地（types.ts 北星兑现）

`PackerOrchestrator.orchestrate(ctx, state, options) → EmitEntry[]`（types.ts §north-star）真落地：
- orchestrator `implements PackerOrchestrator`（消解 orchestrator.ts:6 自承"不写 implements"张力）
- 签名/入参/返回对齐北星（`PackerContext` + `OrchestratorState` + `OrchestrateOptions` → `EmitEntry[]`）
- `createPackerOrchestrator` 不再公开 4 registry（loaderRegistry/compileRegistry/emitRegistry/dispatchRegistry = facade 内部）

### R-FC-3 — OrchestrateRequest 收敛

`OrchestrateRequest` ~19 字段（targetPath/workPath/useAppIdDir/state/store/lifecycle/fileTypes/affectedEntries/stages/seedPath/prepareConfig/prepareNpm/skipMaterialize/invalidatedModules/incremental/configChanged/parallel/compileOptions...）→ 收敛为语义入参：
- `CompileRequest`（one-shot build）：workPath/targetPath/useAppIdDir/compileOptions/fileTypes/stages/sourcemap/minify...
- `WatchRequest`（增量 rebuild）：CompileRequest + affectedEntries/invalidatedModules/seedPath/incremental/configChanged

build() 入口 + dev session 适配器相应改写。

### R-FC-4 — 行为 0

纯结构重构，build 产物字节不变。每 collaborator 抽取 + facade 落地各 = 独立 commit + 行为 0 gate（tsc 0 + vitest 全绿 + 7 项目 diff=0）。ALS 直调保留（collaborator 内部）→ 产物不变。

### R-FC-5 — Non-scope 边界（ rigor 红线守）

- **不改 ALS 内部**（B 切法留后）——collaborator 可调 `getWorkPath()`/`getPages()` 等 ALS 读，但不重构 ALS 为 PackerContext 入参
- **不动 renderer 注入点**（F-PA-3，A 切法）——orchestrator.ts:64-72 webviewRenderer 副作用注册 + renderers.ts 索引签名保留原样（另 Action）
- **不抽 aspect**（F-PA-2，C 切法）——collaborator 内部横切穿线（sourcemap/compatibilityWarnings/compileConfig）暂留
- **不接 dispatch wiring**（F-PA-5/E）——L/C/E registry 仍 NOT wired，PackerDispatchRegistry 仍 WIRED

### R-FC-6 — types.ts 形状纪律

collaborator 接口声明落 types.ts（纯形状层，无 implementation import）。collaborator impl 落 packer/ 对应子目录（config/ 或 pipeline/ 或新 collaborator/——design 定）。types.ts 不引 env.ts 等 implementation（守 D-PC-5 / packer 形状纪律）。
