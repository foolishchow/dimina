# Technical Design — watch-api

> 契约状态：**已冻结（v1，2026-09-10）**。Readiness Review verdict `pass`：R1–R4 选 (a)，B 组默认全采纳，C/D 无异议。本设计是 CF-1 在 bin 上接入 CLI flag 的前置稳定面；变更需同步更新 requirements / acceptance / README。

设计基线（2026-09-10 工作区）：

- `src/bin/watch.js`：已抽出 `createWatchBuildPlan` / `createWatchRebuildScheduler` / `createIgnoredPathMatcher` / `getPublishedOutputPath`
- `src/bin/index.js`：`build -w` 内联 chokidar 编排环
- `src/bin/dev.js`：几乎相同的编排环 + `synthesizeReloadLevel` / lifecycle / `setPendingReload`
- `@dimina/compiler` 的 `exports` 尚无 watch 子路径；vite entry 无 watch

## 1. 问题与边界

**要消除的重复**：chokidar 创建、产物 ignore、事件上 plan skip、scheduler 装配、rebuild 内二次 plan → `build()` → 刷新 `dependencyGraph` / ignore 集合。

**留在调用方的差异**：

| 关注点 | `build -w` | `dmcc dev` |
| --- | --- | --- |
| 初始 `build` options | `{ sourcemap }` | `{ sourcemap, lifecycle }` |
| rebuild 前 | 无 | `synthesizeReloadLevel` + `setPendingReload` |
| 日志 | CLI `eventLabels` | 同左 |
| 错误 | `console.error`；进程不退出 | 同左；`build:error` 已由 lifecycle 推送 |

不在本门修改：`createWatchBuildPlan` / scheduler 语义、`dev-server` / `dev-reload` / ws、`build()` 签名、core compilers、CF-1 compile-config。

## 2. 冻结决策（D1–D6 + D1a）

| ID | 决策点 | 冻结值 |
| --- | --- | --- |
| D1 | 初始 build | `start()` 内执行首次 `build()`；失败则 throw，不启动监听 |
| D1a | `dmcc dev` 时序 | `autoListen` 默认 `true`；dev 传 `false`：`start()` 仅初始 build（resolve 为 `buildResult`）→ 调用方 `createDevServer` + `listen` → `watcher.listen()`；严格等价现网 `build → server → watch`，**不接受** listen 前变更窗口 |
| D2 | 回调时机 | `onRebuild(change)`：scheduler 在 rebuild **前**调用（CLI 日志）；`beforeBuild({ change, plan, appId })`：plan 非 skip 之后、`build()` **前**（dev：`setPendingReload`） |
| D3 | `stop()` | 关闭 chokidar + `await scheduler.waitForIdle()`；CLI 长驻进程可不调用 |
| D4 | 导出路径 | `@dimina/compiler/watch` subpath；vite 增加对应 lib entry；纳入 `check-package-exports` |
| D5 | 底层工具位置 | `bin/watch.js` → `common/watch-plan.js`；`watch-runner.js` 依赖 common；测试改 import |
| D6 | CLI 日志 | `eventLabels` 与中文日志留在 bin，经 `onRebuild` 注入；API 默认静默 |

附加冻结（B 组）：

- plan/scheduler **不**从 `@dimina/compiler/watch` 再导出；测试从相对路径 import common
- `options` 原样透传 `build()`；本门不做 CF-1 profile 合并
- **不**提供可替换的完整 `rebuild` 钩子

## 3. API 形状

```js
import { createBuildWatcher } from '@dimina/compiler/watch'

/**
 * @param {object} params
 * @param {string} params.targetPath
 * @param {string} params.workPath
 * @param {boolean} params.useAppIdDir
 * @param {object} [params.options]  传给每次 build() 的基座 options（sourcemap/lifecycle/…）；本门不解读 CF-1 profile
 * @param {boolean} [params.autoListen=true]  false 时 start() 只做初始 build，须再调 listen()（D1a）
 * @param {(change: { event, filePath, count }) => void} [params.onRebuild]  scheduler 在 rebuild 前调用（CLI 日志）
 * @param {(ctx: { event, filePath, count, plan, appId }) => void | Promise<void>} [params.beforeBuild]
 *        plan 已算完且非 skip 之后、调用 build() 之前（dev：setPendingReload）
 * @param {(error: Error, change: { event, filePath, count }) => void} [params.onError]
 */
const watcher = createBuildWatcher({ ... })

const buildResult = await watcher.start()  // D1：初始 build；autoListen 时一并 listen
await watcher.listen()                     // 仅 autoListen=false 时需要（D1a）
await watcher.stop()                       // D3
```

公开返回值承诺：`{ start(), listen(), stop() }`。`start()` resolve 为首次 `buildResult`（供 dev 取 `appId`）。是否额外暴露 `waitForIdle` 不作公开承诺（内部测试可用）。

**刻意不采用**：把整个 `rebuild` 函数交给调用方替换——那会把 plan/graph 更新责任重新推回 bin，失去去重意义。

### 与早期草案的差异

- 旧草案 `onRebuild(result, change)`（rebuild 后、带 result）已否决（R1(a) / D2）。
- 增加 `beforeBuild` + `autoListen`/`listen()`（D1a）。

## 4. 编排环（watch-runner 职责）

```text
start():
  buildResult = await build(target, work, useAppIdDir, options)
  dependencyGraph = from(buildResult)
  ignoredOutputPaths = { publishedPath(appId) }
  scheduler = createWatchRebuildScheduler({
    onRebuild,                         // 透传
    onError,                           // 透传
    rebuild: async (change) => {
      plan = createWatchBuildPlan({ ...change, dependencyGraph, publishedPath })
      if (plan.skip) return
      await beforeBuild?.({ ...change, plan, appId: buildResult.appId })
      result = await build(..., { ...options, ...plan.options })
      buildResult = result
      dependencyGraph = from(result)
      ignoredOutputPaths.add(publishedPath(result.appId))
    },
  })
  if (autoListen) await listen()
  return buildResult

listen():
  // 幂等：已监听则 no-op 或 throw（实施选一，测试锁定；建议已监听则 throw）
  chokidar.watch(workPath, { persistent, ignoreInitial, ignored: matcher(ignoredOutputPaths) })
    .on('all', (event, filePath) => {
      if (createWatchBuildPlan(...).skip) return
      scheduler.schedule(event, filePath)
    })

stop():
  await chokidar.close()
  await scheduler.waitForIdle()
```

事件过滤、合并、增量规则仍完全委托现有 plan/scheduler（R-003）。

## 5. 调用方改造

### `bin/index.js`（build -w）

```text
若 !watch → 单次 build 后返回（保持现状）
watch → createBuildWatcher({
  options: { sourcemap },
  autoListen: true,          // 默认
  onRebuild: 日志,
  onError: 日志,
}).start()
```

不再直接 import chokidar / 装配 scheduler（R-008）。

### `bin/dev.js`（D1a）

```text
lifecycle = createLifecycle()
watcher = createBuildWatcher({
  options: { sourcemap, lifecycle },
  autoListen: false,
  beforeBuild: ({ change, plan, appId }) => {
    // synthesizeReloadLevel + setPendingReload（须在 build() 前；devServer 已 listen）
  },
  onRebuild: 日志,
  onError: 日志,
})
buildResult = await watcher.start()          // 仅初始 build
devServer = createDevServer({ appId: buildResult.appId, ... })
// attach lifecycle → notify*
await devServer.listen(port)
await watcher.listen()                       // 此后才 watch
```

`beforeBuild` 闭包需在 `listen(devServer)` 之后才被调度触发（因 watch 尚未启动）；创建 watcher 时可先占位，在 `devServer` 赋值后由闭包读取，或在 `listen()` 前完成 `devServer` 绑定——实施任选，验收锁「首次 beforeBuild 调用时 devServer 已可用」。

## 6. 包导出与构建

| 项 | 动作 |
| --- | --- |
| `package.json` `exports["./watch"]` | → `./dist/watch.js`（与 vite `fileName` 对齐） |
| `vite.config.mjs` `build.lib.entry` | 增加 `watch` entry，指向 `watch-runner.js`（或薄 re-export 文件） |
| `scripts/check-package-exports.js` | postbuild 检查须通过 |

公开面最小：`createBuildWatcher`。plan/scheduler 不公开。

## 7. 文件落地（实施时）

新增：

- `src/common/watch-runner.js`
- `__tests__/watch-runner.spec.js`

迁移/修改：

- `src/bin/watch.js` → `src/common/watch-plan.js`（D5）
- `src/bin/index.js`、`src/bin/dev.js`
- `__tests__/watch-scheduler.spec.js` import
- `package.json`、`vite.config.mjs`
- 注释：`dev-reload.js` 等对 `bin/watch.js` 的路径说明

不改：`dev-server.js`、`dev-reload.js` 逻辑、`lifecycle.js`、core compilers、`src/index.js` 的 `build` 签名。

## 8. 与 CF-1 的交接

- 本门保持 `options` 透传给 `build()`，不引入 compile configuration。
- CF-1 在 CF-4 完成后再改同一 bin 文件接入 `--minify` / `--no-minify`，避免并行改 watch 环。
- CF-1 完成后，watcher 的 `options` 仍由调用方合并后传入；runner 不感知 profile。

## 9. 备选与取舍

- **只抽函数、不公开 package export**：无法满足 CLI ⊆ API 与 R-006；弃。
- **让调用方传入完整 `rebuild`**：bin 重复不会实质消除；弃。
- **`onRebuild` 改为 rebuild 之后带 result**：破坏现网日志时机，且 pendingReload 必须在 build 前；弃（R1(a)）。
- **`start()` 立即 watch、接受 listen 前窗口**：行为不等价；弃（R2(a) / D1a）。
