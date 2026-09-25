# Acceptance — fe-tools-packer-output-abstraction

Status: **draft（2026-10-10；review round 1-3 findings F1-F12 已修正；D-O1..7 + D-OL1..4 待 review lock）**

Status authority: [Action Status](../STATUS.md)

| ID | Req | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-O1 | R-O1 | Output interface + 生命周期 | types.ts 含 `Output` interface（add/read/publish/**getEntries**，F-R4-2）+ `PublishOpts`；tsc 0；**Output 生命周期 D-OL1..4 方案 B**（orchestrator 入口创建 mode-aware + **listr2 ctx 注入 tasks.run({output})** F-R4-3 + config-collector 删 buildModel 行只消费 + stage onOutput add + BuildResult.buildModel→output 字段 + session state.output + build:end listener 重新赋值字段 + dev server 持 OutputRef 窄接口读 output）替代 buildModel 流 | pending |
| A-O2 | R-O2 | MemOutput impl（dev memfs） | `MemOutput` 实现 Output：add 写内存 Map + lazy index（add 失效——复刻 BuildModel.getArtifact）+ read 读内存 + publish no-op；**实证前提**（纯 dev serveRoot 空——seedPath 缺 + materialize 跳 → no-op 等价）；行为 == 现状纯 dev memfs | pending |
| A-O3 | R-O3 | DiskOutput impl（one-shot + previewAdapter + watch） | `DiskOutput` extend BaseOutput（F-R10-2）：add 累积 + dirty set（H4 D-PUSH-3）+ **read 读累积内存 lazy index**（F-R4-1，继承 BaseOutput，非 null——previewAdapter-dev 须即时内存读）+ getEntries（F-R4-2）+ publish 封装 materialize+publishToDist+createDist（**per-build mkdtemp scratch**，F3 + **temporary=true hardcode** F-R10-1 + dirty guard + mkdir+writeFileSync+String(map) + rename/EXDEV/incremental sync + clearDirty）；构造收 final；行为 == 现状 one-shot/previewAdapter | pending |
| A-O4 | R-O4 | dev server 读路径统一 | dev-server.ts 改 `outputRef.output?.read(path)` 单一入口（createServer params 收 **OutputRef 窄接口**，F-R5-2，消 artifactResolver callback）；miss 仍 fs.readFile(serveRoot) fallback；**serveRoot mode-dep**（F8——纯 dev mkdtemp 空 / previewAdapter-dev mkdtemp 落盘 / one-shot final）；dev server 持 OutputRef 读 output 字段（D-OL4，rebuild 重新赋值字段，读当前值） | pending |
| A-O5 | R-O5 | mode-driven impl 选择 | **4 mode 覆盖**（F4）：dev→MemOutput / one-shot+previewAdapter+watch-standalone→DiskOutput（**orchestrator 入口 mode-aware 创建**，方案 B，按 request.skipMaterialize）；config-collector 删 buildModel 行只消费 sctx.output；消 skipMaterialize flag（grep skipMaterialize caller=0） | pending |
| A-O6 | R-O6 | 殁骸拆除（含全 sctx.buildModel 消费者 + type 字段演进 + isTemporaryTargetPath） | grep 验 caller=0：`BuildModel`/`materialize`/`publishToDist`/`createDist`/`artifactResolver`/`skipMaterialize`/`sctx.buildModel` 全退役（含全 caller 点：types L437 + publisher L31 + orchestrator **L143**（F-R5-1）+ L156/187/277 + session L235 + index L26/78 + runner L40）；compat 写 output 消费方死（`getTargetPath()` + **`isTemporaryTargetPath()`**（F-R11-2）在 emit/* caller=0）；**F-R10-1 publisher 删 sctx.storeInfo.pathInfo 消费**（buildDir/temporaryTargetPath）；**BuildResult.buildModel→output**（types L503）+ BuildModel type 删 + BuildResult.entries sourced from output.getEntries()（F-R4-2）；**F-R7-1 sctx.buildModel 消费者**：stage-dispatcher L54 + logic-emitter L37/L42 → sctx.output；**F-R7-2/R7-3 type 字段演进**：StageChannelContext（types L123）+ SessionState（session/index.ts L59）buildModel?→output? | pending |
| A-O7 | R-O7 | 行为 0（双模式 split） | tsc 0 + vitest 88/88 全绿（dev-reload/dev-server/compile-cli-cache/lifecycle-integration 双模式 spec）；**one-shot 7 项目 diff=0**（dc-build）；**dev 行为 spec 覆盖**（F12——dev mode 无 7-diff 方法，dev-reload/dev-server spec 验 Output.read + rebuild 替换 state.output） | pending |
| A-O8 | R-O8 | Non-scope 守 | storeInfo/sctx.storeInfo 不动 + worker ALS（resetStoreInfo+parse-walk getters）不动 + compiler/* 不动 + config computation 不动 + env.ts ALS 门面不删（compat 写 output 消费方死后剩 config 消费方留 storeInfo 塌缩） | pending |

## backflow（P-O3 后记录，非此 Action scope）

- compat 写 output-path 消费方死 → storeInfo 塌缩 initiative backflow（R-NS8 续）
- targetPath 双语义消解 → PackerContext 不再背 TEMP scratch
- env.ts ALS 门面剩 config 消费方（project-store.getDependencyGraph 等）→ 留 storeInfo 塌缩
