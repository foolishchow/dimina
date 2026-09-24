# Packer Facade / Aspect / 设计模式缺陷诊断（2026-10-09）

- 类型：只读架构回顾（对照 `fe/tools/bundler/src/packer/` + renderer 接入面）
- 分支：`feature/fe-tools-sidecar`
- 范围：packer 模块的 facade / aspect / strategy / god-object 设计模式层缺陷，及对后续 renderer（skyline/lynx）轨道的影响预测
- **不授权实施**；发现记入下文「发现」与「建议」，热修 / 新 Action 须另授

权威参考：[architecture-notes.md](./architecture-notes.md) · [2026-09-24-packer-incremental-retrospect.md](./2026-09-24-packer-incremental-retrospect.md) · [Experience-Review.md](../Experience-Review.md) · [docs/actions/TODO.md](../actions/TODO.md)

---

## 0. 回顾触发与结论

触发：fe-tools-hmr-chain-residuals close-with-residual 后评估"dispatch wiring 是否值得开新 Action"。预研发现 logicLoader 是刻意不完整的"Phase bridge 原语"（只做 buildJSByPath 7 步中的第 4 步），dispatch wiring 是 L 级 + 行为 0 critical + 价值依赖 runtime HMR API（外部阻塞）。转而审视 packer 整体架构，发现**设计模式层存在系统性缺陷**——不是某处写坏，是缺边界设计模式（facade / aspect / strategy injection）。

**核心结论**：packer 有一个纪律良好的"北星契约"层（`types.ts` 426 行纯形状，discriminated union、无索引签名、D-PCS-1..11 决策全记录），但**运行层（`orchestrator.ts` + ALS + Listr + mutable bag ctx）与类型层双轨长期共存**——类型层是文档，设计模式缺陷活在运行层、被类型层掩盖。表现为：无 facade、无 aspect、renderer 三连问题、orchestrator god object。**加一个 renderer（skyline/lynx）将同时触发全部 5 个缺陷**。

---

## 1. 发现（按严重度排序）

### F-PA-1（critical）— Facade 缺失：orchestrator 是 god object，非 facade

**现象**：
- 北星契约 `PackerOrchestrator.orchestrate(ctx: PackerContext, state, options) → EmitEntry[]`（`types.ts:386-393`）**根本没落地**。
- 实际签名 `_orchestrate(request: OrchestrateRequest) → Record<string, unknown>`（`orchestrator.ts:103, 366`）——签名、入参、返回值全不符。`orchestrator.ts:13` 自承"不写 implements PackerOrchestrator（返回值与形状 EmitEntry[] 张力，D-OR-7）"。
- `createPackerOrchestrator` 返回时公开内部结构：
  ```ts
  return { loaderRegistry, compileRegistry, emitRegistry, dispatchRegistry, orchestrate }
  ```
  调用方（build/session/dev）可伸手进 4 个 registry。
- orchestrator 同时干 6 类业务活：`store.load`（config fixpoint）/ `compileConfig` / `npmBuilder` / `deriveLogicBuckets` + `emitEngine`（logic emit 特例）/ `materialize` / `publishToDist`。

**影响**：调用方与 packer 内部无边界收敛。`OrchestrateRequest` 20+ 字段是"无 facade"的直接证据——facade 会把它收敛成 1-2 个语义入参（`CompileRequest` / `WatchRequest`）。orchestrator 既是编排者又是业务执行者又是 registry 暴露者 = 典型 god object。

**证据**：`orchestrator.ts:13, 84-88, 103, 189-260（initPhases + logic emit + materialize 全在 _orchestrate）, 366`；`index.ts:33-78`（build() 薄透传 20+ 字段）。

---

### F-PA-2（critical）— Aspect 缺失：5 个横切关注点全内联穿线 + 模块级全局

**现象**：没有任何横切关注点被抽成 aspect。全是 mutable 字段穿线 + 模块级全局，每个 domain（logic/view/style）各抄一份。

| 关注点 | 穿线方式 | 证据 |
| --- | --- | --- |
| **sourcemap** | flag 经 6 层：`options.sourcemap → compileConfig → stageSpecs.workerOptions → ctx.sourcemap → msg.sourcemap → worker 模块级 `enableSourcemap = !!msg.sourcemap` | `logic/index.ts:10` `let enableSourcemap = false`；`view/renderer/vue/state.ts` 同模式——每 domain 各一份模块级 mutable 全局 |
| **compatibilityWarnings** | `new Set()` 塞 ctx → worker 结果回传 → stage-channel 写 → orchestrator 读打印 | 12 处散落 7 文件（`stage-channel`/`logic`/`view`/`runtime`/`define-engine`/`orchestrator`/`types`） |
| **compileConfig** | `activeCompileConfig` 模块级全局，每 domain 各一份，worker 收 msg 后 `activeCompileConfig = config` | `logic/index.ts:14` + `view/index.ts:56` 各一份 |
| **cache invalidation** | `invalidatedModules` 穿 options→ctx→msg→worker Set→buildJSByPath cache 检查；view/style 另有 dirtySet 走 viewParseWalk | 两套失效路径，非统一 aspect |
| **lifecycle** | 最接近 aspect（createLifecycle + emit events），但作为 plain object `{emit, isolatedListenerErrors}` 在 Listr task 间手传 | 无 typed phase 契约 |

**影响**：每加一个 domain 或 renderer，就要重抄一遍 sourcemap/compileConfig/cache 穿线。横切逻辑复制粘贴 = 行为漂移温床（logic 的 sourcemap 穿线与 view 的已可能不一致）。新 renderer 作者无法复用既有 aspect，须自抄。

**证据**：`logic/index.ts:10-14, 276`；`view/index.ts:56`；`stage-channel.ts`（compatibilityWarnings 写）；`define-engine.ts:33`（buildConfig 抄 sourcemap/minify）。

---

### F-PA-3（critical）— Renderer 三连问题：契约 untyped + 副作用注册 + 层次混淆

**现象**：renderer 概念被劈成三个 registry + 一个 packer core 副作用注册：

```
① renderers.ts                              name → { runViewStage, runStyleStage }   // stage 编排级
② view/wxml/renderer/registry.ts            id → { render }                           // IR→code 级
③ orchestrator.ts:62-70                     模块加载副作用 registerRenderer(webview)  // packer core 下沉注册
```

**子问题**：

**(a) renderer 契约是 untyped bag**（违 types.ts 纪律）：
```ts
// renderers.ts
interface Renderer { name: string; [key: string]: unknown }  // 索引签名——types.ts 明令禁止的反模式
```
renderer 长什么样、该实现什么方法，无 typed 契约。新 renderer 作者只能读 webview 实现去猜。

**(b) 副作用注册在 packer core**：
```ts
// orchestrator.ts:62-70
const webviewRenderer = { name: 'webview', runViewStage, runStyleStage }
if (!getRenderer('webview')) registerRenderer(webviewRenderer)
```
packer 核心层在模块加载时注册具体 renderer——**packer 向下依赖具体 renderer**。加 skyline 时：
- 方案 a：orchestrator import skyline → packer 依赖所有 renderer（耦合地狱）
- 方案 b：skyline 在别处注册 → orchestrator 硬编码的 `webviewRenderer` 常量是冲突 fallback

**没有注入点**——host 不能说"这次 build 用 skyline renderer"。renderer 选择是编译期全局的，非 per-build/per-session 注入。

**(c) 两个 renderer 抽象层次混淆**：顶层 renderer（`runViewStage` = stage 编排）vs wxml renderer（`render` = IR→code）——都叫 "renderer"、各有 registry，但层次不同。新 renderer 作者要同时理解两者关系 + 各注册一次。

**(d) per-page renderer 结构性不可能**：`renderers.ts` 注释自承"页面级混合 renderer 编译留待未来"。renderer 字段在 compileConfig 全局流转（`compileTarget.renderer.adapter` → `stageSpecs[view].renderer` → `createStageTask`），stage plan 不按页分 renderer。`app.json.renderer` 全局 + `page.json.renderer` 页面级字段**读了但不用**——加 skyline 混合页要重写 stage plan。

**(e) renderer 无 aspect 接入**：renderer adapter 收 `{ctx, task, workerOptions, lifecycle}`——mutable bag。renderer 想参与 sourcemap/cache/lifecycle 没有类型化 hook，只能从 bag 捞字段。

**影响**：加 skyline 将同时撞 6 墙：① orchestrator 副作用注册 → packer 依赖 skyline；② 契约 untyped bag → skyline 作者猜接口；③ 两 registry 层次混淆 → skyline 注册两次；④ per-page → stage plan 重写；⑤ skyline 抄一份 sourcemap/compileConfig/cache 穿线；⑥ skyline view cache 要并入 StageChannelContext（已有 viewCache/styleCache，再加 skylineCache？）。

**证据**：`renderers.ts`（Renderer 索引签名 + 注释"留待未来"）；`orchestrator.ts:62-70`（副作用注册）；`view/wxml/renderer/registry.ts`（第二 registry）；`registry.ts:158-180`（stageSpecs.renderer 流转）。

---

### F-PA-4（high）— 三种 ctx 模型未 reconcile

**现象**：三种 ctx 共存，未收敛：

| ctx | 声明位置 | 角色 | 现实 |
| --- | --- | --- | --- |
| **PackerContext** | `types.ts:67-83` | I/O 环境（workPath/targetPath/readContent/resolvers/fileTypes） | 热路径几乎不构造；_orchestrate 通篇调 env.ts ALS 全局（`getWorkPath()`/`getPages()`/`getAppConfigInfo()`） |
| **OrchestratorState** | `types.ts:317-330` + `session-state.ts` | session-scoped（graph+cache+invalidated） | 实体化（PackerSessionState），但 `session-state.ts:11` 自承不写 `implements OrchestratorState`（ModuleResultCache 泛型化 deferred） |
| **StageChannelContext** | `types.ts:90-110` | pipeline-scoped mutable bag（16 字段，load/compile/emit 增量写） | **ALS 替代未完成态**——既非纯 I/O 也非 session，是 Listr 流转的 mutable bag |

**影响**：PackerContext 字段（readContent/resolvers）在 StageChannelContext 里根本没有——两个 ctx 模型未 reconcile。StageChannelContext 实质承载了本应属 PackerContext 的 I/O（storeInfo 间接含 paths）+ 本应属 aspect 的横切（sourcemap/cache/warnings）+ pipeline 状态（pages/buildModel）——一个 bag 干三件事。

**证据**：`types.ts:67-83`（PackerContext）vs `types.ts:90-110`（StageChannelContext）字段集不重叠；`orchestrator.ts:191`（`sctx.storeInfo`）+ `orchestrator.ts:196`（`getPages()` ALS 直调）同函数内两模型并用。

---

### F-PA-5（high）— 两套派发机制并存（L/C/E registry vs PackerDispatchRegistry）

**现象**：
- **PackerDispatchRegistry**（`registry.ts:24-40`，stage 级，WIRED）：`kind → {engine, title}` → worker。真实 compile/emit 走此路径。
- **L/C/E registry**（`registry.ts:84-130`，per-kind，NOT wired，北星形状）：`LoaderRegistry`（logic only）/ `CompileRegistry`（empty）/ `EmitRegistry`（empty）。只有 `kinds()/get()` 生产调用（D-HR-1 minimal）。

**影响**：L/C/E registry 是平行文档，非运行路径。两套派发机制长期共存 = 漂移风险。chain-residuals close-with-residual 的根因——dispatch wiring 要让 L/C/E registry 取代 PackerDispatchRegistry + worker，是 L 级重构（logicLoader 须对齐 buildJSByPath 7 步）。

**证据**：`registry.ts:24-40`（PackerDispatchRegistry，WIRED）vs `registry.ts:84-130`（L/C/E，NOT wired）；`orchestrator.ts:84-88`（三 registry 实体化但空 dispatch）。

---

### F-PA-6（medium）— logic emit 特例路径绕过 Emitter registry

**现象**：三 emit 路径不对称：
- view/style：worker → pageBundles → stage-channel 写 cache → buildModel.add
- logic compile：worker → compileRes
- **logic emit：`deriveLogicBuckets`（graph 闭包派生）+ `emitEngine` → buildModel.add**（`orchestrator.ts:288-310`）——非 worker、非 registry

**影响**：Emitter interface（`strategy: 'inline'|'delayed'`）永远不会是 logic emit 路径（除非重写 `deriveFromGraph` 为 Emitter impl）。北星"Emitter 封装 emit 策略"对 logic 不成立——logic 的 emit 策略是 graph 闭包，不是 Emitter。

**证据**：`orchestrator.ts:288-310`（deriveLogicBuckets + emitEngine，独立于 createStageTask）；`types.ts:251-265`（Emitter interface，logic 不走）。

---

## 2. 根因诊断（设计模式层）

不是某处写坏了，是**整套缺乏边界设计模式**：

| 缺陷 | 根因 | 表现 |
| --- | --- | --- |
| 无 facade | 调用方与 packer 内部无 facade object 收敛 | 20+ 字段 OrchestrateRequest 透传 |
| 无 aspect | 横切关注点应经 aspect/middleware 横切，而非沿 mutable ctx + 模块全局纵向穿线 | 每 domain 各抄一份穿线 |
| 无 strategy 注入点 | renderer 应是可注入 strategy（host 选 skyline/webview/lynx） | packer core 硬编码副作用注册 |
| god object | orchestrator 公开 4 registry + 干 6 类业务活 | 北星 facade 契约（只编排）vs 实现 god object |
| 类型层/运行层双轨 | types.ts 画了 facade+aspect+strategy 北星，运行层是 Listr+ALS+mutable bag | 类型层是文档，缺陷活在运行层 |

**双轨长期共存**是系统性根因——设计模式缺陷被纪律良好的类型层掩盖，不易在 review 中暴露。

---

## 3. 重构切法建议（不立即实施，待授权）

### 3.1 优先级排序

| 切法 | 价值 | 风险 | 规模 | 前置 |
| --- | --- | --- | --- | --- |
| **A. renderer 注入点重设计** | 解锁 skyline 轨道 | 行为 0 critical（renderer 选择路径） | M | 无 |
| **B. ALS→PackerContext 闭合迁移** | 根因（解 F-PA-4 + 为 aspect 铺路） | 行为 0 critical（ALS 全局改入参，触面广） | M-L | 无 |
| **C. aspect 分离（sourcemap/compatibility/config）** | 减穿线复制 + 为新 domain/renderer 复用 | 中（横切重构） | M | B（PackerContext 先就位） |
| **D. facade 收敛（PackerOrchestrator 真落地）** | 解 god object + 20+ 字段入参 | 行为 0 critical（orchestrator 重写） | L | A+B+C |
| **E. L/C/E dispatch wiring（取代 PackerDispatchRegistry）** | 北星兑现 + HMR per-module 增量 | 行为 0 critical（Loader 对齐 buildJSByPath） | L | D + runtime HMR 就绪 |

**依赖序**：A 独立可做（renderer 轨道阻塞解除）。B 是根因（C/D 依赖 B）。E 最后（依赖 D + runtime）。

### 3.2 各切法草案

**A. renderer 注入点重设计**（解 F-PA-3）：
- 拆 `renderers.ts` 的 `Renderer` 索引签名为 typed 契约（`interface Renderer { name; createStageAdapter(opts); createWxmlBackend() }`——统一顶层 + wxml 两层）。
- 删 `orchestrator.ts:62-70` 副作用注册。renderer 改 host 注入（`createPackerOrchestrator({ renderers: [...] })`）。
- per-page renderer：stage plan 按 page 分桶（每桶一个 renderer adapter），非全局 compileConfig.renderer。
- renderer 接 aspect hook（见 C）。

**B. ALS→PackerContext 闭合**（解 F-PA-4）：
- _orchestrate 的 env.ts ALS 直调（`getWorkPath`/`getPages`/`getAppConfigInfo`/`isMiniGame`）→ PackerContext 入参或 storeInfo 显式字段。
- StageChannelContext 的 I/O 字段（storeInfo 含 paths）→ 提升到 PackerContext 构造。
- StageChannelContext 收敛为纯 pipeline 状态（cache/pages/buildModel），不再兼职 I/O。
- config-fixpoint.ts 已闭合（FixpointCtx）——参照它闭合 orchestrator 层。

**C. aspect 分离**（解 F-PA-2）：
- 抽 `SourcemapAspect`（替代 enableSourcemap 模块全局 + ctx.sourcemap 穿线）。
- 抽 `CompatibilityAspect`（替代 12 处散落 Set）。
- 抽 `CompileConfigAspect`（替代 activeCompileConfig 每 domain 一份）。
- aspect 经 middleware/interceptor 横切 stage，非沿 ctx 纵向穿线。
- 每 domain/renderer 复用同一 aspect 实现（消复制粘贴）。

**D. facade 收敛**（解 F-PA-1）：
- `PackerOrchestrator.orchestrate(ctx, state, options) → EmitEntry[]` 真落地。
- orchestrator 只编排（graph.build / 查 entries / 派发 / 合 delta）；store.load/npm/derive/materialize/publish 下沉到 facade 后的子组件或 stage impl。
- `OrchestrateRequest` 20+ 字段收敛为 `CompileRequest`/`WatchRequest`（1-2 语义入参）。
- 4 registry 不再公开返回（facade 内部）。

**E. L/C/E dispatch wiring**（解 F-PA-5 + F-PA-6）：
- logicLoader 对齐 buildJSByPath 7 步（graph 写 / extraInfo / 遍历 / transformCjs / processedModules）→ 真 Loader。
- view/style Loader/Compiler/Emitter adapter impls（从 LoadInput 取 page 上下文，须 LoadInput 扩 page-context 字段——见 chain-residuals 预研 ②）。
- L/C/E registry 取代 PackerDispatchRegistry + worker 路径。
- logic emit 的 `deriveLogicBuckets` 重写为 Emitter impl（strategy: delayed，graph 闭包作为 Emitter 内部逻辑）。
- **前置**：runtime HMR API 就绪（否则价值不可行使，premature）。

---

## 4. 与既有 Action / residual 的关系

| 本诊断发现 | 既有 residual/Action 关系 |
| --- | --- |
| F-PA-5（两套派发） | = chain-residuals F-HR-1 的根因（registry 注册零消费 → dispatch 未接线） |
| F-PA-6（logic emit 特例） | = H1 D-ED-1 deriveFromGraph 接线（已 land，但是 Emitter registry 的绕行） |
| F-PA-2（aspect 缺失） | = ③ model→pipeline import residual 的温床（横切穿线散落致跨层 import） |
| F-PA-4（三种 ctx） | = R3（条件过期）的根因——StageChannelContext 是 R3 ctx 三分的产物 |
| F-PA-3（renderer 三连） | 新发现——既有 Action 未覆盖（renderer 轨道未启动） |

**建议**：F-PA-3（renderer 注入点）是**新轨道**，独立于 HMR 链 residuals。若 skyline/lynx 提上日程，A 切法优先。否则 B（ALS 闭合）是根因优先级最高。

---

## 5. 不做的事

- **不改 src**（只读回顾）。
- **不开新 Action**（切法草案待用户授权 + 须先定优先级：renderer 轨道 vs ALS 闭合 vs 其他）。
- **不重写 types.ts 北星**（types.ts 是好资产；缺陷在运行层，重写类型层不解决运行层问题）。
- **不立即做 dispatch wiring（E）**——runtime HMR API 未就绪，premature。

---

## 6. 后续询问

1. skyline/lynx renderer 是否提上日程？若 yes → A 切法优先（解 renderer 注入点）。
2. 是否启动 ALS→PackerContext 闭合迁移（B）作为根因优先？M-L 级 + 行为 0 critical。
3. 还是转其他优先级（ts-migration 技术债 / didi-side 回流 / 其他 open action）？

待用户定方向后，再 draft 对应 Action（formalize → plan → review → implement 全流程）。
