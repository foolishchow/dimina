# ES Target Unification（CF-3：logic 车道收敛）

- Action: `es-target-unification`
- Status: `in_progress`
- Updated: 2026-09-10
- Promoted: 2026-09-10（Readiness Review pass；切片 **仅 logic**；D-CF3-1..5 全按建议）
- Authorized: 2026-09-10（明确授权实施）
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-3）
- 前置：CF-1 `compiler-configurable`（**complete**）；CF-2 非硬前置（正交，已 complete）
- 设计权威：[technical-design](technical-design.md)（**已冻结 v1 · 仅 logic**）

## Documents

| 文档 | 作用 |
| --- | --- |
| [requirements](requirements.md) | 需求与非范围（仅 logic 切片） |
| [technical-design](technical-design.md) | CJS → `esTarget.logic` 接线（**已冻结 v1**） |
| [acceptance](acceptance.md) | MUST 验收表（A-001..A-008） |

## Background

双线程下 ES target 按车道拆分（CF-1）：

| 车道 | 缺省 | 说明 |
| --- | --- | --- |
| logic | es2023 | QuickJS / JSC / Worker |
| view | es2020 | WebView / Browser |

**缺陷**是 logic **车道内部**漂移（bundle 已读 `esTarget.logic`，单模块 CJS 仍硬编码 `es2020`）。logic≠view **不是**缺陷。

## 本门切片（已冻结）

**仅 logic 收敛**：把 CJS 路径接到 `esTarget.logic`。

**不含**：抬高 `esTarget.view`；无 WebView/Harmony 矩阵前置。

## Goal

- logic-compiler 各 transform target 统一读 `esTarget.logic`
- 缺省双字段值不变；不改 view
- view/style 产物 diff=0；logic 差异如实记录

## Non-goals

- view 抬升 / 强制 logic===view
- 改 CF-1 配置形状、CF-2 platform、新增 es-target CLI
- 性能优化

## Scope

- `fe/packages/compiler/src/core/logic-compiler.js`（CJS target）
- 相关 `__tests__/`；闭合时 RFC 短回写

## Readiness gaps

无。切片已冻为仅 logic；前置 CF-1 complete。

- 状态：`in_progress`（已授权实施）

## Closure conditions

- [acceptance](acceptance.md) 全部 MUST 通过并有证据
- 不含 view 抬升欠债
- STATUS、导航、归档一致
