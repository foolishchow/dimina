# Watch API（CF-4：watch 从 CLI-only 提升为 API 能力）

- Action: `watch-api`
- Status: `draft`
- Updated: 2026-09-08
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-4）
- 前置：无（独立，可与 CF-1 compiler-configurable 并行 formalize；**实施顺序建议先于 CF-1**，避免 bin/index.js 与 bin/dev.js 的 watch 重构和 CLI flag 接入冲突）

## Background

当前 `-w, --watch` 是 CLI-only 能力，违反 **CLI ⊆ API** 原则：

- `dmcc build -w` 的 watch 逻辑（chokidar + watch plan + scheduler + build）全部写在 `bin/index.js` 命令 handler 里
- `dmcc dev` 需要同样的 watch 能力，但 API 没有——**被迫复制了一遍**（`bin/dev.js` 里几乎相同的 chokidar → plan → scheduler → build 链路）
- 两处代码重复，改一处容易漏另一处

## Goal

将 watch 逻辑提升为可编程 API（消除 CLI-only 和代码重复），`build -w` 和 `dmcc dev` 都通过这个 API 使用 watch。

## Non-goals

- 不改 watch 行为语义（调度/合并/增量策略不变）
- 不改 A2/A3 dev server/HMR/ws 协议
- 不改编译配置框架（CF-1 `compiler-configurable` 范围）
- 不做性能优化

## Scope

- `fe/packages/compiler/src/common/watch-runner.js`（新增：可编程 watch API）
- `fe/packages/compiler/src/bin/index.js`（build -w 改为调 watch API）
- `fe/packages/compiler/src/bin/dev.js`（dev 改为调 watch API，消除重复）
- `fe/packages/compiler/__tests__/`（watch API 规格）

## API 设计（草案）

```js
// 可编程 watch API
import { createBuildWatcher } from '@dimina/compiler/watch'

const watcher = createBuildWatcher({
  targetPath,
  workPath,
  useAppIdDir,
  options,           // build options（兼容现有 build() 签名；CF-1 完成后由 compile configuration 合并层承接）
  onRebuild,         // (result, change) => void
  onError,           // (error, change) => void
})

await watcher.start()   // 初始构建 + 开始监听
await watcher.stop()    // 停止监听
```

CLI 和 dev.js 都消费这个 API：

```js
// bin/index.js（build -w）
const watcher = createBuildWatcher({ ..., onRebuild: console.log })

// bin/dev.js
const watcher = createBuildWatcher({
  ...,
  onRebuild: (result) => {
    devServer.setPendingReload(synthesize(...))
    // ws 推送
  },
})
```

## Deliverables

- `createBuildWatcher()` API（start/stop/onRebuild/onError）
- `bin/index.js` 和 `bin/dev.js` 消除重复，都调 API
- watch API 规格（可编程使用、生命周期、错误处理）
- 行为等价验证（重构前后 build -w 和 dev 的 watch 行为不变）

## Readiness gaps

- 待 Readiness Review：API 形状（函数签名/回调/生命周期）需评审冻结

## Closure conditions

- 所有 MUST Acceptance 通过并有证据
- build -w / dev 行为等价（重构不改语义）
- 代码重复消除（bin/index.js 与 bin/dev.js 共享 watch API）
- STATUS、导航、归档一致
