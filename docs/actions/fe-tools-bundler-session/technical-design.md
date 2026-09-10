# Technical Design — fe-tools-bundler-session

> **STALE / DRAFT WARNING (2026-09-10)**  
> Action renamed from `fe-tools-bundler-core`. Positioning is now **session/facade**, not “bundler core + L0 plugin”.  
> Prefer probes: [resolve.draft.mjs](./resolve.draft.mjs), [orchestrator.draft.mjs](./orchestrator.draft.mjs), [stages.draft.md](./stages.draft.md), [README](./README.md).  
> Sections below that mandate `use` / L0 dogfood / `src/bundler-core/` are **historical** until rewritten.

# Technical Design — fe-tools-bundler-core（BC-1）〔archived narrative below〕

> 契约状态：**草案（逐项讨论中，2026-09-10）**。曾误标冻结 v1 / ready；**以下不以实施规格为准**。配置探针见 [config.draft.mjs](config.draft.mjs)。

设计基线（`feature/fe-tools-sidecar`，unvite complete 后）：

- [`src/index.js`](../../../fe/tools/bundler/src/index.js)：`build` / `runBuild` + Listr 阶段手写
- [`src/common/watch-runner.js`](../../../fe/tools/bundler/src/common/watch-runner.js)：`createBuildWatcher`
- [`src/bin/dev.js`](../../../fe/tools/bundler/src/bin/dev.js)：D1a 手拼串联
- [`src/common/lifecycle.js`](../../../fe/tools/bundler/src/common/lifecycle.js)：A1 事件契约 v1（内部）
- 自发布：镜像 `src`→`dist`（无 Vite）

## 1. 问题与边界

**要消除的缺口**：无共享 Bundler 会话；CLI/dev 手拼；plugin 无 apply 点；lifecycle 非经会话暴露。

**本门不做**：阶段图数据结构搬家（BC-2）；stage 文本 transform / 改图（BC-3）；IR；拆独立 npm 包。

## 2. 冻结决策（D-BC-1..8）

| ID | 决策点 | 冻结值 |
| --- | --- | --- |
| D-BC-1 | 物理位置 | `fe/tools/bundler/src/bundler-core/`；随 `@dimina/bundler` 发布；**不**先建 `@dimina/bundler-core` |
| D-BC-2 | 范围 | **仅 BC-1**；BC-2/3 另 Action |
| D-BC-3 | API 面 | `createBundler` → `{ use, build, watch, dev }`；无第三套平行编排入口 |
| D-BC-4 | `dev` | core 方法 + **preview adapter**（默认 web）；**严格复现** CF-4 D1a 时序；HTTP/ws 留在现有 `dev-*` |
| D-BC-5 | Plugin | **仅 L0**：`apply(api)` 内 `api.on(LIFECYCLE_EVENTS.*)`；无 `transform` / `tapStage` / `replaceStage`；无通用 `devEvent` plugin（reload 仍由 adapter + `beforeBuild`） |
| D-BC-6 | 兼容 | 保留 default `build` 与 `exports["./watch"]`；内部委托 Bundler |
| D-BC-7 | 行为 | 目标 **0** 可观察语义变化（编译产物、lifecycle 序、watch、dev reload 契约） |
| D-BC-8 | 导出 | 具名 `createBundler`：主入口再导出 + `exports["./bundler"]` → `dist/bundler-core/index.js`；纳入 `check-package-exports` |

## 3. 对象模型

### 3.1 会话

```text
BundlerSession = {
  paths: { workPath, targetPath, useAppIdDir }
  baseOptions      // 传入每次 build 的基座（mode/platform/sourcemap/minify/…）
  lifecycle        // 本会话唯一；未传入则 createLifecycle()
  plugins[]        // use() 累积；首次 run 后冻结
  _started         // 是否已执行过 build|watch|dev
}
```

### 3.2 API 形状

```js
import { createBundler } from '@dimina/bundler/bundler'
// 或：import { createBundler } from '@dimina/bundler'

/**
 * @param {object} options
 * @param {string} options.workPath
 * @param {string} options.targetPath
 * @param {boolean} [options.useAppIdDir=true]
 * @param {object} [options.compile]  传给 build 的基座 options（mode/platform/sourcemap/…）
 * @param {object} [options.lifecycle] 可选外部 lifecycle（测试）；默认自建
 * @param {object[]} [options.plugins]  等价于依次 use()
 */
const bundler = createBundler({ workPath, targetPath, useAppIdDir, compile, plugins })

bundler.use({
  name: 'example',
  apply(api) {
    api.on('bundle:published', (payload) => { /* … */ })
    api.on('build:end', (payload) => { /* … */ })
  },
})

const result = await bundler.build(overrides?)   // Object.assign(baseOptions, overrides) → 现有 build()
const watcher = bundler.watch({
  autoListen, onRebuild, beforeBuild, onError, /* 同 createBuildWatcher 其余回调 */
})
// watcher 仍暴露 start/listen/stop；options.lifecycle 固定为会话 lifecycle

const handle = await bundler.dev({
  host, port, /* preview 相关 */
  // 可选 previewAdapter；缺省 createWebPreviewAdapter
})
// handle: { close() | stop(), /* 至少能结束 server + watcher */ }
```

**`use` 规则**：`_started === true` 后再 `use` → throw `TypeError`（或文档等价错误）。`createBundler({ plugins })` 在返回前完成 apply。

**刻意不采用**：`run({ target: 'build'|'watch'|'dev' })` 单一入口（BC-1 用显式方法，减少歧义）；webpack 式 `tap` 命名。

### 3.3 `dev` 时序（D-BC-4，对齐 D1a）

```text
1. 会话已有 lifecycle（及 L0 plugins 已 apply）
2. bundler.watch({ autoListen:false, lifecycle, beforeBuild→adapter.setPendingReload, … })
3. buildResult = await watcher.start()
4. adapter.createServer({ serveRoot, sdkRoot, appId, … })  // 今日 createDevServer
5. lifecycle.on(BUNDLE_PUBLISHED / BUILD_ERROR / BUILD_WARNING) → adapter 通知
6. await adapter.listen(host, port)
7. await watcher.listen()
```

CLI `bin/dev.js` 仅：解析 argv → `createBundler` → `bundler.dev(...)` → 进程生命周期。

Preview adapter 最小接口（BC-1）：

```text
{
  setPendingReload(payload)
  createServer(opts) -> { listen, notifyBuildPublished, notifyBuildError?, … }  // 可直接包 createDevServer
  // 或 adapter 内部持有 server，对外 listen/close
}
```

实施时可令 `createWebPreviewAdapter` 薄包装现有 `createDevServer` + `synthesizeReloadLevel`，**不**重写协议。

### 3.4 兼容委托

```text
export default function build(...) {
  return createBundler({ targetPath, workPath, useAppIdDir, compile: options })
    .build()
}
// watch export：createBuildWatcher 保持；或内部注明「推荐 bundler.watch」但仍可用
```

BC-1 **不删除** `createBuildWatcher` 公开导出。`bundler.watch` 内部调用它并强制注入会话 `lifecycle` / 合并 `baseOptions`。

## 4. Plugin L0（D-BC-5）

```js
/**
 * @typedef {{ name: string, apply: (api: { on: typeof lifecycle.on }) => void }} BundlerPlugin
 */
```

- `api.on` === 会话 `lifecycle.on`（或绑定包装，语义同 A1）。
- **不**暴露 `emit` 给插件。
- 事件名与载荷 = A1 已冻表（`docs/Compiler-Architecture-RFC.md` §4.4 / lifecycle.js）。
- dogfood：`__tests__/fixtures` 或 `__tests__/bundler-core-plugin-dogfood.spec.js` 内联插件即可；不必先发独立示例包。

## 5. 模块布局（建议）

```text
src/bundler-core/
  index.js                 // createBundler
  create-bundler.js        // 可选拆分
  preview-web-adapter.js   // 默认 adapter（或 common/ 下，由 core 引用）
```

`runBuild` 仍留在 `src/index.js`（BC-1 不搬阶段图）。

## 6. 测试与消融

| 规格 | 锁什么 |
| --- | --- |
| bundler-core 门面 | createBundler → build 返回；use 后再 build 收到事件；started 后 use 抛错 |
| dogfood / 隔离 | 插件 throw 不失败构建（A1 隔离） |
| bin 契约（建议） | `bin/index.js` / `bin/dev.js` 经 createBundler；dev 无完整手拼 chokidar+server 副本 |
| 既有 | lifecycle / watch-runner / watch-scheduler / build-error / 全量 vitest |

消融（Experience-Review §6）：对 bin 契约或 dogfood，临时去掉 `createBundler` 接线应失败 → 恢复再过。

## 7. 与伞 / RFC 关系

- 落实 RFC **G3 最小切片**（dogfood 不改核心）；§4.3 transform 仍「待后续冻结」。
- 伞 TS-3「可选拆包」≠ 本门；本门是编排控制面 BC-1。伞 roadmap 可交叉引用本 Action。
- **不**阻塞、**不**替代 TS-2 IR。

## 8. 风险

| 风险 | 缓解 |
| --- | --- |
| 门面层引入行为漂移 | D-BC-7 + 全量测试 + CLI 冒烟 |
| plugin API 过早当稳定生态 | experimental 标注；仅 L0 |
| dev 时序回归 | D-BC-4 明文 + 既有 dev specs / 冒烟 |
