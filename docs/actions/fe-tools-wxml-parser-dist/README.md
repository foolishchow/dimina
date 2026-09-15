# FE Tools WXML Parser Dist

- Action: `fe-tools-wxml-parser-dist`
- Status: `draft`
- Updated: 2026-09-15（讨论收敛：A 路线（napi 矩阵）优于 wasm；CI 破损实证在案；待定 3 项）
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-wxml-bridge`](../_archive/complete/fe-tools-wxml-bridge/README.md)（napi 桥 + SpanView；parser/binding 分 crates 按 oxc 先例）；[`fe-tools-wxml-refactor`](../_archive/complete/fe-tools-wxml-refactor/README.md)（`WXML_PARSER` 默认 **napi**——放大分发缺口）；`fe/tools/crates/dimina-wxml-parser`（483 tests，swc 类型库 + `swc_ecma_parser`）
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

1. **P0（止血）**：fe-tests.yml 增加 Rust 构建（`cargo build -p dimina-wxml-parser-napi --release` + `napi build` 或等价）+ cargo cache → CI 恢复绿。
2. **P1（分发正规化）**：napi-rs 多平台 matrix（主流平台）；`@dimina/wxml-parser-napi` 子包化（`optionalDependencies` 自动选择）；`index.js` 双态解析（本地 dev 优先 workspace 现场 `.node`，发布态走子包）；发版流打通。

## Non-goals

- wasm/web 端 target（观察项，另立）
- parser 语义/性能改动（本门纯分发面）
- musl/alpine、freebsd 等长尾平台（有真实需求再补）
- `fe/packages` 触碰

## 边界

```text
本 Action:  P0 CI 止血 → P1 napi 矩阵 + 子包化 + 双态解析 + 发版流
观察（TODO）: B 路线 wasm——触发条件 = web 端 WXML parse 消费需求落地
```

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **P0 止血** | CI 增 Rust 构建步骤 + cargo cache（key=Cargo.lock） | CI 全绿（本地模拟已证现状必红）；增量构建时长可接受（记录数字） |
| **P1 矩阵** | matrix 构建 N 平台；子包 `optionalDependencies`；`index.js` 双态解析；发版流 | 各平台产物存在且可加载；本地 dev（`pnpm build`）与发布态（子包）双路径验证；发版演练或等价 dry-run |

## 决策记录（建议 · 2026-09-15，待拍板）

| ID | 建议 | 备注 |
| --- | --- | --- |
| **D-WX-1** | A 路线（napi 矩阵）；wasm 记观察项（触发=浏览器端 parse 消费需求）；swc wasm plugin 机制不适用（概念澄清入档） | 讨论收敛表见上 |
| **D-WX-2** | 平台集 = 主流 5：`darwin-arm64` / `darwin-x64` / `linux-x64-gnu` / `linux-arm64-gnu` / `win32-x64-msvc`；musl 后补 | napi-rs build-action 按需开 |
| **D-WX-3** | `index.js` 双态解析：本地 dev 优先加载 workspace 现场 `.node`（`pnpm build` 产出）；发布态走 `optionalDependencies` 子包（平台检测） | oxc 同款 |
| **D-WX-4** | `index.node` **退出 git 追踪**（`.gitignore`）——本地由 `pnpm build` 产出、CI 由构建步骤产出 | 消除二进制入库；过渡策略见待定 ② |
| **D-WX-5** | cargo cache 键 = `fe/tools/crates/Cargo.lock` hash；CI 增量构建 | 首次全量分钟数记录入 validation |

## 待定（Readiness 前需确认）

1. **bundler 是否真发布 npm**：影响 P1 深度（若永不发布，P1 退化为「CI 可构建 + 本地双态」即可，子包化/发版流可砍）
2. **`.node` 退 git 的过渡策略**：P0 时即退（团队 clone 后需一次性 `cargo build`——Rust 工具链成为 dev 前置）vs P1 子包就绪后再退（期间 x64 仍不可用）
3. **CI 时长预算**：swc 依赖树全量编译分钟数（cache 命中前）——超出预算则考虑构建产物 artifact 缓存或 matrix 拆 job

## Status / 授权

- 当前 **`draft`**：三病症 + A/B 对比 + P0/P1 门 + D-WX-1..5 建议在案；**待定 3 项拍板后补 Readiness 五件套**
- 未授权实施

## 闭合条件

- P0/P1 交付；A-\* 全 pass；CI 恢复绿且增量时长达标
- 双态解析实证（本地 dev / 子包发布态）；发版流演练
- A/B 对比结论 + wasm 观察项回流 TODO/architecture-notes
- STATUS/归档一致；`fe/packages` 零污染

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | 初稿：CI 破损实证（本地模拟 `.node` 缺失复现）→ P0 止血 + P1 矩阵两门；A/B 路线对比收敛（A 优先；swc wasm plugin 概念澄清入档）；D-WX-1..5 建议；3 项待定 |