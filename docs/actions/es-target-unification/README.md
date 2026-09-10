# ES Target Unification（CF-3：ES target 值统一）

- Action: `es-target-unification`
- Status: `draft`
- Updated: 2026-09-08
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-3）
- 前置：CF-1 `compiler-configurable`（ES target 已从 compile configuration 读取）

## Background

编译器内部 ES target 历史上按最保守运行时设定，存在不一致：

- `logic-compiler.js:122` — `es2023`（QuickJS 兼容）
- `logic-compiler.js:443` — `es2020`（单模块 CJS 转换）
- `view-compiler.js:330` — `es2020`（view bundle minify）

CF-2 已将三处硬编码替换为从 compile configuration 读取（per-stage 保持现值）。本 Action 统一值为 es2023。

## Goal

将所有阶段的 ES target 统一为 `es2023`，消除 per-stage 不一致。**产物会发生变化（有意）**——需独立验证兼容性与安全性。

## Non-goals

- 不提升 web platform 的 ES target（将来按需，需独立兼容性验证）
- 不做 ES target 按 platform 分叉（首版 native/web 都是 es2023）
- 不改编译配置框架（CF-2 已落地）
- 不做性能优化

## 外部依赖

- **Harmony WebView es2023 兼容性调研**：view bundle 的 es2020→es2023 变化需确认 Harmony WebView 实测支持。调研未完成前本 Action 不得进入 ready。

## Scope

- `fe/packages/compiler/src/common/compile-config.js`（per-stage esTarget 值统一）
- `fe/packages/compiler/__tests__/`（产物兼容性规格）
- RFC 回写（如 D6:B 可变层示例更新）

## Deliverables

- 所有阶段 ES target 统一为 es2023
- 产物 diff≠0 的完整解释与验证（变化是安全的、兼容的、可回滚的）
- Harmony WebView 兼容性调研记录
- 全量回归 + 运行时行为验证

## Readiness gaps

- **外部依赖未满足**：Harmony WebView es2023 兼容性调研待完成
- 调研完成后方可 Readiness Review

## Closure conditions

- 所有 MUST Acceptance 通过并有证据
- 产物变化有完整的兼容性验证（不只是字节 diff）
- STATUS、导航、归档一致
