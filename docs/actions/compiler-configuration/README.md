# Compiler Configuration（Umbrella）

- Action: `compiler-configuration`
- Status: `draft`
- Updated: 2026-09-08
- Status authority: [Action Status](../STATUS.md)
- 设计权威：本 umbrella 的架构决策由子 Action 分别推动回写 RFC（D6:B 等）；本文不重复

## Background

编译器当前的配置散落在三层：CLI 参数（`--sourcemap` 等）、API options（`build()` 的 `options` 参数）、内部硬编码（ES target、minify、sourcemap 策略）。同一关注点没有统一配置位置；新增配置项要同时改三层；部分能力（watch）是 CLI-only 的，违反 CLI ⊆ API 原则。

上一轮 umbrella `compiler-improvement` 交付了 hook 层、dev server、HMR、renderer 抽象；本轮聚焦**编译器配置化**——从硬编码走向声明式编译策略。

## Goal

1. 引入 platform 维度（运行时宿主环境：native/web），修订 D6 为 D6:B（产物分层）
2. 建立统一编译配置框架（compile configuration），CLI ⊆ API 能力对齐
3. ES target 从硬编码消除，值统一（独立验证产物变化）
4. watch 从 CLI-only 提升为 API 能力，消除 dev/build 重复实现

## Non-goals

- 不实现新的产物格式（modDefine 注册调用结构不变）
- 不实现 Lynx（C1 deferred 不变）
- 不做性能优化
- 不修改 service / bridge / HMR / ws 协议
- 不新增配置文件（`dimina.config.js` 将来按需）

## Scope

- 主战场：`fe/packages/compiler`
- 涉及：`src/bin/`（CLI）、`src/common/`（配置框架）、`src/core/`（硬编码消除）
- 不涉及：`fe/packages/render`、`fe/packages/container-sdk`（运行时行为）

## 核心设计原则

**CLI ⊆ API**：CLI 是 API 的便捷子集。CLI 能做的 API 一定能做；API 能做的 CLI 不一定暴露（克制）。不允许 CLI-only 的能力。

**compile profile = f(platform, mode, override)**：

```text
                    build              dev
native            es2023 + minify     —
web               es2023 + minify     es2023 + 不 minify
```

**D6:B 产物分层**：

| 层 | 跨 platform × mode | 内容 |
| --- | --- | --- |
| 不变层 | 结构一致 | modDefine 注册调用结构、模块 ID、目录、app-config、警告 |
| 可变层 | 由 compile profile 决定 | ES target、minify、sourcemap 策略 |

## Deliverables

- platform 维度声明 + CLI `--platform` + D6:B RFC 回写
- compile configuration 统一框架（CLI/API 收敛、mode preset、minify/sourcemap/esTarget 从框架读取）
- dev 默认不 minify（行为变更，独立验证）
- ES target 值统一（产物有意变化，独立验证 + 兼容性调研）
- watch API 化（消除 dev/build 重复，API 完备性）

## Umbrella 机制

每个子 Action 独立 formalize（draft → ready → in_progress → complete），验收标准从 RFC 派生。子 Action complete 时持久发现回流 RFC。

## Roadmap

| 门 | 内容 | 子 Action | 依赖 | 状态 |
| --- | --- | --- | --- | --- |
| CF-1 | 统一编译配置框架（CLI⊆API/mode/minify/sourcemap + platform 占位） | `compiler-configurable` | 无 | draft |
| CF-2 | platform 维度接入（枚举注册进 config 框架/CLI/约束/D6:B） | `platform-abstraction` | CF-1 | draft |
| CF-3 | ES target 值统一（es2020→es2023） | `es-target-unification` | CF-1 + Harmony WebView 调研 | draft |
| CF-4 | watch API 化（消除 CLI-only/重复） | `watch-api` | 无（实施先于 CF-1） | complete |

依赖关系（修正后，2026-09-08 审查）：

```text
CF-1 configurable → CF-2 platform（platform 接入已有 config 框架）
CF-1 configurable → CF-3 es-target（值统一在 config 里改）
CF-4 watch-api（独立，可并行）
```

执行建议（F-CF-002/003 审查修正后定稿）：

```text
Phase 1（串行，避免 bin 文件冲突）：
  CF-4 watch-api          → 先抽离 bin watch 编排（稳定入口文件）
  CF-1 compiler-configurable → 在稳定入口上接入 CLI flag + compile config（首版 core 框架，bin 接入在 CF-4 之后）

Phase 2（依赖 CF-1）：
  CF-2 platform-abstraction → platform 枚举注册进 config
  CF-3 es-target-unification → 值统一（外部依赖 Harmony 调研）
```
## Readiness gaps

- 各子 Action 需分别 formalize 并通过 Readiness Review
- CF-3 有外部依赖（Harmony WebView es2023 兼容性调研）

## Closure conditions

- 全部子 Action complete（含验收证据与回流）
- D6:B 定稿回写 RFC
- STATUS、导航、归档一致
