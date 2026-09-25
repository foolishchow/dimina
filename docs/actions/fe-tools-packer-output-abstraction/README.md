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
| `orchestrator.ts` | collaborator 接 Output（sctx.output 或 deps.output）；Output impl 构造点 |
| `session/index.ts` | dev 选 MemOutput + 注入 dev server Output.read（替代 artifactResolver） |
| `dev/dev-server.ts` | 读路径改 Output.read（统一 memory/disk，miss 仍 fs fallback 非编译资产） |
| `bin/compile.ts` | one-shot 选 DiskOutput（或经 build() facade） |
| `index.ts`（build facade） | Output impl 选择 + 构造（mode-driven） |

## Design inputs

- 北星 shape：[`types.ts`](../../../fe/tools/bundler/src/packer/types.ts) §4 EmitOptions/EmitBucket + §8 BuildResult（D-NS-3 entries: EmitEntry[]）
- 现有 output 机制：[`emit/build-model.ts`](../../../fe/tools/bundler/src/packer/emit/build-model.ts)（BuildModel class）+ [`emit/publish.ts`](../../../fe/tools/bundler/src/packer/emit/publish.ts)（createDist/publishToDist）+ [`emit/publisher.ts`](../../../fe/tools/bundler/src/packer/emit/publisher.ts)
- memfs 决策：[`fe-tools-bundler-emit-memfs`](../_archive/complete/fe-tools-bundler-emit-memfs/README.md) D-MM-1..6（直读 BuildModel + skipMaterialize dev 跳过）
- H4 dirty tracking：D-PUSH-3（dirtyEntries set + materialize 增量 guard）
- 架构张力：[`2026-10-10-packer-architecture-analysis.md`](../../fe-tools/2026-10-10-packer-architecture-analysis.md) §9 T1/T2/T3

## Deliverables

1. `Output` interface（types.ts §10）+ MemOutput impl + DiskOutput impl
2. dev server 读路径统一（Output.read 替代 artifactResolver + fs-fallback 双路）
3. one-shot/previewAdapter 写+发布路径统一（DiskOutput.publish 替代 materialize + publishToDist + createDist）
4. 殁骸拆除：BuildModel / materialize / publishToDist / createDist / artifactResolver / skipMaterialize
5. 行为 0 三件套（tsc 0 + vitest 全绿 + 7 项目 diff=0）跨 dev（memfs）+ one-shot（disk）双模式

## Readiness gaps

- **D-O1 Output interface 形状**（add/read/publish 签名 + dirty tracking 是否 interface 级）——design.draft 待 lock
- **D-O2 DiskOutput.publish 语义封装边界**（createDist seed 逻辑是否入 Output）——design.draft 待 lock
- **D-O3 dev server fs-fallback 保留范围**（非编译资产 SDK/static 仍读盘 FINAL）——design.draft 待 lock

formalize gate（problem observable ✓ / goal concrete ✓ / scope statable ✓ / dependencies identifiable ✓ / deliverables enumerable ✓ / acceptance executable ✓）——pass。design.draft lock 后转 `ready` → `in_progress`。

## Closure conditions

- A-O1..N 全 pass（Output interface + 2 impl + dev/one-shot 接入 + 殁骸拆除 + 行为 0）
- Durable findings propagated（compat 写 output 消费方死 → 记 storeInfo 塌缩 initiative backflow）
- Status/path/navigation 一致 + validator 0/0
