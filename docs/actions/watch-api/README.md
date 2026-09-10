# Watch API（CF-4：watch 从 CLI-only 提升为 API 能力）

- Action: `watch-api`
- Status: `in_progress`
- Updated: 2026-09-10
- Promoted: 2026-09-10（Readiness Review pass；R1–R4 选 (a)，B 组默认全采纳，C/D 无异议）
- Authorized: 2026-09-10（明确授权实施）
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-4）
- 前置：无（独立；**实施顺序先于 CF-1**，避免 bin 上 watch 重构与 CLI flag 接入冲突）
- 设计权威：[technical-design](technical-design.md)（已冻结 v1）；冲突时以本文档群与 STATUS 一致更新为准

## Documents

| 文档 | 作用 |
| --- | --- |
| [requirements](requirements.md) | 需求与非范围 |
| [technical-design](technical-design.md) | API / D1–D6+D1a / 编排环 / 导出（**已冻结 v1**） |
| [acceptance](acceptance.md) | MUST 验收表（A-001..A-009） |

## Background

当前 `-w, --watch` 的**编排环**仍是 CLI 侧重复实现，违反 **CLI ⊆ API**：

- plan / scheduler / ignore 已抽到 `src/bin/watch.js`，但 `bin/index.js`（`build -w`）与 `bin/dev.js` 仍各自内联 chokidar → plan skip → schedule → rebuild → `build()` 环
- 无公开 watch API；`package.json` `exports` 无 watch 子路径
- 改一处编排容易漏另一处；CF-1 若并行改 bin 易冲突

## Goal

将 watch 编排提升为可编程 API，`build -w` 与 `dmcc dev` 都通过该 API 使用 watch；消除 CLI-only 与 bin 重复，并稳定 bin 入口供 CF-1 接入。

## Non-goals

- 不改 watch 行为语义（调度/合并/增量策略不变）
- 不改 A2/A3 dev server/HMR/ws 协议
- 不改编译配置框架（CF-1 `compiler-configurable` 范围）
- 不做性能优化

## Scope

- `fe/packages/compiler/src/common/watch-runner.js`（新增：可编程 watch API）
- `fe/packages/compiler/src/common/watch-plan.js`（由 `bin/watch.js` 迁入，D5）
- `fe/packages/compiler/src/bin/index.js`（build -w 改为调 watch API）
- `fe/packages/compiler/src/bin/dev.js`（dev 改为调 watch API；`autoListen: false`，D1a）
- `fe/packages/compiler/package.json` + `vite.config.mjs`（`@dimina/compiler/watch` 导出）
- `fe/packages/compiler/__tests__/`（watch-runner 规格；scheduler 规格改 import）

## API 设计（已冻结 v1）

以 [technical-design](technical-design.md) §2–§3 为准。摘要：

```js
import { createBuildWatcher } from '@dimina/compiler/watch'

const watcher = createBuildWatcher({
  targetPath,
  workPath,
  useAppIdDir,
  options,        // 透传 build()；本门不做 CF-1 profile 合并
  autoListen,     // 默认 true；dev 必须 false（D1a）
  onRebuild,      // (change) => void；rebuild 前（CLI 日志）
  beforeBuild,    // async ({ change, plan, appId }) => void；build() 前（dev：setPendingReload）
  onError,        // (error, change) => void
})

const buildResult = await watcher.start()  // 初始 build；autoListen 时一并 listen
await watcher.listen()                     // 仅 autoListen=false
await watcher.stop()
```

## Deliverables

- `createBuildWatcher()` API（start / listen / stop；onRebuild / beforeBuild / onError）
- `bin/index.js` 与 `bin/dev.js` 消除编排重复，都调 API
- 公开导出 `@dimina/compiler/watch` + 构建/exports 检查
- watch API 规格 + 行为等价验证（build -w / dev）

## Readiness gaps

无。Readiness Review 已于 2026-09-10 pass 并冻结 D1–D6 + D1a（见 technical-design）。

- 状态：`in_progress`（已授权实施）
- 残余风险：无已接受的时序窗口；dev 必须走 `autoListen: false`

## Closure conditions

- [acceptance](acceptance.md) 全部 MUST 通过并有证据
- build -w / dev 行为等价（重构不改语义；D1a 严格等价，无默契窗口）
- 代码重复消除（bin 共享 watch API）
- STATUS、导航、归档一致
