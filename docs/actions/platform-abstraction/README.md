# Platform Abstraction（CF-2：platform 维度接入）

- Action: `platform-abstraction`
- Status: `draft`
- Updated: 2026-09-08
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-2）
- 前置：CF-1 `compiler-configurable`（统一配置框架已落地，platform 字段占位已存在）
- 设计权威：[Compiler Architecture RFC](../../Compiler-Architecture-RFC.md) §3 D6（本 Action 推动修订为 D6:B）；A4 归档 [render-target-abstraction](../_archive/complete/render-target-abstraction/README.md)

## Background

CF-1（compiler-configurable）已建立统一编译配置框架（compile configuration），platform 字段已占位但未接入实际枚举。本 Action 将 platform 维度（native/web）注册进 config 框架，赋予其语义。

背景事实：`dmcc build` 和 `dmcc dev` 隐含了两个不同的运行时平台——build 面向 Dimina 原生四端容器（QuickJS/JSCore + native WebView），dev 面向 Web 浏览器（V8 + iframe）。产物字节一致但无表达手段。

## Goal

将 platform 枚举（native/web）注册进 CF-1 的 compile configuration 框架，提供 CLI `--platform`，修订 D6 为 D6:B。**不改任何编译器内部行为**（ES target/minify 硬编码已在 CF-1 中收敛，本 Action 只接入 platform 语义）。

## Non-goals

- 不改编译器内部行为（CF-1 已收敛）
- 不做 ES target 值统一（CF-3）
- 不做 watch API 化（CF-4）
- 不实现 Lynx（C1 deferred）
- 不改 renderer 抽象（A4 已闭合）

## Scope

- `fe/packages/compiler/src/common/platforms.js`（platform 枚举、resolvePlatform、InvalidPlatformError）
- `fe/packages/compiler/src/common/compile-config.js`（platform 字段接入 CF-1 框架 + `sourcemapStrategy` 字段由 platform 派生，不改 sourcemap 生成逻辑）
- `fe/packages/compiler/src/bin/index.js`（`dmcc build --platform <name>`）
- `fe/packages/compiler/src/bin/dev.js`（dev 固定 platform=web）
- `fe/packages/compiler/__tests__/`
- RFC D6:B 回写

## Deliverables

- platform 枚举（native/web）+ resolvePlatform + CLI `--platform`
- renderer × platform 约束校验（预留：lynx 不支持 web）；经 A4 renderer registry（`getRenderer`）读取当前 renderer
- sourcemap 策略语义标注（`sourcemapStrategy` 字段：quickjs-attach / devtools-url，由 platform 派生，不改实际 sourcemap 行为）
- D6:B 产物分层 RFC 回写
- 缺省产物逐字节一致验证（diff=0）

## Readiness gaps

- 前置 CF-1（compiler-configurable）需先 complete
- 已冻结：platform 来源 = CLI；sourcemap web 策略 = 仅语义标注；缺省 native

## Closure conditions

- 所有 MUST Acceptance 通过并有证据
- 缺省产物逐字节一致（diff=0）
- RFC D6:B 回写
- STATUS、导航、归档一致
