# Implementation Plan — compiler-hook-layer

任务可评审、有依赖、带验证点；执行授权后按序进行。

| ID | 任务 | 依赖 | 验证点 |
| --- | --- | --- | --- |
| P-001 | 新增 `src/common/lifecycle.js`：事件常量、`createLifecycle()`、错误隔离、载荷冻结；单元规格（注册顺序、async 监听器、隔离语义） | — | 新增 lifecycle 单测绿 |
| P-002 | 重构 `runBuild`：任务节点改为生命周期阶段函数；Listr 仅 UI；init/并发/publish 顺序与现状一致 | P-001 | 既有 55 spec 全绿 |
| P-003 | `build:warning` 镜像兼容性警告；确认 `printCompatibilityWarnings` 输出逐字节不变 | P-002 | compatibility 系 spec 绿 + 手工比对输出 |
| P-004 | 新增观察者集成规格：全量 / `stages` 过滤 / 小游戏 / 失败路径四场景的事件序列断言（含并发不串行、`stage:error`→`build:error`→reject 同对象） | P-002 | 新增集成规格绿 |
| P-005 | 产物字节一致性验证：在基线 commit（改造前）与工作区分别构建 `examples/miniprogram` 全部示例，产物目录 diff 为空（含 `.map` 关闭与 `--sourcemap` 两种模式） | P-002 | diff 日志入库 validation |
| P-006 | 入口回归：`dmcc build`、`dmcc build -w`（watch 冒烟）、`pnpm compile` 批量路径行为不变 | P-002 | compile-cli-cache / watch-scheduler spec 绿 + watch 冒烟记录 |

执行约束（对齐 Experience-Review）：

- 每步提交保持全量 spec 绿（小步提交，禁止长寿命半绿分支）；
- 诊断日志仅 P-001 错误隔离路径保留统一前缀输出，其余临时日志不进入提交；
- P-005 的基线构建在独立 worktree（`git worktree`）完成，不污染当前分支。

## 执行记录

| 任务 | 状态 | 日期 | 备注 |
| --- | --- | --- | --- |
| P-001 | 完成 | 2026-09-08 | 单测 12 项 + 全量 56 文件/353 用例绿；证据见 [validation](validation.md) |
| P-002 | 完成 | 2026-09-08 | runBuild 生命周期驱动重构：事件序、三阶段并发、打印语义与错误契约不变；全量绿 + 3 组冒烟；证据见 [validation](validation.md) |
| P-003…P-006 | 未开始 | — | — |
