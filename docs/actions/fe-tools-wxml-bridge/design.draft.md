# Design draft — fe-tools-wxml-bridge

Status: **冻结 v1（2026-09-14）** — D-WB-1..6 已拍板；实施中改设计须修订本档并同步 requirements / acceptance

## 目标形状

```text
WXML source ─dimina-wxml-parser(napi)─> SpanView ──> view inMap 构建（Rust 真 span）
              (Rust, 483 tests)          (JS 侧消费)        (替代 1:1 猜射)
```

- **桥梁不变式**：JS 侧永不直接吃 crate struct；只吃 SpanView（span+raw+结构）。`sourceFile` 由调用方传入并透传。

## SpanView 形状（D-WB-4 · PARSING-SPEC §0.4 同构）

```js
// parseWxmlSpanView(source, sourceFile?) → { document: SpanDocument, sourceFile? }
SpanDocument { body: SpanNode[], sourceFile? }
SpanNode =
  | { type: 'element', name, attrs: SpanAttr[], directives?: …, children: SpanNode[],
      span: {start,end}, selfClosing, raw: 节点原文 }
  | { type: 'text', value: { kind:'static'|'expr'|'template', raw, parts?(对于模板) },
      span, raw }
  | { type: 'comment', text, raw, span }
  | { type: 'wxs' | 'templateDef' | 'templateRef' | 'import' | 'include' | 'slot',
      …字段按 docs/wxml 形状（Option 字段 ↦ undefined）, span, raw }
SpanAttr { name, value?: { kind, raw, span(值体) }, span /* 含 = 与引号 */, raw }

span = { start, end }   // 半开 byte 偏移（D-WIR-5 / PARSING-SPEC §0.4 一致）
```

**关键取舍**：W1 只要 span/raw/结构 → napi 返回值走**紧凑 JSON**（非 napi class 树）——绑定工作量降到「crate → JSON 序列化」，span 语义无损；后续需要深度消费时再加 napi struct 面。**不含 `.expr`/`.object`。**

## napi 工程形态（D-WB-3）

- 独立子 crate `crates/dimina-wxml-parser-napi`（oxc-parser 同款「parser + napi 分 crates」）：
  - `napi-rs` bindgen；`parseWxmlSpanView` 输出 JSON（SpanView 面上限）；
  - dev 本地 `napi build`（`@napi-rs/cli`）→ `.node`；
- JS 侧薄包 `fe/tools/wxml-parser-napi/package.json`（pnpm workspace 成员 `@dimina/wxml-parser-napi`）：
  - `scripts.build = napi build`；`main` 加载 `.node`；
  - 未构建时 `require` 报 `[wxml] node 未构建`（构建指引）。
- 预编译分发不在本门（R-WB4）。

## W2 inMap 构建策略

```text
view 渲染路径（vueBackend/编排壳）：
  tpl（组装后 Vue 模板串）─行/列→ SpanView 位置？
  ── 建“生成位置 → (sourceFile, span.start) ”两层映射：
     ① html() 行结构 ↔ SpanView 节点（load 后真实 span）
     ② transHtmlTag 行偏移（列级近似，行数不增——若今有增行，标记为残余）
  inMap = 逐生成行/列 → 原 {file, line(由 span→行派生), column}
```

- **行级不变量**：无 include/import 页面映射目标 = 今日（1:1 各生成行 → 主文件同行）；修复后 include 页不再错位。
- 抽查集：base 工程含 include/import 的页面清单（W2 实施时用 `rg <include|<import` 枚举，工作列表入 acceptance）。

## 决策记录（已拍板 · 2026-09-14，全部照建议）

| ID | 决策 |
| --- | --- |
| D-WB-1 | 桥 = napi-rs（CLI-JSON 否决） |
| D-WB-2 | D-WIR-1 修订：Rust parser 作桥接组件进 tools（oxc 先例；单 crate 边界） |
| D-WB-3 | Rust 归属 `fe/tools/crates/` workspace；napi 独立子 crate + JS 薄包 |
| D-WB-4 | SpanView = 紧凑 JSON（span/raw/结构；无表达式负载；sourceFile 透传） |
| D-WB-5 | docs 主从：仓库 `docs/wxml/` 真源；crate `docs/` 冻结快照 |
| D-WB-6 | W2 验证契约：code 严格 diff=0 + 行级不变量 + 更准断言（抽查集）+ 列级新增 |

## 已确认设计输入（引用，不重定）

`docs/wxml` 七份规范（PARSING-SPEC §0.4 span 契约 / AST-TYPES 形状 / EXPRESSION-SPEC）· wxml-ir 缝（Document/loc/sourceTexts）· oxc-parser（Rust-via-napi 先例）· D-WIR-1（本门修订）· 结构判据纪律（模式名只作词汇）

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | v1 成稿：SpanView 形状、napi 工程、W2 inMap 策略、D-WB-1..6 拍板 |