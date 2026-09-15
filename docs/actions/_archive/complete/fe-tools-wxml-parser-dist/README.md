# FE Tools WXML Parser Dist

- Action: `fe-tools-wxml-parser-dist`
- Status: `complete`
- Updated: 2026-09-15（授权 `in_progress`；基线 `dd2cb451`；R2/R3 Readiness 已 pass）
- Status authority: [Action Status](../../../STATUS.md)
- 前置上下文：[`fe-tools-wxml-bridge`](../fe-tools-wxml-bridge/README.md)（napi 桥 + SpanView；parser/binding 分 crates 按 oxc 先例）；[`fe-tools-wxml-refactor`](../fe-tools-wxml-refactor/README.md)（`WXML_PARSER` 默认 **napi**——放大分发缺口）；`fe/tools/crates/dimina-wxml-parser`（483 tests，swc 类型库 + `swc_ecma_parser`）
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

### 病症一（P-WX1）：单平台 `.node` 入库 + CI 无构建——CI 必红

- `fe/tools/wxml-parser-napi/index.node` 是 **Mach-O arm64（2.7M）且被 git 追踪**——单平台二进制产物入库；
- `.github/workflows/fe-tests.yml` 跑 **ubuntu-latest（x64）**，**无任何 cargo/napi 构建步骤**；
- `WXML_PARSER` 默认 `napi`（D-WR-2）→ 所有 view 编译测试走 napi；
- **实证（2026-09-15）**：本地临时移除 `.node` 复现 CI 状况——`bundler-session.spec` 编译视图/编译项目全炸：`[wxml] @dimina/wxml-parser-napi native module not built`。ubuntu 上加载 arm64 Mach-O 同样失败 → **CI 当前必红**（高置信，P0 首步在 CI 侧确认）；
- 团队 x64 机器（linux/mac intel）同样无法使用 napi parser。

### 病症二（P-WX2）：手写薄包无平台解析——多平台态无法表达

`wxml-parser-napi/index.js` 是 `require('./index.node')` 单文件直连（延迟抛错）。无平台检测、无 `optionalDependencies` 子包结构——发布态无法按平台挑产物。

### 病症三（P-WX3）：napi binding 无发版故事

`@dimina/bundler` 带 `publishConfig: npmjs.org` + release 脚本（会发布）；其依赖 `@dimina/wxml-parser-napi`（workspace:*）需要 npm 上的多平台子包 + `optionalDependencies` 自动选择，当前不存在。

## 讨论收敛（2026-09-15）：为什么是 A（napi 矩阵）而非 wasm

| 维度 | A：napi 多平台矩阵 | B：自建 wasm（wasi/component） |
| --- | --- | --- |
| 性能 | 最优（零改动） | 2–5x 相对开销（编译期 ms 级绝对值小，但无净收益） |
| 调试 | panic 真实 stack（私有 toolchain 迭代频繁，值钱） | trap 难调试 |
| 工具链 | 一次性 CI 配置 | component model 演进中，持续跟随税 |
| 演进自由 | parser crate 不动，只换 binding——未来加 B 是加法 | — |
| 独占收益 | — | 浏览器复用（**当前无消费者**） |

**概念澄清（拒绝直接套 swc wasm plugin）**：swc 的 wasm plugin（`jsc.experimental.plugins`）是 **JS/TS transform 宿主机制**（插件收 `Program` AST 的 visitor），假设宿主是 swc 编译管线；我们是独立 WXML parser（自定义语言），只复用 swc 类型库/基础设施——我们是宿主不是插件，机制不适用。B 若做 = 自建 wasm target（@swc/wasm 先例证明 swc 全家含 `swc_ecma_parser` 可编 wasm，无硬阻塞），记观察项。

## Goal

1. **P0（止血）**：fe-tests.yml 增 Rust/`napi build --platform` + cargo cache；`*.node` 退 git；**`index.js` 最小加载** `index.<platform>.node`（与 build 同交付）→ CI 恢复绿。
2. **P1（分发正规化）**：napi-rs 五平台 matrix；主包 `optionalDependencies` 子包化；`index.js` **完整双态**（本地 `index.<platform>.node` → `binding.js` 子包 → 抛错）；发版流打通。

## Non-goals

- wasm/web 端 target（观察项，另立）
- parser 语义/性能改动（本门纯分发面）
- musl/alpine、freebsd 等长尾平台（有真实需求再补）
- `fe/packages` 触碰

## 边界

```text
本 Action:  P0 CI 止血 + 最小平台后缀加载 → P1 napi 矩阵 + 子包化 + 完整双态 + 发版流
观察（TODO）: B 路线 wasm——触发条件 = web 端 WXML parse 消费需求落地
```

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **P0 止血** | CI 增 Rust 构建 + cache；build=`napi --platform`；最小加载 `index.<platform>.node`；`*.node` 退 git | CI 全绿（run 锚定）；本地 `pnpm build` → vitest 绿 |
| **P1 矩阵** | 5 平台 matrix；`optionalDependencies` 子包；完整双态；发版流 | 各平台可加载；本地/发布双路径实证；dry-run 或首版发布 |

## 决策记录（已拍板 · 2026-09-15）

| ID | 决策 | 备注 |
| --- | --- | --- |
| **D-WX-1** | A 路线（napi 矩阵）；wasm 记观察项（触发=浏览器端 parse 消费需求）；swc wasm plugin 机制不适用（概念澄清入档） | 讨论收敛表见上 |
| **D-WX-2** | 平台集 = 主流 5：`darwin-arm64` / `darwin-x64` / `linux-x64-gnu` / `linux-arm64-gnu` / `win32-x64-msvc`；musl 后补 | napi-rs build-action 按需开 |
| **D-WX-3** | `index.js` 双态：本地优先 `index.<platform>.node`（`pnpm build --platform`）；发布态走 `binding.js` → `optionalDependencies` 子包 | oxc 同款；P0 仅最小加载（无子包回退） |
| **D-WX-4** | 全部 `*.node` **退出 git 追踪**（`.gitignore`；含旧 `index.node` 与 `index.*.node`）——本地/CI 由 `pnpm build` 产出 | 消除二进制入库 |
| **D-WX-5** | cargo cache 键 = `fe/tools/crates/Cargo.lock` hash；CI 增量构建 | 首次全量分钟数记录入 validation |
| **D-WX-6**（拍板） | bundler **会发布 npm** → P1 全深度：5 平台子包 + `optionalDependencies` + 发版流 | 原待定 ① |
| **D-WX-7**（拍板） | `*.node` **P0 即退 git**（`git rm --cached` + `.gitignore`）；dev 前置 = Rust + `pnpm build`；P0 CI 构建让 x64 立即可用 | 原待定 ②——不等 P1 |
| **D-WX-8**（拍板） | CI 时长**无预算** → 单 job 内构建（不拆 matrix job、不做产物 artifact 缓存）；cargo cache 照做（D-WX-5 保留，便宜且标准） | 原待定 ③ |
| **D-WX-9**（R1-F1） | **三文件分层**：`index.<platform>.node`（CLI 产，退 git）+ `binding.js`（CLI glue，ESM，入库）+ `index.js`（手写：P0 最小加载 / P1 完整双态 + `parseWxmlSpanView`）；build = `napi build --platform --release --js binding.js --format esm --no-dts --manifest-path ../crates/Cargo.toml` | `--js/--no-js` 仅 `--platform` 下有效；`--format` 默认 cjs 与 `type:module` 冲突 |

**平台三元组映射（P0 最小加载 / D-WX-2，与 napi-rs 命名一致）**：

| `process.platform` + arch | `index.<platform>.node` |
| --- | --- |
| `darwin` + `arm64` | `darwin-arm64` |
| `darwin` + `x64` | `darwin-x64` |
| `linux` + `x64` | `linux-x64-gnu` |
| `linux` + `arm64` | `linux-arm64-gnu` |
| `win32` + `x64` | `win32-x64-msvc` |

## 待定

无（D-WX-1..9 已全拍板）。

## Status / 授权

- 当前 **`in_progress`**（2026-09-15 授权）：Readiness R4 **pass**；实施基线 **`dd2cb451`**（授权前 HEAD；本提交含 R2/R3 文档修）。
- 执行允许：按 plan 从 **P0** 开工（build `--platform` + 最小加载 + 退 git + CI）；P1 另序推进。
- 残留：F-R2-004（P1 接 ESM `binding.js` 加载方式）P1 step3 前冻。

## 闭合条件

- P0/P1 交付；A-\* 全 pass；CI 恢复绿且增量时长达标
- 双态解析实证（本地 dev / 子包发布态）；发版流演练
- A/B 对比结论 + wasm 观察项回流 TODO/architecture-notes
- STATUS/归档一致；`fe/packages` 零污染

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | 初稿：CI 破损实证（本地模拟 `.node` 缺失复现）→ P0 止血 + P1 矩阵两门；A/B 路线对比收敛（A 优先；swc wasm plugin 概念澄清入档）；D-WX-1..5 建议；3 项待定 |
| 2026-09-15 | **待定拍板 → D-WX-6..8**：bundler 会发布 npm（P1 全深度）；`.node` P0 即退 git（dev 前置 = Rust + pnpm build）；CI 无时长预算（单 job 构建，cache 照做）。**待定清空** |
| 2026-09-15 | **Readiness 五件套成稿，升 `ready`**：R-WX0..5 + design（现状锚定含 build script darwin 专属硬编码 `.dylib` 实证 / P0 napi CLI 迁移 / P1 napi-rs 标准流 + 双态 index.js）+ plan（P0 独立可交付）+ A-WX0..5 + P-WX00..07。实施未授权 |
| 2026-09-15 | **P1 交付**（`7e43f175`）：napi/napi-derive → 3（binding 根因修复）；glue 定为 `binding.cjs`（CJS——ESM glue 破坏延迟抛错契约）；完整双态 + `_resolveNative()` 钩 + 4 单测（584/584）；五 targets/去 private/files 定稿；npm 五子包模板；`napi-release.yml`（tag 触发五平台 matrix）；prepublish dry-run 连通实证 |
| 2026-09-15 | **环境发现**：fork（foolishchow/dimina）Actions 未启用（零 runs + dispatch 403）→ P-WX01 blocked-on-env；另证 1 crate 测试失败为 **pre-existing**（基线同败，`<template name is>` → UnclosedTag，与 napi3 无关） |
| 2026-09-15 | **Close**：P-WX01 声明 Uncovered（fork Actions 未启用，blocked-on-env——以 didi 侧回流 PR 运行为准）；A-WX0..5 闭合核验；升 `complete` 归档 |
| 2026-09-15 | **Review R1（F1–F7）收敛**：F1 🔴 `--platform` 语义错位 + glue 覆盖风险 → **D-WX-9 三文件分层**（路线乙，design §2.1/§3.2 重写）；F2 显式 `dtolnay/rust-toolchain@stable`；F3 darwin-x64 走 arm64 runner + `--target` 交叉（Intel runner 退役）；F4 x64-linux 首跑 residual + `WXML_PARSER=cheerio` 应急阀；F5 P-WX00 措辞限定（win 归 P1）；F6 双态单测落点 + `_resolveNative()` 钩；F7 `prepublish` 命令形态 P1 校准 |
| 2026-09-15 | **R2 F-R2-001..003**：P0 纳入最小加载 `index.<platform>.node`（与 `--platform` build 同交付）；R-WX3/P-WX02 改平台后缀口径；gitignore=`*.node` |
| 2026-09-15 | **R3 文案**：Goal/产品门/决策表标题对齐；五平台三元组映射表入 README |
| 2026-09-15 | **Readiness R4 pass** → 授权 **`in_progress`**（基线 `dd2cb451`） |
| 2026-09-15 | **P0 实施中**：napi CLI `--platform` + 最小加载 + `*.node` 退 git + fe-tests Rust 步骤；本地 580/580；`binding.js` 因 derive2/CLI3 typedef 路径差未出（P1 前对齐） |