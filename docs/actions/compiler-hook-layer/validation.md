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

## 闭合判定（模板）

- A-001~A-009 全部 passed（A-007 为 SHOULD 支撑项，失败需记录原因与影响）；
- 事件契约定稿结论回写 umbrella roadmap（A2/A4 依赖声明）；
- 无未记录的未覆盖区域。
