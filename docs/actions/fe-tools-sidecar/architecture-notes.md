# Architecture notes — session / ProjectStore / BuildPipeline

Status: **discussion consensus**（2026-09-12）  
Authority pointers: [`fe-tools-project-store`](../_archive/complete/fe-tools-project-store/README.md) · [`fe-tools-build-pipeline`](../_archive/complete/fe-tools-build-pipeline/README.md) · [`fe-tools-session-unify`](../_archive/complete/fe-tools-session-unify/README.md) · [`fe-tools-compiler-target`](../_archive/complete/fe-tools-compiler-target/README.md) · [`fe-tools-incremental-target`](../_archive/complete/fe-tools-incremental-target/README.md)（draft） · [`fe-tools-wxml-ir`](../_archive/complete/fe-tools-wxml-ir/README.md)（**ready** · TS-2） · [compiler-symptom-inventory](./compiler-symptom-inventory.md) · 已归档 session

## 唯一会话管理者

> **Session（`createBundler`）是唯一会话管理者。**  
> `ProjectStore` / `BuildPipeline` 是会话的部件，不升级为会话，也不另立长活 Engine 抢权。

```text
Session（长活产品面）
  ├─ Resolved · lifecycle · activeLoop
  ├─ ProjectStore                 // createBundler 即创建并持有（始终有实例）
  ├─ PreviewAdapter?              // 仅 .dev
  └─ BuildPipeline.run(...)       // 每次编译按次创建并执行
         │
         ▼
    ProjectStore.load / merge     // load 按需
         │                        // 活图：PS1 = Store + watch 闭包镜像双持；PS2 起 Store 唯一权威
         ▼
    workers（hydrate + 变换）
```

| 问题 | 答案 |
| --- | --- |
| 谁管会话？ | **只 session** |
| 谁管工程状态/图？ | **ProjectStore**（装载与 merge 归宿）；**PS1** 下 watch 仍可闭包**镜像**图（W3）；**PS2** 起 Store 为唯一活图权威 |
| 谁跑一次编译的阶段？ | **BuildPipeline**（按次） |
| 谁管 preview？ | **session + dev/**（Store 最多发变更通知） |
| Store 何时创建？ | **`createBundler` 即创建并持有**（任何 session 都有）；**load 按需**（见调度草案）。非进程单例 |
| 活图何时单权威？ | **PS2**（删 watch-runner 闭包镜像）；勿把 PS1 写成已单权威 |

## Session 调度（已确认 L1–L4）

细则：[session-scheduling.draft.md](./session-scheduling.draft.md)

| ID | 结论 |
| --- | --- |
| **L1** | `.build` **每次**全量 `load` |
| **L2** | watch rebuild 近端：**全量 load + 旧图 merge**；`applyChanges` 远期 |
| **L3** | 保留 `build()` 门面；无 session 时可临时 createStore |
| **L4** | `stop`/`close` 后 **保留** Store 实例与图 |

### watch / dev（W1–W4）

| ID | 结论 |
| --- | --- |
| **W1** | 刀 A（注入 store 进 watcher）**与 PS1 同交** |
| **W2** | watcher **允许**无 store → 临时 create（直测） |
| **W3** | 刀 A **保留**闭包 graph 镜像；**PS2** 再删并改为 plan 只读 Store |
| **W4** | `.dev` `beforeBuild` ctx **不必**含 store |

细则：[session-scheduling.draft.md](./session-scheduling.draft.md) §6。

```text
createBundler → 必有 store（未 load）
.build / watch.start / rebuild → Pipeline.run(store) / build(注入 store) → load（策略见上）→ …
stop/close → 释 activeLoop；store 保留
.dev = session.watch + preview（编译路径同构）
```

## Session 执行内核（fe-tools-session-unify · 已交付 2026-09-14）

三入口（`.build` / `.watch` / `.dev`）共享 `src/session/runner.js` 执行内核（`createSessionRunner(state)`）：

```text
composeOptions(overrides)   // options 组装：白名单合并 + fileTypes 缺省 + store/lifecycle 注入（forced-last）
runOnce(overrides)          // one-shot 编译（仅 .build；内化 R4 idle-check，消息文本冻结）
assertLoopFree(kind)        // R3 检查（消息含 kind；dev 经此保留 dev-flavor 消息，D-SU-4 标签保持 'watch'）
occupyLoop(kind)            // R3 断言 + 置位（watcher 创建成功后；创建失败不得占用）
releaseLoop()               // 幂等释放（stop / close / R7 回滚统一出口）
```

**结构不变量（本伞 MUST）**：新增执行入口（如 target 方向 build 变体）**必须经内核**（composeOptions / runOnce / loop 三件套），不得在壳内另起分叉组装、断言或释放。壳（`session/index.js`）零 `state.activeLoop` 访问、零内联 options 组装——由 `session-unify.spec` 结构锚定与消融保障（回归基线见归档 Action）。

## CompileTarget 形态层（fe-tools-compiler-target · 已交付 2026-09-14）

与 session-unify **正交**：session 管「怎么编译」；CompileTarget 管「编译成什么」。

```text
createCompileTarget(runOptions)                 // 静态段：C1 + renderer 校验 + stages 白名单（Listr 前 fail-fast）
  → readLoadBindings()                          // 动态段：阶段组装侧唯一 env 读取（collect-config 后）
  → deriveStagePlan(target, bindings, { cwd… }) // 纯派生：stages / workerOptions / sourcemapTargetPath / stylePages
        │
        ▼
BuildPipeline「编译项目」闭包只消费 plan.stageSpecs（不再散算形态条件）
```

| 关注点 | 归属 |
| --- | --- |
| C1 语义 | `shared/compile-config.js`（CF-1）；`createCompileTarget` 内部经它取值 |
| renderer / stages 白名单 | `createCompileTarget` |
| mini-game / appId / pages / appStyleScopeId（组装侧） | `readLoadBindings` |
| 最终阶段 / workerOptions / paths | `deriveStagePlan`（纯、无突变） |
| build⇒native 入口纪律 | `resolveBundlerConfig`（T0；不坍缩描述模型） |

落点：`src/compiler/compile-target.js`（**不进**公开 `exports`）。

**结构不变量（本伞 MUST）**：形态条件（mode / platform / renderer / 启用阶段 / sourcemap 策略 / 产物路径形态）**单源于 compile-target**——新增形态轴必须经描述 + 派生，不得在 `build-pipeline` 的 `'编译项目'` 闭包内散算（renderer 字符串反查、内联 `sourcemapTargetPath`、mini-game 直耦 stage push、手工三捆 workerOptions）。由 `compile-target.spec` 结构锚定与消融保障。

**E1 不变量**：管线侧必须自调 `resolveCompileConfig`（直调 `build()` 自洽，L3）；session 层另经 `resolveBundlerConfig`（D-R2 seeds）——两合法路径，同一纯函数；不得在 pipeline 内联 `MODE_PRESETS` / `sourcemapStrategyFor` / 平台私算。

**残余（E7 · 近端 draft）**：watch-plan / compile-cache 的碎片 `plan.options` 回灌仍使增量路径绕开形态单源——见 [`fe-tools-incremental-target`](../_archive/complete/fe-tools-incremental-target/README.md) 与 [compiler-symptom-inventory](./compiler-symptom-inventory.md) S1/S2/S3/S9。

## WXML 模板缝（fe-tools-wxml-ir · 已交付 2026-09-14；目录轴见 layout）

view 模板路径已切为中立缝（`src/compiler/view/wxml/`，layering 后落点）：

```text
parse（parseWxml）   WXML 源 → Document（cheerio 仅投影；特殊节点保留；loc 半开）
load（loadTemplates） 展开/收集（include 内联、import 收集、template/wxs、assets、图边、sourceTexts）
WxmlRenderer（registry）  LoadedGraph → 产物；vue = renderer₀；同 id 注册抛错
```

**结构不变量（本伞 MUST）**：新模板目标（如第二 WxmlRenderer）**必须经 `wxml/renderer/registry` 挂载**（`WxmlRenderer` 接口），不得再以「WXML 源 → cheerio → 产物」熔断路径直连；view-compiler / `compile.js` 仅为编排壳。过渡注记两处成文（component-host 源级包装 / compileTemplate 打包壳）——语义迁移期再收。style-compiler 同构切缝为 S13 书面剩余。

## WXML SpanSource（fe-tools-wxml-bridge · D-WIR-1 修订 2026-09-14）

**D-WIR-1 修订（D-WB-2）**：允许 Rust parser（`fe/tools/crates/dimina-wxml-parser`，483 tests）作为 **napi 桥接组件**进 tools 工具链（对齐 oxc-parser 先例）——边界 = **单 crate 桥**，非工具链 Rust 化；桥接实现限 `fe/tools/`，不触碰 `fe/packages/*`。原 wxml-ir「仅 JS」约束对此桥修正。

**职责分配**：

```text
SpanView（napi 桥）:  WXML 源 → 树 + 半开 byte span + raw + sourceFile   ← Rust parser
wxml/load + view:    展开/收集/产物（cheerio 投影继续）                    ← JS（不变）
sourcemap 归位:      inMap 消费 SpanView 真 span（行级正确 + 列级可用）
```

**结构不变量**：SpanView 不含表达式负载（`.expr/.object`）；`sourceFile` 透传；span 语义与 PARSING-SPEC §0.4 / D-WIR-5 一致（半开 byte、文件内局部）。后续 W3+（换投影/表达式消费）沿用此桥面扩展。

## WXML 标准 Document + 双 Parser（fe-tools-wxml-refactor · complete 2026-09-15）

路径：`fe/tools/bundler/src/compiler/view/wxml/`（目录轴以 layout 为准）。

**结构不变量（本伞 MUST）**：

1. load / WxmlRenderer（含 `renderer/vue/tools`）**不得** import cheerio，不得消费 `_$` / `_elem`；树访问仅经 Document 操作面（`common/`）。
2. 编译默认 parser = **napi**；`WXML_PARSER=cheerio` 为可验证回退；两路产物+sourcemap 必须 diff=0。
3. Document 契约字段始终存在（可选=值可 null，非缺键）；特殊节点用 `type`（`include`/`wxs`/`template-def`…）而非标签名字符串判别语义。
4. 行为 0 锚定当前 bundler view 产物语义（含 Vue 降级），非微信真源重标定。

**非本门（仍适用）**：wxs/asset **目录**归位；表达式 SWC AST 消费；IR 纯化 / 通用 transform pass；第二 WxmlRenderer 实现。

## WXML 目录轴（fe-tools-wxml-layout · 2026-09-15）

权威树：

```text
wxml/
  parse.js              # 开关 + 对外入口（默认 napi）
  compile.js            # toCompileTemplate 编排（parse→load→renderer）
  common/               # document / document-ops / parity
  napi/parse.js         # SpanView → Document
  cheerio/parse.js      # cheerio 投影 → Document
  load/                 # LoadedGraph + paths / include / template / orchestrator-live
  renderer/             # ≠ 平台 app.json.renderer
    registry.js         # registerWxmlRenderer / getWxmlRenderer / …
    stub.js
    vue/                # index + tools(+live/state)
```

**结构不变量（本伞 MUST）**：

1. 顶层不得再出现权威入口 `parser/`、`transform/`、`backends/`；生产路径不得 import 上述旧目录。
2. parse 轴（`napi/`|`cheerio/`）仅源串→Document；`load/` 不 import cheerio；引擎目录不 import `renderer/`。
3. 公开 API 使用 `Wxml` 前缀（`getWxmlRenderer` 等）；旧 `getBackend` / `vueBackend` / `WxmlBackend` 等**无** re-export。
4. `compile.js` 仅编排，不承载展开/降级算法体；vue 工具在 `renderer/vue/`。
5. 本门行为 0：相对实施基线产物+sourcemap diff=0；默认 napi vs cheerio diff=0。

## Emit 层 + 唯一写盘出口（fe-tools-bundler-emit-layer · 2026-09-15）

- **契约**（`pipeline/emit.js`）：`emitEntry({entryId, kind, modules, transform: {strategy, minify, target, platform}, sourcemap, sourcemapTargetPath, filename, relPrefix}, outputEnv={collectOutput, writeDir})` → `number`。模块集合 = `Iterable<{moduleId, code, map, extraInfoCode?}>`（D-E-1 契约先立，不含 range/sourceFile——D-E-6；`extraInfoCode` 是 logic sourcemap 路径 wrapModDefine header 注入，非 range/sourceFile，策略内部透传）。
- **策略**（D-E-2 函数注入）：`bundle`（view 整包 + moduleRanges 行定位，布局私有）/ `perModule`（logic 逐模块 + sourcemap rebase 在 apply 内，D-E-12）。非标志位 if。
- **output.js**（`pipeline/output.js`，D-E-3/D-E-7 独立）：`write({entry, collectOutput, writeDir})` → void。collectOutput→postMessage(M1)；否则 mkdir-p+writeFileSync。不管 count（D-E-11）/不管 rebase（D-E-12）。sourcemap 信息在 `entry.sourcemaps?[]`（存在即写 map，不需 flag 参数）。
- **方案 A**（D-E-9）：emitEntry 内部调 output.write，返回 1（调用方 `outputCount += result`）。A→B 演化（刀 3 若需“只产不写”）= 拆 emitEntry → {entry} + output.write 外部调，加法。
  > **D-E-9 废弃**（fe-tools-worker-runtime D-WR-11）：emitEntry 改 async `Promise<void>` fire-and-forget——删 outputEnv 第二参数 + 删 return number + 从 `abilityContext.getStore()` 拿 sink（`sink.write(entry)` 替代 output.write）；output.js 删除（FileSink 在 worker-runtime/sinks.js）。
- **style 边界**（D-E-8）：style 只收 output.write（compileSS 内部组装 entry），不进 emitEntry（无模块集合/modDefine/transform）。
- **CF-1**：`effectiveJsMinify = minify && !sourcemap`——sourcemap 模式跳过 minify（mergeSourcemap 只做单层行偏移，串联两份 map 未实现）。
- **行为 0**：三链 diff=0（含非 sourcemap+非 minify tab 路径）；vitest 584/584。grep 三引擎零直接 `fs.writeFileSync` + 零 `type:'output'` postMessage。
- **提供者 A0**：view scriptRes（Map）/ logic compileRes（Array）现作提供者；未来 ModuleCache（刀 3）以同形状 `{moduleId, code, map}` 提供即可守约。
- **非本刀**：ModuleCache（刀 3）/ 失效查询（刀 2）/ transform 粒度统一 / tree-shaking。

## Bundler allowJs 类型门禁（fe-tools-bundler-typecheck · 2026-09-15）

- `fe/tools/bundler/tsconfig.json`：`allowJs: true`、`checkJs: false`、`strict: true`、`noEmit: true`；`include` = `src/compiler/**`。
- CI：`.github/workflows/fe-tests.yml` 跑 `pnpm --filter @dimina/bundler typecheck`（`tsc --noEmit`）**必过**。
- S1 白名单文件带 `// @ts-check`：`wxml/common/{document,document-ops,parity}.js`、`wxml/load/index.js`、`wxml/renderer/{registry,stub}.js`、`pipeline/compile-target.js`。
- `WxmlRenderer` / `LoadedGraph` 等契约以白名单内集中 typedef 为权威（`wxml/common/wxml-ir.types.js`、`pipeline/compile-target.types.js`）；**不以**未 check 的 `vue/index.js` 为类型源。
- **非本门**：整仓 `.ts` 迁移；`sync-dist` → tsc emit；S2/S3（`view/index.js` / vue-tools / style|logic|npm）全开 check。

## 命名

| 概念 | 采用名 |
| --- | --- |
| storeInfo 状态管家 | **ProjectStore**（≠ storeInfo 函数） |
| runBuild 编译承载面 | **BuildPipeline**（runBuild 可作门面） |
| 产品会话 | **session** / `createBundler`（已有） |

## 架构术语：Packer / Scheme（2026-09-18）

讨论「抽出通用打包工具」和「Dimina 怎么打包」时，只用下面两个词。不要用 bundler / logic 指这两层。

| 术语 | 是什么 | 不是什么 |
| --- | --- | --- |
| **Packer** | 通用模块打包器（同类：Rollup / webpack）。只负责模块标识、模块图、transform、模块产出。不知道小程序、页面、WXML。 | 不是包名 `@dimina/bundler`，也不是现在的 `src/` 整树 |
| **Scheme** | Dimina 的打包方案：编什么、分几条车道、产物长什么样、何时调用 Packer | 不是目录 `compiler/logic`。该目录整段是焊点，不是这个词，也不是已经抽出的 Packer |

今天的 `@dimina/bundler` 把 Packer 和 Scheme 焊在一起。`compiler/logic/**` 整目录是焊点：对外是 Scheme 调用的 JS 车道，对内的模块图与 transform 是未来 Packer 的胚。本术语节不拆该目录。

后续架构文档沿用这对术语。包名、目录名 `compiler/logic` 保持不变，直到另有 Action 改名。

**落点权威**：目录/文件级 Packer / Scheme / 焊点归属见 [`fe-tools-bundler-boundaries`](../_archive/complete/fe-tools-bundler-boundaries/technical-design.md) §2 落点表（D-BD-1..6）。4 个焊点：`compiler/pipeline/emit.ts`、`compiler/logic/**`、`compiler/core/env.ts`、`model/dependency-graph.ts`。本术语节不展开焊点拆分；方法级拆分另立。

## 已确认设计点（P1–P6 · 2026-09-12）

| ID | 结论 |
| --- | --- |
| **P1** | Store → `src/model/project-store.js`；Pipeline → `src/compiler/build-pipeline.js` |
| **P2** | PS1 薄包装 storeInfo+ALS；getters 不动；**不含** PS2 |
| **P3** | 不新增公开 `exports` |
| **P4** | merge 首刀 **全量** |
| **P5** | PS1 / BP1 不硬依赖；**禁混 PR** |
| **P6** | `build()` 唯一公开编译入口；BP1 留 Listr |
| **M-A** | `ctx.dependencyGraph` 与 Store 持有图**同引用**；channel.merge 即写 Store |
| **R1** | PS1 文件清单：project-store + session + watch-runner + build/runBuild 接线；不抽阶段表 |
| **R2** | runBuild 内挂 M-A **≠** BP1 |
| **R3** | PS1 **不**暴露 `session.store` |
| **R4** | compile-cache 两门 Non-goal |
| **RR4** | `options.store`（包内）；无则临时 store |
| **RR5** | session 内部 `state.store` |
| **RR6** | ctx 挂 Store 图；禁止再 `new` 挂 ctx |
| **RR7** | 实施 PS1 略先；禁同 PR |
| **RR8** | 两门可分升 ready |
| **RR12** | 伞 `fe-tools-sidecar` 不随子门自动升 ready |
| **FR2** | `build:start` 剥 `store` |
| **FR5** | 两门已同升 ready（2026-09-12）；实施另授 in_progress |

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-12 | 初稿：三分 + 唯一会话管理者 |
| 2026-09-12 | **确认**：Store 于 `createBundler` 即创建持有；load 按需；非进程单例 |
| 2026-09-12 | **确认** L1–L4；链到 session-scheduling.draft.md |
| 2026-09-12 | **确认** P1–P6（落点 / PS1 范围 / exports / merge / 顺序 / build 门面） |
| 2026-09-12 | **确认** W1–W4（watch/dev 接入两刀） |
| 2026-09-12 | review：澄清 PS1 双持 vs PS2 单权威措辞 |
| 2026-09-12 | **确认 M-A** |
| 2026-09-12 | **确认 R1–R4**；两门 requirements/acceptance/validation 草稿 |
| 2026-09-12 | Readiness Round 3：RR1–RR12；stages → build-pipeline/stages.md；设计冻结 v1 |
| 2026-09-12 | Final Readiness FR1–FR9；implementation-plan；待升 ready |
| 2026-09-14 | **回流 fe-tools-session-unify（complete）**：Session 执行内核（composeOptions / runOnce / assertLoopFree / occupyLoop / releaseLoop）+ 结构不变量「新增执行入口必须经内核」入档 |
| 2026-09-14 | **回流 fe-tools-wxml-ir（complete）**：WXML parse→Document→load→Backend 缝 + 结构不变量「新模板后端必须经 registry 挂载」入档；S13 view 侧收口 |
| 2026-09-14 | **回流 fe-tools-compiler-target（complete）**：CompileTarget 两段 API + 结构不变量「形态条件单源于 compile-target」+ E1 双重解析不变量入档 |
| 2026-09-15 | **回流 fe-tools-wxml-refactor（complete `13c9c902`）**：标准 Document + Document 操作面；`WXML_PARSER` 默认 napi；零 cheerio 泄漏不变量入档；已归档 |
| 2026-09-15 | **回流 fe-tools-bundler-typecheck（complete `eb3b2bc4`）**：类型门禁不变量入档（CI `tsc --noEmit` 必过；白名单 `@ts-check`；集中 typedef 不以 vue/index 为类型源） |
| 2026-09-15 | **回流 fe-tools-bundler-tsc-dist（complete）**：**B2 build 模型**——dist 唯一生产者 = `tsc -p tsconfig.build.json`（`rootDir:src`/`outDir:dist`）；整树 sync-dist 已删除；postbuild（copy-sdk-assets + check-exports）保留。**绿场规则**：`src/` 新文件允许 `.ts`。**后缀约定（D-TD-20）**：运行时消费方写显式 `.ts` 后缀 + `rewriteRelativeImportExtensions`（emit 重写回 `.js`）；`.js`→`.ts` 隐式映射只存在于 tsc program——vitest/worker 直跑 src 不解析，显式 `.ts` 是唯一可运行写法。**worker 注记**：src 链 spawn 需 `--experimental-strip-types`（stage-channel 已按 `/src/` 探测注入）。**迁徙边界**：view/index.js、renderer/vue/tools.js、vue/index.js 禁迁；第 2 刀（document/document-ops/load）另立 |
| 2026-09-18 | **术语**：架构讨论用 **Packer**（通用模块打包器）/ **Scheme**（Dimina 打包方案）。禁止用 bundler / logic 指这两层。包名与 `compiler/logic` 目录不因此改名 |
| 2026-09-18 | **术语对齐**：Packer 用词改为模块标识、模块图、transform、模块产出。`compiler/logic/**` 整目录是焊点，不是 Scheme 车道 |
| 2026-09-18 | **回流 fe-tools-bundler-boundaries**：落点表权威指针入档（4 焊点：emit.ts / logic/** / env.ts / dependency-graph.ts；D-BD-1..6） |
