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
| `fe-tools-sidecar` | `draft` | [README](fe-tools-sidecar/README.md) | Umbrella（draft）；近端结构多已归档；**PS3 deferred**；TS-2 [`fe-tools-wxml-ir`](_archive/complete/fe-tools-wxml-ir/README.md) **complete 已归档**（view 缝；style 剩余）；E7 incremental-target 仍 draft；TS-4 成文。 | 2026-09-14 |
| `fe-tools-project-store` | `complete` | [README](_archive/complete/fe-tools-project-store/README.md) | ProjectStore **PS1+PS2 已交付并归档**：壳 + 刀 A + M-A + 删闭包镜像（W3→仅 Store）；Store 唯一活图权威；消融 ×3（M-A-inject / PS2-store / PS2-plan）；PS3 未实施。 | 2026-09-12 |
| `fe-tools-build-pipeline` | `complete` | [README](_archive/complete/fe-tools-build-pipeline/README.md) | BuildPipeline **BP1 已交付并归档**：阶段表等价抽取→`src/compiler/build-pipeline.js`；index.js 薄委托；Listr 仍在；行为 0（nomap 94 / sourcemap 185 diff=0）；485 tests / 73 suites 全绿；M-A 消融 ×1；A-BP01..05 全 pass。 | 2026-09-12 |
| `fe-tools-bundler-output-pure` | `superseded` | [README](_archive/superseded/fe-tools-bundler-output-pure/README.md) | output 纯化（worker 无 fs）+ 删 collectOutput=false 直写。**方案 C 证伪**（40 测试 parentPort null 崩溃）。**被 fe-tools-worker-runtime superseded**——worker-runtime 删 collectOutput（零残留）+ emitEntry 从 getStore 拿 sink + 测试直连 runWithAbilities（FileSink）+ warnOnce getStore 兜底，5 项目标全包含。 | 2026-09-16 |
| `fe-tools-worker-runtime` | `complete` | [README](_archive/complete/fe-tools-worker-runtime/README.md) | 收敛线程调度知识到 worker-runtime 面（11 决策全拍）；executeTask 资源层接缝；emitEntry fire-and-forget；pool/queue 留未来。31 轮 review 全收敛（56 findings 全落盘，R31 pass）。**实施完成 + close**：P-WR00..08 全步通过，4 组 diff=0 + 584/584 + tsc OK。 | 2026-09-16 |
| `fe-tools-bundler-emit-memfs` | `draft` | [README](fe-tools-bundler-emit-memfs/README.md) | 阶段 2：dev memfs（产物不落盘）；依赖 output-pure close（materialize 成唯一写盘点后才有单一边界）；memfs 方案 + 漏网点收口待拍板。 | 2026-09-16 |
| `fe-tools-bundler-emit-layer` | `complete` | [README](_archive/complete/fe-tools-bundler-emit-layer/README.md) | 三刀 C 的刀 1：emit 抽取（pipeline/emit.js emitEntry + bundle/perModule 策略 + pipeline/output.js write）；A-E0..5 / P-E01..06 全 pass；Close 复验 `a48df487` 584/584 + 4 组 diff=0；D-E-1..12 回流；已归档。 | 2026-09-15 |
| `fe-tools-bundler-layout` | `complete` | [README](_archive/complete/fe-tools-bundler-layout/README.md) | 目录双轴归置：`common/`/`core/`→`compiler|model|watch|dev|shared`；行为 0 变化（481 测绿；nomap 94 / sm 185 diff=0）；已归档。 | 2026-09-12 |
| `fe-tools-bundler-session` | `complete` | [README](_archive/complete/fe-tools-bundler-session/README.md) | 会话/编排门面（曾用名 bundler-core）：O1–O3 全交付（session 模块 + ./session 子路径 + CLI 全经 session）；479 测试全绿；消融×3；产物字节级等价（nomap+sourcemap）；已知限制（监听累积）随档保留。已归档。 | 2026-09-10 |
| `fe-tools-build-model` | `complete` | [README](_archive/complete/fe-tools-build-model/README.md) | 内部统一第一步（主线程层）：M1 结果边界（产物回传+BuildModel+materialize）+ M2 指纹失效（(mtime,size)+scan/closure+verify 对拍 MUST）已交付；M3 cache 迁移 defer。A-BM01..07 全 pass + 6 项消融。已归档。 | 2026-09-10 |
| `fe-tools-module-cache` | `complete` | [README](_archive/complete/fe-tools-module-cache/README.md) | worker 内层：**缩 scope 闭合**（见 README「实际交付摘要」）— MC1 失败缓存脚手架 + D-MC-3 选项 B / MC2 style minify key + D-MC-5 / MC3 测例；**未**做 ModuleCache 分层与内容寻址。消融 ×3。已归档。 | 2026-09-12 |
| `fe-tools-worker-architecture` | `complete` | [README](_archive/complete/fe-tools-worker-architecture/README.md) | **决策 Action（已落地 + 归档）**：四阶段演进 + D-WA-1..6 + WorkerTask/Result 协议 v1/v2 + 超时防护 + stats 消费契约。被 build-model + module-cache 引用消费，无实施冲突。已归档。 | 2026-09-10 |
| `fe-tools-bundler-unvite` | `complete` | [README](_archive/complete/fe-tools-bundler-unvite/README.md) | 卫生：下线 Vite 自打包；镜像 dist + watch shim；A-UV01..09 / P-001..008（含 dimina-cli build/dev）；已归档。 | 2026-09-10 |
| `fe-tools-bootstrap-copy` | `complete` | [README](_archive/complete/fe-tools-bootstrap-copy/README.md) | 独立搬迁 complete：tools/bundler+web-container-sdk；`dimina-cli` 冒烟 200；packages 干净；已归档。 | 2026-09-10 |
| `fe-tools-compiler-target` | `complete` | [README](_archive/complete/fe-tools-compiler-target/README.md) | CompileTarget 形态层：T0 入口纪律 + T1 静态描述 + T2 阶段派生；A-CT0..06 全 pass；消融 ×3；回流 architecture-notes；已归档。 | 2026-09-14 |
| `fe-tools-incremental-target` | `draft` | [README](fe-tools-incremental-target/README.md) | E7 增量形态回灌：watch/cache options 袋与 CompileTarget 对齐（S1/S2/S3/S9）；契约 A/B 待拍板；未授权实施。 | 2026-09-14 |
| `fe-tools-bundler-boundaries` | `complete` | [README](_archive/complete/fe-tools-bundler-boundaries/README.md) | Packer/Scheme 职责与目录/文件落点；不改 src。D-BD-1..6 全拍板（4 焊点：emit.ts/logic/env/dependency-graph）；落点表封口全集；env.ts 15 处核对通过；architecture-notes 回流；零 diff 验证通过。已归档。 | 2026-09-18 |
| `fe-tools-compiler-layering` | `complete` | [README](_archive/complete/fe-tools-compiler-layering/README.md) | compiler 目录归位（两轴 + WORKER_ENTRY + 根级 index.js 删除）；559/559 + diff=0；A-CL1 修正（函数拆散推迟）；已归档。 | 2026-09-15 |
| `fe-tools-wxml-parser-dist` | `complete` | [README](_archive/complete/fe-tools-wxml-parser-dist/README.md) | P0 `c2d792de` + P1 `7e43f175`：完整双态 + 五平台矩阵 + 子包模板 + 发版流；584/584 + dry-run 连通；**P-WX01 声明 Uncovered**（fork Actions 未启用）；已归档。 | 2026-09-15 |
| `fe-tools-wxml-refactor` | `complete` | [README](_archive/complete/fe-tools-wxml-refactor/README.md) | W1–W3：23 函数归位 + 标准 Document + 默认 napi；A-WR0..5 / P-WR00..07 全 pass；Close 复验 `13c9c902` 580/580 + P-WR06 diff=0；不变量回流；已归档。 | 2026-09-15 |
| `fe-tools-wxml-layout` | `complete` | [README](_archive/complete/fe-tools-wxml-layout/README.md) | L0–L2：napi/cheerio + load/ + compile.js + renderer/vue/；同门删净；A-WL0..5 / P-WL00..07 全 pass；Close 复验 `4259ebdd` 580/580 + diff=0；不变量回流；已归档。 | 2026-09-15 |
| `fe-tools-bundler-typecheck` | `complete` | [README](_archive/complete/fe-tools-bundler-typecheck/README.md) | S0+S1 交付（`eb3b2bc4`）：allowJs+CI `tsc --noEmit` + 七文件 `@ts-check` + 集中 typedef；580/580 + diff=0；已归档。 | 2026-09-15 |
| `fe-tools-bundler-tsc-dist` | `complete` | [README](_archive/complete/fe-tools-bundler-tsc-dist/README.md) | B2 交付：build=tsc emit + sync-dist 删除 + 第0/1刀迁 .ts + D-TD-17..20（TS5055 包名化/exports 重映射/热修/显式 .ts 后缀路线）；580/580 + diff=0 + 双消融；已归档。 | 2026-09-15 |
| `fe-tools-wxml-bridge` | `complete` | [README](_archive/complete/fe-tools-wxml-bridge/README.md) | Rust parser napi 桥 + sourcemap 跨文件归位（W0/W1/W2）；559/559 + 无 include 页 sourcemap diff=0 + 消融 ×2；D-WIR-1 修订回流；已归档。 | 2026-09-14 |
| `fe-tools-wxml-ir` | `complete` | [README](_archive/complete/fe-tools-wxml-ir/README.md) | TS-2：parse→Document→load→Backend 缝 + registry；行为 0 严格 diff=0；消融 ×2；S13 view 收口（style 书面剩余）；不变量回流；已归档。 | 2026-09-14 |
| `fe-tools-session-unify` | `complete` | [README](_archive/complete/fe-tools-session-unify/README.md) | session 三入口内核抽取 + 调度收口；S1+S2 交付（`src/session/runner.js` 内核；壳零 activeLoop 访问）；500/74 全绿；diff=0 ×2 基线；消融 ×2；结构不变量已回流 architecture-notes；已归档。 | 2026-09-14 |
| `fe-tools-ts-migration` | `complete` | [README](_archive/complete/fe-tools-ts-migration/README.md) | **bundler/src 全仓 72 .js→.ts 完成**；import 后缀显式 .ts；行为 0（4 组 diff=0 + 584/584 + tsc 0 错）；JSDoc→TS type（不用 any）；深度类型化 274→29 硬类型（89.4%）+ @ts-expect-error 556→3（99.5%）+ tsconfig 5 类 strict lint + 35 处存量修复；Close 复验 `b124f84c`。已归档。 | 2026-09-16 |
