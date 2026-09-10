# Compiler Configurable（CF-1：统一编译配置框架）

- Action: `compiler-configurable`
- Status: `draft`
- Updated: 2026-09-08
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-1）
- 前置：无（本门为最先落地的框架层）

## Background

编译器配置当前散落在三层，没有统一位置：

1. **CLI 参数**：`--sourcemap`、`--no-app-id-dir` 等
2. **API options**：`build()` 的 `options`（sourcemap/fileTypes/stages/seedPath/...）
3. **内部硬编码**：ES target（es2023/es2020）、minify（硬编码 true）、sourcemap 策略

问题：
- 新增配置项要同时改三层
- 内部硬编码无法被 CLI/API 触达（如 minify 不可配置）
- dev 场景做了不必要的 minify（堆栈不可读、增量慢）

### CLI ⊆ API 原则

CLI 是 API 的便捷子集。CLI 能做的 API 一定能做；API 能做的 CLI 不一定暴露（克制）。不允许 CLI-only 的能力。

### Compile profile 模型

```text
compile profile = platform defaults × mode defaults × 用户覆盖

                    build              dev
native            es2023 + minify     —（dev 固定 web）
web               es2023 + minify     es2023 + 不 minify
```

- **platform** 决定 ES target（运行时能力）
- **mode** 决定 minify 缺省（build=true / dev=false）
- **用户覆盖**可改 minify（`--minify` / `--no-minify`）

## Goal

建立统一编译配置框架（compile configuration），让所有编译行为选项有明确的结构化位置；CLI/API 收敛到这个结构；mode 提供预设；minify/sourcemap/esTarget 硬编码消除。

## Non-goals

- 不接入 platform 枚举（CF-2 `platform-abstraction` 范围；CF-1 只做字段占位）
- 不统一 ES target 值（CF-3 独立处理产物变化）
- 不做 watch API 化（CF-4）
- 不新增配置文件（`dimina.config.js` 将来按需）
- 不改 `build()` API 签名（向后兼容）
- 不把 API-only 选项暴露为 CLI（stages/seedPath 等保持 API-only）

## Scope

**首版**（核心框架 + 硬编码消除，不动 CLI/bin）：

- `fe/packages/compiler/src/common/compile-config.js`（新增：compile configuration 结构、合并链、mode preset）
- `fe/packages/compiler/src/index.js`（options 合并进 config，传给 stage/worker）
- `fe/packages/compiler/src/core/logic-compiler.js`（esTarget/minify 从 config 读取）
- `fe/packages/compiler/src/core/view-compiler.js`（同上）
- `fe/packages/compiler/src/core/style-compiler.js`（如涉及）
- `fe/packages/compiler/__tests__/`（config 解析、CLI⊆API、dev minify 规格）

**CLI 接入**（在 CF-4 `watch-api` 完成后，同一 bin 文件上接入，避免 merge 冲突）：

- `fe/packages/compiler/src/bin/index.js`（`--minify`/`--no-minify`）
- `fe/packages/compiler/src/bin/dev.js`（`--minify`；mode=dev preset）

明确不改：
- `fe/packages/render` / `fe/packages/container-sdk`（运行时行为）
- renderer registry（A4 范围）
- dev server / HMR / ws 协议（A2/A3 范围）
- platform 枚举接入（CF-2 范围）
- ES target 值统一（CF-3 范围）
- watch 编排重构（CF-4 范围）

## Deliverables

- compile configuration 统一结构（esTarget/minify/sourcemap/platform/mode）
- 配置合并链：CLI > API options > mode preset > platform defaults > 内部缺省
- minify 硬编码消除 + mode 缺省（build=true/dev=false）+ CLI `--minify`/`--no-minify`
- sourcemap CLI flag 收敛进结构（行为等价）
- ES target 硬编码消除（per-stage 值保持现状，不做统一）
- dev 默认不 minify（行为变更，独立验证）
- sourcemap 隐式跳过 minify 逻辑显式化

## 首版边界

**收敛的配置项**（首版做）：

| 项 | 变更 | 行为影响 |
| --- | --- | --- |
| minify | 硬编码→配置 | dev 缺省变 false（行为变更） |
| sourcemap | CLI flag→结构 | 无变化 |
| esTarget | 硬编码→配置 | 无变化（per-stage 保持现值） |
| mode | 新增 preset | dev 不 minify |
| platform | 字段占位（枚举 CF-2 接入） | 无变化 |

**不收敛**（保持 API-only，将来按需）：

| 项 | 现状 | 理由 |
| --- | --- | --- |
| stages/affectedEntries/seedPath/dependencyGraph | API options | 工具链内部机制，CLI 不暴露 |
| fileTypes | API options | 项目级配置，将来可走配置文件 |
| prepareConfig/prepareNpm | API options | 增量控制，watch plan 使用 |
| sourcemap 详细度 | 内部硬编码 | 将来扩展 |

## Readiness gaps

- 已冻结（2026-09-08）：CLI 克制原则、CLI⊆API、mode preset、dev 不 minify、per-stage esTarget 首版不变
- 待 Readiness Review 确认文档完整性

## Closure conditions

- 所有 MUST Acceptance 通过并有证据
- 缺省 build 产物逐字节一致（diff=0）
- dev 产物 minify 差异有验证
- STATUS、导航、归档一致
