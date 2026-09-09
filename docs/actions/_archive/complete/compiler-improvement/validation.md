# Validation — compiler-improvement (umbrella)

计划命令与证据形态；实际执行结果由各子 Action 记录并汇总到闭合判定。本文当前只含计划，不含已执行验证。

## 计划命令

| 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- |
| 既有行为护栏 | `cd fe && pnpm test` | 全量命令日志（退出码、用例数） |
| 编译器单包护栏 | `cd fe && pnpm --filter compiler test` | 命令日志 |
| 产物契约对比 | A4/B 各门：新旧产物目录 diff（排除 `*.map`），预期零差异 | diff 输出或脚本日志 |
| dev 冒烟 | `fe/` 之外目录对 `examples/miniprogram/<app>` 执行 `dmcc dev` | 命令日志 + 页面证据 |
| HMR 契约 | dev server / ws 协议 vitest 契约测试 | 命令日志 |
| 失败语义消融 | 注入编译错误 → 断言旧产物仍被服务、实例存活 | 消融记录（含恢复后复验） |
| 兼容性同步 | `cd fe && pnpm --filter compiler sync:compat && git diff --exit-code`（预期无变化） | 命令日志 |

## 执行环境记录要求

每次记录实际验证时附：日期、commit、环境要点（Node/pnpm 版本、平台）、与计划的偏差。

## 闭合判定（2026-09-08）

- 全部 MUST 验收通过并有证据（A-001..A-009 全 passed，均由子 Action P-001..P-007 实际执行证据支撑）；
- SHOULD 项（A-003/A-004）通过：L2/L3 均以真实 HTTP/WS 冒烟 + render 事务规格交付；
- B/C 终局决策落档：B0–B4 与 C1 均 deferred，再激活条件入 [TODO](../../../TODO.md)；
- 无未记录的未覆盖区域。

Decision: **closable**（待 Close workflow 归档）。
