# Compiler Configurable（CF-1：统一编译配置框架）

- Action: `compiler-configurable`
- Status: `draft`
- Updated: 2026-09-10
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-1）
- 前置：无（框架层；**实施在 CF-4 `watch-api` complete 之后**，于稳定 bin 上接 CLI flag）

## Documents

| 文档 | 作用 |
| --- | --- |
| [requirements](requirements.md) | 需求与非范围 |
| [technical-design](technical-design.md) | 配置结构 / 合并链 / stage 接线（待 Readiness 冻结） |
| [acceptance](acceptance.md) | MUST 验收表（A-001..A-009） |

## Background

编译器配置当前散落在三层，没有统一位置：

1. **CLI 参数**：`--sourcemap`、`--no-app-id-dir` 等
2. **API options**：`build()` 的 `options`（sourcemap/fileTypes/stages/seedPath/...）
3. **内部硬编码**：ES target（logic/view 不同取值）、minify（硬编码 true）、sourcemap 策略

问题：新增配置项要改三层；minify 等不可配置；dev 不必要 minify。

### CLI ⊆ API

CLI 是 API 的便捷子集。不允许 CLI-only 能力。

### 双线程与 ES target（2026-09-10）

```text
logic  → QuickJS / JSC / Worker     → esTarget.logic（缺省 es2023）
view   → Native WebView / Browser   → esTarget.view（缺省 es2020）
```

```js
esTarget: { logic: 'es2023', view: 'es2020' }
```

- 禁止顶层标量 `esTarget`
- view → `esTarget.view`；logic **bundle minify** → `esTarget.logic`
- logic **单模块 CJS**（现状 `es2020`）同车道收敛 → **CF-3**（本门保持硬编码以保 diff=0）
- style 不消费 JS `esTarget`

### Compile profile

```text
minify ← mode（build=true / dev=false）
esTarget.logic / esTarget.view ← 双线程缺省；platform 覆盖留给 CF-2
```

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
- `esTarget` 双字段；缺省 diff=0
- 验收规格

## Readiness gaps

文档已补齐（2026-09-10）：requirements / technical-design / acceptance。状态仍为 `draft`，**未授权实施**。

进入 `ready` 前待 Readiness Review 冻结：

1. **D-CF1-1**：标量/`esTarget` 非法形状 → 硬失败（design 建议）
2. **D-CF1-2**：mode 字段名 `options.mode`（`'build'|'dev'`）
3. **D-CF1-3**：logic 单模块 CJS 留 CF-3（本门不接线）——与「双字段」一并确认
4. **D-CF1-4**：acceptance A-001..A-009 + A-006 消融口径
5. 评审结论回写本 README gaps 清零与 STATUS → `ready`

无外部阻塞（CF-4 已 complete）。

## Closure conditions

- [acceptance](acceptance.md) 全部 MUST 通过并有证据
- 缺省 build 产物 diff=0；dev 不 minify 有验证
- STATUS、导航、归档一致
