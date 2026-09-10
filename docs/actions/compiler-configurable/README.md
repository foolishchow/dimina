# Compiler Configurable（CF-1：统一编译配置框架）

- Action: `compiler-configurable`
- Status: `ready`
- Updated: 2026-09-10
- Promoted: 2026-09-10（Readiness Review pass；D-CF1-1..4 全按建议）
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-1）
- 前置：无（框架层；**实施在 CF-4 `watch-api` complete 之后**，于稳定 bin 上接 CLI flag）
- 设计权威：[technical-design](technical-design.md)（已冻结 v1）

## Documents

| 文档 | 作用 |
| --- | --- |
| [requirements](requirements.md) | 需求与非范围 |
| [technical-design](technical-design.md) | 配置结构 / 合并链 / stage 接线（**已冻结 v1**） |
| [acceptance](acceptance.md) | MUST 验收表（A-001..A-009） |

## Background

编译器配置散落在 CLI / API options / 内部硬编码。本门建立统一 compile configuration，并按双线程拆分 ES target。

### CLI ⊆ API

CLI 是 API 的便捷子集。不允许 CLI-only 能力。

### 双线程与 ES target（已冻结）

```js
esTarget: { logic: 'es2023', view: 'es2020' }
```

- 禁止顶层标量；非法形状硬失败（D-CF1-1）
- view → `esTarget.view`；logic bundle minify → `esTarget.logic`
- logic 单模块 CJS 仍硬编码 `es2020` → CF-3（D-CF1-3）
- `options.mode`: `'build' | 'dev'`（D-CF1-2）

## Goal

统一 compile configuration；CLI/API 收敛；mode preset；minify/sourcemap/`esTarget.{logic,view}` 可配置。

## Non-goals

- platform 枚举语义（CF-2）
- 抬高 view / logic CJS→`esTarget.logic`（CF-3）
- watch（CF-4 complete）
- 配置文件；改 `build()` 签名；API-only 选项上 CLI

## Scope

- `src/common/compile-config.js`；`src/index.js`；logic/view/style compilers；bin minify flags；`__tests__/compile-config.spec.js`

## Deliverables

- 配置结构 + 合并链
- minify 可配置 + dev 默认 false + CLI flags
- sourcemap 进结构；跳过最终 minify 显式化
- `esTarget` 双字段；缺省 build 产物 diff=0
- 验收规格

## Readiness gaps

无。Readiness Review 已于 2026-09-10 pass 并冻结 D-CF1-1..4。

- 状态：`ready`（可执行；**实施仍需明确授权**后方可进入 `in_progress`）

## Closure conditions

- [acceptance](acceptance.md) 全部 MUST 通过并有证据
- 缺省 build 产物 diff=0；dev 不 minify 有验证
- STATUS、导航、归档一致
