# FE Tools WXML Bridge

- Action: `fe-tools-wxml-bridge`（暂名，转正见待定 ①）
- Status: `draft`
- Updated: 2026-09-14（sourcemap 病症实锚 + crate 入树验证后初稿）
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-wxml-ir`](../_archive/complete/fe-tools-wxml-ir/README.md)（缝已交付；D-WIR-1「仅 JS」约束由本门修订）；`docs/wxml/` 七份规范；`fe/tools/crates/dimina-wxml-parser`（Rust parser，483 tests 绿）
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

**Sourcemap 缺陷（bug 级，非增强）**：view/style 路径的映射是 1:1 行猜射（`sourcemap.js:71-88`——generated 第 N 行 → original 第 N 行，零内容感知、零列）：

- view 的 `inMap` 是 **include/import 展开后的组装模板**对**主文件**做 1:1（`view-compiler.js:745`）——include 内联 N 行后，主文件后续所有行**错位 N 行**（错误定位，非质量差）；
- style 同样依赖 `createLineSourcemap` 链（`style-compiler.js:398,441`）；
- 列恒为 0；跨文件内容无 `sourceFile` 归位；
- logic 路径（oxc AST + MagicString）是唯一健康路径——**Rust parser via napi 进 JS 工具链是本仓库既有先例**（oxc-parser）。

**已到位的资产**：

| 资产 | 状态 |
| --- | --- |
| Rust parser `dimina-wxml-parser`（2645 行，swc 基座） | ✅ 入树 `fe/tools/crates/`（Cargo workspace 就绪，**483 tests 绿**）；API `parse_wxml` / `parse_wxml_expression` / `parse_template_data` |
| 规范七份（AST-TYPES 1553 / PARSING-SPEC 757 / EXPRESSION 653 / …） | ✅ `docs/wxml/`（半开 byte span 契约 §0.4 与已交付 Document.loc 同构；Value 三态/TemplatePart/指令分离） |
| wxml-ir 地基（Document/loc/sourceTexts/缝） | ✅ 已归档（`a5262a53`），`_$` 投影句柄留有换 parser 的接缝 |
| **缺口** | ❌ 无 napi/serde 绑定——JS 侧消费需自建 |

## Goal

1. **桥**：napi-rs 绑定 `dimina-wxml-parser` 进 JS 工具链（对齐 oxc-parser 先例），首片交付 **SpanView**（span + 结构 + raw，不含表达式 AST 负载）
2. **sourcemap 修复**：view 路径 include/import 跨文件归位（行级正确 + 列级可用），消费真 span 替代 1:1 猜射
3. **验证契约**：code 严格 diff=0；**map 允许变化且必须更准**（新质量断言框架）；不变量——无 include/import 页面 map 与今日一致

## Non-goals

- 不换 cheerio 投影为真 parser（W3+ 按需；wxml-ir 的 Document 契约不动）
- 不消费表达式 AST（`.expr`/`.object` 负载；Accept/Reject 维持后置）
- 不动 logic 路径；不做 style 切缝（S13 剩余另议，映射修复可顺带）
- 不做 formatter/lint/IDE；不向 didi 推送
- 不引入预编译多平台二进制分发（本地 cargo build；CI 需 Rust 工具链——记伞 CI gap）

## 边界

```text
本 Action:  Rust parser --napi--> JS SpanView --> sourcemap 归位（bridge + 首个消费者）
wxml-ir(已归档): 缝/Document 契约（不变）；W3+ 换 parser 属后续 Action
B 轨道(deferred): Rust 宿主（本门仅桥接单 crate，非工具链 Rust 化）
```

## 产品门（草案）

| 门 | 内容 | 验收判据（草案） |
| --- | --- | --- |
| **W0** 入树基建 | VENDOR.md（溯源 + 同步责任）；docs 主从定界；gitignore/workspace 正式化；**D-WIR-1 修订入档**（Rust-via-napi 对齐 oxc 先例，架构注记）；`.node` 构建脚本 | crate 在 workspace 构建 + 483 tests 绿；VENDOR/docs/gitignore 在档；修订决策可溯 |
| **W1** napi 桥 + SpanView | napi 子 crate（`dimina-wxml-parser-napi`，暂名）暴露 `parseWxmlSpanView(source, sourceFile?)`：Document 树 + 半开 span + sourceFile + raw（丢 `.expr`/`.object`）；JS 侧加载 `.node` | JS 单测：SpanView 与 crate 测试同源用例对拍（span/raw/结构三一致）；性能基准记录 |
| **W2** sourcemap 修复 | view 路径 `inMap` 改由真 span 构建（跨文件行归位 + 列可用）；include/import 场景修复 | code 严格 diff=0；**map 质量断言**（include 页抽查：生成行 → 正确 {file,line}；无 include 页 map **与今日一致** 不变量）；消融 |
| **W3+** | 换投影 / 表达式消费 / style 切缝 | 按需另立（不在本门） |

## 已拍板决策（2026-09-14，用户确认）

| ID | 决策 |
| --- | --- |
| **D-WB-1** | 桥形态 = **napi-rs**（CLI-JSON 方案否决） |
| **D-WB-2** | **D-WIR-1 修订**：允许 Rust parser 作为桥接组件进 tools 工具链（对齐 oxc-parser 先例；边界=单 crate 桥，非工具链 Rust 化） |
| **D-WB-3** | Rust 归属 = `fe/tools/crates/` Cargo workspace（后续 Rust 组件同驻） |

## 待定（Readiness 前需确认）

1. **Action 名**：`fe-tools-wxml-bridge`（建议）/ `spanbridge` / `wxml-napi`
2. **SpanView 形状**：字段清单（span 三层：node/attr/expr-body？raw 含否 `{{}}` 定界？sourceFile 传递）——W1 design 冻结项
3. **napi 工程形态**：独立子 crate（建议，oxc-parser 同款）vs feature 开关；npm 包装（`@dimina/wxml-parser`？）与 `.node` 加载策略（dev 本地构建）
4. **docs 主从**：crate `docs/` vs 仓库 `docs/wxml/`（建议：仓库为真源、crate docs 改指针——Action 体系引用仓库路径）
5. **W2 map 质量断言操作化**：抽查用例集（base 工程含 include 的页面清单）与「更准」的判定口径
6. **VENDOR 溯源补全**：源工作区路径/commit（用户提供）

## Status / 授权

- 当前 **`draft`**：病症实锚 + 资产验证 + 三决策入档；待定 6 项拍板后补 Readiness 五件套
- 未授权实施

## 闭合条件（草案）

- W0–W2 交付；A-\* 全 pass；消融（桥拔除 → SpanView 测试失败；span 断供 → map 断言失败）按 Experience §6；
- map 质量断言框架成文（code diff=0 + map 变准 + 无 include 不变量）；
- D-WIR-1 修订回流入 architecture-notes / wxml-ir 归档注记；
- VENDOR/docs 主从/gitignore 在档；STATUS/归档一致；`fe/packages` 零污染。

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | 初稿：sourcemap 病症实锚（1:1 猜射/include 错位）；crate 入树 + workspace + 483 tests 验证；D-WB-1..3 拍板；6 项待定 |
