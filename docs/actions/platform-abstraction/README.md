# Platform Abstraction（CF-1：platform 维度声明）

- Action: `platform-abstraction`
- Status: `draft`
- Updated: 2026-09-08
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-1）
- 设计权威：[Compiler Architecture RFC](../../Compiler-Architecture-RFC.md) §3 D6（本 Action 推动修订为 D6:B）；A4 归档 [render-target-abstraction](../_archive/complete/render-target-abstraction/README.md)

## Background

`dmcc build` 和 `dmcc dev` 隐含了两个不同的运行时平台但没有显式表达：

- `dmcc build` → Dimina 原生四端容器（QuickJS/JSCore + native WebView，file:// 加载）
- `dmcc dev` → Web 浏览器（V8 + iframe + container-sdk Web 宿主页，HTTP 加载）

产物字节上两者完全一致（D6 冻结），但这是统一保守的结果——一旦 Web 平台需要不同编译策略就没有表达手段。

## Goal

引入显式 platform 维度（`native` / `web`），修订 D6 为 D6:B（产物分层），**不改任何编译器内部行为**（ES target/minify 硬编码不动，归 CF-2/CF-3）。

## Non-goals

- 不改编译器内部行为（ES target/minify/sourcemap 硬编码不动）
- 不做 minify 配置、mode 维度（CF-2 `compiler-configurable`）
- 不做 ES target 值统一（CF-3 `es-target-unification`）
- 不做 watch API 化（CF-4）
- 不实现 Lynx（C1 deferred）
- 不改 renderer 抽象（A4 已闭合）

## Scope

- `fe/packages/compiler/src/common/platforms.js`（新增：platform 枚举、解析、sourcemap 策略语义）
- `fe/packages/compiler/src/index.js`（platform 进入编译上下文）
- `fe/packages/compiler/src/bin/index.js`（`dmcc build --platform <name>`）
- `fe/packages/compiler/src/bin/dev.js`（`dmcc dev` 固定 platform=web）
- `fe/packages/compiler/__tests__/`（platform 解析规格）
- RFC D6:B 回写

明确不改：
- ES target/minify 硬编码（CF-2/CF-3 范围）
- renderer registry（A4 范围）
- dev server/HMR/ws 协议（A2/A3 范围）

## Deliverables

- platform 枚举（`native`/`web`）与 `resolvePlatform()`（缺省 native，未知抛 `InvalidPlatformError`）
- CLI `--platform <name>`（build）；dev 固定 web
- renderer × platform 约束校验（预留：lynx 不支持 web）
- sourcemap 策略语义标注（quickjs-attach / devtools-url，不改实际行为）
- D6:B 产物分层 RFC 回写
- 缺省产物逐字节一致验证（diff=0）

## Readiness gaps

- 已冻结（2026-09-08）：platform 来源 = CLI（不走 app.json）；sourcemap web 策略 = 仅语义标注；缺省 native 向后兼容
- 待 Readiness Review 确认文档完整性

## Closure conditions

- 所有 MUST Acceptance 通过并有证据
- 缺省产物逐字节一致（diff=0）
- RFC D6:B 回写
- STATUS、导航、归档一致
