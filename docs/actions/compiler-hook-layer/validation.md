# Validation — compiler-hook-layer

计划命令与证据形态；实际结果在执行阶段填写并支撑闭合判定。

## 计划命令

| 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- |
| 编译器规格 | `cd fe && pnpm --filter compiler test` | 退出码 + 用例数 |
| 全仓回归 | `cd fe && pnpm test` | 退出码 |
| 错误契约 | 上述命令中 `build-error-contract.spec.js` 未改动通过 | git diff 佐证 |
| 字节一致性 | `git worktree add <tmp> <baseline>` → 两边各执行编译 → `diff -r` 产物目录（默认 + `--sourcemap`） | diff 空输出日志 |
| 并发不串行 | 新增集成规格（A-005） | spec 运行日志 |
| 监听器隔离消融 | 移除隔离逻辑 → A-006 规格必须失败 → 恢复后通过（Experience-Review §6） | 消融前后两次运行记录 |
| 入口回归 | `pnpm compile`（批量缓存路径）+ `dmcc build -w` 手工冒烟 | 命令日志 + 冒烟记录 |

## 执行环境记录要求

每次实际验证附：日期、commit、Node/pnpm 版本、与计划偏差。

## 实际执行记录

### P-001（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `2cdc66d7` |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| 新增规格 | `corepack pnpm --filter compiler exec vitest run __tests__/lifecycle.spec.js` | 12/12 通过 | `fe/packages/compiler/__tests__/lifecycle.spec.js` | passed |
| 全量回归 | `corepack pnpm --filter compiler test` | 56 文件 / 353 用例全绿（含新增；错误契约用例的✖输出为预期） | 终端日志 | passed |
| Lint | `corepack pnpm lint` | oxlint 无告警 | 终端日志 | passed |
| 契约实现 | `src/common/lifecycle.js`：事件常量表（12 事件，冻结）、`createLifecycle()`、注册序同步 await、错误隔离（`[lifecycle]` 前缀结构化日志 + `isolatedListenerErrors`）、浅冻结载荷；未触碰 `runBuild` 与任何既有文件 | — | 源码 diff 仅 2 个新文件 | passed |

覆盖说明：

- R-005（隔离）已由 4 项规格锁定（同步/异步抛错、前缀日志、实例间隔离、冻结致隔离）；消融（A-006）留待 P-002 接入 runBuild 后按 A-006 口径执行——隔离逻辑在 P-001 仅存在于 lifecycle 模块内部，无法在不改规格的前提下“移除机制”进入构建路径，故此处不提前消融。
- 未覆盖：与 `runBuild` 集成后的时序断言（P-004）、字节一致性（P-005）、入口回归（P-006）。

### P-002（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `72650702` |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| 全量回归 | `corepack pnpm --filter compiler test` | 56 文件 / 353 用例全绿 | 终端日志 | passed |
| Lint | `corepack pnpm lint` | oxlint 无告警 | 终端日志 | passed |
| 小游戏冒烟 | 内置监听器构建 `examples/miniprogram/air-battle` | 事件序完全符合契勾：start→collected→prepared→config:compiled→npm:built→stage:before/after(logic)→published→end；air-battle 为小游戏仅 logic 阶段，符合 miniGame 分支 | 冒烟脚本（临时，已删） | passed |
| 常规 app 冒烟 | 内置监听器构建 `examples/miniprogram/base` | 三阶段 stage:before 并行发出、stage:after 交错（logic→view→style 完成序不保证）；build:warning 逐条镜像（6 条，与 [compat] 打印去重后一致）；durationMs/compatibilityWarnings 载荷正常 | 同上 | passed |
| 失败路径冒烟 | 指向不存在的 workPath | reject 同一 Error 对象；事件 build:error(stage=null)（storeInfo 失败无 stage 信息，符合设计） | 同上 | passed |
| 契约实现 | `src/index.js`：声明式 phase 数组（initPhases 串行 / stage 并发）驱动 Listr（纯 UI）；每个阶段触发对应事件；谱留 `options.lifecycle` 注入点（内部选项，已从 build:start 载荷剥离非序列化字段）；Public API（build 签名/返回/错误契约）未变 | — | diff 仅 1 文件 | passed |

与计划偏差：

- 契约未定义生命周期注入点；按 Execute 工作流在已批准设计内补齐 `options.lifecycle`（内部选项，不属公开稳定契勾，A-008 不涉此）。
- 覆盖范围：P-002 未新增规格（时序断言归 P-004）；礼节性 3 组冒烟作为临时验证，不入库。

## 闭合判定（模板）

- A-001~A-009 全部 passed（A-007 为 SHOULD 支撑项，失败需记录原因与影响）；
- 事件契约定稿结论回写 umbrella roadmap（A2/A4 依赖声明）；
- 无未记录的未覆盖区域。
