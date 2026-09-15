# Technical Design — fe-tools-wxml-refactor

Status: **冻结 v1.3（2026-09-15）** — D-WR-1..9；F-WR-R1/R2/R3 文档修；与 requirements / plan / acceptance 同步。

## 1. 目标形状

```text
WXML source
  ├─ parser/cheerio.js ─┐
  └─ parser/napi.js   ──┴→ 标准 JS Document（Rust AST shape + JS mutable）
                              ↓
                    transform / LoadedGraph / vue backend
```

cheerio 与 napi 都必须产出同一枚举面。cheerio 是投影工具，不向 transform/backend 暴露 `_$`、`_elem` 或 cheerio API。

## 2. 标准 Document contract

字段以 `docs/wxml/WXML-AST-TYPES.md` 为真源，JS 使用可变数组：

```js
Document { span, body, sourceFile }
Element  { type: 'element', span, name, attrs: Attr[], directives: [],
           slot: null, children: [], selfClosing: false }
Attr     { span: null|Span, name, value: null|Value }
Value    { kind: 'static'|'expr'|'template', raw, span, parts? }
```

特殊节点的 `type` 为 `wxs | template-def | template-ref | import | include | slot`，各自字段按 AST contract 映射。

**null / [] / 缺字段（澄清 D-WR-5 ∩ D-WR-7）：**

- 契约字段**始终存在**（不得因 parser 能力差异省略键）。
- `null` = 有意义但当前 parser 无法提供（如 cheerio 下 attr.span）。
- `[]` = 空集合（如无 directives）。
- D-WR-5「可选层」指**值可为 null**（napi 尽量填全；cheerio 可 null），**不是**字段可缺失。
- transform **只依赖必填语义**（type/name/children/body/attrs 数组存在）；可选值有则用。

JS 可变不代表 Rust AST 可变性迁移：W2 的 replace/remove 直接操作 JS 数组。

## 3. W1：函数归位（穷举名单 · 本 Action 权威）

**计数：** view 域 wxml 相关 **24** = 本门搬迁 **23** + `transTagWxs` **1**（留 wxs 轨道，非本门）。

| 目标文件 | 函数（**W1** 逐字搬迁；本门 MUST） |
| --- | --- |
| `view/wxml/transform/index.js` | `toCompileTemplate`, `transTagTemplate`, `processIncludeConditionalAttrs`, `collectIncludedComponentTags`, `collectNewlineOffsets`, `getSourceLine` |
| `view/wxml/transform/paths.js` | `getViewPath`, `resolveTemplateDependencyPath`, `buildExtStripRegex`, `stripViewScriptExt` |
| `view/wxml/backends/vue-tools.js` | `normalizeTemplateDom`, `normalizeTemplateSyntax`, `transHtmlTag`, `transTag`, `groupDuplicateNamedSlots`, `wrapForIfScopes`, `generateSlotDirective`, `getProps`, `generateVModelTemplate`, `getDirectiveAttributeNames`, `hasForAndIf`, `getTemplateCompilerOptions`, `compileTemplateModuleRender` |

**非本门（仍计在 24 内，W1 不搬）：** `transTagWxs` → 按 layering 归 `view/wxs/`（可继续暂留 `view/index.js` 直至 wxs 归位 Action）。

来源：[`fe-tools-compiler-layering`](../_archive/complete/fe-tools-compiler-layering/README.md) 归属表；**本表为本门唯一权威**，归档表若漂移以本表 + 实施时 grep 为准并回流修订。

当前 23 个函数均为顶层定义，允许逐函数搬迁；**W1** 函数体与签名逐字保持。新模块导出函数，`view/index.js` 重新导入并继续组装现有 `ctx.tools`。模块级依赖走稳定相对路径；尚未归位的 expression/wxs/asset 辅助符号用过渡 re-export/live binding——**W1 禁止改其实现**（含仍接收 `$`）。模块加载测试覆盖 ESM worker 图，避免 TDZ。**W2** 再按 §4.2/§4.5/§4.6 改访问面与签名（含对 `transTagWxs` / `transAsses` 的薄适配）。

**W1 grep 锚定：** 上表 23 名在 `view/index.js` **无函数定义残留**；允许 `transTagWxs` 仍在 index（或已迁 wxs）；禁止要求「一切 wxml 相关符号从 index 消失」。

## 4. W2：标准形状与 cheerio 封装

### 4.1 parser 层

- `parser/cheerio.js`：cheerio load、遍历、属性解析、Value 分类、特殊节点分类、Document 序列化/结构操作。
- `parser/napi.js`：SpanView → 标准 Document 的递归构造；不做第二套 AST。
- `document.js`：标准工厂、节点访问/修改方法、plain snapshot 与语义比较辅助。
- `load.js` / `backends/vue.js`：只消费 Document 操作面，不 import cheerio。

### 4.2 Document 操作面（穷举 · 按消费者 · 对照今日调用）

不是通用 DOM API。W2 必须提供且 **load / backends/vue.js / vue-tools（§3 迁入的 DOM 重写函数）** **只**经此面访问树（名可同义微调或合并，语义不可少）。实施期若发现表外能力，**须先修订本表**再编码。

**Consumer 列：** `load` = `load.js`；`vue` = `backends/vue.js` 渲染/行源；`tools` = `normalizeTemplateDom` / `groupDuplicateNamedSlots` / `wrapForIfScopes` / `transTagTemplate` / `processIncludeConditionalAttrs` / `collectIncludedComponentTags` 等。

| # | 方法（建议名） | Consumer | 今日来源 | 用途 |
| --- | --- | --- | --- | --- |
| 1 | `query` / `queryAll`(scope?, typeOrTag\|'*') | load, tools | `$('include'\|…)` / `$('*')` / `root.find('*')` | 按类型、标签或全树查找 |
| 2 | `getAttr(node, name)` | load, tools | `$(elem).attr('src')` | 读单属性（走 Attr[]） |
| 3 | `listAttrs(node)` | load, tools | `$(elem).attr()` / `elem.attribs` | 全量属性视图（只读快照或 Attr[]） |
| 4 | `setAttr(node, name, value)` | tools, load§4.6 | `wrapper.attr(name, value)` / `transAsses` 写 src | 写/覆盖属性 |
| 5 | `removeAttr(node, name)` | tools | `$(node).removeAttr(...)` | 删属性 |
| 6 | `replaceNode(old, next\|string\|nodes)` | load | `$(elem).replaceWith(...)` | include 展开替换 |
| 7 | `removeNode` / `removeAll` | load, tools | `.remove()` | 删节点 |
| 8 | `serialize(node?)` | load, vue, tools | `$.html()` / `$.html(elem)` | 文档或子树序列化 |
| 9 | `getRootChildren()` | load, vue | `$.root().children()` | 根下一层 |
| 10 | `getChildren(node)` | load, tools | `$(host).children()` / `parent.children` | 任意节点子列表 |
| 11 | `wrapRootIfMulti(tag)` | load | multi-root `<view>` 包装 | 页多根（含 contents 迁入） |
| 12 | `removeMatching(scope, predicate\|tags)` | load, tools | include 内删 template/wxs；`find(...).remove()` | 按谓词或标签清洗 |
| 13 | `createElement(name, attrs?)` | load, tools | `$('<view>')` / `` $(`<${tag}>`) `` | 建包装节点 |
| 14 | `append(parent, child\|contents)` | load, tools | `wrapper.append` / `root.append` | 挂接子节点 |
| 15 | `insertBefore(ref, node)` | tools | `$(nodes[0]).before(wrapper)` | 前插（slot/for 包装） |
| 16 | `walk(nodes, visitor)` | vue | `walk($.root().children()…)` | 渲染遍历 |
| 17 | `getSourceOrigin(node)` | vue | `_elemFiles` / startIndex 语义 | sourcemap 行源 |
| 18 | `getTagName(node)` | tools, vue | `element.tagName` / `node.name` | 标签名（标准节点用 `name`/`type`） |

节点身份与树关系以 Document 对象引用为准；**禁止**再暴露 cheerio 元素 / `_$` / `_elem`。`getProps` / `transTag` 等纯 attrs→字符串函数：W2 可将入参从 `Record` 改为 `Attr[]`（或经 `listAttrs`），属允许的签名变更（见 §4.5）。

### 4.3 特殊节点

特殊节点从 parser 阶段分类：`<include>` 即使缺少 `src` 仍为 `{type:'include', src:null}`；不再用 `name === ...` 作为语义判别。`templateNodeKind` 等旧二次猜测在所有消费者迁移后删除。

### 4.4 行源与序列化

标准 Document 保存 span/sourceFile；include/import 展开时保留 origin。Vue backend 从标准序列化结果生成 line origins。W2 不要求中间 Document JSON 与旧投影字节相等，只要求最终产物和 sourcemap 等价（D-WR-9）。

### 4.5 `normalizeTemplateSyntax` / vue-tools 目标形态（F-WR-R2-001）

今日路径：`html 字符串 → cheerio.load → normalizeTemplateDom($) → $.html()`（`view/index.js` 内联 cheerio）。

W2 **目标形态**：

1. **废除** string→`cheerio.load`→string 环路；`normalizeTemplateDom(document, components)`（及 slot/for 包装）**就地**改标准 Document，只经 §4.2。
2. `backends/vue.js` 在 serialize / htmlparser2 熔断**之前**调用 Document 版 normalize；不再把 `$` 传入 tools。
3. `normalizeTemplateSyntax(html, …)`：删除，或降为测试/过渡薄封装且**不得**再 `import cheerio`；正式编译路径不依赖它。
4. `transHtmlTag` 可继续消费 **serialize 后的字符串** + `htmlparser2`（非 cheerio；本门不强制把 htmlparser2 迁入 parser）。

### 4.6 load 边界：`transTagWxs` / `transAsses`（F-WR-R3）

今日 `load.js` 在收回 `_$` 后仍会调用未归位助手：

- `tools.transTagWxs($, …)`（主文档 / include / import）
- `tools.transAsses($, $('image'), …)`

二者**不在** §3 的 23 搬迁名单内（`transTagWxs` 属 wxs 轨道；`transAsses` 属 asset），但 A-WR2 要求 **load 零 cheerio/`_$`**，二者今日又只吃 `$`。

**拍板策略（唯一）：**

1. **W2 允许**对 `transTagWxs`、`transAsses` 做 **Document 面向薄适配**：改签名与树访问（`$` / cheerio 节点 → Document + §4.2：`query`/`getAttr`/`setAttr`/`removeNode` 等），**不**迁目录、**不**开 wxs/asset 归位 Action、**不**改 wxs 收集/编译与 asset 收集的编译语义。
2. load 只传 Document / 节点引用，**禁止**为迁就二者而保留 `_$` 或在 load 内 `cheerio.load`。
3. **W1** 仍逐字保留 `$` 签名与实现；适配仅发生在 W2。
4. 若适配时需从 §4.2 表外取能力，先修订 §4.2 再编码（与既有纪律相同）。

## 5. W3：napi 默认装配

`parser/index.js` 根据 `process.env.WXML_PARSER ?? 'napi'` 选择 parser；只接受 `napi` 或 `cheerio`，非法值以 `[wxml]` 错误失败。napi 直接调用 `parseWxmlSpanView` 并构造标准 Document。默认 napi，cheerio 为显式回退与对拍基线。

两路对拍比较：节点 type/name、attrs 名和值分类、directives、特殊节点字段、可用 span；cheerio 属性 span 为 null 不构成不等价。最终以同一 fixture 编译的 code 与 sourcemap diff=0 为硬门。

## 6. 失败与边界

所有 parser/load/backend 错误带 `[wxml]`，尽量带 sourceFile 与 span。表达式 `.expr` 不进入 JS Document；保留 raw。纯 transform 产新树、表达式消费、第二 backend、logic/style/wxs 其他函数归位另立 Action。

## Residual（Experience §3）

本门行为 0 / 默认 napi 锚定的是**当前** `@dimina/bundler` view 产物语义（含 Vue 降级），**不是**微信官方运行时逐条重标定。真源纠偏另立 Action。
