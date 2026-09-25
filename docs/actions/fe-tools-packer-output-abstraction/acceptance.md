# Acceptance — fe-tools-packer-output-abstraction

Status: **draft（2026-10-10；review round 1-3 findings F1-F12 已修正；D-O1..7 + D-OL1..4 待 review lock）**

Status authority: [Action Status](../STATUS.md)

| ID | Req | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-O1 | R-O1 | Output interface + 生命周期 | types.ts 含 `Output` interface（add/read/publish）+ `PublishOpts`；tsc 0；**Output 生命周期 D-OL1..4**（config-collector 设 sctx.output + stage onOutput add + BuildResult.buildModel→output 字段 + session state.output + rebuild listener 替换 + dev server Output.read）替代 buildModel 流 | pending |
| A-O2 | R-O2 | MemOutput impl（dev memfs） | `MemOutput` 实现 Output：add 写内存 Map + lazy index（add 失效——复刻 BuildModel.getArtifact）+ read 读内存 + publish no-op；**实证前提**（纯 dev serveRoot 空——seedPath 缺 + materialize 跳 → no-op 等价）；行为 == 现状纯 dev memfs | pending |
| A-O3 | R-O3 | DiskOutput impl（one-shot + previewAdapter + watch） | `DiskOutput` 实现 Output：add 累积 + dirty set（H4 D-PUSH-3）+ read 返 null（F5）+ publish 封装 materialize+publishToDist+createDist（**per-build mkdtemp scratch**，F3 + dirty guard + mkdir+writeFileSync+String(map) + rename/EXDEV/incremental sync + clearDirty）；构造收 final；行为 == 现状 one-shot/previewAdapter | pending |
| A-O4 | R-O4 | dev server 读路径统一 | dev-server.ts 改 `output.read(path)` 单一入口（createServer params 收 Output，消 artifactResolver callback）；miss 仍 fs.readFile(serveRoot) fallback；**serveRoot mode-dep**（F8——纯 dev mkdtemp 空 / previewAdapter-dev mkdtemp 落盘 / one-shot final） | pending |
| A-O5 | R-O5 | mode-driven impl 选择 | **4 mode 覆盖**（F4）：dev→MemOutput / one-shot+previewAdapter+watch-standalone→DiskOutput（config-collector 按 request.mode 构造）；消 skipMaterialize flag（grep skipMaterialize caller=0） | pending |
| A-O6 | R-O6 | 殁骸拆除（含 BuildResult 字段） | grep 验 caller=0：`BuildModel`/`materialize`/`publishToDist`/`createDist`/`artifactResolver`/`skipMaterialize` 全退役（含全 caller 点：types L437 + publisher L31 + orchestrator L156/187/277 + session L235 + index L26/78 + runner L40）；compat 写 output 消费方死（`getTargetPath()` 在 emit/* caller=0）；**BuildResult.buildModel→output 字段**（types L503）+ BuildModel type 删 + BuildResult.entries sourced from output（保公开契约） | pending |
| A-O7 | R-O7 | 行为 0（双模式 split） | tsc 0 + vitest 88/88 全绿（dev-reload/dev-server/compile-cli-cache/lifecycle-integration 双模式 spec）；**one-shot 7 项目 diff=0**（dc-build）；**dev 行为 spec 覆盖**（F12——dev mode 无 7-diff 方法，dev-reload/dev-server spec 验 Output.read + rebuild 替换 state.output） | pending |
| A-O8 | R-O8 | Non-scope 守 | storeInfo/sctx.storeInfo 不动 + worker ALS（resetStoreInfo+parse-walk getters）不动 + compiler/* 不动 + config computation 不动 + env.ts ALS 门面不删（compat 写 output 消费方死后剩 config 消费方留 storeInfo 塌缩） | pending |

## backflow（P-O3 后记录，非此 Action scope）

- compat 写 output-path 消费方死 → storeInfo 塌缩 initiative backflow（R-NS8 续）
- targetPath 双语义消解 → PackerContext 不再背 TEMP scratch
- env.ts ALS 门面剩 config 消费方（project-store.getDependencyGraph 等）→ 留 storeInfo 塌缩
