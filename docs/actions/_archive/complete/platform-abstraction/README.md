# Platform Abstraction（CF-2：platform 维度接入）

- Action: `platform-abstraction`
- Status: `complete`
- Updated: 2026-09-10
- Promoted: 2026-09-10（Readiness Review pass；D-CF2-1..5 全按建议）
- Authorized: 2026-09-10（明确授权实施）
- Archived: 2026-09-10
- Status authority: [Action Status](../../../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-2）
- 前置：CF-1 `compiler-configurable`（**complete**）
- 设计权威：[technical-design](technical-design.md)（**已冻结 v1**）；RFC [D6:B](../../../../Compiler-Architecture-RFC.md) / §4.8；A4 [render-target-abstraction](../render-target-abstraction/README.md)

## Documents

| 文档 | 作用 |
| --- | --- |
| [requirements](requirements.md) | 需求与非范围 |
| [technical-design](technical-design.md) | platform 解析 / 策略标注 / renderer 约束（**已冻结 v1**） |
| [acceptance](acceptance.md) | MUST 验收表（A-001..A-009） |
| [validation](validation.md) | 验证证据（P-001..P-003，含消融） |

## Background

CF-1 已建立统一 compile configuration，`platform` 仅占位。本门把 `native` / `web` 注册进框架并提供 CLI，**不改变** minify / `esTarget` / sourcemap 生成。

## Goal

- platform 枚举 + 缺省 `native`；`dmcc build --platform`；`dmcc dev` 固定 `web`
- `sourcemapStrategy` 派生标注；renderer × platform 钩子
- RFC D6:B；缺省产物 diff=0

## Non-goals

- 不改编译变换；不抬 `esTarget.view`；不实现 lynx；不改 A4 选择模型

## Scope（已交付）

- `src/common/platforms.js`；`compile-config.js`；`src/index.js` 断言
- `bin/index.js` / `bin/dev.js`
- `__tests__/platforms.spec.js` + compile-config 扩展
- RFC D6:B + §4.8

## Readiness gaps

无。

## Closure conditions

- [acceptance](acceptance.md) 全部 MUST 通过并有证据 — 已满足
- 缺省产物 diff=0；RFC D6:B — 已满足
- STATUS、导航、归档一致 — 本闭合完成

## Closure decision（2026-09-10）

- **终局决策**：`complete`，归档至 `docs/actions/_archive/complete/platform-abstraction/`。
- **验收**：A-001~A-009 全部 `passed`，证据见 [validation](validation.md)（P-001..P-003；P-002 为缺省 native 消融）。
- **实现提交**：`5af081c5`；闭合含 validation、RFC D6:B/§4.8、归档。
- **残余风险 / 边界**：
  - `sourcemapStrategy` 仅为元数据；真正按策略改 map 生成另立 Action。
  - renderer `unsupportedPlatforms` 为预留形状；尚无 lynx 实现。
  - 全量测试以 `npx vitest run` 执行。
