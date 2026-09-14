# Requirements — fe-tools-wxml-ir

Status: **draft（2026-09-14）** — Readiness 已过；随 Action `ready` 冻结需求面

## R-WIR0（MUST）中立 Document

`@dimina/bundler` 模板路径须能产出可单测的 **Document**（JS 对象树），节点至少能区分：普通元素、文本、以及 template 定义/引用、wxs、import、include、slot（与 [`WXML-AST-TYPES`](../../wxml/WXML-AST-TYPES.md) 分类对齐到「可指认」，字段级允许分期）。

## R-WIR1（MUST）阶段不熔断

- **parse** 不得读盘展开 import/include，不得在 parse 内完成 Wxs 编译；
- **load** 拥有路径解析、读盘、图边、展开、Wxs 编译、component-host 等（见 technical-design 归属表）；
- **Backend** 消费 LoadedGraph / Document；**不得**以「原始 WXML → cheerio → 产物」为权威路径；
- cheerio/htmlparser2 **仅**作 parse 投影工具（D-WIR-6 + technical-design 不变量）。

## R-WIR2（MUST）Backend 可插

- 实现 technical-design 所冻的 **WxmlBackend** 接口与 `registerBackend` / `getBackend`（同 id **抛错**）；
- `vue` 为 backend₀；生产路径仅 `vue`；至少再注册测例桩（如 `stub`），证明挂点真实。

## R-WIR3（MUST）行为 0

- 基线服从 **D-WIR-9**（**无**差分白名单）：
  - `fe/tools/bundler` 全量 vitest（`--no-file-parallelism`）；
  - `examples/miniprogram/base` nomap + sourcemap 相对实施前快照 `diff -rq` = 0；
- 命令见 [validation](validation.md) P-WIR00..02。

## R-WIR4（MUST）正交

`compiler/wxml/**`（parser / Document / load）**不得**依赖 `platform === 'native'|'web'`；Backend 选择服从 **D-WIR-8**。

## R-WIR5（MUST）范围与语言

- 实现限于 **JS**（`fe/tools` / `@dimina/bundler`）；
- 不并入 E7、Listr、PS3、S14、真第二生产 renderer。

## R-WIR6（MUST）定位与 sourcemap

- 参与映射的节点带 **D-WIR-5** `loc`；跨文件可选 `sourceFile`；
- sourcemap 开启时质量不低于今日（与 P-WIR02 一并对拍）；
- 禁猜行权威路径；load 后可追溯来源。

## R-WIR7（MUST）parse / 表达式分期

- parse 服从 **D-WIR-6**；表达式服从 **D-WIR-7**；不得以此阻塞 Backend 缝与行为 0。

## R-WIR8（MUST）阶段归属可审查

实现须可对照 technical-design **归属表**指认：Import/Include 展开、Wxs 编译、component-host、slot/Vue 降级等落在约定阶段（P-WIR07）。

## R-WIR9（SHOULD）诊断可定位

parse/load（及 registry 配置错误）的失败路径应使用 **`[wxml]`** 前缀，并尽量带上 `sourceFile` 与 `loc`（Experience-Review §7）；不得依赖无位置的裸字符串作为唯一诊断。

## Non-requirements

- 一次对齐 `docs/wxml` 全部 Span / 表达式容器契约
- 真手写扫描器；表达式 Accept/Reject 全量
- 生产级第二模板后端；公开插件 API
- S14 stage-channel 载荷扩展
- 微信真源语义重标定；`dimina-cli` 预览 / 真机 / 视觉（见 validation Uncovered）
