# Action Status

本文档是所有正式 Action 当前状态与位置的唯一权威。

## 状态模型

| 状态 | 含义 |
| --- | --- |
| `draft` | 范围或闭合定义尚不完整；未授权实施。 |
| `ready` | 需求、设计、计划、验收与验证足以执行。 |
| `in_progress` | 明确授权的实施或验证正在进行。 |
| `blocked` | 具体条件阻碍有效推进；Action 保持活动。 |
| `complete` | 必要验收通过、证据已记录、持久发现已回流。 |
| `superseded` | 另一 Action 或已接受的决策替代了本工作。 |
| `deferred` | 明确的决策推迟了本工作。 |

## 维护规则

- 创建正式 Action 时恰好新增一行，初始为 `draft`。
- Action README 的状态与本表保持一致。
- 状态、摘要、日期、路径、导航与归档位置作为一次一致变更更新。
- `draft` / `ready` / `in_progress` / `blocked` 的 Action 保持在 `docs/actions/<action-id>/`。
- 终局 Action 移入对应的 `_archive/` 位置。
- 变更状态前需要明确授权且满足目标门条件。
- `complete` 前必须通过验收、记录实际验证证据并完成持久发现回流。

## Actions

| Action | Status | Path | Summary | Updated |
| --- | --- | --- | --- | --- |
| `compiler-improvement` | `complete` | [README](_archive/complete/compiler-improvement/README.md) | 编译器改造 umbrella：A 轨道（A1/A2.0/A2/A3/A4）全部 complete；B/C deferred。A-001~A-009 全 passed，已归档。 | 2026-09-08 |
| `compiler-hook-layer` | `complete` | [README](_archive/complete/compiler-hook-layer/README.md) | Umbrella gate A1（事件契约已冻结 v1）：runBuild 生命周期驱动化交付，行为/产物零变化；A-001~A-009 全 passed，已归档。 | 2026-09-08 |
| `dmcc-dev-server` | `complete` | [README](_archive/complete/dmcc-dev-server/README.md) | Umbrella gate A2：`dmcc dev` 交付 dev 链路（静态服务 + 宿主页 + ws + 代理 + L1 relaunch）；A-001~A-012 全 passed，已归档。 | 2026-09-08 |
| `hmr-l2-l3` | `complete` | [README](_archive/complete/hmr-l2-l3/README.md) | Umbrella gate A3：Web 容器 dev-only L2 CSS 热替换 + L3 模板热重挂；A-001~A-013 全 passed，已归档。 | 2026-09-08 |
| `render-target-abstraction` | `complete` | [README](_archive/complete/render-target-abstraction/README.md) | Umbrella gate A4：renderer 抽象（对齐微信 app.json/page.json renderer），首个 `webview`，产物 diff=0；A-001~A-010 全 passed，已归档。 | 2026-09-08 |
| `compiler-configuration` | `complete` | [README](_archive/complete/compiler-configuration/README.md) | Umbrella：编译器配置化；CF-1..CF-4 全部 complete 并归档；D6:B / §4.6–§4.9 已回流。 | 2026-09-10 |
| `compiler-configurable` | `complete` | [README](_archive/complete/compiler-configurable/README.md) | CF-1：统一 compile config + 双字段 esTarget；A-001~A-009 全 passed（含 A-006 消融）；已归档。 | 2026-09-10 |
| `platform-abstraction` | `complete` | [README](_archive/complete/platform-abstraction/README.md) | CF-2：platform native/web + sourcemapStrategy 标注；A-001~A-009 全 passed（含缺省 native 消融）；已归档。 | 2026-09-10 |
| `es-target-unification` | `complete` | [README](_archive/complete/es-target-unification/README.md) | CF-3：仅 logic 车道收敛；A-001~A-008 全 passed（含消融；产物 diff=0）；已归档。 | 2026-09-10 |
| `watch-api` | `complete` | [README](_archive/complete/watch-api/README.md) | CF-4：watch API 化；A-001~A-009 全 passed（含 A-005 消融）；已归档。 | 2026-09-10 |
| `fe-tools-sidecar` | `draft` | [README](fe-tools-sidecar/README.md) | Umbrella（draft）；TS-2 IR deferred；近端 [`fe-tools-bundler-layout`](fe-tools-bundler-layout/README.md) **ready**（目录双轴归置）。 | 2026-09-12 |
| `fe-tools-bundler-layout` | `ready` | [README](fe-tools-bundler-layout/README.md) | 目录归置：build/dev × session/compiler；归属表 ACCEPTED；D-BL-1..8 冻；L1 试点=`dev/`；行为 0 变化。待实施授权。 | 2026-09-12 |
| `fe-tools-bundler-session` | `complete` | [README](_archive/complete/fe-tools-bundler-session/README.md) | 会话/编排门面（曾用名 bundler-core）：O1–O3 全交付（session 模块 + ./session 子路径 + CLI 全经 session）；479 测试全绿；消融×3；产物字节级等价（nomap+sourcemap）；已知限制（监听累积）随档保留。已归档。 | 2026-09-10 |
| `fe-tools-build-model` | `complete` | [README](_archive/complete/fe-tools-build-model/README.md) | 内部统一第一步（主线程层）：M1 结果边界（产物回传+BuildModel+materialize）+ M2 指纹失效（(mtime,size)+scan/closure+verify 对拍 MUST）已交付；M3 cache 迁移 defer。A-BM01..07 全 pass + 6 项消融。已归档。 | 2026-09-10 |
| `fe-tools-module-cache` | `complete` | [README](_archive/complete/fe-tools-module-cache/README.md) | worker 内层：**缩 scope 闭合**（见 README「实际交付摘要」）— MC1 失败缓存脚手架 + D-MC-3 选项 B / MC2 style minify key + D-MC-5 / MC3 测例；**未**做 ModuleCache 分层与内容寻址。消融 ×3。已归档。 | 2026-09-12 |
| `fe-tools-worker-architecture` | `complete` | [README](_archive/complete/fe-tools-worker-architecture/README.md) | **决策 Action（已落地 + 归档）**：四阶段演进 + D-WA-1..6 + WorkerTask/Result 协议 v1/v2 + 超时防护 + stats 消费契约。被 build-model + module-cache 引用消费，无实施冲突。已归档。 | 2026-09-10 |
| `fe-tools-bundler-unvite` | `complete` | [README](_archive/complete/fe-tools-bundler-unvite/README.md) | 卫生：下线 Vite 自打包；镜像 dist + watch shim；A-UV01..09 / P-001..008（含 dimina-cli build/dev）；已归档。 | 2026-09-10 |
| `fe-tools-bootstrap-copy` | `complete` | [README](_archive/complete/fe-tools-bootstrap-copy/README.md) | 独立搬迁 complete：tools/bundler+web-container-sdk；`dimina-cli` 冒烟 200；packages 干净；已归档。 | 2026-09-10 |
