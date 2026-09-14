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

**序列化路径（D-WB-7）**：vendored crate 加 **serde derives**（仅 span/raw 面类型；`ExprContainer.expr` 等 swc 表达式类型不序列化/丢负载）。这是 **vendored 代码修改**——VENDOR.md 记入「vendored modification」并列入同步注意（重随上游时需重放）。**兜底（F20）**：若 `#[ast_node]` 宏与 `#[derive(Serialize)]` 冲突或序列化面比预期宽，改**手写 serializer**（仅遍历 span/raw 面，天然排除表达式负载）——二选一在 W1 首步骤定，可测锚：SpanView 输出不含 swc 表达式字段。

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
view 渲染路径（vueBackend/编排壳）——**双 inMap 调用点均覆盖**：
  A. :745 主文档 inMap（processedTpl）
  B. :531 templateModuleRender inMap（tm.sourceInfo.startLine → SpanView 真定位；模板定义含从 include/import 文件收集者）
  tpl（组装后 Vue 模板串）─行/列→ SpanView 位置？
  ── 建“生成位置 → (sourceFile, span.start) ”两层映射：
     ① html() 行结构 ↔ SpanView 节点（load 后真实 span）
     ② transHtmlTag 行偏移（列级近似，行数不增——若今有增行，标记为残余）
  inMap = 逐生成行/列 → 原 {file, line(由 span→行派生), column}
```

- **行级语义正确（不变量）**：映射行目标 = 真实 {file,line}；今日 1:1 猜射仅为对照基线（无 include 页若行结构保持则自然一致）。1:1 猜射对无 include 页也可能错（transHtmlTag 重排行），硬断言"= 今日"会卡死正确修复（F14）。
- **实证决策门（F14）**：W2 首步在 base 无 include 页跑行保持率探针；若 transHtmlTag 对简单页保持行结构 → 不变量取"等于今日"硬形态（回归价值更高）；否则取"语义正确 + 差异观测"。两形态都不影响 include 页修复本身。
- 抽查集：base 工程含 include/import 的页面清单（W2 实施时用 `rg <include|<import` 枚举，工作列表入 acceptance）。

## 决策记录（已拍板 · 2026-09-14，全部照建议）

| ID | 决策 |
| --- | --- |
| D-WB-1 | 桥 = napi-rs（CLI-JSON 否决） |
| D-WB-2 | D-WIR-1 修订：Rust parser 作桥接组件进 tools（oxc 先例；单 crate 边界） |
| D-WB-3 | Rust 归属 `fe/tools/crates/` workspace；napi 独立子 crate + JS 薄包 |
| D-WB-4 | SpanView = 紧凑 JSON（span/raw/结构；无表达式负载；sourceFile 透传） |
| D-WB-5 | docs 主从：仓库 `docs/wxml/` 真源；crate `docs/` 冻结快照 |
| D-WB-6 | W2 验证契约：code 严格 diff=0 + 行级语义正确不变量（+ 观测；行保持探针后升级硬形态，F14）+ 更准断言（抽查集）+ 列级新增（双 inMap 点） |
| D-WB-7 | serde derives（vendored 修改，VENDOR 记）→ 紧凑 JSON；sourcesContent 覆盖所有映射文件 |

## 已确认设计输入（引用，不重定）

`docs/wxml` 七份规范（PARSING-SPEC §0.4 span 契约 / AST-TYPES 形状 / EXPRESSION-SPEC）· wxml-ir 缝（Document/loc/sourceTexts）· oxc-parser（Rust-via-napi 先例）· D-WIR-1（本门修订）· 结构判据纪律（模式名只作词汇）

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | v1 成稿：SpanView 形状、napi 工程、W2 inMap 策略、D-WB-1..6 拍板 |
| 2026-09-14 | Review R1 F1/F4/F5：W2 双调用点（:745+:531）；D-WB-7（serde 路径 + sourcesContent） |