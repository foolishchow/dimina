# Acceptance — fe-tools-packer-output-abstraction

Status: **draft（2026-10-10；D-O1..7 待 review lock，P-O1..3 实施序）**

Status authority: [Action Status](../STATUS.md)

| ID | Req | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-O1 | R-O1 | Output interface 抽象 | types.ts §10 含 `Output` interface（add(EmitEntry)/read(path)→{code}\|null/publish(target,opts?)）+ `PublishOpts`；tsc 0 | pending |
| A-O2 | R-O2 | MemOutput impl（dev memfs） | `MemOutput` 实现 Output：add 写内存 Map + lazy index（add 失效——复刻 BuildModel.getArtifact）+ read 读内存 + publish no-op；行为 == 现状 dev memfs（D-MM-1） | pending |
| A-O3 | R-O3 | DiskOutput impl（one-shot + previewAdapter） | `DiskOutput` 实现 Output：add 累积 + dirty set（H4 D-PUSH-3）+ publish 封装 materialize+publishToDist+createDist（dirty guard + mkdir+writeFileSync+String(map) + rename/EXDEV/incremental sync + clearDirty）；构造收 final + scratch(mkdtemp)；行为 == 现状 one-shot/previewAdapter | pending |
| A-O4 | R-O4 | dev server 读路径统一 | dev-server.ts 改 `output.read(path)` 单一入口（消 artifactResolver callback）；miss 仍 fs.readFile(serveRoot) fallback（非编译资产 SDK/static） | pending |
| A-O5 | R-O5 | mode-driven impl 选择 | dev→MemOutput / one-shot+previewAdapter→DiskOutput（session.dev + build facade 构造点）；消 skipMaterialize flag（grep skipMaterialize caller=0） | pending |
| A-O6 | R-O6 | 殁骸拆除 | grep 验 caller=0：`BuildModel`/`materialize`/`publishToDist`/`createDist`/`artifactResolver`/`skipMaterialize` 全退役；compat 写 output 消费方死（`getTargetPath()` 在 emit/* caller=0——注：compiler/* parse-walk collectAssets 仍存，worker 侧不动） | pending |
| A-O7 | R-O7 | 行为 0 | tsc 0 + vitest 88/88 全绿（dev-reload/dev-server/compile-cli-cache/lifecycle-integration 双模式 spec）+ 7 项目 diff=0（dev memfs + one-shot disk 双模式 byte-identical） | pending |
| A-O8 | R-O8 | Non-scope 守 | storeInfo/sctx.storeInfo 不动 + worker ALS（resetStoreInfo+parse-walk getters）不动 + compiler/* 不动 + config computation 不动 + env.ts ALS 门面不删（compat 写 output 消费方死后剩 config 消费方留 storeInfo 塌缩） | pending |

## backflow（P-O3 后记录，非此 Action scope）

- compat 写 output-path 消费方死 → storeInfo 塌缩 initiative backflow（R-NS8 续）
- targetPath 双语义消解 → PackerContext 不再背 TEMP scratch
- env.ts ALS 门面剩 config 消费方（project-store.getDependencyGraph 等）→ 留 storeInfo 塌缩
