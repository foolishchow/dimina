# WXML Parsing Specification

**Version:** 1.0 (Draft)
**Date:** 2026-06-26
**Purpose:** Define how WXML source maps to the target `wxml::ast` contract.

## Status

**Status:** in_progress

The base parser executes through the existing project-build and standalone
compiler entries. The `ElseDirectiveValue` carrier boundary is `ready`, but its
implementation and broader WXML acceptance have not passed.

This document defines the target parsing contract. Current implementation
lives in `dimina-wxml-parser/src/lib.rs` and related modules. All primary
parser validation evidence groups (E1-E8, E10-E12) passed before the conditional
carrier extension. Those tests remain evidence for the existing base parser but
do not prove production execution for `ElseDirectiveValue`. Diagnostic `source_file`
provenance is defined by the SWC node contract and verified by parser owner
tests.

## Before Reading

- [WXML-LANGUAGE-SPEC.md](./WXML-LANGUAGE-SPEC.md) - WXML language surface.
- [WXML-AST-TYPES.md](./WXML-AST-TYPES.md) - target AST type contract.
- [WXML-EXPRESSION-SPEC.md](./WXML-EXPRESSION-SPEC.md) - expression parser contract.
- [WXML-SWC-NODE-CONTRACT.md](./WXML-SWC-NODE-CONTRACT.md) - AST annotation,
  projection, foreign-AST leaf, source-file provenance, and no-fallback
  contract.

This document owns source-to-AST parsing behavior. `WXML-SWC-NODE-CONTRACT.md`
owns `swc_common::ast_node` annotation, WXML-owned projection boundaries,
foreign SWC AST leaf policy, diagnostic `source_file` provenance, and
no-fallback rules. If this document and `WXML-SWC-NODE-CONTRACT.md` conflict on
source-file provenance or projection ownership, `WXML-SWC-NODE-CONTRACT.md`
is the defined contract for that boundary.

## 0. Parsing Overview

```text
WXML source
  -> parser
  -> Document
```

The parser may be implemented with a lexer/token stream or a hand-written
scanner. This spec only defines the source-to-AST contract.

### 0.1 Parser Owns

- Recognizing WXML tags, attributes, text, comments, and special nodes.
- Recognizing `{{ ... }}` expression boundaries.
- Invoking the WXML expression parser for expression bodies.
- Constructing the target `Document` / `Node` tree.
- Preserving `Span`, raw source where required, and `self_closing` tag shape.
- Reporting syntax errors such as unclosed tags, mismatched tags, unclosed
  attributes, malformed interpolation boundaries, and expression parse errors.

### 0.2 Parser Does Not Own

- File existence and path resolution.
- Template reference existence.
- WXS module resolution.
- Component resolution.
- Type checking, scope checking, or data binding runtime semantics.
- `wx:if` / `wx:elif` / `wx:else` sibling-chain validation.
- Legality of special-node attribute combinations.
- Legality of `module/src/content`, `src` extension, or path target kind.

Those checks belong to diagnostics, semantic analysis, graph/load, WXS compiler,
or WXML compiler stages.

### 0.3 Parse Result and Error Contract

Target parser APIs should expose a structured parse result rather than only a
string error:

```rust
pub type ParseResult = Result<Document, Vec<ParseError>>;

pub struct ParseError {
    pub span: Span,
    pub source_file: Option<PathBuf>,
    pub kind: ParseErrorKind,
    pub message: String,
}

pub enum ParseErrorKind {
    UnclosedTag,
    MismatchedTag,
    UnclosedAttribute,
    MalformedInterpolation,
    Expression,
    TemplateData,
    Syntax,
}
```

Rules:

- Parser errors use WXML source spans, not SWC wrapper spans.
- `source_file` preserves the caller-provided path exactly when available.
  The parser must not canonicalize, resolve, normalize, or require the path to
  exist. Detailed diagnostic provenance rules live in
  [WXML-SWC-NODE-CONTRACT.md](./WXML-SWC-NODE-CONTRACT.md).
- The first implementation may stop after the first fatal syntax error, but the
  contract shape allows returning multiple errors later.
- Invalid expression or template data input is reported as a parser error for
  this target contract. The AST has no invalid-expression recovery node.
- Missing or non-static fields represented by `Option` may still produce an AST
  node with `None`; semantic diagnostics own those validity messages unless the
  source is syntactically malformed.

### 0.4 Span Contract

`Span` values are byte ranges in the original WXML source. Ranges are
half-open: `start` is inclusive and `end` is exclusive.

Rules:

- `Document.span` covers the full source.
- Tag-origin node spans cover the complete source form for that node. Paired
  tags include opening tag, body, and closing tag. Self-closing tags include
  the single tag.
- `Attr.span` covers the full attribute source, including name, `=`, quotes
  when present, and value source.
- `StaticValue.span` and `TemplateValue.span` cover the value body only,
  excluding attribute quotes.
- `ExprContainer.span` covers the expression body only, excluding `{{` and
  `}}`.
- `TemplatePart::Static.span` covers that static segment in the original value
  body.
- `TemplatePart::Expr.span` follows `ExprContainer.span`.
- `Comment.span` covers the full comment including `<!--` and `-->`;
  `Comment.text` excludes delimiters.
- `SourcePath`, `TemplateName`, `SlotName`, and `WxsModuleName` spans cover the
  static value body, excluding attribute quotes.

### 0.5 Whitespace Policy

The target parser policy is:

- Preserve whitespace inside attribute values and text values.
- Preserve whitespace-only text nodes inside element, template, and slot
  bodies.
- Skip top-level whitespace-only text nodes in `Document.body`.
- Inside `Element.children`, `TemplateDef.body`, and `Slot.children`, every
  source range between markup boundaries becomes one `Text` node unless the
  range is empty.
- Interpolation boundaries split a `Text.value` into `Value::Expr` or
  `Value::Template`; they do not split the surrounding `Text` node into
  multiple sibling nodes.

This policy keeps authored layout text available to compiler/runtime stages
while avoiding document-level indentation noise between top-level nodes.

## 1. Document

Parsing a WXML source returns:

```rust
pub struct Document {
    pub span: Span,
    pub body: Vec<Node>,
    pub source_file: Option<PathBuf>,
}
```

Rules:

- `span` covers the full source.
- `body` contains all top-level nodes.
- WXML does not require a single root element.
- Top-level whitespace-only text follows the whitespace policy in section 0.5.
- `source_file` is populated when the caller provides a source path.

## 2. Node Classification

The parser produces:

```rust
pub enum Node {
    Element(Element),
    Text(Text),
    Comment(Comment),
    Wxs(Wxs),
    TemplateDef(TemplateDef),
    TemplateRef(TemplateRef),
    Import(Import),
    Include(Include),
    Slot(Slot),
}
```

Tag classification is by tag name and recognized special-node attributes:

| Source shape | AST node |
| --- | --- |
| `<!-- ... -->` | `Node::Comment` |
| text outside tags | `Node::Text` |
| `<wxs ...>` | `Node::Wxs` |
| `<template name="...">` | `Node::TemplateDef` |
| `<template ...>...</template>` without `is` | `Node::TemplateDef` with `name: None` |
| `<template is="...">` | `Node::TemplateRef` |
| `<import ...>` | `Node::Import` |
| `<include ...>` | `Node::Include` |
| `<slot ...>` | `Node::Slot` |
| every other tag | `Node::Element` |

If a `<template>` has both `name` and `is`, parser classification follows
`name` first and creates `TemplateDef`; semantic diagnostics own the invalid
combination.

## 3. Common Tag Parsing

For every tag-origin node, the parser records:

- `span`: source range for the full tag-origin node. See section 0.4.
- `self_closing`: whether the source used a self-closing tag spelling.

For paired tags, `span` covers the opening tag, body, and closing tag. For
self-closing tags, `span` covers the single tag.

The parser uses `self_closing` only to preserve source shape. Semantic/compiler
logic must use semantic fields such as `body`, `children`, `src`, and `content`
for behavior.

## 4. Element Parsing

Ordinary tags parse to:

```rust
pub struct Element {
    pub span: Span,
    pub name: Atom,
    pub attrs: Vec<Attr>,
    pub directives: Vec<Directive>,
    pub slot: Option<SlotAssignment>,
    pub children: Vec<Node>,
    pub self_closing: bool,
}
```

Rules:

- `name` is the tag name.
- `attrs` contains only ordinary attributes.
- `attrs` does not contain `wx:*`, `hidden`, or `slot`.
- `directives` contains parsed rendering/control directives.
- `slot` contains component-child slot assignment from `slot="..."`.
- `children` contains parsed child nodes for non-self-closing elements.
- `children` is empty for self-closing elements.

### 4.1 Slot Assignment

```rust
pub struct SlotAssignment {
    pub span: Span,
    pub name: SlotName,
}
```

Rules:

- `slot="before"` becomes `Element.slot = Some(SlotAssignment { ... })`.
- Slot assignment names are static.
- Dynamic or missing slot assignment values do not enter the main AST contract;
  diagnostics/semantic layer owns validation.

## 5. Attribute Parsing

Ordinary attributes parse to:

```rust
pub struct Attr {
    pub span: Span,
    pub name: Atom,
    pub value: Option<Value>,
}
```

Rules:

- `span` covers the full attribute source. See section 0.4.
- `name` is the attribute name.
- `value: None` represents a boolean attribute with no explicit value.
- `value: Some(...)` represents the parsed attribute value.
- Attribute quote policy is defined by the language spec; the AST stores the
  parsed value, raw value text, and spans.

Attributes recognized as directives, special-node fields, static source paths,
static names, or slot assignment do not remain in ordinary `attrs`.

## 6. Value Parsing

`Value` is shared by attributes and text:

```rust
pub enum Value {
    Static(StaticValue),
    Expr(ExprContainer),
    Template(TemplateValue),
}
```

### 6.1 Static Value

```rust
pub struct StaticValue {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}
```

Rules:

- Used when the value contains no `{{ ... }}` interpolation.
- `raw` preserves the original value text.
- `value` stores the decoded/cooked value according to
  [WXML-LANGUAGE-SPEC.md section 12](./WXML-LANGUAGE-SPEC.md#12-特殊字符和转义).
  The supported named entities are `&lt;`, `&gt;`, `&amp;`, `&nbsp;`,
  `&quot;`, and `&apos;`; decimal and hexadecimal numeric entities are decoded.
  Unknown or malformed entities remain literal in `value` and unchanged in
  `raw`.
- Empty quoted values such as `class=""` become
  `Value::Static(StaticValue { raw: "", value: "", ... })`.

### 6.2 Expr Value

```rust
pub struct ExprContainer {
    pub span: Span,
    pub expr: Box<Expr>,
    pub raw: Atom,
}
```

Rules:

- Used when the complete value is exactly one interpolation, such as
  `{{className}}`.
- `raw` is the expression source inside `{{` and `}}`.
- `expr` is produced by the WXML expression parser. See
  [WXML-EXPRESSION-SPEC.md](./WXML-EXPRESSION-SPEC.md).
- Empty interpolation bodies such as `{{ }}` are expression parser errors.

Expression parse failure is a parser syntax error for this target contract.
Recovery nodes for invalid expressions are not part of the AST contract.

### 6.3 Template Value

```rust
pub struct TemplateValue {
    pub span: Span,
    pub raw: Atom,
    pub parts: Vec<TemplatePart>,
}

pub enum TemplatePart {
    Static(StaticValue),
    Expr(ExprContainer),
}
```

Rules:

- Used when the value contains mixed static and dynamic parts, or multiple
  interpolations.
- `"prefix {{name}} suffix"` becomes a `TemplateValue` with static, expr, and
  static parts.
- `{{a}}{{b}}` becomes one `TemplateValue` with two expression parts.
- `{{a}}   {{b}}` preserves the middle spaces as a static part.
- Static parts are decoded/cooked using the same entity rules as
  `StaticValue`.
- The parser does not store `Expr::Tpl` as the AST source of truth.
- Later lowering may convert `TemplateValue` to SWC or runtime expression
  forms.

## 7. Text Parsing

Text parses to:

```rust
pub struct Text {
    pub span: Span,
    pub value: Value,
}
```

Rules:

- Static text becomes `Value::Static`.
- `{{message}}` becomes `Value::Expr`.
- Mixed text such as `Hello {{name}}!` becomes `Value::Template`.
- Whitespace-only text handling follows section 0.5.

## 8. Directive Parsing

Directives are removed from ordinary `attrs` and stored in `directives`:

```rust
pub enum Directive {
    If(IfDirective),
    Elif(ElifDirective),
    Else(ElseDirective),
    For(ForDirective),
    Key(KeyDirective),
    Hidden(HiddenDirective),
}
```

### 8.1 Conditional Directives

```rust
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
```

Rules:

- `wx:if="{{expr}}"` becomes `Directive::If`.
- `wx:elif="{{expr}}"` becomes `Directive::Elif`.
- `wx:if` and `wx:elif` require a value that is exactly one interpolation.
  Static, empty, missing, or mixed values are parse errors for the target
  contract.
- `wx:else` becomes `Directive::Else` and preserves whether its value is absent
  or present. `wx:else`, `wx:else=""`, and `wx:else="{{x}}"` must remain
  distinguishable in the AST.
- Parser does not validate sibling-chain legality.
- Parser does not decide whether a present `wx:else` value is semantically
  valid; RenderTransform owns that validation. It cannot discard the value
  before that boundary.

### 8.2 List Directives

```rust
pub struct ForDirective {
    pub source: ExprContainer,
    pub item: Option<Atom>,
    pub index: Option<Atom>,
    pub span: Span,
}

pub struct KeyDirective {
    pub value: KeyValue,
    pub span: Span,
}

pub enum KeyValue {
    StarThis,
    Identifier(Atom),
    Expr(ExprContainer),
}
```

Rules:

- `wx:for="{{items}}"` becomes `Directive::For`.
- `wx:for` requires a value that is exactly one interpolation. Static, empty,
  missing, or mixed values are parse errors for the target contract.
- `wx:for-item="item"` populates `ForDirective.item`.
- `wx:for-index="index"` populates `ForDirective.index`.
- `wx:for-item` and `wx:for-index` only consume static value bodies. Dynamic,
  empty, or missing values become `None`; semantic diagnostics own validity.
- `wx:key="*this"` becomes `KeyValue::StarThis`.
- `wx:key="id"` becomes `KeyValue::Identifier`.
- Other non-empty static `wx:key` values are stored as `KeyValue::Identifier`
  payloads without parser validation. For example, `wx:key="item.id"` is stored
  as `KeyValue::Identifier(Atom::from("item.id"))`. Semantic diagnostics own
  whether that static key payload is legal for runtime semantics.
- `wx:key="{{expr}}"` becomes `KeyValue::Expr`.
- Empty `wx:key` values are parse errors for the target contract.
- Parser does not validate whether `wx:key` appears without `wx:for`.
- Directive order in `Element.directives` and `Slot.directives` follows source
  attribute order.

### 8.3 Hidden Directive

```rust
pub struct HiddenDirective {
    pub test: Option<Value>,
    pub span: Span,
}
```

Rules:

- `hidden` becomes `Directive::Hidden { test: None, ... }`.
- `hidden="{{expr}}"` becomes `Directive::Hidden { test: Some(Value::Expr(...)), ... }`.
- `hidden="false"` becomes `Directive::Hidden { test: Some(Value::Static(...)), ... }`.
- `hidden` is not stored in ordinary `attrs`.

## 9. Comment Parsing

Comments parse to:

```rust
pub struct Comment {
    pub span: Span,
    pub text: Atom,
    pub raw: Atom,
}
```

Rules:

- `raw` preserves the complete comment source.
- `text` stores the comment body without comment delimiters.

## 10. Special Node Parsing

Special nodes are not ordinary `Element` values. Their known fields are lifted
into typed fields. Unexpected attrs/directives do not enter the main AST
contract; diagnostics/semantic layer owns validation.

### 10.1 WXS

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

Rules:

- `<wxs module="m">...</wxs>` becomes inline `Wxs` with `content`.
- `<wxs module="m" src="./m.wxs" />` becomes external `Wxs` with `src`.
- `module` is static and becomes `WxsModuleName`.
- `src` is static and becomes `SourcePath`.
- Dynamic `module` or `src` does not enter the main AST contract.
- Parser does not parse WXS code; inline content is preserved as raw source.
- Parser keeps `src` and `content` as independent `Option` fields.
- Semantic layer classifies external/inline and reports invalid combinations.

### 10.2 Template Definition

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

Rules:

- `<template name="card">...</template>` becomes `TemplateDef`.
- `name` is static and becomes `TemplateName`.
- Missing or non-static `name` becomes `name: None`.
- `body` is a WXML fragment parsed as `Vec<Node>`.
- Parser does not preserve invalid attrs/directives in `TemplateDef`.

### 10.3 Template Reference

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

Rules:

- `<template is="card" data="{{...item}}" />` becomes `TemplateRef`.
- `target` corresponds to the `is` attribute.
- `target` points to a template name, not a WXML file path.
- Static and dynamic template names are represented through `Value`.
- `data` corresponds to the `data` attribute.
- `data` is parsed as WXML template data grammar, not ordinary `Value`.
- Template data is normalized into `TemplateData.object`.
- `data` must be exactly one interpolation (with optional outer whitespace).
  Outer content must be pure whitespace; any other static content makes it a
  mixed value, which is a parse error. Examples:
  - Valid: `data="{{foo}}"`, `data=" {{foo}} "` (outer whitespace allowed)
  - Invalid: `data="foo"` (static), `data="x{{foo}}"` (mixed static/dynamic)
- Empty template data (`data="{{}}"`) is a parse error.
- Missing-value `data` attribute is also a parse error when present.
- Template data parsing first uses the token-aware scanner defined by the
  expression spec to isolate top-level entries. It parses each entry through a
  one-entry SWC object wrapper, normalizes an extracted static key in the AST,
  and composes the ordered entries into `Expr::Object(ObjectLit)`. It does not
  build or reparse one length-changing normalized body. Any invalid entry or
  extracted shape is a template data parse error. See
  [WXML-EXPRESSION-SPEC.md](./WXML-EXPRESSION-SPEC.md#7-wxml-template-data).
- `data="{{text: 'forbar'}}"` is parsed as the normalized object literal
  `{ ["text"]: 'forbar' }`.
- `data="{{item}}"` is parsed as object literal `{ item }`.
- `data="{{foo, bar}}"` is parsed as object literal `{ foo, bar }`.
- `data="{{...item}}"` is parsed as object literal `{ ...item }`.
- `data="{{...obj1, ...obj2, a, c: 6}}"` is parsed as the normalized object
  literal `{ ...obj1, ...obj2, a, ["c"]: 6 }`.
- `TemplateData.raw` contains the trimmed template data body: the content between
  `{{` and `}}` with leading and trailing whitespace removed. For example,
  `data="{{foo}}"` yields `raw = "foo"`, and `data=" {{ foo, bar }} "` yields
  `raw = "foo, bar"`.
- `TemplateData.span` points to the exact location of `raw` in the source,
  satisfying the reversibility contract (E12): `source[span] == raw`.
- Mixed entries preserve source order. Later duplicate keys override earlier
  keys when the object is evaluated.
- Every top-level static `PropertyName: value` is normalized to a computed
  property after its isolated SWC parse and before final ObjectLit composition.
  This includes identifier, string, numeric, and `__proto__` names. Repeated
  static `__proto__` entries are parsed in separate wrappers and become valid
  ordinary data properties with later-write-wins semantics; they cannot trigger
  the JavaScript duplicate-prototype-setter early error. Nested object literals
  are not rewritten.
- Template data body grammar:

```text
TemplateDataBody  := ObjectEntry ("," ObjectEntry)* ","?
ObjectEntry       := SpreadEntry | PropertyEntry | ShorthandEntry
SpreadEntry       := "..." NormalExpression
PropertyEntry     := PropertyName ":" NormalExpression
PropertyName      := IdentifierName | StringLiteral | NumericLiteral
                   | "[" NormalExpression "]"
ShorthandEntry    := IdentifierName
```

- `ShorthandEntry` means an identifier-only entry. For example,
  `data="{{item}}"` becomes `{ item: item }`, not `{ ...item }`.
- `NormalExpression` follows the accepted normal-expression categories from
  [WXML-EXPRESSION-SPEC.md](./WXML-EXPRESSION-SPEC.md).
- Nested object and array values are allowed only to the extent those ordinary
  normal-expression categories are accepted.
- Computed property names are accepted. Their key expression follows the same
  accepted normal-expression categories as a property value. Getter, setter,
  and method shorthand properties remain rejected.
- The internal top-level entry scanner is token-aware and ephemeral. It does not
  add a public `TemplateDataPart`, change `TemplateData.raw`, or transfer
  ownership of the returned SWC `ObjectLit` to WXML AST nodes.
- After one isolated wrapper yields exactly one entry and before static-key
  normalization, every authored expression in that entry passes through the
  same crate-private `validate_accepted_expression` owner used by ordinary WXML
  expressions. Shorthand validates its identifier, a static property validates
  its value, a computed property validates its authored key followed by its
  value, and spread validates its operand. Nested accepted expressions recurse
  through that same owner; Template data cannot define a wider expression
  language than ordinary WXML bindings.
- A category rejection remains a `WxmlTemplateDataError` internally, carrying
  `RejectedExpression(ExpressionCategoryError)`, but its public WXML diagnostic
  is `InvalidWxmlExpression`. Outer interpolation/object-entry grammar failures
  remain Template-invocation data-shape failures. No partial `TemplateData` or
  composed `ObjectLit` is returned after either failure.
- Each entry wrapper remaps copied node spans from its own authored entry range.
  The final ObjectLit uses the complete Template-data span; synthetic brackets
  and quotes have no standalone user span. A rejected expression maps to its
  authored key, value, spread operand, or nested expression; if exact mapping
  is unavailable, it falls back to that isolated entry, never the synthetic
  wrapper or automatically the whole Template-data body.
- Parser does not preserve invalid attrs or illegal children in `TemplateRef`.

### 10.4 Import and Include

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

Rules:

- `<import src="./template.wxml" />` becomes `Import`.
- `<include src="./header.wxml" />` becomes `Include`.
- `src` is static and becomes `SourcePath`.
- Dynamic `src` does not enter the main AST contract.
- `SourcePath` is lexical. The owning node determines expected source kind.
- Parser does not resolve paths or validate path existence.

### 10.5 Slot Outlet

```rust
pub struct Slot {
    pub span: Span,
    pub name: Option<SlotName>,
    pub directives: Vec<Directive>,
    pub children: Vec<Node>,
    pub self_closing: bool,
}

pub struct SlotName {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}
```

Rules:

- `<slot />` becomes `Slot { name: None, ... }`.
- `<slot name="header">fallback</slot>` becomes `Slot { name: Some(...), children: ... }`.
- `name` is static and becomes `SlotName`.
- Dynamic slot names do not enter the main AST contract.
- `children` contains fallback content.
- `directives` contains parsed control directives such as `wx:if` or `hidden`.
