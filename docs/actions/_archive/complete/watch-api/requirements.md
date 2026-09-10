# Requirements — watch-api

## R-001（MUST）可编程 watch API

提供 `createBuildWatcher`（公开子路径导出，见 [technical-design](technical-design.md)），调用方无需经过 CLI 即可完成：初始构建 → 文件监听 → 增量/全量重建。API 生命周期至少包含 `start()` 与 `stop()`。

## R-002（MUST）CLI ⊆ API

`dmcc build -w` 与 `dmcc dev` 的 watch 能力必须通过同一 API 实现；不得再存在 CLI-only 的 chokidar→plan→scheduler→build 编排副本。

## R-003（MUST）watch 行为语义不变

以下语义与改造前逐项等价（由既有 `watch-scheduler` 规格 + 新增 runner 规格锁定）：

- 事件集合：`add` / `change` / `unlink` 触发重建；目录事件忽略
- 合并：构建进行中到达的事件合并为最后一次，`count > 1` 时保守全量（`createWatchBuildPlan`）
- 增量：单文件 `change` 且依赖图可推导时走 incremental options；否则 skip 或全量
- 忽略：已发布产物目录不触发重建（`createIgnoredPathMatcher`）
- 失败后继续：单次 rebuild 失败不终止监听（调用方可在 `onError` 记录）

## R-004（MUST）`build -w` 行为等价

重构后 `dmcc build -w` 的初始构建、日志、增量/全量、错误打印与进程保持运行的行为与改造前等价；不引入新的 CLI flag。

## R-005（MUST）`dmcc dev` 行为等价

重构后 `dmcc dev` 的 watch 编排改为消费 API，但以下契约零改动：

- A1 lifecycle 注入与 `bundle:published` / `build:error` 驱动
- A2 `synthesizeReloadLevel` → `setPendingReload`（build 前）→ ws 推送
- A2/A3 reloadLevel、ws 消息形状、快照语义、宿主页行为

## R-006（MUST）公开导出可用

`@dimina/compiler/watch`（或 Readiness 冻结的等价子路径）可从包外 import；`package.json` `exports`、vite build entry 与 `check-package-exports` 一致。

## R-007（MUST）既有规格全绿 + 新增 API 规格

`pnpm --filter compiler test` 全绿；既有 `watch-scheduler.spec.js` 在 import 路径调整后仍通过；新增 `watch-runner`（或等价）规格覆盖 R-001 / R-003 的可编程路径与 `start`/`stop`。

## R-008（MUST）bin 编排去重可观察

`bin/index.js` 与 `bin/dev.js` 不再各自内联完整的 chokidar 监听环（创建 watcher、`ignored`、`all` 事件上的 plan skip + `scheduler.schedule`）；二者均调用 watch API。CLI 专属日志文案可留在 bin。

## R-009（SHOULD）底层 plan/scheduler 迁出 bin

现有 `src/bin/watch.js` 中的 plan / scheduler / ignore 工具迁至 `src/common/`（或由 runner 同目录承载并再导出），避免可复用逻辑继续长在 `bin/`；测试与 `dev-reload` 注释路径同步更新。

## Non-scope

见 [README](README.md) Non-goals：不改 watch 调度/增量语义、不改 A2/A3 协议、不做 CF-1 编译配置框架、不做性能优化。
