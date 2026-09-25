# fe-tools-packer-output-abstraction

- Action: `fe-tools-packer-output-abstraction`
- Status: `draft`
- Created: 2026-10-10
- Status authority: [Action Status](../STATUS.md)
- 设计门：[design.draft.md](design.draft.md)（D-O1..N 待 lock）
- 实施计划：[implementation-plan.md](implementation-plan.md)（P-O1..3 分相）
- 验证：[validation.md](validation.md)
- 背景：[`docs/fe-tools/2026-10-10-storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) + [`2026-10-10-packer-architecture-analysis.md`](../../fe-tools/2026-10-10-packer-architecture-analysis.md)

## Background

packer 当前的产物输出路径由 **4 个缠结概念**组成，因无统一 Output 抽象而分裂为 memory 路径与 disk 路径两套平行机制：

```
worker → BuildModel.add(entry)          [内存累积器]
       → materialize(model, TEMP)       [内存→盘 flush，skipMaterialize guard]
       → publishToDist(TEMP→FINAL)      [盘→盘 rename/copy]

dev server 读:
  artifactResolver = buildModel.getArtifact(path)  [内存读]
  miss → fs.readFile(serveRoot=FINAL)              [盘读 fallback]
```

**病症**：
1. **memory/disk 双路平行**——BuildModel（内存累积 + getArtifact 读）与 materialize/publishToDist（盘写 + 盘间复制）是两套机制，skipMaterialize 是 mode 开关，非统一抽象。
2. **targetPath 双语义**——PackerContext.targetPath（FINAL 发布目录）vs sctx.storeInfo.pathInfo.targetPath/getTargetPath()（TEMP scratch 构建目录）——两个 targetPath 是不同概念（一个发布、一个 scratch），但因无 Output 抽象而都叫 targetPath，缠在 PackerContext + storeInfo + ALS singleton 三处。
3. **compat 写 load-bearing 的 output 角色**——storeInfo compat 写 dump pathInfo 到 defaultCompilerContext，喂 getTargetPath() → createDist/materialize/publishToDist。这是 P-NS6 audit 揭示的 backflow 的主要消费方。
4. **memfs（dev）是特殊路径**——D-MM-1 直读 BuildModel + skipMaterialize 跳过 materialize，是 mode-specific 分支，非统一 Output impl。

详见 [`2026-10-10-packer-architecture-analysis.md`](../../fe-tools/2026-10-10-packer-architecture-analysis.md) §9 张力 T1/T2/T3 + [`2026-10-10-storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md)。

## Goal

抽象统一 `Output` interface，兼容 memfs（dev 内存直读）与 system fs（one-shot 盘写+发布），替代 BuildModel/materialize/publishToDist/createDist/artifactResolver/skipMaterialize 的 4 概念缠结：

- `Output` interface（add/read/publish）+ 2 impl（MemOutput / DiskOutput）
- dev 选 MemOutput（内存累积 + 直读 + publish noop）→ 消 skipMaterialize + artifactResolver/fs-fallback 双路
- one-shot/previewAdapter 选 DiskOutput（累积 + dirty tracking + publish = materialize+publishToDist+createDist 语义封装）→ 消独立 materialize/publishToDist/createDist
- targetPath 双语义消解——DiskOutput 构造收 final + scratch（封装 TEMP→FINAL），PackerContext 不再背双义
- compat 写的 output-path 消费方（getTargetPath 喂 createDist/materialize/publishToDist）死——为 storeInfo 塌缩铺路

## Non-goals

- **不动 storeInfo / sctx.storeInfo**——config 计算正交；Output 只收 target/scratch 于构造时（非从 storeInfo 读）。storeInfo 塌缩是后续独立 initiative。
- **不动 worker ALS（resetStoreInfo + parse-walk getters）**——worker 模型结构性需求；Output 只在主线程，worker 仍 postMessage EmitEntry 到主线程 Output.add。
- **不动 compiler/\***——worker 产 EmitEntry 边界不变。
- **不动 config computation（graph/config-collector）**——config fixpoint 与 output 正交。
- **不删 env.ts ALS 门面**——compat 写 output 消费方死后仍剩 config 消费方（project-store.getDependencyGraph 等），留 storeInfo 塌缩 initiative 处理。
- **不迁 PackerContext 构造 duplication**（buildPackerContext/buildFixpointCtx/toPackerContext 三同质构造器）——独立 dedup follow-up。

## Scope（affected boundaries）

| 边界 | 改动 |
|---|---|
| `types.ts` | 加 `Output` interface（§10 新 section） |
| `emit/build-model.ts` | BuildModel 退役——累积 + dirty tracking 语义迁入 Output impl（DiskOutput 保留 dirty） |
| `emit/publish.ts` | createDist + publishToDist 退役——语义封装入 DiskOutput.publish |
| `emit/publisher.ts` | collaborator 改调 Output.publish（非 materialize + publishToDist） |
| `emit/dist-preparer.ts` | createDist 调用退役——DiskOutput 内部管理 scratch（或 dist-preparer 退役） |
| `orchestrator.ts` | **orchestrator 入口创建 Output（方案 B，mode-aware 点 L121 后）**：`request.skipMaterialize ? new MemOutput() : new DiskOutput(ctx.targetPath)`；**listr2 ctx 注入 `tasks.run({ output })`**（L292，F-R4-3）；stage onOutput → sctx.output.add（L83/85，F-R7-1）；result.output = context.output（L294 cast 改）+ result.entries = output.getEntries()（L296，F-R4-2）；collaborator 接 Output（**deps.output**，F6 lock） |
| `pipeline/stage-dispatcher.ts` | **L54 dispatch 路径 onOutput `sctx.buildModel.add` → `sctx.output.add`**（F-R7-1 殁骸消费者迁移） |
| `emit/logic-emitter.ts` | **L37 cast 读 sctx.buildModel → sctx.output + L42 buildModel.add(entry) → sctx.output.add**（F-R7-1 logic 累积路径） |
| `store/config-collector.ts` | **删 `sctx.buildModel = new BuildModel()` 行**（L36）——只消费 sctx.output（职责分离） |
| `store/config-collector.ts` | **删 `sctx.buildModel = new BuildModel()` 行**（L36）——只消费 sctx.output（职责分离：orchestrator 决策 mode+创建，config-collector 只设其他 8 sctx 字段） |
| `session/index.ts` | **SessionState.buildModel → output**（L59，F-R7-3/F-R9-2——只 SessionState，不加 PackerSessionState）；dev 选 MemOutput + 注入 dev server OutputRef（替代 artifactResolver）；**state.output 替代 state.buildModel**（L244 首 build + L255 build:end listener 重赋值字段，F1 D-OL4） |
| `dev/dev-server.ts` | 读路径改 outputRef.output?.read（createServer params 收 **OutputRef 窄接口**，F-R5-2，消 artifactResolver）；miss 仍 fs fallback 读 serveRoot（mode-dep，F8） |
| `session/preview-adapter.ts` | **createServer 签名演进**（F-R22-1 中间层）：artifactResolver → outputRef；session L247 传 outputRef=state；透传 createDevServer |
| `bin/compile.ts` | one-shot 选 DiskOutput（orchestrator 入口按 mode） |
| `index.ts`（build facade） | Output impl 选择（mode-driven，orchestrator 入口） |
| `packer/types.ts` | Output interface（add/read/publish/**getEntries**，F-R4-2）+ PublishOpts；**BuildResult.buildModel → output 字段**（L503，F11 D-OL3）+ BuildModel type 删（P-O3）；**StageChannelContext.buildModel → output**（L123，F-R7-2） |
| `packer/emit/output.ts`（新增，F7 lock） | Output interface + MemOutput + DiskOutput（2 class + 1 interface） |

## Design inputs

- 北星 shape：[`types.ts`](../../../fe/tools/bundler/src/packer/types.ts) §4 EmitOptions/EmitBucket + §8 BuildResult（D-NS-3 entries: EmitEntry[]）
- 现有 output 机制：[`emit/build-model.ts`](../../../fe/tools/bundler/src/packer/emit/build-model.ts)（BuildModel class）+ [`emit/publish.ts`](../../../fe/tools/bundler/src/packer/emit/publish.ts)（createDist/publishToDist）+ [`emit/publisher.ts`](../../../fe/tools/bundler/src/packer/emit/publisher.ts)
- memfs 决策：[`fe-tools-bundler-emit-memfs`](../_archive/complete/fe-tools-bundler-emit-memfs/README.md) D-MM-1..6（直读 BuildModel + skipMaterialize dev 跳过）
- H4 dirty tracking：D-PUSH-3（dirtyEntries set + materialize 增量 guard）
- 架构张力：[`2026-10-10-packer-architecture-analysis.md`](../../fe-tools/2026-10-10-packer-architecture-analysis.md) §9 T1/T2/T3

## Deliverables

1. `Output` interface（types.ts）+ MemOutput impl + DiskOutput impl（emit/output.ts，F7 lock）
2. **Output 生命周期 D-OL1..4 方案 B**（F1 + F-R4-3 listr2 + F-R7-1 全消费者）：orchestrator 入口创建 Output（mode-aware）+ `tasks.run({output})` 注入 + config-collector 删 buildModel 行 + **sctx.output.add 全 4 路径**（orchestrator L83/85 + stage-dispatcher L54 + logic-emitter L42，F-R7-1）+ BuildResult.buildModel→output + result.entries=output.getEntries()（F-R4-2）+ session state.output（SessionState L59，F-R7-3）+ build:end listener 重赋值字段 + dev server 持 OutputRef 读 output（替代 buildModel 流）
3. dev server 读路径统一（outputRef.output?.read 替代 artifactResolver + fs-fallback 双路；serveRoot mode-dep；OutputRef 窄接口，F-R5-2）
4. one-shot/previewAdapter/watch 写+发布路径统一（DiskOutput.publish per-build mkdtemp 替代 materialize + publishToDist + createDist）
5. 殁骸拆除：BuildModel / materialize / publishToDist / createDist / artifactResolver / skipMaterialize + BuildResult.buildModel→output 字段
6. 行为 0（tsc 0 + vitest 全绿 + one-shot 7 diff=0 + dev spec 覆盖，F12 split）跨 dev（memfs）+ one-shot（disk）双模式

## Readiness gaps

**review round 1-22 findings 全修正**（F1-F12 round 1-3 + F-R4-1/2/3 + F-R5-1/2 round 4-6 + F-R7-1/2/3 + F-R8-1 + F-R9-2 round 7-9 + F-R10-1/2 + F-R11-1/2 round 10-12 + F-R13-1/2/3 + F-R14-1/2 round 13-14 + F-R18-1/2/3 + F-R19-4 round 18-19 + F-R22-1/2/3 round 22：全维度 + 中间层 preview-adapter 签名 + emit/ 目录 + BuildModelEntry type/import）。design.draft §2.0 方案 B + D-O1..7 + D-OL1..4 + §4 风险 + §6 emit/ 目录演进。

- **D-O1 Output interface 形状**（add/read/publish 签名 + dirty tracking interface 级 vs impl 级）——design.draft 待 lock
- **D-O2 MemOutput.publish no-op 实证前提**（纯 dev serveRoot 空）——design.draft 已补实证
- **D-O3 DiskOutput.publish 语义封装边界**（per-build mkdtemp + createDist seed 逻辑）——design.draft 待 lock
- **D-OL1..4 Output 生命周期**（buildModel 流替代）——design.draft §2.0 待 lock

formalize gate（problem observable ✓ / goal concrete ✓ / scope statable ✓ / dependencies identifiable ✓ / deliverables enumerable ✓ / acceptance executable ✓）——pass。design.draft lock 后转 `ready` → `in_progress`。

## Closure conditions

- A-O1..8 全 pass（Output interface + 生命周期 + 2 impl + dev/one-shot/watch 接入 + 殁骸拆除 + BuildResult 字段演进 + 行为 0 split）
- Durable findings propagated（compat 写 output 消费方死 → 记 storeInfo 塌缩 initiative backflow）
- Status/path/navigation 一致 + validator 0/0
