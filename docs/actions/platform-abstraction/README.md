# Platform Abstraction（CF-2：platform 维度接入）

- Action: `platform-abstraction`
- Status: `ready`
- Updated: 2026-09-10
- Promoted: 2026-09-10（Readiness Review pass；D-CF2-1..5 全按建议）
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-2）
- 前置：CF-1 `compiler-configurable`（**complete**；platform 字段占位已存在）
- 设计权威：[technical-design](technical-design.md)（**已冻结 v1**）；RFC [D6](../../Compiler-Architecture-RFC.md)（闭合时修订为 D6:B）；A4 [render-target-abstraction](../_archive/complete/render-target-abstraction/README.md)

## Documents

| 文档 | 作用 |
| --- | --- |
| [requirements](requirements.md) | 需求与非范围 |
| [technical-design](technical-design.md) | platform 解析 / 策略标注 / renderer 约束（**已冻结 v1**） |
| [acceptance](acceptance.md) | MUST 验收表（A-001..A-009） |

## Background

CF-1 已建立统一 compile configuration，`platform` 仅占位校验。`dmcc build` 与 `dmcc dev` 隐含不同运行时宿主（原生四端 vs Web 浏览器），但配置面无法表达。

本门把 `native` / `web` 注册进配置框架并提供 CLI，**不改变** minify / `esTarget` / sourcemap 生成行为。

## Goal

- platform 枚举 + `resolvePlatform` + 缺省 `native`
- CLI `dmcc build --platform`；API `options.platform`；`dmcc dev` 固定 `web`
- `sourcemapStrategy` 由 platform 派生（仅语义标注）
- renderer × platform 约束钩子（经 A4 `getRenderer`）
- 闭合回写 RFC D6:B；缺省产物 diff=0

## Non-goals

- 不改编译变换（minify / esTarget / map 生成）
- 不抬高 `esTarget.view`、不强制 logic/view 同值（CF-3）
- 不实现 lynx；不改 A4 renderer 选择模型
- 不做 watch 改动（CF-4 complete）

## Scope

- `src/common/platforms.js`；`compile-config.js`；`src/index.js` 断言
- `bin/index.js` / `bin/dev.js`
- `__tests__/platforms.spec.js`（及 compile-config 扩展）
- RFC D6:B（闭合时）

## Deliverables

- 见 Goal；验收规格 A-001..A-009；validation（实施后）

## Readiness gaps

无。前置 CF-1 complete；D-CF2-1..5 已冻。

- 状态：`ready`（待明确授权实施）

## Closure conditions

- [acceptance](acceptance.md) 全部 MUST 通过并有证据
- 缺省产物 diff=0；RFC D6:B 回写
- STATUS、导航、归档一致
