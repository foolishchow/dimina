# RFC：DMCC 编译器架构改造 —— dev/HMR 一体化与架构统一

| 项 | 内容 |
| --- | --- |
| 状态 | 草案（Draft v0.3），供评审 |
| 分支 | `feature/compiler-improve` |
| 范围 | `fe/packages/compiler`（DMCC）及 dev 体验链路，不改变运行时产物契约 |
| 关联文档 | [架构总览](./Architecture-Diagram.md) · [实现细节](./Architecture-Details.md) · [维护经验](./Experience-Review.md) · [Umbrella Action](./actions/compiler-improvement/README.md) |

## 1. 背景与动机

本改造的动机**不是性能**，而是三个工程问题：

1. **dev 体验割裂**：本地预览需要 `pnpm compile`（批量脚本）+ `pnpm dev`（容器 vite 工程 + 代理服务）两个世界配合，容器 demo（`fe/packages/container`）与编译器之间靠写死目录约定（`container/public`）耦合，外部用户无法用 `dmcc` 一条命令获得完整预览。
2. **热更新缺位**：watch 只做到「重新编译」，编译完成后的生效方式（整页刷新？重启 app？样式能不能不重跑逻辑层？）没有设计，每次改动都付出全量重启的代价。
3. **扩展点缺失，架构无统一挂载面**：编排层是硬编码的 Listr 任务树；未来 Lynx 渲染后端、宿主自定义插件、dev server 都没有干净的接入点，只能继续往任务树里塞分支。

性能（napi 边界序列化、JS 侧字符串热点）是**附带收益**，不作为立项依据。

### 1.1 目标（成功标准）

- **G1 dev 一体化（必达）**：`dmcc dev <workPath>` 一条命令完成编译、预览、代理；使用者无需进入 `fe/` 工作区，无需理解 container 与产物目录约定。
- **G2 分级热更新**：L1（页面 relaunch）必达；L2（CSS 热替换）力争；L3（模板热重挂保 service 状态）力争，时序不成立则降级为 L1（见 §7 假设 1），降级不阻塞交付；任何级别的编译失败都不得中断运行中的实例。
- **G3 统一挂载面（必达）**：编译器生命周期可挂载——dev server、宿主插件、未来 lynx adapter 通过同一套 hook / target / 插件契约接入，不再向任务树塞分支。验收含 dogfood：一个示例插件（自定义 transform 或 dev 事件订阅）全程不修改 compiler 核心实现。
- **G4 产物契约护栏（全程有效）**：改造期间产物**除 sourcemap（`.map`）外字节级不变**；`.map` 允许语义等价差异（B1 替换实现），验收以断点有效性与位置抽查为准；55 个既有 spec 全绿。这是约束而非交付物。

### 1.2 非目标

- **性能优化**：B 轨道的附带收益，验收标准是「不劣化」而非「更快」。
- **L4 logic 状态保留热替换**：明确不做（§4.2）。
- **webpack / swc 插件兼容**：明确不做（D5）。
- **Lynx 落地**：本文仅预留挂载点（A4）；PoC 与立项另出 RFC（C1）。
- **运行时语义修改**：不改变既有运行时语义与四端原生容器行为、bridge 契约；允许在 Web 容器（`fe/packages/render` + `fe/packages/container-sdk`）新增 **dev-only 扩展能力**（L2/L3 所需，经 feature flag 隔离，不影响产物与原生端）。
- **fe 工作区自身的开发工作流**：运行时/容器开发者的 vite dev、`dev:native`、preview 链路保持现状，不在本改造范围。

### 1.3 追溯：动机 → 目标 → 手段 → 阶段

| 动机 | 目标 | 手段 | 阶段 |
| --- | --- | --- | --- |
| dev 体验割裂 | G1 | dev server + 内置宿主页（container-sdk 复用）+ 代理合并 | A2 |
| 热更新缺位 | G2 | HMR 分级 + 变更分类器（复用依赖图与阶段映射） | A2 / A3 |
| 扩展点缺失 | G3 | hook 生命周期 + target 抽象 + 极简插件 API | A1 / A4 / D5 |
| （长期）统一核心、与 rspeedy 工具链同构 | — 非 G1–G3 交付项 | Rust 宿主（oxc 作 cargo 依赖） | B0–B4，解耦可延后 |

## 2. 现状盘点（已核实事实）

以下事实均来自当前仓库源码，作为本 RFC 的证据基础：

### 2.1 产物契约（改造中必须冻结的部分）

- 逻辑层产物：逐模块 `modDefine('/路径', factory)` 注册，无 bootstrap runtime；`require()` 保持运行时求值，编译期仅改写路径字面量为模块 ID。
- 运行时注册表：`@dimina/common/src/core/amd.js`（`modDefine`/`modRequire`），由 service 层注入 `globalThis.modDefine`（`packages/service/src/core/env.js`）。
- 视图层产物：按页面拆分的 `.js`（内含 Vue 渲染函数，同样 modDefine 格式）与 `.css`。
- 包边界：主包 + 分包（含独立分包）各自产出 `logic.js`；跨包 `require` 按路径经运行时注册表解析，**不是**静态 chunk 语义。
- 模块循环依赖按 CJS 语义保留（logic-compiler 中仅断回边、不断深链，有注释与测试锁定）。
- sourcemap 模式下跳过 minify（单层行偏移拼接，服务于 Harmony QuickJS 断点调试）。

### 2.2 现有 dev 链路

```text
pnpm compile ─→ src/bin/compile.js 批量编译 examples/miniprogram
                └─ 产物写入 fe/packages/container/public/{appId}/
pnpm dev     ─→ concurrently[ proxy server + container(vite) dev ]
                └─ container 消费 @dimina/fe-container-sdk 的 createContainer()
                   按 resourceBaseUrl 约定拉取 app-config.json / logic.js / 页面产物
watch        ─→ chokidar + 依赖图 → 增量重建计划（dmcc build -w 已有，但无生效联动）
```

关键事实：**`@dimina/fe-container-sdk` 本就是无 UI、可嵌入的容器运行时 SDK**，container 只是它的参考宿主——「合并」不需要重写容器，只需要把宿主页与资源服务内置到编译器。

### 2.3 可复用的增量基础设施

三阶段并行 worker（cgroup 感知）+ 文件指纹缓存（`COMPILE_CACHE_VERSION`）+ `DependencyGraph`（模块/文件归属、依赖/被依赖边）+ `compile-stages`（文件类型 → 受影响阶段映射）+ seed 目录 + 页面级 `affectedEntries`。**依赖图与阶段映射恰好构成热更新所需的「变更分类器」**，是 §4.2 的地基。

### 2.4 技术栈分层

| 层 | 技术 | 性质 |
| --- | --- | --- |
| JS/TS/WXS 解析与遍历 | oxc-parser / oxc-walker | 原生（napi） |
| 源码改写 | MagicString | JS |
| 压缩 / TS 转换 | esbuild | 原生 |
| 模板编译 | cheerio + htmlparser2 + `@vue/compiler-sfc` | JS |
| 样式 | postcss + postcss-selector-parser + autoprefixer + cssnano + less/sass | JS |
| 编排 / watch / 增量 / 图 / Worker 池 / 发布 | 自研 JS | JS |
| 质量护栏 | 55 个 vitest spec（含 2 个 `.test.js`） | — |

## 3. 决策记录

### D1. 不采用通用 bundler（rspack / webpack / rollup / rolldown / esbuild lib / parcel / farm）

**理由**：DMCC 的逻辑层产物是「保模块边界 + 路径寻址注册表 + require 运行时求值」的序列化格式，与 bundler 的定义（消灭边界、输出优化 chunk + 自带 runtime）在模型上对立。rspack/turbopack 的 chunk 渲染核心在 Rust 侧，JS hook 无法触达逐模块格式；历史上 Taro/uni-app 用 webpack 4 硬改 chunk 模板做到类小程序输出，代价是维护 fork/厚插件，且这条后门在 webpack 5 与 Rust 化 bundler 中已被关闭。

**后果**：modDefine 序列化、require 改写、包边界语义继续由 DMCC 自研并拥有。

### D2. dev 一体化：`dmcc dev` 为编译器内置能力，不依赖 rspack

**理由**：`dmcc dev` = 现有 watch + 静态资源服务（no-cache）+ 内置宿主页（消费 container-sdk + `pageFrame.html`）+ WebSocket 变更通知 + 网络代理合并。小程序双线程 + `App()/Page()` 全局注册语义决定了热更新上限见 §4.2 的分级，rspack 的模块级 HMR runtime 在此模型下没有承载点，dev server 能力用静态服务 + ws 即可覆盖。

**后果**：`fe/packages/container` 角色逐步收敛为参考宿主；compiler 对 container-sdk 的依赖方式（peer / 预构建宿主页随包分发）在 A2.0 定案。内置宿主页定位为**最小宿主**：直开目标 app（可选 `path` 参数），不含应用列表/手机壳 UI——列表壳保留在 container demo。

### D3. 渲染层引入 target 抽象；rspack 至多存在于 lynx adapter 内部

**理由**：若未来以 Lynx 原生渲染替代 WebView 渲染，被替换的只是「WebView + Vue render」一段：view/style 编译按 target 分叉（WXML → Lynx 模板源码 → rspeedy/rspack → `.lyx`），logic 层、modDefine 契约、service runtime、bridge 契约全部不动。rspack 的正确位置是 lynx target adapter 内部的实现细节（作为库调用），而非 DMCC 的架构基座。

**后果**：Lynx 路线的真实成本在 wx 组件集重写、CSS 子集与布局差异、双后端行为一致性（`map/canvas/video/web-view` 等组件是 WebView 路线强项、Lynx 路线弱项）；Harmony 与 Web 预览仍需 WebView 路线，最终形态是多后端并存而非替代。本 RFC 仅预留挂载点，Lynx 立项另出 RFC。

### D4. 架构统一优先：hook/target 层先行，Rust 宿主为解耦的长期轨道

**理由**：dev/HMR/统一三个目标用纯 JS 即可达成（A 轨道）。Rust 宿主的价值在「统一核心 + 阶段黑盒契约 + 与 lynx/rspeedy 工具链同构」，并顺带消除 napi 边界序列化（AST 全程留在 Rust 内存）与 JS 侧字符串热点；oxc 核心能力均有 Rust crate（`oxc_parser`/`oxc_ast`/`oxc_traverse`/`oxc_codegen`/`oxc_minifier`/`oxc_resolver`/`oxc_sourcemap`/`oxc_transformer`；遍历用 `oxc_ast::Visit` 与 `oxc_traverse`，注意 npm 侧的 `oxc-walker` 是 JS 包、无对应 cargo crate），Rust core 约等于「把 oxc 从 napi 调用换成 cargo 依赖，再补领域代码」。**两条轨道解耦**：A 轨道定义阶段接口与插件契约，B 轨道在接口之内替换实现，互不阻塞。

**后果**：新增原生二进制发布矩阵（napi-rs 预编译产物）；仓库已依赖 oxc/esbuild 原生包，分发负担不新增类别，但 CI 与调试成本上升。B 轨道各步以「与 JS 实现产物一致 + 耗时不劣化」为验收（性能为护栏而非目标）。

### D5. JS 插件层：阶段级黑盒 + 极简 hook；不做 webpack/swc 插件兼容

**理由**：
- postcss / postcss-selector-parser 操作的是 JS AST 对象，逐插件桥接无意义；正确粒度是整阶段黑盒（宿主调一次 `compileStyle(...) → {code, map}`）。
- webpack 插件兼容需要复刻 Compilation/Module/Chunk 对象体系（rspack 专职团队多年工作量）；swc 插件绑定特定 `swc_core` 版本且为 wasm 宿主设计，与已选的 oxc 路线冲突。rolldown 的先例证明「不兼容 webpack、只提供 6~8 个极简 hook」是可行的减法。

**后果**：插件 API 成为需要承诺稳定性的公开契约，需版本化与文档；在明确插件作者群体（dimina 团队 / lynx adapter / 宿主 App）后再冻结对外版本。

### D6. 产物契约冻结

**理由**：四端容器、运行时与既有回归测试共同锁定的行为边界。改造期间 `modDefine` 格式、模块 ID 规则、输出目录结构（`main/`、`{root}/`、`app-config.json`）、兼容性警告语义一个字节不变（sourcemap 文件的例外口径见 G4）。

**后果**：55 个既有 spec 全程作为行为护栏；新增能力（hook、dev、target）的测试按 [维护经验](./Experience-Review.md) 第 6 条执行消融实验。

### D7. 若启动 B 轨道：JS 单线程陷阱必须在架构第一天规避

**理由**：Rust 核心起多线程后，经 napi threadsafe function 回调的 JS（postcss 管线、Vue `compileTemplate`）仍会排队到单一 Node 主线程。现状 worker_threads 三阶段并行是真并行；naive 的「Rust 核心 + JS 插件」会让 JS 侧串行化。

**决策**：桥粒度 = 阶段级黑盒；每个 stage worker 各自加载 Rust 动态库（napi-rs 支持多 worker 各自 module env），JS 插件在各 worker 内并行执行；顶层编排保持轻量。**禁止**细粒度逐模板/逐模块跨语言互调。

## 4. dev 与 HMR 设计

### 4.1 `dmcc dev` 形态

```text
dmcc dev [workPath]
 ├─ watch（现有增量计划，扩展为产出「变更分类事件」）
 ├─ HTTP 静态服务：serve 产物目录（no-cache）+ 内置宿主页 + 代理（合并现 fe/packages/server 职责）
 │    └─ 仅对外暴露「最后一次成功发布」的快照（版本化目录）；编译失败时在售版本不变
 └─ WebSocket：向宿主页推送 { appId, changedStages, affectedPages, reloadLevel }
      └─ reloadLevel 由 dmcc dev 侧按 §4.2 合成规则计算，宿主页只负责执行
```

### 4.2 热更新分级（HMR Ladder）

按「改动付出多大代价生效」分级，**变更分类直接复用 `DependencyGraph` + `compile-stages`**：

| 级别 | 名称 | 触发变更 | 生效方式 | 前提 |
| --- | --- | --- | --- | --- |
| L0 | 全量重启 | `app.json`、`project.config.json`、tabBar/分包结构 | 通知容器重启 app | — |
| L1 | 页面 relaunch | `.js/.ts`（logic 阶段） | worker 重 eval logic → 当前页 relaunch，App 状态重建 | 容器支持 relaunch 消息 |
| L2 | CSS 热替换 | `.wxss/.less/.scss/.sass`（仅 style 阶段） | 仅向渲染层推送页面 css 重载，**logic/页面实例不动** | render 侧支持样式热替换 |
| L3 | 模板热重挂 | `.wxml`（仅 view 阶段） | 页面 view 模块重取 + remount，**service 侧状态保留** | render 侧支持页面级 remount + setData 状态回放 |
| L4 | logic 状态保留热替换 | `.js` 改动保留 App/页面状态 | 状态快照/回放迁移 | 复杂度高，**明确不做**，留待外部贡献 |

表后补充两条规则：

- **reloadLevel 合成规则**：防抖窗口内混合变更取最具破坏性的级别——出现 logic 变更即 L1；否则 view → L3；否则仅 style → L2；`app.json` 等配置或未识别文件 → L0。`compile-stages` 已能识别 config kind，L0 检测无需新机制。
- **L3 数据回放首选方案**：render 侧缓存每页最近一次 setData 快照，remount 后本地回放，**service 完全不动**；「service 重发数据」仅作备选。与 §1.2 最小触碰原则一致。

验收场景（对齐 [维护经验](./Experience-Review.md) 第 4、5 条）：首次进入、再次进入、快速连续保存、L2/L3 混合改动、保存出错（编译失败不得中断当前运行实例，保留旧产物并提示）。

### 4.3 插件 API 草案（待评审冻结）

```js
// 形态示意，非最终 API
export default {
	name: 'my-plugin',
	// 阶段级 transform：入参/出参均为完整源文本 + sourcemap
	transform: { stage: 'style', handler(source, id, opts) { /* … */ } },
	// dev 扩展：拦截变更事件 / 自定义 reload 级别
	devEvent(event, meta) { /* … */ },
	// 产物级钩子
	generateBundle(assets, meta) { /* … */ },
}
```

约束：hook 入参出参只含可序列化数据（字符串/Buffer/JSON），AST 不跨边界；hook 数量 ≤ 8 个；每个 hook 的执行时机与失败语义写入文档并配契约测试。

## 5. 分阶段路线图（绞杀者模式）

**A 轨道（主线：dev/HMR/统一，纯 JS）** 与 **B 轨道（长期：Rust 宿主，解耦可延后）** 并行推进，A 先行。

| 阶段 | 内容 | 验收标准 |
| --- | --- | --- |
| **A1 hook 层** | 把 Listr 任务树抽为可挂载生命周期（env → config → npm → [view ‖ logic ‖ style] → publish），不改任何行为 | 55 测试全绿；`build()` 公开行为与错误契约不变（`build-error-contract.spec.js` 重点回归） |
| **A2.0 宿主资产分发定案** | 前置决策：container-sdk 预构建产物随 compiler 分发 vs peer dependency（已核实：其运行时依赖仅 mitt/vconsole，render/service/components 均为构建期打入 dist；该决策决定 dmcc dev 的离线可用性与版本耦合） | 决策记录补充到 D2；新 clone 示例在 `fe/` 工作区之外验证所选方案可行 |
| **A2 dev server + L1** | `dmcc dev`：静态服务（服务最后成功发布快照）+ 内置宿主页 + 代理 + ws；logic 变更 → 页面 relaunch（复用 `appManager.restartMiniProgram`） | 示例 app 一条命令起预览（含 `fe/` 外新 clone 场景）；§4.2 L1 场景验收；dev server 与 ws 协议有 vitest 契约测试 |
| **A3 HMR L2/L3** | CSS 热替换 + 模板热重挂；落点：`fe/packages/render` + `fe/packages/container-sdk`（dev-only 扩展，feature flag 隔离）；L3 回放按 §4.2 首选方案 | §4.2 L2/L3 场景验收（自动化 + 手工）；编译失败不中断运行实例（消融：注入失败用例验证旧产物保留） |
| **A4 target 抽象** | view/style 输出按 target 分叉（先只有 `webview` 一个实现；服务于 G3 挂载面，为 C1 预留接入点） | 产物与现状逐字节一致（diff 验收） |
| **B0 基线** | profile 现有编译（冷/热/批量），记录各阶段耗时，作为 B 轨道「不劣化」对照 | 报告入库附录 |
| **B1 sourcemap 试点** | `oxc_sourcemap` 替换 source-map-js 合并逻辑 | sourcemap 三组 spec 全绿；Harmony QuickJS attach 实机验证；`.map` 语义等价性抽查；耗时较 B0 基线不劣化（±5% 误差带） |
| **B2 缓存 + 依赖图** | 指纹（blake3）与 DependencyGraph 下沉 Rust | 增量/全量/编译器热路径 spec 全绿；缓存版本号升级并验证旧缓存失效路径 |
| **B3 watch** | notify（或 @parcel/watcher）替换 chokidar | watch 调度 spec 全绿；rename/批量改动/输出目录自触发等边界用例 |
| **B4 view 管线 Rust 化** | WXML 解析 + 模板变换 + 代码生成下沉 Rust；保留 `compileTemplate` 阶段级桥 | view spec 全绿 + 产物抽样 diff 一致；耗时不劣化 |
| **C1 lynx PoC（可选，另立 RFC；前置：A4）** | `view/text/image` 三组件单页面走通 `.lyx` 链路 | bridge 链路图（事件产生→渲染完成）先行；Android demo 实机验收 |

每阶段遵循 [维护经验](./Experience-Review.md)：相邻回归（同链路组件、已有用例）、视觉/生命周期状态验证、临时日志与消融补丁不进入提交。

## 6. 风险清单

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| L3 模板热重挂的状态回放语义（生命周期/observer 时序） | 高 | 严格按小程序契约设计 remount 时序；覆盖首次/返回/快速切换/展开收起循环；消融验证 |
| 插件 API 过早冻结 | 高 | A1 只抽内部 hook 不对外承诺；对外 API 在明确插件作者群体后再定版本 |
| 编译失败打断运行中实例 | 高 | 发布目录原子性（编译成功才 swap）；dev server 仅服务最后成功发布快照（§4.1）；失败保留旧产物 + 明确提示 |
| 宿主资产分发与版本耦合（A2.0） | 中 | 决策前置到 A2 之前；预构建产物锁定版本并在 dist 中校验完整性 |
| B 轨道 JS 串行化导致性能倒退（D7 陷阱） | 中 | 阶段级黑盒 + worker 内加载 Rust 库；B0 基线对照，每步验收「不劣化」 |
| 原生二进制分发矩阵（平台/CI） | 中 | napi-rs 预编译；对齐 oxc/esbuild 现有分发方式；保留 JS 回退路径直至矩阵稳定 |
| Rust panic / 混合栈调试成本 | 中 | panic 转 JS Error 带结构化字段（对齐现有错误契约）；关键边界日志结构化 |
| 与上游演进冲突（fork 长期分叉） | 中 | 改造分层落点集中（compiler 包内），持续 `upstream/main` rebase |

## 7. 未验证假设（诚实边界）

按 [维护经验](./Experience-Review.md) 第 5、6 条要求，以下内容目前**仅为分析结论，未经本仓库实验证实**：

1. 「L3 模板热重挂可在保留 service 状态下达成」——render 侧 remount + setData 回放的时序可行性待 A3 原型验证；不成立则 L3 降级为 L1。
2. 「rspack chunk 渲染 hook 无法干净产出 modDefine 格式」——基于公开资料与先例推断；若 C1 lynx 路线启动，应先做 50 行级 PoC 实测（模块 ID = 路径、跨包 require 保持字面量、modDefine 逐模块输出三点）。
3. 「napi 多 worker 各自加载 Rust 库即可保住 JS 并行」——napi-rs 支持 worker env，但本仓库场景（阶段级大任务 + 共享只读数据）的实际调度行为待 B1 试点验证。
4. Lynx 工具链（rspeedy）的 API 稳定性与平台覆盖——待 C1 立项时重新评估，本文不作为承诺。

## 8. 与既有文档的关系

- 产物契约、通信模型以 [架构总览](./Architecture-Diagram.md) 与 [实现细节](./Architecture-Details.md) 为准，本 RFC 不修改任何运行时语义。
- [维护经验](./Experience-Review.md) 适用于本改造全过程：层级定位、消融实验、诊断日志控制、相邻回归验证。
- 改造完成后，`fe/packages/compiler/README.md` 与本 RFC 中的「现状」章节需同步更新；能力表如有变化须执行 `pnpm --filter compiler sync:compat`。

## 修订记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v0.1 | 2026-09-08 | 初稿：动机/D1–D7/路线图 |
| v0.2 | 2026-09-08 | 按动机重排（dev/HMR/统一优先）；补目标 G1–G4、非目标、追溯表 |
| v0.3 | 2026-09-08 | 实施计划审查修复：A2.0 前置决策、reloadLevel 合成规则、L3 回放首选方案、dev 快照语义；文档审查修复：spec 数量 55、oxc_traverse 更正、D6/G4 口径同步、最小宿主定义、C1 前置 A4、fe 工作流非目标 |
