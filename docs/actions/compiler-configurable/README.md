# Compiler Configurable（CF-1：统一编译配置框架）

- Action: `compiler-configurable`
- Status: `draft`
- Updated: 2026-09-10
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-1）
- 前置：无（框架层；**实施在 CF-4 `watch-api` complete 之后**，于稳定 bin 上接 CLI flag）

## Background

编译器配置当前散落在三层，没有统一位置：

1. **CLI 参数**：`--sourcemap`、`--no-app-id-dir` 等
2. **API options**：`build()` 的 `options`（sourcemap/fileTypes/stages/seedPath/...）
3. **内部硬编码**：ES target（logic/view 不同取值）、minify（硬编码 true）、sourcemap 策略

问题：
- 新增配置项要同时改三层
- 内部硬编码无法被 CLI/API 触达（如 minify 不可配置）
- dev 场景做了不必要的 minify（堆栈不可读、增量慢）

### CLI ⊆ API 原则

CLI 是 API 的便捷子集。CLI 能做的 API 一定能做；API 能做的 CLI 不一定暴露（克制）。不允许 CLI-only 的能力。

### 双线程与 ES target（2026-09-10 定稿）

Dimina 逻辑层与视图层跑在不同 JS 引擎上，ES target **必须按车道拆分**，不能用单个全局值表达：

```text
logic  → QuickJS / JSC / Worker     → esTarget.logic（缺省 es2023）
view   → Native WebView / Browser   → esTarget.view（缺省 es2020）
```

配置形状（首版）：

```js
esTarget: {
  logic: 'es2023',
  view: 'es2020',
}
```

- **不提供**与双字段并存的顶层标量 `esTarget`（避免歧义）。
- `logic-compiler` 内所有 esbuild/转换 target（含单模块 CJS 路径）均读 `esTarget.logic`。
- `view-compiler` 读 `esTarget.view`。
- style 阶段不消费 JS `esTarget`。
- 首版缺省保持现值 → **缺省 build 产物 diff=0**；是否抬高 `view` 属 CF-3，不在本门。

### Compile profile 模型

```text
compile profile = platform defaults × mode defaults × 用户覆盖

minify（由 mode 定缺省）:
                    build              dev
native / web        minify=true        minify=false（dev 固定 web）

esTarget（由双线程车道定缺省；platform 可覆盖 view，CF-2 接入）:
  logic: es2023
  view:  es2020
```

- **mode** 决定 minify 缺省（build=true / dev=false）
- **esTarget** 按 logic/view 双字段；首版 platform 仅占位，不改缺省值
- **用户覆盖**可改 minify（`--minify` / `--no-minify`）；esTarget 首版以 API/结构为主，CLI 暴露克制（可不暴露）

## Goal

建立统一编译配置框架（compile configuration），让所有编译行为选项有明确的结构化位置；CLI/API 收敛到这个结构；mode 提供预设；minify/sourcemap/`esTarget.{logic,view}` 硬编码消除。

## Non-goals

- 不接入 platform 枚举语义（CF-2 `platform-abstraction`；CF-1 只做 `platform` 字段占位）
- 不抬高或统一 `esTarget.view` / 不强制 logic 与 view 同值（CF-3）
- 不做 watch API 化（CF-4 已 complete）
- 不新增配置文件（`dimina.config.js` 将来按需）
- 不改 `build()` API 签名（向后兼容；options 合并进 config）
- 不把 API-only 选项暴露为 CLI（stages/seedPath 等保持 API-only）

## Scope

**首版**（核心框架 + 硬编码消除；CLI 在 CF-4 之后接 bin）：

- `fe/packages/compiler/src/common/compile-config.js`（新增：结构、合并链、mode preset、`esTarget.{logic,view}`）
- `fe/packages/compiler/src/index.js`（options 合并进 config，传给 stage/worker）
- `fe/packages/compiler/src/core/logic-compiler.js`（`esTarget.logic` / minify 从 config 读取）
- `fe/packages/compiler/src/core/view-compiler.js`（`esTarget.view` / minify 从 config 读取）
- `fe/packages/compiler/src/core/style-compiler.js`（如涉及 minify，不涉及 esTarget）
- `fe/packages/compiler/__tests__/`（config 解析、双字段 esTarget、CLI⊆API、dev minify 规格）

**CLI 接入**（CF-4 已完成，可在稳定 bin 上接入）：

- `fe/packages/compiler/src/bin/index.js`（`--minify`/`--no-minify`）
- `fe/packages/compiler/src/bin/dev.js`（`--minify`；mode=dev preset）

明确不改：
- `fe/packages/render` / `fe/packages/container-sdk`
- renderer registry（A4）
- dev server / HMR / ws（A2/A3）
- platform 枚举接入（CF-2）
- 抬高 view ES target（CF-3）

## Deliverables

- compile configuration 统一结构（`esTarget.{logic,view}` / minify / sourcemap / platform / mode）
- 配置合并链：CLI > API options > mode preset > platform defaults > 内部缺省
- minify 硬编码消除 + mode 缺省（build=true/dev=false）+ CLI `--minify`/`--no-minify`
- sourcemap CLI flag 收敛进结构（行为等价）
- ES target 硬编码消除为双字段；缺省 logic=es2023、view=es2020（与现状一致）
- dev 默认不 minify（行为变更，独立验证）
- sourcemap 隐式跳过 minify 逻辑显式化

## 首版边界

**收敛的配置项**（首版做）：

| 项 | 变更 | 行为影响 |
| --- | --- | --- |
| minify | 硬编码→配置 | dev 缺省变 false（行为变更） |
| sourcemap | CLI flag→结构 | 无变化 |
| esTarget.logic / esTarget.view | 硬编码→双字段配置 | 无变化（缺省保持现值） |
| mode | 新增 preset | dev 不 minify |
| platform | 字段占位（枚举 CF-2 接入） | 无变化 |

**不收敛**（保持 API-only，将来按需）：

| 项 | 现状 | 理由 |
| --- | --- | --- |
| stages/affectedEntries/seedPath/dependencyGraph | API options | 工具链内部机制，CLI 不暴露 |
| fileTypes | API options | 项目级配置，将来可走配置文件 |
| prepareConfig/prepareNpm | API options | 增量控制，watch plan 使用 |
| sourcemap 详细度 | 内部硬编码 | 将来扩展 |
| esTarget CLI flags | — | 首版克制；需要时再暴露 |

## Readiness gaps

- 已冻结（2026-09-10）：CLI⊆API、mode preset、dev 不 minify、**esTarget 双字段（logic/view）**、首版缺省 diff=0、不提供顶层标量 esTarget
- 待 Readiness Review 确认文档完整性

## Closure conditions

- 所有 MUST Acceptance 通过并有证据
- 缺省 build 产物逐字节一致（diff=0）
- dev 产物 minify 差异有验证
- STATUS、导航、归档一致
