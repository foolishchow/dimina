# Technical Design — fe-tools-bundler-session

> 状态：**草案（逐项讨论中，2026-09-10）**。本文件是设计索引与对象模型概述；
> **vivid source 是探针**：[resolve.draft.mjs](./resolve.draft.mjs)、[orchestrator.draft.mjs](./orchestrator.draft.mjs)、
> [config.draft.mjs](./config.draft.mjs)、[stages.draft.md](./stages.draft.md)。
> 决策以 [README](./README.md) + 探针注释为准；本文件与之冲突时以探针为权威。

Action renamed from `fe-tools-bundler-core`（2026-09-10）。定位收窄为 **session/facade**，
不是「bundler core + L0 plugin」。旧 BC-1 / L0-plugin / `src/bundler-core/` 叙事已废弃。

设计基线（`feature/fe-tools-sidecar`，unvite complete 后）：

- [`src/index.js`](../../../fe/tools/bundler/src/index.js)：`build` / `runBuild` + Listr 阶段手写
- [`src/common/watch-runner.js`](../../../fe/tools/bundler/src/common/watch-runner.js)：`createBuildWatcher`（lifecycle 经 `options.lifecycle` 注入）
- [`src/bin/dev.js`](../../../fe/tools/bundler/src/bin/dev.js)：D1a 手拼串联
- [`src/bin/index.js`](../../../fe/tools/bundler/src/bin/index.js)：`build` / `build -w` 手拼
- [`src/common/lifecycle.js`](../../../fe/tools/bundler/src/common/lifecycle.js)：A1 事件契约 v1（内部）
- [`src/common/dev-server.js`](../../../fe/tools/bundler/src/common/dev-server.js)：preview server
- [`src/bin/compile.js`](../../../fe/tools/bundler/src/bin/compile.js)：**范围外**——bootstrap 复制残留、无消费者（fe 的 `compile` script 指向 packages/compiler 侧同名文件）；不经 session，本门不动
- 自发布：镜像 `src`→`dist`（无 Vite；`sync-dist-from-src.js` 整目录递归，新 session 模块文件自动进 dist）

## 1. 问题与边界

**要消除的缺口**：无共享 Bundler 会话；CLI/dev 手拼；lifecycle 非经会话暴露。

**本门不做**：阶段图数据结构搬家；stage 文本 transform / 改图；IR；拆独立 npm 包；
`use()` / plugin API（另 Action）；磁盘 config file / file 层（本门不引入，仅 cli + api 两层）。

## 2. 决策索引

冻结/已接受决策不在本文件重述；见权威来源：

| 决策 | 权威来源 |
| --- | --- |
| Resolve D-R1..D-R4（dev targetPath / mode-platform seed / server host-port / no api.outDir） | [resolve.draft.mjs](./resolve.draft.mjs) 头注释 + [orchestrator.draft.md](./orchestrator.draft.md) |
| Session wiring（watch.stop 清 activeLoop / .dev 经 session.watch / CLI -w ⊆ session / createBuildWatcher 保留为兼容 / pipeline 留 runBuild / plugin 非本门） | [orchestrator.draft.md](./orchestrator.draft.md) + [README](./README.md) |
| Config 优先级 P1–P3（P4–P6 reserved for file/plugin）/ Compile C1–C7 / Server Sv1–Sv6 | [config.draft.mjs](./config.draft.mjs) 头注释 |
| Builtin 阶段命名（不可执行清单） | [stages.draft.md](./stages.draft.md) |

**历史决策 ID `D-BC-1..8` 已废弃**（含 `src/bundler-core/` 物理位置冻结、L0 plugin MUST、
`exports["./bundler"]` 等）。本门物理位置 TBD（见 README Scope），plugin 为 OPEN/deferred，
兼容导出见 §4。

## 3. 对象模型（对齐探针）

### 3.1 会话

```text
BundlerSession = {
  workPath, targetPath, useAppIdDir   // 来自 ResolvedBundlerInput
  compile                             // C1 基座；build/watch overrides 合并其上
  fileTypes                           // 顶层 pipeline 选项
  server                              // dev only；host/port only (D-R3)
  lifecycle                           // 本会话唯一；未传入则自建
  activeLoop                          // null | 'watch' | 'dev'；并发规则 R1–R7
}
```

### 3.2 API 形状

```js
import { createBundler, resolveBundlerConfig } from '@dimina/bundler/session'  // 子路径导出（M-K1/B；主入口 re-export 会成环）

const bundler = createBundler(resolved)  // resolved: ResolvedBundlerInput

await bundler.build(overrides?)           // O1：委托 runBuild，强制 lifecycle
const watcher = bundler.watch(watchOpts)  // O2：委托 createBuildWatcher，lifecycle 经 options.lifecycle
const handle = await bundler.dev(devOpts) // O3：经 session.watch + preview adapter (D1a)
bundler.lifecycle                          // 只读：本会话唯一实例；挂监听（on）用途，
                                          // emit 不在承诺面（Background 缺口③承接）
```

（watch handle 只透传 `start/listen/stop`；`waitForIdle` 为 `@internal` 测试用，
**不透传**——测试继续直连 `createBuildWatcher`。）

**lifecycle 注入**（对齐真实实现）：

- `build()`：lifecycle 放进传给 `runBuild` 的 `options.lifecycle`（`src/index.js` 已支持）。
- `watch()`：lifecycle 放进 `createBuildWatcher({ options: { ..., lifecycle } })`（`watch-runner.js`
  顶层无 lifecycle 参数；经 `options.lifecycle`，见 `bin/dev.js` 现状）。**不得**作为顶层参数。
- 会话强制 lifecycle 最后写入，`overrides.lifecycle` 不生效（见探针 `splitBuildOverrides`）。

**刻意不采用**：`run({ target })` 单一入口；webpack 式 `tap` 命名；`use()`（本门不暴露）。

### 3.3 `dev` 时序（O3，对齐 D1a）

```text
1. session.watch({ autoListen:false, beforeBuild→adapter.setPendingReload, ... })
2. buildResult = await watcher.start()
3. adapter.createServer({ serveRoot, sdkRoot, appId, ... })  // 今日 createDevServer
4. lifecycle.on(BUNDLE_PUBLISHED / BUILD_ERROR / BUILD_WARNING) → adapter 通知
5. await adapter.listen(host, port)
6. await watcher.listen()
```

CLI `bin/dev.js` 仅：解析 argv → `resolveBundlerConfig` → `createBundler` → `.dev()`。

Preview adapter 最小接口（探针 `PreviewAdapter` typedef）：薄包装现有 `createDevServer` +
`synthesizeReloadLevel`，**不**重写协议。`buildIdCounter`（`synthesizeReloadLevel` 的 `buildId`）
属 **adapter 状态**，每次 `.dev()` 新建，不进 session 基座（保持 session 纯委托）。

`sdkRoot` 解析（今日 `bin/dev.js` 的 `resolveSdkRoot`）须**迁至 `common/sdk-root.js`**
（M-F3）——adapter 若从 `bin/dev.js` import 会成环（改造后 bin/dev.js 经 session，
session adapter 又引 bin/dev.js）；bin 侧 re-import 保持兼容（P-004 已允许该单函数迁移）。

`wsPath` 固定 `'/ws'`（等价今日 `bin/dev.js`），由 adapter 内部传入（L-I1）——与
`sdkRoot` 同为 adapter 接管的 `createDevServer` 参数；其余（`hostHtml` / `pageFrameHtml` /
`allowedOrigins`）走默认，adapter 只传四个即等价今日。

dev 默认 `targetPath` 实施须用 `fs.mkdtempSync(path.join(os.tmpdir(), 'dmcc-dev-'))`
（每次唯一，等价今日 `bin/dev.js`）；探针固定名 `dmcc-dev-DRAFT` 仅示意（L-F2）。

server 取值**只来自 `Resolved.server`**（D-R3 唯一来源）；`.dev()` 不收 host/port 参数
（CLI `--host`/`-p` 经 resolve 的 cli 层，API 走 `api.server`，无第三入口）。

**启动失败回滚（R7）**：`.dev()` 内部任一步（watcher.start / createServer / lifecycle
接线 / listen）失败时，stop watcher + close adapter + 清 `activeLoop` 后 rethrow，
session 保持可复用（A-BS08；activeLoop/资源层面）。裸 `.watch()` 豁免：start 失败
保持 started=false，可重试 start() 或 stop() 释放。

**已知限制（已接受，2026-09-10）**：lifecycle 无 `off()`（A1 v1 契约），dev 注册的
3 个监听（`bundle:published` / `build:error` / `build:warning` → adapter）在回滚/close
后不卸载——无害（dev-server close 自清 clients + broadcast 检查 readyState，
已关 notify 空转不崩）但跨 dev 循环累积。若 A1 后续增加 `off()`，dev 应只卸载
自己注册的监听（不动用户监听）。

### 3.4 CLI flags → resolve cli 层映射（M-E2，1:1 行为不变的前提）

| CLI flag（commander） | 解析后 | resolve cli 层键 | 备注 |
| --- | --- | --- | --- |
| `-c, --work-path <path>` | `options.workPath` | `cli.workPath` | build + dev |
| `-s, --target-path <path>` | `options.targetPath` | `cli.targetPath` | **argv 缺省留 bin**：build→`process.cwd()`、dev→`mkdtempSync`（等价今日）；dev 时 D-R1（缺省走 temp） |
| `--no-app-id-dir` | `options.appIdDir === false` | `cli.useAppIdDir = false` | build + dev |
| `--sourcemap` | `options.sourcemap = true` | `cli.sourcemap` | build + dev；覆盖缺省 false |
| `--minify` / `--no-minify` | `options.minify` true/false | `cli.minify` | 覆盖 mode preset（D-R2：other C1 freely overridable） |
| `--platform <name>` | `options.platform` | `cli.platform` | **仅 build**；dev 无此 flag（若强行传入触发 D-R2 hard-fail） |
| `-p, --port <number>` | `options.port`（string） | `cli.port`（resolve 内 `Number()`） | 仅 dev |
| `--host <addr>` | `options.host` | `cli.host` | 仅 dev |
| `-w, --watch` | `options.watch` | **不进 resolve** | 路由 flag：`.build()` vs `.watch().start()` 的选择 |
| （dev 无 flag） | — | `mode`/`platform` 由 D-R2 seed | 等价今日 bin/dev.js 硬编码 `mode:'dev' + platform:'web'` |

未列的 flag 不存在；新增 flag 需同步本表与 resolve cli 层。

**argv 缺省规则（M-G1）**：所有 flag 的缺省值计算留 bin 层显式传（`?? cwd` / `?? mkdtemp` /
`appIdDir !== false` / `!!sourcemap` 等，等价今日）；resolve 只收显式值——探针内回落
（build→workPath / dev→temp）仅服务纯 API 调用者，CLI 接线依赖回落即破坏 R-BC3。

## 4. 兼容委托（R-BC4）

```text
export default function build(targetPath, workPath, useAppIdDir, options) {
  // 不经 resolveBundlerConfig：入参已是归一 api 语义；直接手工构造 Resolved 委托 session
  const resolved = { workPath, targetPath, useAppIdDir, compile: pickC1(options), ... }
  return createBundler(resolved).build()
}
exports['./watch'] → createBuildWatcher  // 保留为低层/兼容导出
```

- **委托形状已锁（M-F1 补强）**：default `build()` **不**经 `resolveBundlerConfig`（其入参
  `(targetPath, workPath, useAppIdDir, options)` 已是 api 语义，再走 resolve 是绕路且引入
  语义转换风险）。**首选：保持现有实现完全不委托**——新理由：`runBuild` 是 `index.js`
  **私有**函数（仅 default `build` 导出），session 委托只能 `import default build from './index.js'`；
  若 default `build()` 再委托 session 即成 `index.js ↔ session.js` ESM 循环。
  **约束**：session 委托路径 = `import default build`；**不得**为委托而导出私有 `runBuild`
  （改公开面，违反 R-BC3）。若未来必须双向委托，先把 `runBuild` 抽独立模块（另 Action）。

**模块依赖拓扑（M-K1/B，2026-09-10 拍板）**——零循环：

```text
index.js（default build；不依赖 session/watch-runner）
  ↑                    ↑
  │                    │
common/watch-runner.js   session/index.js（import default build —— 唯一委托路径，
                         且 import common/watch-runner 委托 watch）
                         session/resolve.js → common/compile-config.js
                         session/preview-adapter.js → common/{dev-server,dev-reload,sdk-root}.js
bin/{index,dev}.js → session/{index,resolve}.js
公开面：exports["./session"] → dist/session/index.js（与 ./watch 先例同构）
```

**禁止**：在 `src/index.js` 内 re-export session（`index → session → index` 成环，
会重新引入 M-F1 消除过的两节点环）；`exports["."]` 保持仅 default build。

## 4.5 目标文件清单（L-K2，P-004 对照基准）

```text
新增（6）：
  src/session/index.js                    createBundler（O1）
  src/session/resolve.js                  resolveBundlerConfig（O1）
  src/session/preview-adapter.js          web preview adapter + wsPath/'/ws'（O3）
  src/common/sdk-root.js                  resolveSdkRoot 迁入（O3；bin re-import 兼容）
  __tests__/bundler-session.spec.js       A-BS01/08·overrides·lifecycle 暴露（O1 起，O3 补 R7）
  __tests__/bin-session-contract.spec.js  A-BS02 grep+spawnSync（O1 起，O2 扩 -w）

修改（6）：
  src/bin/index.js                        build/-w 经 session（O1/O2）
  src/bin/dev.js                          dev 经 session；resolveSdkRoot 改 re-import（O3）
  scripts/check-package-exports.js        +@dimina/bundler/session entry（O1）
  package.json                            exports +"./session"（O1）
  __tests__/platforms.spec.js             dev 强制 web 断言改为指向 resolve.js D-R2 seed（实现面更新，行为等价；O3）
  __tests__/watch-api-bin-contract.spec.js  断言从「bin 含 createBuildWatcher」演进为「bin 经 session」（实现面更新；O3）

不动：
  src/index.js（M-K1/B：不 re-export、不委托，零改动）
  core/*-compiler.js · env.js · common/{compile-config,watch-runner,dev-server,lifecycle,publish,dev-reload}.js
  package.json exports 既有 4 entries
  其余全部不动（含 src/watch.js、common/ 其余模块、bin/compile.js〔范围外〕）
```
- `createBuildWatcher` 公开导出保留；CLI 不得直接用（须经 `session.watch`），见 R-BC2。
- 本门**不**新增 `exports['./bundler']`（旧 D-BC-8 已废弃）。

## 5. 测试与消融

| 规格 | 锁什么 |
| --- | --- |
| session 门面 | createBundler → build 返回；build/watch 共享 lifecycle；activeLoop 并发规则 R1–R7；dev 启动失败回滚（A-BS08） |
| bin 契约 | `bin/index.js` build/build -w 与 `bin/dev.js` 经 session，无平行手拼（**新增**测例；既有 CLI 基线仅错误契约） |
| 既有回归 | lifecycle / lifecycle-integration / watch-scheduler / build-error-contract / build-stages / dev-server / dev-proxy / dev-host / compile-config / build-output 全量 vitest |

消融（Experience-Review §6）：

- 对 bin 契约：临时去掉 `createBundler` 接线应失败 → 恢复再过。
- 对 session lifecycle 共享：临时让 watch 不注入 `options.lifecycle` 应使 lifecycle-integration 测例失败。
- 对 R7 回滚（A-BS08）：临时去掉 dev() 的 R7 try/catch，注入 failing adapter 测例应因
  `activeLoop` 残留失败 → 恢复再过（L-M3）。

## 6. 与伞 / RFC 关系

- 独立架构 Action，**不是** umbrella `fe-tools-sidecar` 的子门；闭合不依赖伞 `ready`。
- 不阻塞、不替代 TS-2 IR。
- RFC G3 dogfood / §4.3 transform = 后续 Action（非本门）。

## 7. 风险

| 风险 | 缓解 |
| --- | --- |
| 门面层引入行为漂移 | R-BC3 + 全量测试 + CLI 冒烟；diff 范围 P-004 |
| lifecycle 注入路径错误（watch 顶层 vs options） | §3.2 明文 + 对齐 `bin/dev.js` 现状 + lifecycle-integration 测例 |
| dev 时序回归 | §3.3 D1a checklist + 既有 dev specs / 冒烟 |
| dev 启动失败留下半启动状态 | R7 回滚（stop watcher + close adapter + 清 activeLoop）；A-BS08 / P-007 测例 |
| dev 监听器跨循环累积（lifecycle 无 off） | **已接受限制**：readyState 守卫兑底不崩；A1 加 off 后 revisit（dev 只卸自己的监听） |
| plugin 范围蔓延 | 本门不暴露 `use()`；`api.plugins` reserved 不加载 |
