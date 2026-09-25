# Implementation Plan — fe-tools-packer-output-abstraction

Status authority: [Action Status](../STATUS.md)

> P-O1..3 分相，每相独立 commit + 行为 0 gate。依赖序：P-O1 → P-O2 → P-O3（殁骸拆除须在 2 impl 都接入后）。

## P-O1 — Output interface + MemOutput + dev 接入

**依赖**：无（首发）

**改动**：
1. `types.ts` §10 加 `Output` interface + `PublishOpts`（D-O1）
2. 新增 `emit/output.ts`（或 `emit/output/mem-output.ts`）：`MemOutput` impl（Map 累积 + lazy index read + publish no-op）——复刻 BuildModel.getArtifact 语义（D-O2）
3. `session/index.ts` dev 模式构造 MemOutput + 注入 dev server（替代 artifactResolver callback）+ 注入 sctx.output（供 collaborator）
4. `dev/dev-server.ts` 读路径改 `output.read(path)`（miss 仍 fs.readFile fallback，D-O5）——消 artifactResolver 参数
5. collaborator（publisher）读 sctx.output（暂保留 materialize 调用——P-O2 改 publish）**或** P-O1 阶段 publisher 仍调 materialize（MemOutput.publish no-op 等价 skipMaterialize）

**行为 0 验**（dev memfs 模式）：
- tsc 0
- vitest：dev-reload.spec + dev-server.spec + lifecycle-integration.spec（dev 路径）
- 7 项目 dev build diff=0（dev mode byte-identical——同内存，产物 publish 不变）

**风险**：dev server Output.read 须复刻 getArtifact lazy index；fs fallback 保留非编译资产。

## P-O2 — DiskOutput + one-shot/previewAdapter 接入

**依赖**：P-O1（Output interface 就位）

**改动**：
1. `emit/output.ts` 加 `DiskOutput` impl（累积 + dirty tracking + publish 封装 materialize+publishToDist+createDist 语义，D-O3）
   - 构造收 `final: string` + `scratch?: string`（mkdtemp 构造时算，computePathInfo 语义——非 storeInfo 内重算）
   - `add` 累积 + dirty set（H4 D-PUSH-3）
   - `publish(target, opts)`：dirty guard + mkdir+writeFileSync+String(map) + rename/EXDEV/incremental sync + clearDirty（逐行复刻 materialize L104-120 + publishToDist L106-140 + createDist L22-30）
2. `bin/compile.ts` / `index.ts` build facade：one-shot 构造 DiskOutput（收 final=TARGET_PATH + scratch=mkdtemp）注入 orchestrate
3. `session/index.ts` previewAdapter-dev 分支：构造 DiskOutput（现状 skipMaterialize=false 路径）
4. `emit/publisher.ts` collaborator 改调 `output.publish(target, opts)`（非 materialize + publishToDist）——消 skipMaterialize guard
5. `emit/dist-preparer.ts`：createDist 语义已入 DiskOutput.publish——dist-preparer 退役或改 thin wrapper（P-O3 清）

**行为 0 验**（one-shot + previewAdapter disk 模式）：
- tsc 0
- vitest：compile-cli-cache.spec + lifecycle-integration.spec（one-shot 路径）+ view-selective-stages（previewAdapter）
- 7 项目 one-shot build diff=0（byte-identical——DiskOutput.publish 复刻 materialize+publishToDist）

**风险**：DiskOutput.publish byte-exact 复刻（mkdir recursive/writeFileSync/String(map)/rename/EXDEV/incremental sync/dirty guard）；scratch mkdtemp 原子性（并行构建）；dirty tracking 增量（H4 D-PUSH-3）。

## P-O3 — 殁骸拆除 + compat 写 output 消费方死

**依赖**：P-O1 + P-O2（2 impl 都接入，caller 全迁）

**改动**：
1. grep 验殁骸 caller=0 → 删：
   - `BuildModel` class（emit/build-model.ts）——累积 + dirty 已迁 DiskOutput；getArtifact 已迁 Output.read
   - `materialize` 函数（emit/build-model.ts L104）
   - `publishToDist` + `createDist` 函数（emit/publish.ts）
   - `artifactResolver` callback + dev-server 注入参数
   - `skipMaterialize` flag（CompileOptions/types.ts + publisher guard + session/runner/index 传参点）
2. grep 验 compat 写 output 消费方死：
   - `getTargetPath()` 在 createDist/materialize/publishToDist 调用全消（grep 验 env.ts getter caller 在 emit/* = 0）
   - 注：`getTargetPath()` 在 compiler/* parse-walk（collectAssets）仍存——worker 侧，resetStoreInfo 喂，不动
3. `emit/dist-preparer.ts` 退役（如未在 P-O2 清）——createDist 语义入 DiskOutput.publish
4. Output impl 文件归置（emit/output.ts 或拆 mem-output.ts/disk-output.ts）

**行为 0 验**（全量）：
- tsc 0
- vitest 全绿（88 files——含 dev + one-shot 双模式 spec）
- 7 项目 diff=0（`node --experimental-strip-types /tmp/dc-build.mjs diff`）
- grep 验：`BuildModel`/`materialize`/`publishToDist`/`createDist`/`artifactResolver`/`skipMaterialize` caller=0

**回滚**：每相独立 commit。若某相破行为 0 → revert 该相 commit，重新评估。P-O2（DiskOutput.publish 复刻）是最大 blast radius——若 byte 不一致，可拆 P-O2a（DiskOutput.add + dirty）+ P-O2b（publish 复刻逐语义）。

## backflow 记录（P-O3 后）

- compat 写 output-path 消费方死 → 记 storeInfo 塌缩 initiative（R-NS8 backflow 续）
- targetPath 双语义消解 → PackerContext 不再背 TEMP scratch → storeInfo 塌缩时 temporaryTargetPath gap 关闭更易
- 殁骸拆除后 env.ts ALS 门面剩 config 消费方（project-store.getDependencyGraph 等）——留 storeInfo 塌缩处理
