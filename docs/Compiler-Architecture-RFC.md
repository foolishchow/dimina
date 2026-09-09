# RFC：DMCC 编译器架构改造 —— dev/HMR 一体化与架构统一

| 项 | 内容 |
| --- | --- |
| 状态 | 已定稿（Accepted v1.0，2026-09-08） |
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

**A2.0 定案（2026-09-08，决策记录）**：container-sdk **预构建产物随 `@dimina/compiler` 包分发**，不采用 peer dependency。

- **事实基础**：所有 `@dimina/*` workspace 包（common/render/service/components/container-sdk）均为 `private` 且无 version，不发布 registry——peer dependency 在发布形态上不成立（宿主无从安装）；唯一发布包是 `@dimina/compiler`（1.2.1），天然作为资产载体。
- **自包含已验证**：container-sdk dist（index.js 129KB + pageFrame.js 441KB + index.css 76KB + pageFrame.css 31KB + service.js 171KB，合计 ~850KB / gzip ~210KB）零 `@dimina` 残留引用；`service.js` 为无 import 的独立 IIFE bundle（`new Worker` 目标）；生产构建 external 仅 `mitt` 一个（`vconsole` 仅 `import.meta.env.DEV` 动态 import，生产被 tree-shake）。
- **离线模拟验证**（fe/ 工作区外裸目录）：compiler 包内 `sdk/` 静态资产 + `mitt` 依赖即可静态服务全部资源并完成浏览器解析链路（全部 HTTP 200）。
- **落地形态**：compiler 包内置 `sdk/` 静态资产目录（构建时从 container-sdk 复制），`dmcc dev` 直接静态服务；`mitt` 列为 compiler 的 dependencies（宿主页运行时解析），dev 模式 vconsole 随包提供。产物版本随 compiler 发布锁定，无宿主导致的版本漂移。
- **A2 前置依赖解除**：A2 子 Action 范围可直接引用 compiler 包内 `sdk/` 资产，无需处理 workspace 包安装。

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

**dev/HMR 生效边界（定稿，2026-09-08）**：`dmcc dev` 的预览与热更新**只在 Web 容器生效**。三层分离：

| 层 | 容器相关性 | 说明 |
| --- | --- | --- |
| 编译 + 产物 | 容器无关 | 同一份 DMCC 产物四端共用（Harmony/Web 等），D6 冻结；dev server 只 watch + 增量编译 |
| dev server 编排（静态服务/ws/代理/级别合成） | 容器无关 | 只编译 + 推送 `reloadLevel`，宿主只负责执行（§4.5） |
| **预览宿主 + HMR 生效端** | **Web 容器专属** | 内置宿主页 = `createContainer`（container-sdk）；L0 整页重启、L1 relaunch（`container.openApp(destroy)`）、L2/L3（`fe/packages/render` + container-sdk）全在 Web 容器/WebView + Vue render 内 |

- 依据：container-sdk =「Web 端小程序容器运行时 SDK」；render =「渲染线程 SDK」；§1.2 仅在 Web 容器（`render` + `container-sdk`）新增 dev-only 扩展能力（L2/L3 所需），**不改变四端原生容器行为**（Harmony QuickJS/WebView 等走同一产物但无 HMR）。
- 含义：L2/L3 的实现落点被此边界锁死（`render` + `container-sdk` dev-only）；ws 协议（§4.5）是容器无关协议契约，未来 lynx target（A4/C1）理论上可复用同一 ws 通道，但当前唯一执行端是 Web 容器。
- 对验收：L2/L3 场景验收锚点（首次/返回/快速切换/展开收起循环）在 **Web 容器内**执行；L0/L1 已由 A2 在 Web 容器交付（`appManager.restartMiniProgram` / `location.reload()`）。

### 4.2 热更新分级（HMR Ladder）

按「改动付出多大代价生效」分级，**变更分类直接复用 `DependencyGraph` + `compile-stages`**：

| 级别 | 名称 | 触发变更 | 生效方式 | 前提 |
| --- | --- | --- | --- | --- |
| L0 | 全量重启 | `app.json`、`project.config.json`、tabBar/分包结构 | 通知容器重启 app | — |
| L1 | 页面 relaunch | `.js/.ts`（logic 阶段） | worker 重 eval logic → 当前页 relaunch，App 状态重建 | 容器支持 relaunch 消息 |
| L2 | CSS 热替换 | `.wxss/.less/.scss/.sass`（仅 style 阶段） | 仅向渲染层推送页面 css 重载，**logic/页面实例不动** | render 侧支持样式热替换 |
| L3 | 模板热重挂 | `.wxml`（仅 view 阶段） | 页面 view 模块重取 + remount，**service 侧状态保留** | render 侧支持页面级 remount + setData 状态回放 |

**A3 实施结论（2026-09-08）**：Web 容器 dev-only 的 L2/L3 执行链已完成：运行时 flag/内部 envelope 与 `hmr:result` 回传、scope(app/page) CSS 事务、view module replacement、页面 root remount、setupData + initial-data wait 回放、update queue 与 L1 fallback 均有规格与真实 dev HTTP/WS 冒烟证据。A2 `/ws` 消息形状、reloadLevel 合成、编译产物和原生容器保持不变。真实浏览器 DOM/视觉验证工具未安装，作为残余风险记录，不改变“代码/协议/事务链已验证”的结论；若后续发现 render 生命周期时序不满足，必须沿既有 `hmr:result fallback` 路径降级 L1。
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

### 4.4 构建生命周期事件契约（定稿 v1，2026-09-08）

A1（`compiler-hook-layer`）已交付并归档（`docs/actions/_archive/complete/compiler-hook-layer/`）。以下为持久契约，A2/A4/A3 依赖本段：

- **实现**：`fe/packages/compiler/src/common/lifecycle.js`（内部路径，不进入 `package.json` exports）。
- **注入点**：`build(targetPath, workPath, useAppIdDir, options)` 的内部选项 `options.lifecycle`（`createLifecycle()` 实例；不属公开稳定契约）。未传入时内部自建。`build:start` 载荷剥离非序列化字段。
- **事件表**（按序触发；init 系 → stage 系 → publish/结束系；`build:error` 仅失败路径并随后以同一错误对象 reject）：

| 事件 | 载荷 | 备注 |
| --- | --- | --- |
| `build:start` | `{ workPath, targetPath, useAppIdDir, options }` | runBuild 进入、选项校验后 |
| `config:collected` | `{ fileTypes, pagesCount, miniGame }` | |
| `dist:prepared` | `{ seedPath }` | |
| `config:compiled` | `{}` | seedPath 模式且 prepareConfig=false 时省略 |
| `npm:built` | `{}` | seedPath 模式且 prepareNpm=false 时省略 |
| `stage:before` | `{ stage, pages, sourcemap }` | 每启用阶段一次；view/style 在小游戏下省略 |
| `stage:after` | `{ stage, compatibilityWarnings, durationMs }` | warnings 为本次新增（Set 差值） |
| `stage:error` | `{ stage, error }` | 阶段失败；随后 build:error |
| `bundle:published` | `{ targetPath, useAppIdDir }` | 全部 stage 完成后 |
| `build:warning` | `{ message }` | 每条兼容性警告镜像 |
| `build:end` | `{ result, isolatedListenerErrors }` | result 即 build() 返回值；隔离错误计数 |
| `build:error` | `{ error, stage? }` | 随后 reject 同一错误对象 |

- **语义**：每次 `build()` 独立实例（并发/AsyncLocalStorage 安全）；监听器按注册序依次 await；监听器错误隔离（`[lifecycle]` 前缀日志 + 计数，不中断事件流与构建、不改管网产物）；载荷浅冻结（ESM 严格模式下改动即抛错，被隔离）。
- **测试**：契约由 `fe/packages/compiler/__tests__/lifecycle.spec.js`（单元）与 `lifecycle-integration.spec.js`（集成，含四场景 + 隔离消融）锁定。

### 4.5 dev server 契约（定稿 v1，2026-09-08）

A2（`dmcc-dev-server`）已交付并归档（`docs/actions/_archive/complete/dmcc-dev-server/`）。以下为持久契约，A3（HMR L2/L3）依赖本段：

- **命令**：`dmcc dev [workPath]`，选项 `-c/--work-path`、`-s/--target-path`（缺省临时目录）、`-p/--port`（缺省 8080）、`--no-app-id-dir`、`--sourcemap`。初始 build 失败非零退出且不起服务；watch 循环中失败只推 `build:error`，服务与在售快照保持。
- **快照语义**：HTTP 静态服务 `targetPath`（publish 的 rename 原子性保证只暴露「最后一次成功发布」）；全部响应 `Cache-Control: no-cache`。路由：`/`（内置宿主页）、`/sdk/*`（container-sdk 预构建资产，A2.0 随包分发）、`/proxy`（SSRF 防护代理）、其余 → 产物。
- **ws 协议**（`/ws`）：

```
client -> server: { type: 'subscribe', appId }
server -> client: { type: 'subscribed', appId } | { type: 'error', message }
server -> client: { type: 'reload', appId, changedStages, affectedPages, reloadLevel, buildId }
server -> client: { type: 'build:error', message }
client -> server: { type: 'ack', appId, buildId }
```

- `reloadLevel` 由 dmcc dev 侧合成（宿主只执行）；`buildId` 每次重建自增（失败构建消耗但不推送）。失败：清空 pendingReload + 推 `build:error`，不推 reload。
- **reloadLevel 合成规则**（§4.2 最破坏性优先）：`plan.skip` → 不推；非增量（合并/配置 json/未知 kind/add-unlink）→ L0；含 `logic` → L1；含 `view` → L3；仅 `style` → L2；防御空 affectedPages → L1。L2/L3 为「上报级别」——本门宿主按刷新回退，A3 只升级宿主执行端，不改合成与协议。
- **宿主页**（最小宿主）：`createContainer` + `openApp({ destroy: true })` 直开目标 app，`?path=` 入口，`resourceBaseUrl: '/'`；L0 → 整页重启，L1/L2/L3 → relaunch 回退；不追踪导航栈（重进入口页）。
- **测试**：`dev-reload.spec.js`（14 用例矩阵）、`dev-host.spec.js`（10）、`dev-proxy.spec.js`（13，SSRF/合法/非法）、`dev-server.spec.js`（12，路由/快照/pendingReload/ws）。

## 5. 分阶段路线图（绞杀者模式）

**A 轨道（主线：dev/HMR/统一，纯 JS）** 与 **B 轨道（长期：Rust 宿主，解耦可延后）** 并行推进，A 先行。

| 阶段 | 内容 | 验收标准 |
| --- | --- | --- |
| **A1 hook 层** | 把 Listr 任务树抽为可挂载生命周期（env → config → npm → [view ‖ logic ‖ style] → publish），不改任何行为 | 55 测试全绿；`build()` 公开行为与错误契约不变（`build-error-contract.spec.js` 重点回归）。**已完成（2026-09-08，`compiler-hook-layer` 归档）**：57 文件/360 用例全绿；产物字节一致（nomap/sourcemap 双模式 diff 空）；事件契约定稿见 §4.4 |
| **A2.0 宿主资产分发定案** | 前置决策：container-sdk 预构建产物随 compiler 分发 vs peer dependency（已核实：其运行时依赖仅 mitt/vconsole，render/service/components 均为构建期打入 dist；该决策决定 dmcc dev 的离线可用性与版本耦合） | 决策见 D2（A2.0 已定案）；新 clone 示例验证随包分发可行 |
| **A2 dev server + L1** | `dmcc dev`：静态服务（服务最后成功发布快照）+ 内置宿主页 + 代理 + ws；logic 变更 → 页面 relaunch（复用 `appManager.restartMiniProgram`）。**已完成（2026-09-08，`dmcc-dev-server` 归档）**：dev 一条命令起预览；L0/L1 生效、L2/L3 上报+刷新回退；ws 协议与合成契约定稿见 §4.5 | 示例 app 一条命令起预览（含 `fe/` 外新 clone 场景）；§4.2 L1 场景验收；dev server 与 ws 协议有 vitest 契约测试 |
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

1. 「L3 模板热重挂可在保留 service 状态下达成」——render 侧 remount + setData 回放的时序可行性待 A3 原型验证；不成立则 L3 降级为 L1。**现状验证（2026-09-08，代码审计）**：
   - **数据快照可行且有基础**：`runtime.setupData`（`fe/packages/render/src/core/runtime.js:632`）按 `pageId` 累积每页完整响应式状态；`updateModule`（:1400）把 `u/ub` 消息的 setData 写入 `setupData`，`preInitUpdates`（:634）处理先抵达的更新。remount 时无需 service 重发——「每页最近一次 setData 快照」已天然存在于 render 侧。
   - **view 模块热替换当前不可直接完成**：`loader.createModule`（`loader.js:111-117`）对已存在 path 直接 return，无版本替换 API；新编译产物 `modDefine` 无法覆盖已有 `staticModules[path]`。需 A3 新增 `replaceModule(path, moduleInfo)`（含 usingComponents 递归、旧实例销毁）。
   - **页面级 remount 当前无 API**：`firstRender`（`runtime.js:741-750`）只做**整 app** `unmount → createApp → mount`；无页面级实例管理。需 A3 新增页面级 remount（保留 app 与其余页面）。
   - **组件副作用状态会重置**（onMounted/watch/canvas/scroll）：remount 后丢失——符合 L3 承诺「service 状态保留」，不承诺页面内部运行时副作用。
   - **结论**：假设 1 **条件成立**——数据回放可行，但 A3 需先建两个 render 能力（模块热替换 + 页面级 remount）的原型；原型失败仍可降级 L1（A2 契约 §4.5 已把 L2/L3 定为上报级别）。
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
| v1.0 | 2026-09-08 | 定稿：动机/目标 G1–G4/决策 D1–D7/路线图经评审接受；gate A1 事件契约随 `compiler-hook-layer` 技术设计冻结生效 |
| v1.1 | 2026-09-08 | A1 完成后回写：新增 §4.4 事件契约持久真源；§5 A1 行标注完成并链接归档；修订记录同步 |
| v1.2 | 2026-09-08 | A2.0 定案回写：D2 增补决策记录（预构建 dist 随 compiler 包分发，含自包含/离线验证）；§5 A2.0 行标注已定案 |
| v1.3 | 2026-09-08 | A2 完成后回写：新增 §4.5 dev server 契约（ws 协议 + reloadLevel 合成 + 宿主页语义）；§5 A2 行标注完成并链接归档；修订记录同步 |
| v1.4 | 2026-09-08 | L3 可行性验证回写：§7 假设 1 更新为条件成立并附代码审计证据（setupData 数据回放可行；需 A3 新增模块热替换 / 页面级 remount）；§5 A3 行前置标注更新 |
| v1.5 | 2026-09-08 | dev/HMR 生效边界定稿：§4.1 增补三层分离说明（编译/编排容器无关，预览宿主 + HMR 生效端 Web 容器专属）；锁定 A3 落点（render + container-sdk dev-only）与 L2/L3 验收锚点（Web 容器内） |
| v1.6 | 2026-09-08 | A3 L2/L3 实施完成回写：§4.2 增补实施结论（Web 容器 dev-only 执行链、L1 fallback、A2/原生边界与残余浏览器风险）；A3 Action 进入 Close 流程 |
