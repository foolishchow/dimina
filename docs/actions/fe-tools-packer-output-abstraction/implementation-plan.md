# Implementation Plan — fe-tools-packer-output-abstraction

Status authority: [Action Status](../STATUS.md)

> P-O1..3 分相，每相独立 commit + 行为 0 gate。依赖序：P-O1 → P-O2 → P-O3（殁骸拆除须在 2 impl 都接入后）。

## P-O1 — Output interface + MemOutput + dev 接入 + Output 生命周期

**依赖**：无（首发）

**改动**：
1. `types.ts` 加 `Output` interface + `PublishOpts`（D-O1）+ `BuildResult.buildModel` → `output?: Output | undefined`（D-OL3，F1）
2. 新增 `emit/output.ts`（F7 修正 lock）：`MemOutput` impl（Map 累积 + lazy index read + publish no-op）——复刻 BuildModel.getArtifact 语义（D-O2）
3. **Output 生命周期（D-OL1..4，F1，方案 B——orchestrator 入口创建）**：
   - orchestrator `orchestrate()` 入口（L121 request 构造后，mode-aware 点）创建：`const output = request.skipMaterialize ? new MemOutput() : new DiskOutput(ctx.targetPath)`——经 task ctx 初始化设 sctx.output（config-collector 跑前）
   - **config-collector 删 `sctx.buildModel = new BuildModel()` 行**（L36），只消费 sctx.output（职责分离）
   - orchestrator L83/85 stage compile onOutput → `sctx.output.add(entry)`（替代 sctx.buildModel.add）
   - orchestrator L294 `result.output = (context as {output?}).output`（替代 result.buildModel）
   - session L244 `state.output = buildResult.output`（首 build）
   - session L255 `build:end` listener 重新赋值 `state.output` 字段（同 state 对象，非替换 state）
4. `session/index.ts` dev 模式 dev server createServer params 改收 state（或窄接口）注入（替代 artifactResolver callback）
5. `dev/dev-server.ts` 读路径改 `output.read(path)`（miss 仍 fs.readFile fallback，D-O5）——createServer params 改收 Output（消 artifactResolver callback）
6. collaborator（publisher）暂保留 materialize 调用（P-O1 阶段 publisher 仍调 materialize + sctx.output.add 并行——MemOutput.publish no-op 等价 skipMaterialize；P-O2 改 publish）

**行为 0 验**（dev memfs 模式，F12 split）：
- tsc 0
- vitest：dev-reload.spec + dev-server.spec（dev server 读 Output.read + rebuild 替换 state.output）+ lifecycle-integration.spec（dev 路径）
- one-shot 7 diff=0（MemOutput 不影响 one-shot 路径——publisher 仍调 materialize，one-shot 走原 buildModel）

**风险**：dev server Output.read 须复刻 getArtifact lazy index；fs fallback 保留非编译资产。

## P-O2 — DiskOutput + one-shot/previewAdapter 接入

**依赖**：P-O1（Output interface 就位）

**改动**：
1. `emit/output.ts` 加 `DiskOutput` impl（累积 + dirty tracking + publish 封装 materialize+publishToDist+createDist 语义，D-O3）
   - 构造收 `final: string`（FINAL 发布目录）——scratch mkdtemp 在 publish 内（per-build，F3，非构造时）
   - `add` 累积 + dirty set（H4 D-PUSH-3）
   - `read` 返 null（F5）
   - `publish(target, opts)`：mkdtemp scratch + dirty guard + mkdir+writeFileSync+String(map) + rename/EXDEV/incremental sync + clearDirty（逐行复刻 materialize L104-120 + publishToDist L106-140 + createDist L22-30）
2. orchestrator 入口（mode-aware 点）：one-shot + previewAdapter + watch standalone（F4）→ `new DiskOutput(ctx.targetPath)`；dev（无 previewAdapter）→ `new MemOutput()`（替代 config-collector 创建——config-collector 删 buildModel 行）
3. `bin/compile.ts` / `index.ts` build facade：one-shot final=TARGET_PATH（orchestrator 入口已按 mode 选 DiskOutput）
4. `session/index.ts` previewAdapter-dev 分支：orchestrator 入口按 skipMaterialize=false 选 DiskOutput（现状 skipMaterialize=false 路径）
5. `emit/publisher.ts` collaborator 改 deps.output + `output.publish(target, opts)`（非 materialize + publishToDist）——消 skipMaterialize guard
6. `emit/dist-preparer.ts`：createDist 语义已入 DiskOutput.publish——dist-preparer 退役（P-O3 删；P-O2 阶段如需分离可保留 thin wrapper，倾向直接并入 publish）

**行为 0 验**（one-shot + previewAdapter + watch disk 模式）：
- tsc 0
- vitest：compile-cli-cache.spec + lifecycle-integration.spec（one-shot 路径）+ view-selective-stages（previewAdapter）
- 7 项目 one-shot build diff=0（byte-identical——DiskOutput.publish 复刻 materialize+publishToDist）

**风险**：DiskOutput.publish byte-exact 复刻（mkdir recursive/writeFileSync/String(map)/rename/EXDEV/incremental sync/dirty guard）；scratch mkdtemp per-build 原子性（复刻 storeInfo per-orchestrate）；dirty tracking 增量（H4 D-PUSH-3）。

## P-O3 — 殁骸拆除 + compat 写 output 消费方死

**依赖**：P-O1 + P-O2（2 impl 都接入，caller 全迁）

**改动**：
1. grep 验殁骸 caller=0 → 删：
   - `BuildModel` class（emit/build-model.ts）——累积 + dirty 已迁 DiskOutput；getArtifact 已迁 MemOutput.read
   - `materialize` 函数（emit/build-model.ts L104）
   - `publishToDist` + `createDist` 函数（emit/publish.ts）
   - `artifactResolver` callback + dev-server createServer params 注入点
   - `skipMaterialize` flag（types.ts L437 + publisher L31 + orchestrator L156/187/277 + session L235 + index.ts L26/78 + runner.ts L40）
2. grep 验 compat 写 output 消费方死：
   - `getTargetPath()` 在 createDist/materialize/publishToDist 调用全消（grep 验 env.ts getter caller 在 emit/* = 0）
   - 注：`getTargetPath()` 在 compiler/* parse-walk（collectAssets）仍存——worker 侧，resetStoreInfo 喂，不动
3. `BuildResult.buildModel` 字段（types.ts L503）→ `output: Output | undefined`；BuildModel type 删；`BuildResult.entries`（L496）改 sourced from output（保 entries 公开契约）
4. `emit/dist-preparer.ts` 退役——createDist 语义入 DiskOutput.publish
5. Output impl 文件归置：`emit/output.ts`（F7 lock，2 class + 1 interface）

**行为 0 验**（全量，F12 split）：
- tsc 0
- vitest 全绿（88 files——含 dev spec + one-shot spec 双模式）
- 7 项目 one-shot diff=0（`node --experimental-strip-types /tmp/dc-build.mjs diff`）
- dev 行为由 spec 覆盖（dev-reload/dev-server spec）
- grep 验：`BuildModel`/`materialize`/`publishToDist`/`createDist`/`artifactResolver`/`skipMaterialize` caller=0

**回滚**：每相独立 commit。若某相破行为 0 → revert 该相 commit，重新评估。P-O2（DiskOutput.publish 复刻）是最大 blast radius——若 byte 不一致，可拆 P-O2a（DiskOutput.add + dirty）+ P-O2b（publish 复刻逐语义）。

## backflow 记录（P-O3 后）

- compat 写 output-path 消费方死 → 记 storeInfo 塌缩 initiative（R-NS8 backflow 续）
- targetPath 双语义消解 → PackerContext 不再背 TEMP scratch → storeInfo 塌缩时 temporaryTargetPath gap 关闭更易
- 殁骸拆除后 env.ts ALS 门面剩 config 消费方（project-store.getDependencyGraph 等）——留 storeInfo 塌缩处理
