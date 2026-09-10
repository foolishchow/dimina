# ES Target Unification（CF-3：logic 车道收敛）

- Action: `es-target-unification`
- Status: `complete`
- Updated: 2026-09-10
- Promoted: 2026-09-10（Readiness Review pass；切片 **仅 logic**；D-CF3-1..5 全按建议）
- Authorized: 2026-09-10（明确授权实施）
- Archived: 2026-09-10
- Status authority: [Action Status](../../../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-3）
- 前置：CF-1 `compiler-configurable`（**complete**）
- 设计权威：[technical-design](technical-design.md)（**已冻结 v1 · 仅 logic**）

## Documents

| 文档 | 作用 |
| --- | --- |
| [requirements](requirements.md) | 需求与非范围（仅 logic 切片） |
| [technical-design](technical-design.md) | CJS → `esTarget.logic` 接线（**已冻结 v1**） |
| [acceptance](acceptance.md) | MUST 验收表（A-001..A-008） |
| [validation](validation.md) | 验证证据（P-001..P-003，含消融） |

## Background

logic 车道内部曾漂移：bundle 读 `esTarget.logic`（es2023），单模块 CJS 硬编码 `es2020`。logic≠view 是架构约束，不是缺陷。

## 本门切片（已交付）

**仅 logic 收敛**：CJS `target` → `esTarget.logic`。

**不含**：抬高 `esTarget.view`。

## Goal

- logic-compiler 各 transform target 统一读 `esTarget.logic`
- 缺省双字段与 view 接线不变
- view/style（及本例 logic）产物 diff=0

## Non-goals

- view 抬升 / 强制 logic===view / 新增 es-target CLI

## Scope（已交付）

- `src/core/logic-compiler.js`
- `__tests__/logic-es-target.spec.js`
- RFC §4.7 / §4.9

## Readiness gaps

无。

## Closure conditions

- [acceptance](acceptance.md) 全部 MUST 通过并有证据 — 已满足
- 不含 view 抬升欠债 — 已满足
- STATUS、导航、归档一致 — 本闭合完成

## Closure decision（2026-09-10）

- **终局决策**：`complete`，归档至 `docs/actions/_archive/complete/es-target-unification/`。
- **验收**：A-001~A-008 全部 `passed`，证据见 [validation](validation.md)。
- **实现提交**：`d289561b`；闭合含 validation、RFC §4.9、归档。
- **残余**：view 抬升若需要，须另开切片 + WebView 矩阵；不在本门范围。
