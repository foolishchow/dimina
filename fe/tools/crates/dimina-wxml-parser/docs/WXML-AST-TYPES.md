# WXML AST Type Definitions

**Version:** 1.0 (Draft)  
**Date:** 2026-06-26  
**Purpose:** 完整定义 WXML AST 的所有类型，作为实现规范

## 前置阅读

- [WXML-LANGUAGE-SPEC.md](./WXML-LANGUAGE-SPEC.md) - WXML 语言规范
- [WXML-PARSING-SPEC.md](./WXML-PARSING-SPEC.md) - 解析规范

## 外部依据

本文件中的 Template、Import/Include、WXS 和 Slot contract 参考了以下公开文档，并把查证结论固化为 AST 设计约束：

- [Tencent Cloud: WXML](https://www.tencentcloud.com/zh/document/product/1219/60345)
  - `<template name="...">` 定义模板。
  - `<template is="..." data="...">` 使用模板，`is` 指向 template name，不是文件路径，并支持动态模板名。
  - `<import src="...">` 引入目标 WXML 文件中的 template definitions。
  - `<include src="...">` 包含目标 WXML 文件中除 `<template>` 和 `<wxs>` 外的内容。
- [Tencent Cloud: WXS Modules](https://www.tencentcloud.com/document/product/1219/61724)
  - `<wxs module="...">` 的 `module` 是当前 WXS 标签的模块名，并作为 WXML 表达式可访问的静态绑定名。
  - `<wxs src="...">` 的 `src` 用于引用外部 `.wxs` 文件模块，只能引用 `.wxs` 文件，并且必须使用相对路径。
- [Tencent Cloud: Component Templates and Styles](https://www.tencentcloud.com/document/product/1219/57671)
  - 组件 WXML 中的 `<slot>` 用于承载组件使用者提供的 WXML 结构。
  - 多 slot 通过不同静态 `name` 区分，例如 `<slot name="before"></slot>`。
  - 组件使用方通过普通节点上的 `slot="before"` 把内容分发到对应 slot。

这些外部依据只用于 AST contract 设计；路径存在性、模块名合法性、作用域规则和组合合法性仍由 diagnostics/semantic/graph/compiler 后续阶段处理。

## 命名约定

**核心原则：** 简洁、语义化、避免冗余

### 去除 Wxml 前缀

所有类型都在 `wxml::ast` 模块下，不需要 `Wxml` 前缀：

```rust
// ❌ 之前：冗余
use wxml::ast::WxmlElement;  // wxml 重复两次

// ✅ 现在：简洁
use wxml::ast::Element;
```

### 统一 Value 命名

属性值和文本内容统一使用 `Value` 类型：

```rust
// ❌ 之前：不一致
WxmlAttributeValue
WxmlTextContent

// ✅ 现在：统一
Value  // 用于属性和文本
```

### 缩写原则

学习 SWC 的命名习惯：

```rust
Attr          // 而不是 Attribute
TemplateDef   // 而不是 TemplateDefinition
TemplateRef   // 而不是 TemplateUsage
```

## 设计原则

本 AST 设计参考了 SWC 的 JSX AST 实现，并结合 WXML 的特殊需求。

### 与 SWC JSX 的关系

通过系统对比 SWC JSX 的完整 AST 设计，我们采取"参考精华、适配特性"的策略：

**✅ 直接参考 SWC:**
1. **基础设施**: `#[ast_node]` 宏、`swc_atoms::Atom`、`swc_common::Span`
2. **设计模式**: enum 区分类型、value + raw 双字段、Option 支持布尔属性
3. **性能优化**: 字符串池化、位置追踪

`#[ast_node]` 的稳定节点/叶子/foreign AST 分类、WXML-owned traversal
边界和 `source_file` provenance 契约由
[`WXML-SWC-NODE-CONTRACT.md`](./WXML-SWC-NODE-CONTRACT.md) 维护。本文档
只维护 WXML AST 形状和语言语义；不要在本文档里复制完整 swc_node
节点表，避免 action 文档和 crate 契约漂移。

**❌ 不参考 SWC:**
1. **JSX 特有**: Fragment、Spread、命名空间、opening/closing 分离
2. **节点分裂**: JSX 把 `111{aaa}222` 分裂成 3 个节点，WXML 保持为 1 个节点

**✅ WXML 特有扩展:**
1. **Directive 系统**: wx:if, wx:elif, wx:else, wx:for, wx:key 等控制语义
2. **Value enum**: 支持模板混合 `"a{{b}}c"` (JSX 不支持)
3. **特殊节点**: Wxs, Template, Import/Include, Slot

### 核心设计决策

#### 1. Value 使用 Enum（而非 Struct）

**决策：** Value 用 enum 表达三种互斥情况，而非 struct + kind 标记

```rust
pub enum Value {
    Static(StaticValue),
    Expr(ExprContainer),
    Template(TemplateValue),
}
```

**理由：**
- 三种情况互斥，用 enum 更类型安全
- 避免数据重复（struct 设计会在所有变体都存 expr）
- 符合 Rust 最佳实践
- 借鉴 SWC 的 JSXAttrValue enum 设计思想

#### 2. 统一表达式系统

**决策：** 普通动态 value/directive 表达式用 WXML 自己的表达式容器保存，容器内部使用 `swc_ecma_ast::Expr`。
`<template data="{{...}}">` 是独立的 template data grammar，使用 `TemplateData.object: ObjectLit`，不经过普通
`ExprContainer`。

```rust
use swc_ecma_ast::{Expr, ObjectLit};

pub struct ExprContainer {
    pub expr: Box<Expr>,
    pub raw: Atom,
    pub span: Span,
}
```

**优势：**
- 复用 SWC 的表达式能力（标识符、成员访问、调用等）
- 统一处理普通动态 value/directive 表达式
- Parser AST 保留 WXML 源码边界、raw 和 span
- 后续 lowering 可以按需转换为 SWC 表达式或运行时表达式

#### 3. 不分裂节点（保持模板语义）

**决策：** `"a{{b}}c"` 在 AST 中保持为单个节点

**对比 JSX:**
- JSX: `111{aaa}222` → 3 个子节点 (JSXText + JSXExprContainer + JSXText)
- WXML: `111{{aaa}}222` → 1 个 Text 节点 (value: Template)

**理由：**
- 保留源码语义（在 WXML 中这是一个整体）
- 简化 AST 结构
- 需要 Value enum 支持（不能像 JSXText 那样只存静态值）

#### 4. 字符串池化

使用 `swc_atoms::Atom` 替代 `String`：

```rust
use swc_atoms::Atom;

pub struct Element {
    pub name: Atom,  // 不是 String
}
```

**原因：**
- 标签名重复度高（view, text, button）
- 属性名重复度高（class, id, style）
- Atom 是共享引用，节省内存

#### 5. 所有节点都有 Span

学习 SWC 的设计，所有节点保留位置信息：

```rust
use swc_common::Span;

pub struct Element {
    pub span: Span,
    // ...
}
```

**用途：**
- 错误报告
- IDE 功能（跳转、重构）
- Source map 生成

## 依赖

```rust
// 外部依赖
use std::path::PathBuf;
use swc_atoms::Atom;
use swc_common::{Span, ast_node};
use swc_ecma_ast::{Expr, ObjectLit};
```

## 模块结构

```
wxml::ast
├── Document
├── Node (enum)
├── Element
├── SlotAssignment
├── Attr
├── Value (enum) ⚡ 使用 enum 而非 struct
├── StaticValue
├── ExprContainer
├── TemplateValue
├── TemplatePart (enum)
├── Text
├── Comment
├── Directive (enum)
├── IfDirective
├── ElifDirective
├── ElseDirective
├── ForDirective
├── KeyDirective
├── KeyValue (enum)
├── HiddenDirective
├── Wxs
├── WxsModuleName
├── WxsContent
├── TemplateDef
├── TemplateName
├── TemplateRef
├── Import
├── Include
├── SourcePath
├── Slot
└── SlotName
```

## 类型定义

本节代码块描述目标 AST contract shape。当前实现状态以
`crates/dimina-wxml-parser/src/ast.rs` 为准；`#[ast_node]` 标注是否已经落地
由 [`WXML-SWC-NODE-CONTRACT.md`](./WXML-SWC-NODE-CONTRACT.md) 的验证 action
闭合，不由本文档单独声明。

### 1. 文档根节点

```rust
/// WXML 文档
/// 
/// 表示一个完整的 WXML 文件
pub struct Document {
    /// 整个文档的源码范围
    pub span: Span,

    /// 顶层节点列表
    /// 
    /// WXML 不要求单一根元素（与 HTML 不同）
    pub body: Vec<Node>,
    
    /// 源文件路径（可选）
    pub source_file: Option<PathBuf>,
}
```

**示例：**
```wxml
<!-- 文件：page.wxml -->
<view>A</view>
<view>B</view>

<!-- 对应 AST -->
Document {
    span: Span { start: 0, end: 30 },
    body: vec![
        Node::Element(...),  // <view>A</view>
        Node::Element(...),  // <view>B</view>
    ],
    source_file: Some("page.wxml"),
}
```

### 2. 节点枚举

```rust
/// WXML 节点
/// 
/// 所有可能出现在 WXML 中的节点类型
pub enum Node {
    /// 元素节点
    /// 
    /// 示例：`<view class="container">...</view>`
    Element(Element),
    
    /// 文本节点
    /// 
    /// 示例：`Hello {{name}}!`
    Text(Text),
    
    /// 注释节点
    /// 
    /// 示例：`<!-- comment -->`
    Comment(Comment),
    
    // ---- 特殊节点（WXML 特有） ----
    
    /// WXS 模块
    /// 
    /// 示例：`<wxs module="utils">...</wxs>`
    Wxs(Wxs),
    
    /// 模板定义
    /// 
    /// 示例：`<template name="card">...</template>`
    TemplateDef(TemplateDef),
    
    /// 模板引用
    /// 
    /// 示例：`<template is="card" data="{{...item}}" />`
    TemplateRef(TemplateRef),
    
    /// 引入模板
    /// 
    /// 示例：`<import src="./template.wxml" />`
    Import(Import),
    
    /// 包含片段
    /// 
    /// 示例：`<include src="./header.wxml" />`
    Include(Include),

    /// 插槽出口
    ///
    /// 示例：`<slot name="header">fallback</slot>`
    Slot(Slot),
}
```

**设计说明：**

- **为什么特殊节点独立？** 它们有特殊语义，不是普通元素
- **为什么不用泛型 Element？** 类型安全，防止误用

### 3. 元素节点

```rust
/// 元素节点
///
/// 表示 WXML 标签元素，如 `<view>`, `<text>`, `<button>` 等
#[ast_node("Element")]
pub struct Element {
    /// 源码位置
    pub span: Span,

    /// 标签名
    ///
    /// 示例：`"view"`, `"text"`, `"custom-component"`
    ///
    /// 使用 Atom 优化内存（标签名重复度高）
    pub name: Atom,

    /// 属性列表
    ///
    /// 示例：`[{name: "class", value: ...}, {name: "id", value: ...}]`
    ///
    /// 不包含 directives（wx:if、wx:for、hidden 等）和 slot assignment
    pub attrs: Vec<Attr>,

    /// 指令列表
    ///
    /// 示例：`[Directive::If(IfDirective { test, ... }), Directive::For(ForDirective { source, ... })]`
    ///
    /// 从 wx:if、wx:for、hidden 等属性解析而来
    pub directives: Vec<Directive>,

    /// 组件使用方的 slot assignment
    ///
    /// 示例：`<view slot="before">...</view>`
    pub slot: Option<SlotAssignment>,

    /// 子节点列表
    pub children: Vec<Node>,

    /// 是否自闭合
    ///
    /// `<image src="..." />` → true
    /// `<view>...</view>` → false
    pub self_closing: bool,
}

pub struct SlotAssignment {
    pub span: Span,
    pub name: SlotName,
}
```

**示例：**
```wxml
<view class="container {{theme}}" wx:if="{{show}}">
  <text>Hello</text>
</view>
```

对应 AST：
```rust
Element {
    span: Span { start: 0, end: 80 },
    name: Atom::from("view"),
    attrs: vec![
        Attr {
            name: Atom::from("class"),
            value: Some(Value::Template(TemplateValue {
                raw: Atom::from("container {{theme}}"),
                span: ...,
                parts: vec![...],
            })),
            span: ...,
        },
    ],
    directives: vec![
        Directive::If(IfDirective {
            test: ExprContainer {
                expr: Box::new(Expr::Ident(...)),
                raw: Atom::from("show"),
                span: ...,
            },
            span: ...,
        }),
    ],
    children: vec![
        Node::Element(Element {
            name: Atom::from("text"),
            children: vec![
                Node::Text(Text {
                    value: Value::Static(StaticValue {
                        value: Atom::from("Hello"),
                        raw: Atom::from("Hello"),
                        span: ...,
                    }),
                    span: ...,
                }),
            ],
            ...
        }),
    ],
    self_closing: false,
}
```

### 4. 属性

```rust
/// 元素属性
///
/// 表示元素的一个属性，如 `class="container"`
#[ast_node("Attr")]
pub struct Attr {
    /// 源码位置
    pub span: Span,

    /// 属性名
    ///
    /// 示例：`"class"`, `"id"`, `"data-index"`, `"bind:tap"`
    pub name: Atom,

    /// 属性值
    ///
    /// `None` 表示布尔属性（无值）
    ///
    /// 示例：
    /// - `<button disabled />` → None
    /// - `<view class="x" />` → Some(...)
    pub value: Option<Value>,
}
```

**设计说明：**

**Q: 为什么 value 是 Option？**

学习 SWC 的 `JSXAttr` 设计，支持布尔属性：

```wxml
<button disabled />         <!-- value = None -->
<checkbox checked />        <!-- value = None -->
<button disabled="false" /> <!-- value = Some(...) -->
```

**Q: 事件绑定属性如何处理？**

作为普通属性：

```wxml
<view bind:tap="handleTap" />

<!-- AST -->
Attr {
    name: Atom::from("bind:tap"),
    value: Some(Value::Static(StaticValue {
        value: Atom::from("handleTap"),
        raw: Atom::from("handleTap"),
        span: ...,
    })),
}
```

下游（semantic layer）负责识别和验证事件绑定。

### 5. 值类型（统一）

```rust
/// 值类型（enum）
///
/// 统一用于属性值和文本内容
///
/// 设计决策：使用 enum 而非 struct + kind 标记
/// - 三种情况互斥，enum 更类型安全
/// - 避免数据重复（每个变体只存需要的字段）
/// - 参考 SWC 的 JSXAttrValue enum 设计
#[ast_node]
pub enum Value {
    /// 纯静态值，示例：`class="container"`
    Static(StaticValue),

    /// 纯动态值，示例：`class="{{className}}"`
    Expr(ExprContainer),

    /// 模板值，示例：`class="container {{theme}} large"`
    Template(TemplateValue),
}

/// 纯静态值
#[ast_node("StaticValue")]
pub struct StaticValue {
    pub span: Span,

    /// 解码后的值（HTML entities 已处理）
    pub value: Atom,

    /// 原始源码（用于 emit、diagnostics 和 source map）
    pub raw: Atom,
}

/// WXML 表达式容器
///
/// 参考 SWC JSXExprContainer 的设计，但保留 WXML raw source。
#[ast_node("ExprContainer")]
pub struct ExprContainer {
    pub span: Span,

    /// 动态表达式
    pub expr: Box<Expr>,

    /// `{{` 和 `}}` 内部的原始表达式源码
    pub raw: Atom,
}

/// 混合模板值
///
/// 不使用 `Expr::Tpl` 作为 AST 主存储。Parser AST 保留 WXML 的静态/动态分段；
/// 后续 lowering 可以按需转换为 SWC `Expr` 或运行时表达式。
#[ast_node("TemplateValue")]
pub struct TemplateValue {
    pub span: Span,

    /// 原始源码，例如 `container {{theme}} large`
    pub raw: Atom,

    /// 静态和动态片段，保持源码顺序
    pub parts: Vec<TemplatePart>,
}

#[ast_node]
pub enum TemplatePart {
    Static(StaticValue),
    Expr(ExprContainer),
}
```

**辅助方法：**

```rust
impl Value {
    /// 判断是否为静态值
    pub fn is_static(&self) -> bool {
        matches!(self, Value::Static(_))
    }

    /// 获取静态值（如果是）
    pub fn as_static_str(&self) -> Option<&str> {
        match self {
            Value::Static(value) => Some(value.value.as_ref()),
            _ => None,
        }
    }

    /// 获取 span
    pub fn span(&self) -> Span {
        match self {
            Value::Static(value) => value.span,
            Value::Expr(value) => value.span,
            Value::Template(value) => value.span,
        }
    }
}
```

**示例：**

```wxml
<!-- 静态 -->
class="container"

<!-- 对应 AST -->
Value::Static(StaticValue {
    span: Span { start: 7, end: 16 },
    value: Atom::from("container"),
    raw: Atom::from("container"),
})
```

```wxml
<!-- 动态 -->
class="{{className}}"

<!-- 对应 AST -->
Value::Expr(ExprContainer {
    span: Span { start: 9, end: 18 },
    expr: Box::new(Expr::Ident(Ident {
        sym: "className".into(),
        ..
    })),
    raw: Atom::from("className"),
})
```

```wxml
<!-- 模板 -->
class="container {{theme}} large"

<!-- 对应 AST -->
Value::Template(TemplateValue {
    span: Span { start: 7, end: 32 },
    raw: Atom::from("container {{theme}} large"),
    parts: vec![
        TemplatePart::Static(StaticValue {
            span: ...,
            value: Atom::from("container "),
            raw: Atom::from("container "),
        }),
        TemplatePart::Expr(ExprContainer {
            span: ...,
            expr: Box::new(Expr::Ident(Ident { sym: "theme".into(), .. })),
            raw: Atom::from("theme"),
        }),
        TemplatePart::Static(StaticValue {
            span: ...,
            value: Atom::from(" large"),
            raw: Atom::from(" large"),
        }),
    ],
})
```
### 6. 文本节点

```rust
/// 文本节点
///
/// 设计说明：
/// - 复用 Value enum（可以是 Static/Expr/Template）
/// - Value 内部已包含必要信息，不需要额外的 normalized 字段
#[ast_node("Text")]
pub struct Text {
    /// 源码位置
    pub span: Span,

    /// 文本值
    pub value: Value,
}
```

**示例：**

```wxml
<!-- 静态文本（含 HTML entities） -->
<view>  Hello &amp; World  </view>

<!-- 对应 AST -->
Text {
    span: ...,
    value: Value::Static(StaticValue {
        span: ...,
        value: Atom::from("Hello & World"),  // 已解码
        raw: Atom::from("  Hello &amp; World  "),  // 原始（保留空白）
    }),
}
```

```wxml
<!-- 动态文本 -->
<view>{{message}}</view>

<!-- 对应 AST -->
Text {
    span: ...,
    value: Value::Expr(ExprContainer {
        span: ...,
        expr: Box::new(Expr::Ident(Ident { sym: "message".into(), ... })),
        raw: Atom::from("message"),
    }),
}
```

```wxml
<!-- 模板文本 -->
<view>Hello {{name}}!</view>

<!-- 对应 AST -->
Text {
    span: ...,
    value: Value::Template(TemplateValue {
        span: ...,
        raw: Atom::from("Hello {{name}}!"),
        parts: vec![...],
    }),
}
```

### 7. 指令

```rust
/// WXML 指令
/// 
/// 控制渲染行为的指令
/// 
/// 设计说明：
/// - 指令不存在 attrs 中，独立存储
/// - 包含 `wx:*` 控制语义，以及会改变渲染输出合成顺序的 `hidden`
/// - 每个指令有明确的类型
/// - 保留 span 用于错误报告
pub enum Directive {
    /// 条件渲染 - if 分支
    If(IfDirective),
    
    /// 条件渲染 - elif 分支
    Elif(ElifDirective),
    
    /// 条件渲染 - else 分支
    Else(ElseDirective),
    
    /// 列表渲染
    For(ForDirective),

    /// 列表 key
    Key(KeyDirective),

    /// 条件显示
    Hidden(HiddenDirective),
}

pub struct IfDirective {
    pub test: ExprContainer,
    pub span: Span,
}

pub struct ElifDirective {
    pub test: ExprContainer,
    pub span: Span,
}

pub struct ElseDirective {
    pub value: ElseDirectiveValue,
    pub span: Span,
}

pub enum ElseDirectiveValue {
    Absent,
    Present(Value),
}

pub struct ForDirective {
    /// `wx:for` 列表表达式
    pub source: ExprContainer,

    /// `wx:for-item` 自定义 item 变量名
    pub item: Option<Atom>,

    /// `wx:for-index` 自定义 index 变量名
    pub index: Option<Atom>,

    pub span: Span,
}

pub struct KeyDirective {
    /// `wx:key` 的结构化值
    pub value: KeyValue,
    pub span: Span,
}

pub enum KeyValue {
    /// `wx:key="*this"`
    StarThis,

    /// `wx:key="id"`
    Identifier(Atom),

    /// `wx:key="{{expr}}"`
    Expr(ExprContainer),
}

pub struct HiddenDirective {
    /// `hidden` 无值时为 None；有值时保留原始 Value
    pub test: Option<Value>,
    pub span: Span,
}
```

### 8. 注释

```rust
/// 注释节点
/// 
/// 示例：`<!-- comment -->`
pub struct Comment {
    pub span: Span,
    pub text: Atom,
    pub raw: Atom,
}
```

### 9. 特殊节点

#### 9.1 WXS 模块

```rust
/// WXS 模块
/// 
/// WXS (WeiXin Script) 是小程序的脚本语言
pub struct Wxs {
    pub span: Span,
    
    /// 静态模块名
    pub module: Option<WxsModuleName>,
    
    /// 外部 WXS 文件路径
    pub src: Option<SourcePath>,
    
    /// 内联代码（可选）
    pub content: Option<WxsContent>,

    /// 是否使用自闭合源码形态
    pub self_closing: bool,
}

pub struct WxsModuleName {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}

pub struct WxsContent {
    pub span: Span,

    /// 不解析 WXS 代码，保留原始源码
    pub raw: Atom,
}
```

#### 9.2 模板定义

```rust
/// 模板定义
/// 
/// 定义可复用的模板
pub struct TemplateDef {
    pub span: Span,

    /// 模板定义名
    ///
    /// Parser 允许 None 表达缺失 name 的 malformed source；
    /// 具体诊断由 semantic layer 负责。
    pub name: Option<TemplateName>,

    /// 模板体是一段 WXML fragment
    pub body: Vec<Node>,

    /// 是否使用自闭合源码形态
    pub self_closing: bool,
}

pub struct TemplateName {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}
```

#### 9.3 模板引用

```rust
/// 模板引用（使用）
/// 
/// 实例化一个模板
pub struct TemplateRef {
    pub span: Span,
    
    /// 模板调用目标，对应 `is` 属性
    ///
    /// `is` 指向 template name，不是 WXML 文件路径。
    /// Parser 允许 None 表达缺失 is 的 malformed source；
    /// 静态、动态和混合值由 Value 表达。
    pub target: Option<Value>,
    
    /// 传递给模板作用域的数据（data 属性）
    pub data: Option<TemplateData>,

    /// 是否使用自闭合源码形态
    pub self_closing: bool,
}

pub struct TemplateData {
    /// WXML 源码位置，指向 trimmed body 的确切位置
    ///
    /// 满足 E12 reversibility contract: `source[span.lo..span.hi] == raw`
    pub span: Span,

    /// Trimmed template data body 内容
    ///
    /// 定义：`{{` 和 `}}` 之间的内容，去除首尾空白。
    ///
    /// 示例：
    /// - `data="{{foo}}"` → `raw = "foo"`
    /// - `data="{{ foo }}"` → `raw = "foo"`
    /// - `data=" {{ foo, bar }} "` → `raw = "foo, bar"`
    ///
    /// 注意：这不是"原始源码"，而是规范化后的 trimmed 内容。
    /// Attribute value 可以包含外层空白（如 `data=" {{foo}} "`），但外层
    /// 只能是纯空白，不能是混合静态/动态内容。
    pub raw: Atom,

    /// Parser 将 WXML template data grammar 规范化成 object literal。
    ///
    /// 例如：
    /// - `data="{{text: 'forbar'}}"` -> `{ ["text"]: 'forbar' }`
    /// - `data="{{item}}"` -> `{ item }`
    /// - `data="{{foo, bar}}"` -> `{ foo, bar }`
    /// - `data="{{...item}}"` -> `{ ...item }`
    /// - `data="{{...obj1, ...obj2, a, c: 6}}"` -> `{ ...obj1, ...obj2, a, ["c"]: 6 }`
    pub object: ObjectLit,
}
```

#### 9.4 引入和包含

```rust
/// 引入模板
pub struct Import {
    pub span: Span,

    /// 静态 WXML 文件路径
    pub src: Option<SourcePath>,

    /// 是否使用自闭合源码形态
    pub self_closing: bool,
}

/// 包含片段
pub struct Include {
    pub span: Span,

    /// 静态 WXML 文件路径
    pub src: Option<SourcePath>,

    /// 是否使用自闭合源码形态
    pub self_closing: bool,
}

pub struct SourcePath {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}
```

#### 9.5 插槽

```rust
/// 插槽出口
///
/// `<slot>` 不是普通渲染元素。它表示组件内容分发出口，默认 slot、named slot
/// 和 fallback children 都需要由 WXML compiler 独立处理。
pub struct Slot {
    pub span: Span,

    /// `<slot />` 为 None，`<slot name="header" />` 为 Some(...)
    pub name: Option<SlotName>,

    /// 控制语义 directives
    pub directives: Vec<Directive>,

    /// fallback 内容
    pub children: Vec<Node>,

    /// 是否使用自闭合源码形态
    pub self_closing: bool,
}

pub struct SlotName {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}
```

## 完整示例

### 输入 WXML

```wxml
<wxs module="utils">
  var format = function(x) { return x; };
</wxs>

<view class="container {{theme}}" wx:if="{{showList}}">
  <text>List:</text>
  
  <view 
    wx:for="{{items}}" 
    wx:for-item="item"
    wx:key="id"
    data-id="{{item.id}}"
  >
    {{utils.format(item.name)}}
  </view>
</view>
```

### 对应的 AST（简化表示）

```rust
Document {
    span: ...,
    body: vec![
        // <wxs module="utils">...</wxs>
        Node::Wxs(Wxs {
            span: ...,
            module: Some(WxsModuleName {
                span: ...,
                value: Atom::from("utils"),
                raw: Atom::from("utils"),
            }),
            src: None,
            content: Some(WxsContent {
                span: ...,
                raw: Atom::from("..."),
            }),
            self_closing: false,
        }),
        
        // <view class="..." wx:if="...">
        Node::Element(Element {
            span: ...,
            name: Atom::from("view"),
            attrs: vec![
                Attr {
                    span: ...,
                    name: Atom::from("class"),
                    value: Some(Value::Template(TemplateValue {
                        span: ...,
                        raw: Atom::from("container {{theme}}"),
                        parts: vec![...],
                    })),
                },
            ],
            directives: vec![
                Directive::If(IfDirective {
                    test: ExprContainer {
                        span: ...,
                        expr: Box::new(Expr::Ident(Ident { sym: "showList".into(), ... })),
                        raw: Atom::from("showList"),
                    },
                    span: ...,
                }),
            ],
            slot: None,
            children: vec![
                // <text>List:</text>
                Node::Element(Element {
                    span: ...,
                    name: Atom::from("text"),
                    attrs: vec![],
                    directives: vec![],
                    slot: None,
                    children: vec![
                        Node::Text(Text {
                            value: Value::Static(StaticValue {
                                span: ...,
                                value: Atom::from("List:"),
                                raw: Atom::from("List:"),
                            }),
                            span: ...,
                        }),
                    ],
                    self_closing: false,
                }),
                
                // <view wx:for="..." ...>
                Node::Element(Element {
                    span: ...,
                    name: Atom::from("view"),
                    directives: vec![
                        Directive::For(ForDirective {
                            source: ExprContainer {
                                span: ...,
                                expr: Box::new(Expr::Ident(Ident { sym: "items".into(), ... })),
                                raw: Atom::from("items"),
                            },
                            item: Some(Atom::from("item")),
                            index: None,
                            span: ...,
                        }),
                        Directive::Key(KeyDirective {
                            value: KeyValue::Identifier(Atom::from("id")),
                            span: ...,
                        }),
                    ],
                    attrs: vec![
                        Attr {
                            span: ...,
                            name: Atom::from("data-id"),
                            value: Some(Value::Expr(ExprContainer {
                                span: ...,
                                expr: Box::new(Expr::Member(...)),  // item.id
                                raw: Atom::from("item.id"),
                            })),
                        },
                    ],
                    slot: None,
                    children: vec![
                        Node::Text(Text {
                            value: Value::Expr(ExprContainer {
                                span: ...,
                                expr: Box::new(Expr::Call(...)),  // utils.format(item.name)
                                raw: Atom::from("utils.format(item.name)"),
                            }),
                            span: ...,
                        }),
                    ],
                    self_closing: false,
                }),
            ],
            self_closing: false,
        }),
    ],
}
```

## 类型别名（可选）

为了向后兼容或提供更多语义化的别名：

```rust
// 简化导入
pub use self::{
    Document, Node, Element, SlotAssignment, Attr,
    Value, StaticValue, ExprContainer, TemplateValue, TemplatePart,
    Text, Comment,
    Directive, IfDirective, ElifDirective, ElseDirective, ElseDirectiveValue,
    ForDirective, KeyDirective, KeyValue, HiddenDirective,
    Wxs, WxsModuleName, WxsContent,
    TemplateDef, TemplateName, TemplateRef, TemplateData,
    Import, Include, SourcePath,
    Slot, SlotName,
};
```

## 与现有实现的对比

**状态：** 目标 AST 类型已在 `dimina-wxml-parser` 中实现。

完成项：
1. ✅ `Document`, `Node`, `Value` 等核心类型已实现
2. ✅ `parse_wxml` 公共 API 返回目标 AST
3. ✅ Expression 容器和验证完成（205 expression category tests）
4. ✅ Template data 解析完成
5. ✅ 487 parser crate tests passing; AST validation tracked by E1-E8/E10-E12 evidence groups (all completed)

## 已确定的设计决策

### 1. Value 使用 Enum ✅

**决策：** Value 用 enum 而非 struct + kind 标记

```rust
pub enum Value {
    Static(StaticValue),
    Expr(ExprContainer),
    Template(TemplateValue),
}
```

**理由：**
- 三种情况互斥，enum 更类型安全
- 避免数据重复（不需要所有变体都存 expr）
- 参考 SWC 的 JSXAttrValue enum 设计

### 2. Text 去掉 normalized 字段 ✅

**决策：** Text 只包含 `value: Value`，不需要额外的 normalized 字段

**理由：**
- Value::Static 已经包含 value（解码后）和 raw（原始）
- normalized 会和 Value.value 重复
- 简化结构，避免数据冗余

### 3. 使用 SWC 基础设施 ✅

**决策：** 使用 `#[ast_node]` 宏、`swc_atoms::Atom`、`swc_common::Span`

**理由：**
- 与 SWC AST 的节点标注方式保持一致
- 字符串池化节省内存
- 统一位置追踪系统

注意：`#[ast_node]` 不是 WXML traversal 的全部机制。WXML-owned traversal、
projection、payload leaf、foreign SWC AST leaf 规则以
[`WXML-SWC-NODE-CONTRACT.md`](./WXML-SWC-NODE-CONTRACT.md) 为准。

### 4. 指令独立存储 ✅

**决策：** Directive 从属性中分离，独立存储在 Element.directives

**理由：**
- wx:if、wx:for 控制渲染行为，不是普通属性
- 类型安全，防止误用
- Semantic layer 需要特殊处理

### 5. 不分裂节点 ✅

**决策：** `"a{{b}}c"` 保持为单个 Text 节点，使用 Value::Template

**理由：**
- 保留 WXML 源码语义（这在源码中是一个整体）
- 简化 AST 结构（不像 JSX 分裂成 3 个节点）
- 需要 Value enum 支持动态/模板内容

### 6. 命名约定 ✅

- 去除 `Wxml` 前缀（Element, Attr, Value, Text...）
- 统一用 `Value` 表示属性值和文本内容
- 使用缩写（`Attr` 而不是 `Attribute`）

### 7. Document 根节点 ✅

**决策：** Document 使用 `body` 表示顶层节点，并保留 `source_file` 和文档级 `span`

```rust
pub struct Document {
    pub span: Span,
    pub body: Vec<Node>,
    pub source_file: Option<PathBuf>,
}
```

### 8. Slot 独立节点 ✅

**决策：** `<slot>` 使用 `Node::Slot(Slot)`，不作为普通 `Element`

**理由：**
- 组件文档定义多个 slot 通过不同静态 `name` 区分
- Slot 是组件内容分发出口，不是普通渲染元素
- named/default slot 和 fallback children 需要独立表达
- `name` 使用 `SlotName` 保留 span/raw/value；动态 slot name 不进入主 AST contract
- WXML compiler 不应依赖 `Element.name == "slot"` 字符串判断

### 8.1 Slot assignment 独立字段 ✅

**决策：** 组件使用方的 `slot="..."` 从普通 `attrs` 提升到 `Element.slot`

```rust
pub struct Element {
    pub slot: Option<SlotAssignment>,
    // ...
}

pub struct SlotAssignment {
    pub span: Span,
    pub name: SlotName,
}
```

**理由：**
- 组件文档定义使用方通过普通节点上的 `slot="before"` 把内容分发到对应 slot
- `slot="..."` 是内容分发 placement metadata，不是普通属性
- WXML compiler 需要用它做 child projection/grouping
- `Element.attrs` 不再包含 `slot`，避免普通 attr path 把它传给运行时元素/组件
- 动态 slot assignment 不进入主 AST contract，由 diagnostics/semantic layer 处理

### 9. WXS 独立节点 ✅

**决策：** `<wxs>` 使用 `Node::Wxs(Wxs)`，`module` 和 `src` 都是静态 contract。

```rust
pub struct Wxs {
    pub span: Span,
    pub module: Option<WxsModuleName>,
    pub src: Option<SourcePath>,
    pub content: Option<WxsContent>,
    pub self_closing: bool,
}

pub struct WxsModuleName {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}

pub struct WxsContent {
    pub span: Span,
    pub raw: Atom,
}
```

**理由：**
- WXS 文档定义 `module` 为当前 `<wxs>` 标签的模块名，`src` 为外部 `.wxs` 文件引用
- WXS dependency/module binding 不是普通元素语义
- `module` 是 WXML 表达式可访问的静态绑定名，使用 `WxsModuleName` 保留 span/raw/value
- `src` 是外部 `.wxs` 文件静态相对路径，复用 `SourcePath`
- Parser 不解析 WXS 代码，只保留 `WxsContent.raw`
- 额外 attrs 不进入 WXS 主 AST contract，由 diagnostics/semantic layer 处理
- `module/src/content` 的组合合法性留给 semantic/graph/WXS compiler

### 10. TemplateDef 独立节点 ✅

**决策：** `<template name="...">...</template>` 使用 `Node::TemplateDef(TemplateDef)`

```rust
pub struct TemplateDef {
    pub span: Span,
    pub name: Option<TemplateName>,
    pub body: Vec<Node>,
    pub self_closing: bool,
}

pub struct TemplateName {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}
```

**理由：**
- WXML 文档定义 `name` 为 template definition 的模板名
- TemplateDef 是模板定义，不是普通 `Element`
- `name` 是模板定义名，不进入普通 `attrs`
- `name: None` 允许 parser 表达缺失 name 的 malformed source
- `body: Vec<Node>` 表示模板体是一段 WXML fragment
- 额外属性、非法 directive、缺失 name 等由 diagnostics/semantic layer 处理

### 11. TemplateRef 独立节点 ✅

**决策：** `<template is="..." data="..." />` 使用 `Node::TemplateRef(TemplateRef)`

```rust
pub struct TemplateRef {
    pub span: Span,
    pub target: Option<Value>,
    pub data: Option<TemplateData>,
    pub self_closing: bool,
}

pub struct TemplateData {
    pub span: Span,
    pub raw: Atom,
    pub object: ObjectLit,
}
```

**理由：**
- WXML 文档定义 `is` 为 template usage 的模板名，并支持动态模板名
- TemplateRef 是模板调用点，不是普通 `Element`
- `target` 对应 `is` 属性，指向 template name，不是 WXML 文件路径
- `target: None` 允许 parser 表达缺失 `is` 的 malformed source
- `target` 使用 `Value`，支持静态 template name 和动态表达式
- `data` 使用 `TemplateData`，不是普通 `Value`
- `TemplateData` 将 WXML template data grammar 规范化为 `ObjectLit`
- `data="{{item}}"` 是 object shorthand，等价于 `{ item: item }`，不是 object spread
- `data="{{text: 'forbar'}}"`、`data="{{foo, bar}}"`、`data="{{...item}}"`、`data="{{...obj1, ...obj2, a, c: 6}}"` 都表达传给模板作用域的 object
- 混合 entry 保留源码顺序；运行时/后续 lowering 按 object literal 的同名 key 覆盖语义处理
- parser 先按 token/depth 隔离每个顶层 entry，以单 entry SWC object wrapper 解析，再把提取出的顶层静态 `key: value` 在 AST 中规范化为 computed property，最后按源码顺序组合 `ObjectLit`；因此静态 `__proto__` 是普通 data key，允许重复并遵循 later-write-wins。shorthand、spread、已 authored computed key 和嵌套 object literal 不做这项改写
- 该 token-aware normalization 是 parser 内部过程，不新增公开 `TemplateDataPart`；返回形态仍是一个 SWC `ObjectLit` foreign leaf
- 每个单 entry wrapper 独立 remap 到自身 authored range，最终 ObjectLit 使用完整 Template-data span；`raw/span` 保留 WXML source context，`object` 作为后续 semantic/compiler 的可控表达式形态
- 额外属性、非法 children、缺失 `is` 等由 diagnostics/semantic layer 处理

### 12. Import / Include 静态路径 ✅

**决策：** `<import src="..." />` 和 `<include src="..." />` 使用静态 `SourcePath`

```rust
pub struct Import {
    pub span: Span,
    pub src: Option<SourcePath>,
    pub self_closing: bool,
}

pub struct Include {
    pub span: Span,
    pub src: Option<SourcePath>,
    pub self_closing: bool,
}

pub struct SourcePath {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}
```

**理由：**
- WXML 文档定义 `import/include src` 为 WXML 文件引用
- `import` 暴露目标文件的 template definitions；`include` 包含目标文件中除 `<template>` 和 `<wxs>` 外的内容
- `import/include src` 是 WXML 文件路径，不是普通动态绑定值
- `src: None` 允许 parser 表达缺失或非静态 `src` 的 malformed source
- 动态 `src="{{path}}"` 不进入主 AST contract
- 路径存在性、作用域规则、import 非递归规则、include 过滤规则由 semantic/graph/compiler 处理

### 13. 条件指令兄弟关系由 semantic layer 验证 ✅

**决策：** Parser 只把 `wx:if / wx:elif / wx:else` 解析成局部 `Directive`，不验证 sibling chain。

**理由：**
- sibling chain validation 是跨节点语义检查，不是单节点语法解析
- Parser 应保留 malformed AST，便于 diagnostics 和 recovery
- `wx:elif` 是否紧跟 `wx:if`、`wx:else` 是否被其他节点打断，由 semantic layer 诊断
- 后续 compiler/lowering 可以基于 semantic 结果构建条件组
- `ElseDirectiveValue` 必须区分 `Absent` 与 `Present(Value)`；Parser 不判断
  present value 是否合法，但不能在 semantic layer 之前丢弃它
- 该 carrier extension 状态为 `ready`，但尚未实现；当前仅含 `span` 的实现不构成
  新边界的生产执行证据

### 14. hidden 进入 Directive ✅

**决策：** `hidden` 虽然不是 `wx:*`，但进入 `Directive::Hidden`

```rust
pub struct HiddenDirective {
    pub test: Option<Value>,
    pub span: Span,
}
```

**理由：**
- `hidden` 会改变渲染输出，不能按普通 attr 顺序处理
- compiler 需要在 style/class 合成末端处理 display 行为
- `hidden` 无值时 `test: None`，保留源码保真；有值时用 `Some(Value)`
- `Element.attrs` 不再包含 `hidden`

### 15. Special node invalid attrs 不进入主 AST ✅

**决策：** Special node AST 只表达合法 contract 的核心字段；非法 attrs/directives 不进入 special node 字段。缺失核心字段用 `Option` 表达。

适用节点：

```rust
TemplateDef { name: Option<TemplateName>, body: Vec<Node> }
TemplateRef { target: Option<Value>, data: Option<TemplateData> }
Import { src: Option<SourcePath> }
Include { src: Option<SourcePath> }
Wxs { module: Option<WxsModuleName>, src: Option<SourcePath>, content: Option<WxsContent> }
Slot { name: Option<SlotName>, directives: Vec<Directive>, children: Vec<Node> }
```

**理由：**
- Special nodes 不是普通 `Element`，不应通过 `attrs` 暗示普通属性语义
- AST contract 应清楚表达该 node 的合法核心字段
- `Option` 保留 malformed source 的恢复能力，例如缺失 `src` 或 `name`
- unexpected attrs、invalid directives 和 required-field validation 由 diagnostics/semantic layer 处理

### 16. WXS 不使用 WxsKind enum ✅

**决策：** Parser AST 中 `Wxs` 保持 `src/content` 两个独立 `Option` 字段，不引入 `WxsKind::External/Inline`。

```rust
pub struct Wxs {
    pub span: Span,
    pub module: Option<WxsModuleName>,
    pub src: Option<SourcePath>,
    pub content: Option<WxsContent>,
    pub self_closing: bool,
}
```

**理由：**
- Parser AST 需要表达 malformed source 和错误恢复
- `src + content` 同时存在、两者都缺失，都可以通过两个 `Option` 保留
- Parser 不提前选择 recovery 策略，不在 AST 构造期丢掉源码形态
- semantic layer 后续负责分类 external/inline，并诊断无效组合

### 17. SourcePath 复用为词法静态路径 ✅

**决策：** `SourcePath` 表达源码里的静态路径字面量，不编码目标 source kind。

```rust
pub struct SourcePath {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}
```

**使用方决定目标类型：**
- `Import.src` / `Include.src` 期望 WXML source path
- `Wxs.src` 期望 WXS source path

**理由：**
- Parser AST 只表达静态路径值，不负责扩展名、相对路径、文件存在性校验
- 目标 source kind 已经由 owning node 决定
- 拆成 `WxmlSourcePath` / `WxsSourcePath` 会把 semantic/graph 规则提前编码进 parser AST

### 18. Comment 使用 Atom 并保留 raw ✅

**决策：** Comment 不使用 `String`，改为 `text/raw` 两个 `Atom` 字段。

```rust
pub struct Comment {
    pub span: Span,
    pub text: Atom,
    pub raw: Atom,
}
```

**理由：**
- 与 AST 其他字符串字段的 `Atom` 策略保持一致
- `text` 表示去掉注释边界后的内容
- `raw` 保留原始注释源码，支持 diagnostics、source map、formatter 和 roundtrip

### 19. Tag-origin nodes 保留 self_closing ✅

**决策：** 所有源自 WXML tag 的节点都保留 `self_closing`，包括 special nodes。

适用节点：

```rust
Element { self_closing: bool, ... }
Wxs { self_closing: bool, ... }
TemplateDef { self_closing: bool, ... }
TemplateRef { self_closing: bool, ... }
Import { self_closing: bool, ... }
Include { self_closing: bool, ... }
Slot { self_closing: bool, ... }
```

**理由：**
- Parser AST 需要保留源码 tag 形态，用于 diagnostics、formatter、roundtrip 和 source-aware migration
- `self_closing` 只表达源码形态，不决定核心语义
- semantic layer 负责判断某种 tag 形态是否合法
- compiler 应优先使用 `src/content/body/children` 等语义字段，不依赖 `self_closing` 判断核心行为
