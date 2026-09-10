# Acceptance — watch-api

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | 可通过 `@dimina/compiler/watch` import `createBuildWatcher`；默认 `autoListen` 下 `await start()` 完成初始构建并开始监听且 resolve 为 `buildResult`；`autoListen:false` 时 `start()` 只 build，须再 `listen()`；`await stop()` 无未处理 rejection | watch-runner.spec + postbuild exports 检查 | passed |
| A-002 | R-003 | 既有 `watch-scheduler.spec.js` 全绿；事件集合、合并、增量/skip、产物 ignore、失败后继续监听的行为与改造前一致 | watch-scheduler.spec + watch-runner.spec | passed |
| A-003 | R-004 | `dmcc build -w`：改源文件触发重建日志与成功增量/全量；行为与改造前等价（不新增 flag） | 冒烟日志或契约测试 | passed |
| A-004 | R-005 | `dmcc dev` 使用 `autoListen:false`（D1a）：顺序为初始 build → devServer.listen → `watcher.listen()`；改 logic/style/json 后 reloadLevel / ws 与 A2/A3 一致；`setPendingReload` 在 `build()` 前；失败推 `build:error`、进程不退出 | 既有 dev-server / dev-reload specs + 必要冒烟 | passed |
| A-005 | R-002 / R-008 | `bin/index.js` 与 `bin/dev.js` 无各自内联的完整 chokidar 编排环；二者调用 `createBuildWatcher` | source diff / 审查记录 | passed |
| A-006 | R-006 | `exports["./watch"]` 存在；vite 产物存在；`pnpm --filter compiler build` 后 `check-package-exports` 通过 | build 日志 + package.json diff | passed |
| A-007 | R-007 | `cd fe && pnpm --filter compiler test` 全绿（既有 + 新增 watch-runner） | 命令日志 | passed |
| A-008 | R-009 | plan/scheduler/ignore 位于 `src/common/watch-plan.js`（D5）；`bin/watch.js` 删除或薄 re-export | source tree + 测试 import | passed |
| A-009 | R-005 | A2/A3 相关 spec 未回落；ws 消息形状零改动 | 相关 spec 全绿 + 协议字段抽查 | passed |

## Closure evidence rule

- MUST（A-001..A-009）全部 `passed` 且证据写入 validation（实施阶段补）后方可 `complete`。
- **不接受**未记录的 listen 前变更窗口；D1a 已冻结为严格等价（`autoListen:false`）。
- 消融（Experience-Review §6）：至少对 A-005（去重）或 A-001（公开 API）之一做消融——移除 runner 导出或恢复 bin 内联之一应导致对应断言失败；记录于 validation。

## Status

全部 `passed`：证据见 [validation](validation.md) P-001..P-003（含 A-005 消融）。
