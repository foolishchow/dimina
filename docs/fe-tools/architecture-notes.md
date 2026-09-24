# Architecture notes — session / ProjectStore / BuildPipeline

Status: **discussion consensus**（2026-09-12）  
Authority pointers: [`fe-tools-project-store`](../actions/_archive/complete/fe-tools-project-store/README.md) · [`fe-tools-build-pipeline`](../actions/_archive/complete/fe-tools-build-pipeline/README.md) · [`fe-tools-session-unify`](../actions/_archive/complete/fe-tools-session-unify/README.md) · [`fe-tools-compiler-target`](../actions/_archive/complete/fe-tools-compiler-target/README.md) · [`fe-tools-incremental-target`](../actions/_archive/complete/fe-tools-incremental-target/README.md)（draft） · [`fe-tools-wxml-ir`](../actions/_archive/complete/fe-tools-wxml-ir/README.md)（**ready** · TS-2） · [compiler-symptom-inventory](./compiler-symptom-inventory.md) · 已归档 session

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

**残余（E7 · 近端 draft）**：watch-plan / compile-cache 的碎片 `plan.options` 回灌仍使增量路径绕开形态单源——见 [`fe-tools-incremental-target`](../actions/_archive/complete/fe-tools-incremental-target/README.md) 与 [compiler-symptom-inventory](./compiler-symptom-inventory.md) S1/S2/S3/S9。

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

**落点权威**：目录/文件级 Packer / Scheme / 焊点归属见 [`fe-tools-bundler-boundaries`](../actions/_archive/complete/fe-tools-bundler-boundaries/technical-design.md) §2 落点表（D-BD-1..6）。4 个焊点：`compiler/pipeline/emit.ts`、`compiler/logic/**`、`compiler/core/env.ts`、`model/dependency-graph.ts`。本术语节不展开焊点拆分；方法级拆分另立。

**Module 中心路线（2026-09-19）**：近端伞 [`fe-tools-module-centric`](../actions/_archive/complete/fe-tools-module-centric/README.md)（**`complete`**，2026-09-21；子门 M1 invalidation + M2 result-cache 全 complete 归档；D-MF-1 封口）。D-MF-1：方案 A / logic-only。M0 emit W1 deferred（S 级，另门可独立先行）。

**Module 收敛路线（2026-09-21 / 确认 2026-09-20）**：伞 [`fe-tools-module-convergence`](../actions/_archive/complete/fe-tools-module-convergence/README.md) **`complete`**。MC0（graph 正确性：`clearOutgoingEdges` + `removeNode` + `storeInfo` merge 后删 stale page/component node）+ MC3a（`deriveFromGraph` 函数：entry→graph→modules→code→[EmitModule]，只读）全 complete。D-MC-0 选 A = graph 结构权威、**code 不上图**、D-MF-2 不推翻。MC3c/MC1/MC2 deferred。

**Emit 搬迁（MC3b → 独立 Action）**：[`fe-tools-emit-relocate`](../actions/_archive/complete/fe-tools-emit-relocate/README.md) **`complete`**（2026-09-21）。emit 从 compile-worker 搬到 emit-worker；打破 streaming；主线程按结构化 **`emitBuckets`** 编排（同今日 `writeCompileRes` 分桶；`subs[].root` = `pages.subPages` key / `transSubDir` 形；禁止 path-prefix/closure 重归属）。D-ER-0..7 冻结。行为 0 diff=0；608 vitest 绿。

**HMR-compiler H1 deriveFromGraph 接线（fe-tools-hmr-emit-derive · complete 2026-10-09）**：orchestrator Logic emit task 从 `ctx.emitBuckets`（logic worker 全量输出）改调 `deriveLogicBuckets`（graph + cache 派生）。**D-ED-1 B2+E**（实证 pass）：B2 = 按 **cache 插入序**迭代（非 `graph.getDependencyClosure` 的 `.sort()` 字典序——实证 #1 cache 插入序 == emitBuckets 序 58==58 完美序匹配）；E = **cross-bucket dedup**（sub bucket = sub closure union MINUS main closure——实证 #3 subPackageA closure=7 minus `app`=1 == emit=6；compileJS for subs 传 `mainCompileRes`，已在 main 的不 push 到 sub）。`convergence.ts` 新增 `deriveLogicBuckets`（main closure union + sub closure union MINUS main，cache.entries() 插入序）+ `deriveFromGraph` 改 B2（单 entry 预留 H4）；`module-result-cache.ts` 加 `entries()` 有序迭代（JS Map 保插入序 spec-guaranteed）。**independent subs exception**（F1 fix）：`subPages.independent: true` compileJS 传 `[]` 作 mainCompileRes（不 dedup）→ deriveLogicBuckets 须跳 cross-bucket dedup（independent 保留完整闭包）。`emitBuckets` 全链下线（logicCompile 不返 / stage-channel 不存 / orchestrator 不读）。**D-ED-2 locked B**（一次性，反转 D-HMR-2 推荐 A——SMPU dual-path 验证缺口经验）。行为 0：6 项目 diff=0；tsc 0；vitest 84/626（compile-cli-cache flaky 单跑 pass）；V-PC-5 0 新 violation。15 轮 design.draft review（F2-F19）+ 5 轮 implementation review（F1-F2）。为 H4 per-module HMR push 备 emit 增量化基座（main/sub bucket 经 graph 派生，不再依赖 worker 全量输出）。

**HMR-compiler H2 registry 实体化 Phase 1（fe-tools-hmr-registry-materialize · complete 2026-10-09）**：`emptyRegistry` stub → 实体 `PackerDispatchRegistry`（kind → {engine, title} 映射）。**D-REG-1 locked 非双路径**：compile-target compile 段（`deriveStagePlan` + `readLoadBindings` + `filterPagesByEntries`）移入 `packer/registry.ts` → `computeStagePlan`（registry.kinds() 派生 stages，非 COMPILE_STAGE_ORDER 硬编码）。compile-target 只留静态段（`createCompileTarget` + `COMPILE_STAGE_ORDER`）。orchestrator `createStageTask` 从 registry 获取 engine + title，传给 `runCompileStage`（加 `engine?` 参数，backward-compatible webview renderer）。**D-REG-2/3 locked**：load 在 domain parse-walk（Phase 2 拆分）；stage 保留作 registry 顶层编排。**F-H2-1 deferred to Phase 2**：viewParseWalk/buildCompileCss monolithic L/C/E 拆分是 worker 内部重构，Phase 1 registry materializes at orchestrator dispatch level（worker 仍调 monolithic 函数）。行为 0：6 项目 diff=0；tsc 0；vitest 83/625（compile-cli-cache flaky excluded）；V-PC-5 0 新 violation。为 H3/H4 提供 registry dispatch 基座（kind 派发经 registry，不再 compile-target 硬编码）。

**HMR-compiler H3 per-module view cache（fe-tools-hmr-per-module-cache · complete 2026-10-09）**：G5 per-page-bundle cache（`Map<string, ViewCompiledModule[]>`）→ H3 per-module cache（`Map<string, ViewCompiledModule>` + `Map<string, string[]>` order list）。**D-PMC-1 locked 选项①**（actual probe PASS 3 项目 + vant 4.86x dedup）：cache-hit assemble per-module cache via order list（非 graph 重建——避开 G5 P-G506）；cache-miss 仍全量 viewParseWalk（F-H2-1 L/C/E 拆分后才能选择性 recompile 单 module）。stage-channel split `viewPageBundles` → per-module cache entries + order list。**D-PMC-2/3 locked**：invalidation per-module（order list module invalidated → cache-miss）；watch 字节恒等（integration test PASS）。Style cache N/A（已 per-module = per-page，无 bundle 序问题）。行为 0：6 项目 diff=0；tsc 0；vitest 83/625（compile-cli-cache flaky excluded）；V-PC-5 0 新 violation。为 H4 per-module HMR push 备 per-module 粒度 cache 基座（cache-hit 按 order list 重组 bundle，dedup shared modules 4.86x→1x）。

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
| 2026-09-20 | **回流 fe-tools-packer-research（complete）**：Packer extraction 评估完成，结论 **不值得立即做**。4 焊点方法级审计：26 exports = 2 Packer / 9 共用 / 14 Scheme / 1 基礎 / 3 未使用。11 env.ts 调用 → 4 hooks（graphWriter / pathProvider / resolver / stateRestore）。决策依据：ROI 不足（W2 需 L 级 633 行重构 + 4 Scheme hooks，Packer 无法独立运行）；当前耦合度可接受；优先推 TODO 刀 2+3。**PackerContext 草案**回流供长期参考：`PackerContext { sourceRoot, outputRoot, moduleIdPrefix, runtimeType, graphWriter{addModuleFile/addModuleDependency/getComponentDependencies}, resolver{content/npm/alias/component/appConfig}, stateRestore }`。**推荐路径**：先 TODO 刀 2（失效查询）+ 刀 3（ModuleCache）→ 落地后重评估 Packer 边界。W1（emit.ts parameterize）可独立先行（S 级低风险）。W3 env.ts 不拆（注入 context）；W4 dependency-graph 不拆（限定 kind API）。 |
| 2026-09-20 | **指针 fe-tools-module-centric（draft）**：Module 一等公民伞立项；M1 失效→M2 结果缓存（嗣后 D-MF-1 已封，见下两行） |
| 2026-09-19 | **D-MF-1 讨论稿指针**（已被同行「封口」行取代）：两层方向；细节当时未封 |
| 2026-09-19 | **D-MF-1 封口**：方案 A（CompileInfo.path）；刀 2 仅 logic；view/style 排除；规范形迁移另门 |
| 2026-09-19 | **fe-tools-module-centric → `ready`**：MF0 冻结；下一步 formalize M1（伞不授改 src） |
| 2026-09-19 | **fe-tools-module-invalidation `draft`**：刀 2 立项；继承 D-MF-1；T1–T7 → D-IV-1..9 冻结（见下行） |
| 2026-09-19 | **M1 D-IV-1..9 冻结**：logic-only 闭包；Graph+invalidation 双挂；sorted `string[]`；不接线 watch |
| 2026-09-20 | **M1 升 `ready`**：6 轮 readiness review 收敛（R1–R6: 4→4→2→1→1→0）；D-IV-1..9 全冻；文档门 pass；升 in_progress 另授 |
| 2026-09-20 | **M1 complete**：getInvalidatedModules + computeInvalidatedModules 交付；logic-only 闭包（fileKinds seed + getDirectDependents('logic')）；6 测例（5 案 + 批量）；行为 0（仅 model/ + spec）；tsc 0；vitest 594/595（1 flaky pass）。下一步：M2 result-cache 消费本 API 脏集。 |
| 2026-09-20 | **M2 `draft`**：Module 变换结果缓存立项；承接 M1 脏集 + D-MF-2 缓存宿主另定；4 议题待定（宿主/持久/worker回填/失效触发）。 |
| 2026-09-20 | **M2 `ready`**：D-RC-1..4 冻结——B（独立 ModuleResultCache）/ α（session-only）/ I（IPC 回填 + 主线程管缓存）/ watch-plan 触发。 |
| 2026-09-21 | **M2 `complete`**：D-RC-1..4 冻结已实施。新增 `model/module-result-cache.ts`（`ModuleResultCache` 类）；`compileJS` 返回 `{ compileRes, logicDependencies }`；cache hit 用 `cached.logicDependencies` 遍历依赖（非 graph，避免 stale edge）；AST walk 4 处 `addDependency` 后捕获 `logicDeps`；worker 响应含 `compileRes`+`logicDependencies`（仅 dirty）；主线程组装 `CachedModuleResult` 更新 cache（仅 dirty）；`watch-plan.ts` 加 `computeInvalidatedModules`；`watch-runner.ts` 创建 cache 实例 + 传 `build`。验证：tsc 0 errors；vitest 599 pass；行为 0 确认。 |
| 2026-09-21 | **伞 `fe-tools-module-centric` `complete`**：子门 M1+M2 全 complete 归档；MF0 文档门 pass；D-MF-1 封口（方案 A / logic-only / view·style 排除）。M0 emit W1 deferred（S 级纯重构，另门可独立先行）。 |
| 2026-09-21 | **伞 `fe-tools-module-convergence` formalize `draft`**：承接 module-centric 伞 complete 后的半套资产收敛。原子门 MC1→MC2→MC3 已重构为 MC0（graph 正确性）→ MC3a（deriveFromGraph 只读函数）；MC3b/MC3c/MC1/MC2 deferred。D-MC-0..5 全冻结。升 **`ready`**。 |
| 2026-09-20 | **确认 D-MC-0 持 A**：code 不上图；否决双字段上图候选；伞 `ready`；近端 MC0+MC3a |
| 2026-09-21 | **指针 `fe-tools-emit-relocate` `complete`**：MC3b 独立立项；D-ER-0..7 冻结；D-ER-3 = 结构化 `emitBuckets`（禁 path-prefix/closure 重归属）；实施完成（行为 0 diff=0；608 vitest 绿）；归档 `_archive/complete/` |
| 2026-09-21 | **回流 `fe-tools-emit-transform-split` `complete`**：三车道 parse+walk+transform+emit 拆标准化步骤。**logic**：`logicParseWalk`（oxc parse+walk + MagicString + sourcemap）+ `transformCjs`（esbuild CJS + sourcemap remap）抽出到独立文件；`buildJSByPath` 变薄编排。**style**：`minifyCss`（per-module esbuild CSS minify，从 `emit.ts` 导入）+ `emitStyle`（packaging）抽出到 `emit.ts`；`compileSS` 走 `emitStyle` + `sink.write`；`EmitEntry.kind` += `'style'`。**view**：`compileModuleWithAllWxs` 合并进 `compileModule`（`allScriptModules` 参数）；`buildCompileView` 改名 `compileViewTree`；`viewParseWalk` 包装 `compileViewTree` + `scriptRes→EmitModule[]` 转换；`compileML` 调 `viewParseWalk`。**行为 0 修正**：(1) esbuild CSS minify 须 per-module（`minifyCss` 在 `enhanceCSS` 内），不能 aggregated minify（模块间 `\n` 差异）；(2) page sourcemap 改为条件用——2nd pass（`allScriptModules` provided）`createLineSourcemap`，1st pass + components 条件不变（pages with `<include>` but no `<wxs>` 不触发 2nd pass）；(3) `collectAllWxsModules` 保留（收集缓存泄漏 wxs，删除后 sub-package 产物 diff≠0）。验证：tsc 0 errors；vitest 608/608；nomap+sourcemap diff=0（basic + extended）。归档 `_archive/complete/`。 |
| 2026-09-21 | **回流 `fe-tools-parse-walk-extract` `complete`**：view/style parse-walk 真抽出（从 8 行 re-export 壳升级为真搬代码）。**style**：`enhanceCSS` + `buildCompileCss` + 全部 helpers + 模块级变量 + interfaces 搬到 `style/parse-walk.ts`（~450 行）；`index.ts` 变薄到 74 行（`compileSS` + `styleEngine` + re-export）；`minifyCss` import 跟 `enhanceCSS` 搬走（`noUnusedLocals`）；`clearStyleCaches()` 封装 `compileRes.clear()`。**view**：全部 parse+walk 函数 + 表达式 helpers + wxs helpers + interfaces 搬到 `view/parse-walk.ts`（~1360 行）；`index.ts` 变薄到 175 行（`compileML` + W1 两套 shim 注入 + `viewEngine` + re-export）。W1 两套 cycle-break shim 不变——`index.ts` import 15 函数后调 `bindVueToolsLive`（12）+ `bindTransformOrchestrator`（3）。`wxsScannedWorkPath`（let 变量）用 `ensureWxsScan`/`resetWxsScan`/`clearViewCaches` 三函数封装（ESM live binding 不可外部赋值）。`templateRenderCache` 不留 `index.ts`（`clearViewCaches` 在 `parse-walk.ts` 内处理）。3 条 TD fallback → 正式决策（D-PW-3 `collectAllWxsModules` 保留 / D-PW-4 page sourcemap 条件 / D-PW-5 view 二次编译接受）。验证：tsc 0 errors；vitest 608/608；产物 diff=0。归档 `_archive/complete/`。 |
| 2026-09-21 | **回流 `fe-tools-view-parse-walk-cleanup` `complete`**：view/parse-walk.ts 内部质量重构（行为 0）。(1) `compileResCache` 三用途拆分为 3 个独立 Map：`moduleCompileCache`（`Map<string, ModuleCompileCacheEntry>`）/ `moduleFailureCache`（`Map<string, ErrorShape>`）/ `wxsContentCache`（`Map<string, string>`），删除 `typeof cacheData === 'string'` 旧格式兼容分支（死代码），`clearViewCaches` 清 8 行（3 新 + 5 不变）。(2) `collectAllWxsModules` 两处重复调用提取为 `mergeWxsModules(instruction, scriptRes, seed)` 公共函数。(3) `compileModule`（167 行）拆为 `tryModuleCache`/`compileModuleRender`/`finalizeModule` 三段 + 薄编排。(4) `processWxsContent`（121 行）按转换类型拆为 `replaceGetRegExp`/`replaceGetDate`/`replaceWxsRequire`/`replaceConstructor`，require 分支 npm/普通路径合并为单一路径。(5) `insertWxsToRenderResult`（99 行）拆为 `buildWxsDeclarations`/`buildWxsReplacements`/`applyWxsReplacements` 三段。22 个 export 函数签名全不变（W1 15 binding + 7 其他）。5 轮 readiness review pass（12 findings 全修正）。验证：tsc 0 errors；vitest 608/608；产物 diff=0。归档 `_archive/complete/`。 |
| 2026-09-21 | **回流 `fe-tools-packer-lifecycle-audit` `complete`**：Packer 全流程生命周期审计。8 章节：入口（compile CLI / session / Packer 创建点）/ 第一 build（storeInfo → graph 创建 → 三车道并行 compile → logic emit 推迟 → materialize）/ Worker 内（resetStoreInfo → parse-walk load+compile 交织 → emit）/ watch rebuild（createWatchBuildPlan → computeAffectedEntries + computeInvalidatedModules → 增量 build）/ graph 生命周期（创建→变异→合并，写权分叉）/ cache 生命周期（watch-runner 创建 → worker 读快照 → stage-channel 写回）/ 组件映射现状（5 组件 → 6+ 演化）/ 关键发现 F-1..F-6。F-1: PackerContext ALS-backed 非 plain object。F-2: graph/cache 跨线程快照+合并。F-3: fixpoint per-lane 并行非全局串行。F-4: emit 时机因车道而异。F-5: load 非纯函数写本地 graph。F-6: view/style 无模块级增量。research only 零产品代码变更。归档 `_archive/complete/`。 |
| 2026-09-21 | **`fe-tools-packer-core-shape` `complete`**：Packer core 6 组件形状定义（北星契约）。**管线**：`graph.build(ctx) → load → compile → emit`。load = parse + walk（发现）；compile = transform（变换）；emit = bundle（装配）。两个 fixpoint：config fixpoint（graph.build 读 app.json → 递归组件 → 扫文件）+ source fixpoint（load parse 源码 → mergeDelta）。**6 组件**：① PackerContext（I/O only）② Graph（self-bootstrap, config+source fixpoint）③ LoadedModule + CompiledModule（discriminated union）④ Loader/Compiler/Emitter + 3 registry ⑤ OrchestratorState（session-scoped）⑥ PackerOrchestrator（owns 3 registries）。**D-PCS-1..10**：D-PCS-1 storeInfo 只剩 paths+fileTypes = PackerContext。D-PCS-2 graph 推导逻辑自包含。D-PCS-3 graph 由 Orchestrator 触发长期持有。D-PCS-4 Graph 自己 bootstrap。D-PCS-5 三 registry 取代单体。D-PCS-6 PackerContext(I/O) + OrchestratorState(graph+cache) 拆区。D-PCS-7 Emitter 封装 emit 策略。D-PCS-8 通用 worker。D-PCS-9 OrchestratorState session-scoped ALS pipeline-scoped。D-PCS-10 CompiledModule discriminated union。产出 `src/packer/types.ts`（全部 interface 声明）+ `src/packer/README.md`（边界+映射表）。行为 0（新文件不改现有代码）。 |
| 2026-09-22 | **`fe-tools-als-store` `complete`**：通用 ALS 工具类 `AsyncContextStore<T>` 落地。统一两处 AsyncLocalStorage：`abilityContext`（worker-runtime/context.ts，unknown 类型 → AbilityContext 结构类型）+ `compilerContextStorage`（env.ts，加 globalThis 兜底）。API：`run<R>(context, callback): R` / `get(): T`（throw if none）/ `tryGet(): T | undefined` / `readonly name` / `legacyKey?` 向后兼容。globalThis 兜底 key `__als_${name}`，legacyKey 先查旧 key（`__abilityContext`）复用 vitest 单例。4 处 call site 迁移：runtime.ts（run）/ emit.ts（tryGet()?.sink，消除 as cast）/ compatibility.ts（tryGet()?.logger ?? consoleFallback，消除 as cast）/ style/index.ts（get().sink，消除 as cast）。`getCompilerContext` 保持 `tryGet() ?? defaultCompilerContext` 回退。行为 0（diff=0 + 608 vitest）。Packer 落地地基。归档 `_archive/complete/`。 |
| 2026-09-22 | **`fe-tools-graph-bootstrap` `complete`**：PackerGraph 落地——config fixpoint 逻辑（storeInfo steps 3-6: storeProjectConfig/storeAppConfig/storePageConfig/createInitialDependencyGraph）从 env.ts storeInfo 迁入 `src/packer/graph.ts` `PackerGraph` 类。**路 1 过渡态**（D-GB-1）：build(ctx) 委托 env.ts 函数（通过 ALS Proxy 读写），结果复制到 this.configData/this.graph；终态路 2 将从 ctx.readContent 直接读文件。**storeInfo 瘦身**：steps 1-2（normalizeFileTypes + storePathInfo）保留，steps 3-6 委托 `graph.build()`/`graph.reconcile()`；watch rebuild merge 逻辑（freshEntryIds 记录 + merge old + remove stale）迁入 `reconcile()`。**ALS getter 兼容**：getComponent/getAppConfigInfo/getRuntimeType/isMiniGame 改为 `getCompilerContext().graph?.X() ?? fallback`，fallback 保持旧行为（configInfo Proxy）。**resetStoreInfo** 重建 PackerGraph via `restoreFromSnapshot(configInfo, dependencyGraph)`。**CompilerContext** 加 `graph?: PackerGraph`（optional，createCompilerContext 不改）。**toPackerContext** adapter：CompilerContext→PackerContext 字段映射（directivePrefixes = compilerOptions.templateDirectivePrefixes；resolveAlias/resolveNpm 为 D-PCS-1 deferred stub）。GraphConfigData 类型安全子集（无索引签名，放 graph.ts）。env.ts export PageConfig/ComponentConfig/storeAppConfig/storePageConfig/createInitialDependencyGraph/storePathInfo/getCompilerContext/toPackerContext。循环依赖安全（graph.ts→env.ts runtime；env.ts→graph.ts 仅函数内调用）。验证：tsc 0 errors；vitest 608/608（compile-cli-cache flaky 单跑 pass）；产物 diff=0。 |
| 2026-09-22 | **`fe-tools-orchestrator-state` `complete`**：graph + cache + invalidated 三处散落状态收敛为 session-scoped `PackerSessionState`（D-OS-1..5, D-PCS-3）。**关键发现**：watch 模式 graph 丢失——`activeStore.getDependencyGraph()` 在 ALS 外调用 → 返回 `defaultCompilerContext.dependencyGraph`（空图，storeInfo 只更新 ALS context 不更新 default）→ watch rebuild 实际都是 full rebuild。worker delta（source-level edges）也随 ALS context 销毁丢失。**修复**：`createBuildWatcher` 加 `state?: PackerSessionState` 可选参数（可注入，未传内部 new）；state 通过 `options.state` 传 build-pipeline，`storeInfo` 接收 `options.graph`（传入时用实例不新建、跳过 restoreFromSnapshot；未传向后兼容 new + restore）。watch-plan 从 `state.graph` 读活图（替代 `activeStore.getDependencyGraph()` 读空 default）→ 增量路径生效。cache 从 `state.moduleCache` 取，仍通过 `options.cache` 传（不改读取逻辑）。`PackerSessionState` class（graph: PackerGraph + moduleCache: ModuleResultCache + invalidatedModules: Set），**不写 `implements OrchestratorState`**——ModuleResultCache class 的 get/set 返回 CachedModuleResult（非 `{module, dependencies}`）且 size 是 getter（非 method），与 types.ts §7 interface 不兼容；conformance deferred 到 ModuleResultCache 泛型化 Action。**行为 0 注记**：watch rebuild 从 full → incremental 是行为变化，但产出一致（增量 = 全量子集 + seedPath 复制旧产物 + cache hit = 上次全量结果）。验证：tsc 0 errors；vitest 608/608（watch-runner.spec.js PS2 测例更新为注入 mock state.graph）；7 examples diff=0（896 files）；watch rebuild 产物 diff=0。归档 `_archive/complete/`。 |
| 2026-09-22 | **`fe-tools-packer-orchestrator` `complete`**：过程体迁入 `packer/orchestrator.ts`；公开 build/watch 经适配器 `orchestrate`；`build-pipeline` 死 shim；OrchestrateOptions M1（含 skipMaterialize）；cache 只 `state.moduleCache`；返回 buildResult（D-OR-7）。行为 0：examples **diff=0**（6 apps HEAD vs orch）；tsc 0；vitest 绿。归档 `_archive/complete/`。 |
| 2026-09-22 | **立项 `fe-tools-packer-context` `draft`**：PackerContext 真 I/O + Graph 路 2（关 D-GB 路 1 `void ctx`）。D-PC-0..11 冻（含 D-PC-7 exists=Graph `fs.existsSync` / D-PC-8 `NpmResolver(ctx.workPath)` / D-PC-9 build 局部性 / D-PC-10 `ctx.fileTypes` / D-PC-11 store* 薄壳）。Readiness findings 已修；升 ready 另授。前置 graph-bootstrap + packer-orchestrator。未改 `src`。 |
| 2026-10-07 | **`fe-tools-packer-context` `complete`**：PackerContext 真 I/O + Graph 路 2 落地。创建 `src/packer/config-fixpoint.ts`（~470 行）：14 个 config fixpoint 函数从 env.ts ALS 全局（pathInfo/configInfo/getCompilerContext）迁移为 `FixpointCtx{ctx, configData, npm}` 显式参数——全部从 `ctx.readContent`/`ctx.workPath`/`ctx.fileTypes` 读，不经 ALS getter 回环（D-PC-9）。**graph.ts** `build(ctx)` 删 `void ctx`，创建 FixpointCtx → 调 config-fixpoint；删 env.ts runtime import（graph→env 环打破）。**env.ts** storeProjectConfig/storeAppConfig/storePageConfig/createInitialDependencyGraph/resolveAppAlias/getPages → 薄壳委托 config-fixpoint（D-PC-11）；删 14 个死函数 + 3 个常量 + 5 个 unused import。**D-PC-7** `fs.existsSync` 实现层（不扩 PackerContext）。**D-PC-8** `NpmResolver(ctx.workPath)`。**D-PC-10** `ctx.fileTypes.templateExts/styleExts/viewScriptExts` 替代 ALS getter。验证：tsc 0 errors；vitest 608/608；全量 7 项目 diff=0（air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui）。 |
| 2026-10-07 | **`fe-tools-style-minify-gate` `complete`**：style minifyCss（esbuild）gate `DIMINA_COMPILER_DIFF_VERIFY` env var。**`style/emit.ts`**：加 `isDiffVerifyMode()`（`!!process.env.DIMINA_COMPILER_DIFF_VERIFY`）+ `emitStyle` 激活死 `minify` 参数（`minify && !sourcemap && !isDiffVerifyMode()` → 调 `minifyCss`）。**`style/parse-walk.ts`**：sourcemap=false 路径 minifyCss 调用加 `isDiffVerifyMode()` gate（`shouldMinify && isDiffVerifyMode()`）。**D-SM-3 `!sourcemap` 守卫**：sourcemap=true 路径 cssnano 已在 parse-walk 处理，emit 不双重 minify + sourcemap 不失效。**D-SM-4**：per-module minify（验证模式）vs aggregated minify（生产模式）产出字节差 1 byte（inter-module `\n`），均有效。cssnano 不动。验证：tsc 0；vitest 608/608（两种模式）；diff=0 7/7（验证模式）；style-sourcemap.spec.js 3/3 pass（生产模式 sourcemap=true 不双重 minify）。 |
| 2026-10-07 | **实施 `fe-tools-invalidation-all-kinds`**（增量前置 G3；complete）：`getInvalidatedModules` 去 `kind=logic` 硬编码——① owner 收集删 `if (kinds.has('logic'))`（D-IV-7 反转，`for (const [owner] of ownerKinds)`）② 闭包 `getDirectDependents(id, 'logic')`→`getDirectDependents(id)`（D-IV-6 反转，全 kind dependents）。**module 级与 entry 级失效闭包对齐**（`getAffectedEntries` 早已全 kind）。`computeInvalidatedModules` 函数体零变更（行为自动随 graph 泛化）。JSDoc 同步：`packer/types.ts:357` `logic moduleCache 失效集`→`全 kind 失效模块列表`；`invalidation.ts:30-39` 去 `logic Module 集/仅 logic 边/D-IV-6 kind=logic`→`全 kind Module 集/全 kind 边/D-IU-1`。授权 = incremental-unify D-IU-1（deferred 但设计已拍板）。**行为 0 边界**：getInvalidatedModules 仅 watch 路径执行；one-shot build 不触发 → diff=0；watch 路径**非 no-op**——moduleId 跨 kind 共享（view `compile.ts:37`/style `parse-walk.ts:282`/logic `index.ts:124` 同 namespace）→ G3 后 view/style 变更把共享 moduleId 放进 set，logic worker 运行时命中 → skip→recompile（保守过失效）；安全经 ① stages 门控（`compile-target.ts:174` logic 仅在 requestedStages 含 logic 时派发）+ ② superset 单调（set 只扩，永不欠失效）+ 相同源重编译字节一致。测试：反转 2（wxml→view owner / component.js→page）+ 新增 3（wxss→style / component.wxml→依赖页 / 同模块多文件）。验证：tsc 0 errors；vitest 612/612（compile-cli-cache flaky 单跑 pass）；全量 7 项目 diff=0；V-PC-5 0 新增 violation。 |
| 2026-10-08 | **实施+归档 `fe-tools-view-style-compile-res`**（增量前置 G4；complete）：view/style worker 返回 `ViewCompiledModule[]`/`StyleCompiledModule[]`（D-PCS-10 已存在类型）——① `view/index.ts` `compileML` 返 `Promise<ViewCompiledModule[]>`（收集 `viewParseWalk` 返的 `EmitModule` → 降级 base `{moduleId,kind:'view',code,map,dependencies:[]}`，renderBody/wxsBindings 留 undefined）+ `viewCompile` 返 `{viewCompileResults}` ② `style/index.ts` `compileSS` 返 `Promise<StyleCompiledModule[]>`（收集 `buildCompileCss` 返的 `StyleCompileResult` → 降级 base，dependencies:[]，styleScopeId 留 undefined）+ `styleCompile` 返 `{styleCompileResults}` ③ `stage-channel.ts` 新增 view/style cache 写入块（guarded `if (viewCache && viewResults)`——G4 期 ctx 无 viewCache/styleCache → no-op）。**D-G4-1..9**：降级 base+dependencies:[]（反转 D-IU-2 全字段期望）；cache value bare Map（反转 D-IU-2 双存）；不复用 ModuleResultCache（D-IU-3）；ctx plumbing 边界（G4=type+写，G5=实例+plumbing+skip）；emit 不变；行为 0；A-IU-3 拆分授权（G4=数据源+写，G5=实例+skip）；D-IU-4 两层 boundary（G4=cross-rebuild 写 only，读=G5）。compile 只返新字段，successPayload 由 `runtime.ts:30` `Object.assign` 单独合并（防 double-flush logger）。distinct 字段名 `viewCompileResults`/`styleCompileResults`（防 logic 块 `if(result.compileRes)` 误抓——logic value shape `{compileInfo,logicDependencies}` 与 View/StyleCompiledModule 不同）。**行为 0 边界**：G4 期 `PackerSessionState` 无 viewCache/styleCache 字段 → orchestrator 不 plumb → one-shot ctx.viewCache/styleCache 永远 undefined → stage-channel 写 no-op → 无行为变更 → diff=0。worker 返额外数据不改 emit（collection 是 read-only 遍历 in-memory modules）。**8 轮 review 36 findings 全清**（R1 伪代码保真/R2 traceability 1:1/R3 readiness）。测试：stage-channel 单测 5（① cache 写入 ② no-op ③ worker 返 shape + logic 块回归）。验证：tsc 0 errors；vitest 617/617；全量 6 项目 diff=0；V-PC-5 0 violation。为 G5 cache-hit skip 备数据源。 |
| 2026-10-09 | **实施 `fe-tools-view-style-cache-skip`**（增量前置 G5；complete）：incremental-unify 重激活——A-IU-3 剩余（`PackerSessionState` viewCache/styleCache 字段 + orchestrator plumbing + stage-channel worker input 快照）+ A-IU-4 cache-hit skip。① `session-state.ts` 加 `viewCache?: Map<string, ViewCompiledModule[]>`（per-page-bundle）+ `styleCache?: Map<string, StyleCompiledModule>`（per-page bare，无 transitive subs）② `orchestrator.ts` state→ctx plumbing 镜像 logic（:171/:181）③ `stage-channel.ts` worker input viewCache/styleCache 快照（`new Map(c)` copy constructor——**F12**：bare `Map` 无 `toJSON`，非镜像 logic 的 `c.toJSON()`；logic `ModuleResultCache` 有 toJSON）④ `style/index.ts` `compileSS` cache-hit per-page skip（跳 buildCompileCss，re-emit cached code/map）⑤ `view/index.ts` `compileML` cache-hit skip。**D-G5-1..6 + D-G5-4'**（实施期 P-G506 反转 D-G5-4 F6）：原 F6 设计用 `graph.getDirectDependencies(page,'component')` 重建 sub 集——**P-G506 验证发现不可行**（graph 'component' 边仅 direct 非 transitive、不含 wxs modules、序不一致 → cache-hit bundle 缺内容，实测 base/pages_index.js b1=10525 vs b2=3049 字节）。**D-G5-4' 解**：viewCache 改 **per-page-bundle**（`Map<string, ViewCompiledModule[]>`）——cache value = viewParseWalk 完整有序 EmitModule[]（page+transitive subs+wxs），cache-hit 直接 re-emit 存储原序 bundle → 字节一致（同集同序同 input→emitEntry 确定性输出）。invalidation = bundle 内任一 module moduleId ∈ invalidated → cache-miss 全量 viewParseWalk。compileML 返 `{results, pageBundles}`，viewCompile 返 `{viewCompileResults, viewPageBundles}`，stage-channel view 写块改 per-page-bundle。**RG5-1 residual 消解**（① graph 一致性 + ② F7 顺序均不再相关——直接存原序 bundle）。**行为 0 边界**：one-shot 无 invalidatedModules + state.viewCache=undefined → 无 cache-hit skip → 全量编译 = G4 行为 → diff=0。watch cache-hit skip = 效率提升（产物字节一致）。测试：`view-style-cache-skip.spec.js` 6（compileSS cache-hit/miss/no-cache + compileML per-page-bundle cache-hit/miss/no-cache）+ G4 test ① 同步 per-page-bundle shape。验证：tsc 0 errors；vitest 84 files / 623 tests 全绿（compile-cli-cache flaky 单跑 pass）；P-G503 one-shot 6 项目 diff=0；P-G506 view 0 pages_* diff + style 0 .wxss diff（byte-identity confirmed）。**residual（out-of-scope，pre-existing）**：logic cache 7 logic.js diff + static-copy 22（invalidatedModules=[] 时跳静态拷贝）——G4 baseline 同样存在，需独立 Action（logic-cache-byte-identity + incremental-static-copy）。闭合 incremental-unify（A-IU-1..5 全 complete）。 |
| 2026-10-09 | **实施 `fe-tools-incremental-chain-residuals-closeout`**（IRC；complete）：三轮回顾（9-24/10-09 G5/10-09 G1-G5）consolidate 的 residual closeout。**R1（high）接线**：`watch-runner.ts:91-93` 加 `if (!sessionState.viewCache) sessionState.viewCache = new Map()` + styleCache 同（D-IRC-1）——闭合 G5 生产效能缺口（watch-runner 此前不实例化 → cache 永远 miss、G5 效能空转；正确性无影响）。one-shot 创建点（`index.ts:38`/`build-pipeline.ts:23`）不动 → undefined → no-op → diff=0 边界延续（D-OS-1「单次 build 不传 state」）。**R6**：集成测 ① 加 `.css` 字节恒等断言。**R7**：`view/index.ts:172` 既有 stale 注释更新（viewCompileResults vestigial-but-intentional——G5 改 stage-channel 读 viewPageBundles 后该字段不被消费，但有意保留 HMR-future dirty signal；runtime.ts:33 仍 postMessage）。**R8**：integration `afterEach` reset `DIMINA_COMPILER_DIFF_VERIFY`。**R4**：`docs/fe-tools/README.md` 导航补全 G1-G5+IRC 链（状态标注本已正确）。**R9**：`compileML` `ensureWxsScan` 移入 `hasMiss` 条件分支（预检式与 loop cache-hit 逐字同式；全 cache-hit 跳过）。**修正 G5 A-G51 叙事超前**：G5 acceptance A-G51 称「watch-runner 创建实例」在 G5 closeout 时超前于代码（retrospect F1 抓出）；IRC R1 接线后叙事与代码一致。**G5 归档不重写**（immutable，与 X1 同原则）。行为 0：one-shot 6 项目 diff=0（P-IRC3）；接线回归测（注入 state + mock build，不手建 Map）；tsc 0 errors；vitest 84 files / 626 tests（compile-cli-cache flaky 单跑 pass）；V-PC-5 0 新 violation。residual tracker R1/R6/R7/R8/R4/R9 → fixed；R3/R5/X1 open（HMR 前/非缺陷/归档不可变）；R2 downgraded。 |
| 2026-10-09 | **实施 `fe-tools-style-minify-path-unify`**（SMPU；complete）：统一 style minify 到单一字节恒等路径（per-module）+ 下线 `DIMINA_COMPILER_DIFF_VERIFY` dual-path。**D-SMPU-2 locked A**（revert，minify 留 parse-walk per-module，最小改动 + 字节恒等已证 + 接受放弃 D-SM-2/D-CN-1/D-CN-3 迁移）。① `style/parse-walk.ts`：删 `isDiffVerifyMode()` guard → esbuild `:390` + cssnano `:377` 无条件 per-module minify（canonical）② `style/emit.ts`：删 `isDiffVerifyMode()` 函数 + `emitStyle` 两 minify 块（cssnano `:63` + esbuild `:75`）+ `import postcss` → emitStyle 仅 package + sourceMappingURL（`StyleEmitOptions.minify` 变 dead param，注释标）③ `view-style-cache-skip.spec.js`：删 env setup（IRC R8 的 env reset 随之消失——env var 已下线）。**反转 D-SM-4/D-CN-4 Non-scope**：字节一致现为要求（production == verify baseline）。**bridge D-SM-2/D-CN-1/D-CN-3 反转**：方案 A 放弃 esbuild minify 归 emit 迁移 + cssnano 正本/canonical 归 emit → canonical 回 parse-walk（load/compile 拆时重定）。**行为 0**：post-SMPU production（no env）== pre-SMPU verify（env=1）—— 6 项目 diff=0（proving 统一成功）；tsc 0 errors；vitest 84 files/626 tests；style-sourcemap.spec.js 3/3 pass（cssnano per-module sourcemap 仍正确映射，F6 concern NOT realized）；V-PC-5 0 新 violation。闭合 dual-path 验证缺口（G1-G5+IRC 6 轮 behavior-0 验 parse-walk 路径，production 跑 emit 路径——probe 实证两路径字节不同）。**13 轮 review 13 findings（F1-F13）全 fixed**（R1-3 readiness / R4-6 empirical+cross-authority+consistency / R7-9 deep-verification+design-gate+holistic / R10-13 close-gate+systematic+confirmatory；R12+R13 连续 0 收敛）。 |
| 2026-10-09 | **实施 `fe-tools-hmr-emit-derive`**（HMR-compiler H1；complete）：orchestrator Logic emit task 从 `ctx.emitBuckets` 改调 `deriveLogicBuckets`（graph + cache 派生）。**D-ED-1 B2+E**：B2 = cache 插入序迭代（非 graph `.sort()` 字典序；实证 #1 58==58）；E = cross-bucket dedup（sub closure MINUS main；实证 #3 7-1=6）。`convergence.ts` 新增 `deriveLogicBuckets` + `deriveFromGraph` 改 B2；`module-result-cache.ts` 加 `entries()`。**independent subs exception**（F1）：independent 传 `[]` 不 dedup → deriveLogicBuckets 跳 dedup。`emitBuckets` 全链下线（logicCompile 不返 / stage-channel 不存 / orchestrator 不读）。**D-ED-2 locked B**（一次性，反转 D-HMR-2 推荐 A）。行为 0：6 项目 diff=0；tsc 0；vitest 84/626（compile-cli-cache flaky 单跑 pass）；V-PC-5 0 新 violation。15 轮 design.draft review（F2-F19）+ 5 轮 implementation review（F1-F2）。为 H4 per-module HMR push 备 emit 增量化基座。 |
| 2026-09-24 | **回流只读回顾** [`2026-09-24-packer-incremental-retrospect.md`](./2026-09-24-packer-incremental-retrospect.md)：对照提交史 + 当前 `src`。Packer 路 2 / G1–G5 算法与测试对齐叙事；**F-R1**：生产 `watch-runner` 未 `new Map()` 实例化 `viewCache`/`styleCache` → stage-channel 写 no-op → G5 生产空转（测手工赋 Map 才命中）。另记 logic/static-copy residual、ALS/resolvers 双世界。未改 `src`。 |

**HMR-compiler H4 per-module HMR push Phase 1（fe-tools-hmr-push · complete 2026-10-09）**：编译侧 per-module HMR 基础设施。**D-PUSH-1 locked**：`RELOAD_LEVELS` 加 `L_HMR`（per-module payload level）+ `synthesizeReloadLevel` 加 `enableHmr` 标志（默认 false backward-compatible——增量单 kind → L_HMR；默认 L1/L2/L3 不变）。**D-PUSH-3 locked**：`BuildModel` 加 `_dirtyEntries: Set<string>`（add 时 track）+ `getDirtyEntries()` + `clearDirty()`；`materialize` 增量（dirty 非空 → 只写 dirty entries；空 → 全量 one-shot/首次 build）。**D-PUSH-2 locked 选项②**：runtime-side downgrade——编译侧发 L_HMR payload，runtime 收后自降 L1（runtime 未实现 → payload 丢失 F3 风险已记，非阻塞伞 close）。**F-H4-2 deferred**：publishToDist 增量（atomic move → incremental copy）是 watch 增量 publish 主要工作量，Phase 2 重构。行为 0：6 项目 diff=0（one-shot 无 dev server → L_HMR 无影响；materialize 全 dirty → 全量）；tsc 0；vitest 83/625（compile-cli-cache flaky excluded）；V-PC-5 0 新 violation。编译侧 HMR 交付完成——runtime 就绪后启用 enableHmr 即激活 per-module hot-swap。


**H2 Phase 2 — F-H2-1 L/C/E 拆分完成（fe-tools-hmr-registry-materialize Phase 2 · 2026-10-09）**：H2 归档时 deferred 的 Step 1.5 三步全部交付。**logic**：`compiler/logic/registry-impl.ts` NEW——`logicLoader: Loader`（types.ts 接口 conform）包装 logicParseWalk（parse+walk 发现依赖 + MagicString 路径重写；source = emitModule.code pre-esbuild，dependencies = logicDeps；sourcemap deferred——pre-esbuild map 无法经 LoadedModule 流，types.ts 形状不变）+ `packer/registry.ts` `LoaderRegistryImpl` class + orchestrator `loaderRegistry` 实体化（logic 注册；compile/emit registry 仍 stub）。**style**：`buildCompileCss` monolithic while 循环 → `styleLoad`（组件树发现：显式栈 DFS 声明序 + compiledPaths 去重 + graph component 边读取，纯发现）→ `styleCompile`（per-module enhanceCSS；@import 子 fixpoint 保留内部）→ `styleEmit`（chunks concat + concatSourcemap）三阶段组合，字节恒等（发现/编译解交织安全：enhanceCSS 只写 'style' 边，展开只读 'component' 边）。**view**：函数级 per-module 拆分（非批量阶段）——`viewLoadModule`（L：toCompileTemplate 包装，parse WXML + 组件/wxs 发现）+ `compileModuleRender`（C：已有）+ `finalizeModule`（缓存+装配：已有）+ `viewEmit`（E：scriptRes → EmitModule[]）；**关键决策：view 批量拆分非字节恒等**（scriptRes 插入序 = EmitModule[] 序 = H3 order list 序，wxs 条目与模块条目交错；批量 load-then-compile 变序）→ compileViewTree 递归保持交错编排，阶段函数 per-module 可独立调用（H3 Phase 2 选择性重编译粒度基座）。行为 0：三步各自 tsc 0 + vitest 635/635 + 6 项目 diff=0 + V-PC-5 0（view 拆分中 filter 反转 bug 被 view-compiler-perf-cache 2 tests 捕获后修复）。

**H4 Phase 2 — F-H4-2 publishToDist 增量 sync（fe-tools-hmr-push Phase 2 · 2026-10-09）**：H4 归档时 deferred 的 publish 增量重构交付。`publish.ts` 加 `syncIncremental`（rsync 式：copy 差异文件 + 删除 dist 独有文件——F6 deletion）+ `collectFiles`（递归相对路径集）+ `filesIdentical`（size 快筛 + 字节级比对）；`publishToDist` 加 `incremental` 参数（默认 false）：true + dist 存在 → sync（**无 rm 窗口**——dist 永不短暂缺失，fallback L1 reload fetch 不 404）；否则原全量路径（rm + rename/copy 行为不变——F8 guard）。**正确性论证（无需 write 跟踪）**：createDist(seedPath) 先把上一轮 dist 完整 seed 进 targetPath，本轮所有写入（materialize/collectAssets/config/npm）落在 targetPath——targetPath vs dist 的 diff 恰为本轮变更；资产/配置/npm 非 BuildModel entry，content-diff 天然覆盖（BuildModel-files-only 方案会漏资产更新——已否决）。orchestrator '写入编译产物' 接 `!!seedPath`（watch-plan incremental + compile-cache incremental 是仅有的两个 seedPath 来源；全量路径永不传）。行为 0：tsc 0 + vitest 640/640（5 新 publish-incremental tests：差异 copy + mtime 保留 + F6 deletion + 全量/增量等价 + dist 缺失 fallback + 同 size 字节比对）+ 6 项目 diff=0（one-shot 全量路径未动）+ V-PC-5 0。测试教训：ESM 下 `require()` 产生独立 CJS 实例（dual-instance trap）——须 `await import` 保证与被测模块同一实例。
