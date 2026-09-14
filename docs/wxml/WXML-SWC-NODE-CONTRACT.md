# WXML swc_node Contract

**Status:** ready

The base projection and `ElseDirectiveValue` projection boundaries are fixed;
the latter is not implemented.
**Owner:** `dimina-wxml-parser`  
**Date:** 2026-06-30

## Purpose

This document defines the durable WXML AST annotation, projection, payload, and
source-file provenance contract for `dimina-wxml-parser`.

Implementation behavior is owned by parser source and owner tests.

## Design Position

```text
WXML source -> dimina_wxml_parser::Document
                 |
                 v
        defined swc_node-style annotation/projection contract
```

This contract does not introduce a new parser output model and does not change
the owner of WXML parsing.

## defined Mechanism

```text
Node annotation:
  swc_common::ast_node

Projection:
  first implementation uses dimina_wxml_parser-owned stable projection helpers
  to prove WXML-owned child/projection boundaries

Foreign AST:
  foreign_ast_leaf for swc_ecma_ast::Expr and swc_ecma_ast::ObjectLit
```

Rationale:

- `ast_node = 5.0.0` is already present through the SWC dependency graph.
- `swc_common` re-exports `ast_node`.
- The first implementation uses `swc_common::ast_node`; it must not add a
  direct `ast_node` dependency or new Cargo feature unless the compile spike
  proves the re-export is insufficient and this document is updated first.
- SWC's own `swc_ecma_ast` uses `#[ast_node]` for syntax nodes.
- `#[ast_node]` provides SWC-style node annotation and derives such as
  `Spanned`, `Clone`, `Debug`, and `PartialEq`.
- `#[ast_node]` does not generate WXML-specific `Visit` / `VisitMut` /
  projection behavior. SWC ECMA traversal is generated separately by
  `swc_ecma_visit` for `swc_ecma_ast`.

Therefore WXML must not rely on `#[ast_node]` alone to prove WXML child boundaries. The
defined first implementation contract is annotation plus stable WXML-owned
projection helpers.

`WxmlVisit` / `WxmlVisitWith` are deferred durable API candidates. Introduce
them only if projection helpers cannot prove the required node/leaf/foreign-AST
boundaries or if a later consumer needs visitor-style extension points.

## Classification Categories

| Category | Meaning |
| --- | --- |
| `node` | WXML-owned AST node with span and projection identity. |
| `node_enum` | WXML-owned enum whose variants contain WXML nodes. |
| `child` | Field walked by WXML projection helpers. |
| `leaf` | Payload preserved on the node but not traversed as a WXML child. |
| `foreign_ast` | External AST value owned by another crate, such as SWC JS. |

defined classification principle:

```text
WXML-owned nodes: ast_node where compatible
payload / metadata: no ast_node
foreign SWC AST: no WXML ast_node ownership
```

## defined Node Map

| Type | Classification | Children | Leaves / Payload |
| --- | --- | --- | --- |
| `Document` | `node` | `body` | `span`, `source_file` |
| `Node` | `node_enum` | variant payload | - |
| `Element` | `node` | `attrs`, `directives`, `children` | `span`, `name`, `slot`, `self_closing` |
| `Attr` | `node` | `value` | `span`, `name` |
| `Text` | `node` | `value` | `span` |
| `Comment` | `node` | none | `span`, `text`, `raw` |
| `Value` | `node_enum` | variant payload | - |
| `StaticValue` | `node` | none | `span`, `raw`, `value` |
| `ExprContainer` | `node` | none | `span`, `raw`; `expr` is `foreign_ast_leaf` |
| `TemplateValue` | `node` | `parts` | `span`, `raw` |
| `TemplatePart` | `node_enum` | variant payload | - |
| `Directive` | `node_enum` | variant payload | - |
| `IfDirective` | `node` | `test` | `span` |
| `ElifDirective` | `node` | `test` | `span` |
| `ElseDirective` | `node` | `value` | `span` |
| `ElseDirectiveValue` | `node_enum` | `Present(Value)` | `Absent` |
| `ForDirective` | `node` | `source` | `span`, `item`, `index` |
| `KeyDirective` | `node` | `value` | `span` |
| `HiddenDirective` | `node` | `test` | `span` |
| `KeyValue` | `node_enum` | `Expr(ExprContainer)` | `StarThis`, `Identifier(Atom)` |
| `TemplateData` | `node` | none | `span`, `raw`; `object` is `foreign_ast_leaf` |
| `Wxs` | `node` | none | `span`, `module`, `src`, `content`, `self_closing` |
| `TemplateDef` | `node` | `body` | `span`, `name`, `self_closing` |
| `TemplateRef` | `node` | `target`, `data` | `span`, `self_closing` |
| `Import` | `node` | none | `span`, `src`, `self_closing` |
| `Include` | `node` | none | `span`, `src`, `self_closing` |
| `Slot` | `node` | `directives`, `children` | `span`, `name`, `self_closing` |

## defined Payload Structs

| Type | Classification | Reason |
| --- | --- | --- |
| `SlotAssignment` | `payload` | Normalized `slot="..."` element field, not a WXML child node. |
| `WxsModuleName` | `payload` | Name wrapper with span/raw/value. |
| `WxsContent` | `payload` | Inline WXS source payload; WXS parsing is a different owner. |
| `TemplateName` | `payload` | Name wrapper with span/raw/value. |
| `SourcePath` | `payload` | Path wrapper with span/raw/value. |
| `SlotName` | `payload` | Name wrapper with span/raw/value. |

Universal payload leaves:

- `Span`
- `Atom`
- `PathBuf`
- `source_file`
- `raw` / `value` string atoms
- booleans and syntax flags such as `self_closing`
- quote/name/path wrappers listed above
- directive aliases such as `ForDirective.item` and `ForDirective.index`

The implementation must not adjust this table while coding. If the defined
macro mechanism cannot support the table as written, stop, update this durable
contract and the action validation plan first, then resume. Any approved
adjustment must preserve parser semantics and explain the effect on Vue AST
design.

## Foreign SWC AST Policy

defined first implementation policy:

```text
foreign_ast_leaf
```

Rules:

- WXML projection stops at `ExprContainer.expr`.
- WXML projection stops at `TemplateData.object`.
- Callers that need JavaScript AST traversal must explicitly use SWC-owned
  APIs on the embedded `swc_ecma_ast` values.
- WXML does not make SWC JS nodes WXML-owned.
- Template-data parsing may isolate top-level entries into ephemeral one-entry
  SWC wrappers, synthesize computed static-key nodes after each isolated parse,
  and compose the final foreign-leaf ObjectLit. That parser-internal
  normalization does not create a traversable WXML child, a persistent entry
  AST, or WXML ownership of the resulting SWC nodes. Copied nodes remap from
  their own authored entry range; synthetic key locations map to the authored
  property-key span.

A later action may select a `foreign_ast_bridge`, but that bridge must be
explicit and must not blur WXML ownership.

## Projection Helper Contract

The first implementation validates WXML-owned child boundaries with stable
projection helpers, not a public visitor trait.

Required projection behavior:

- starts from parser-produced `Document` values;
- walks WXML-owned child fields listed in the defined node map;
- records WXML-owned node kinds and representative names/spans;
- records where foreign AST leaves occur without descending into them;
- excludes payload leaves such as `Span`, `Atom`, `PathBuf`, `source_file`,
  raw/cooked strings, and booleans.

The helper API may remain test-only or crate-private for this action. If it
becomes public, the public shape must be documented here before implementation.

defined minimal projection record:

```rust
pub struct WxmlProjectionRow {
    pub kind: &'static str,
    pub name: Option<Atom>,
    pub span: Span,
    pub foreign_leaf: Option<&'static str>,
}
```

The projection helper may use an internal equivalent shape, but tests must
assert these stable fields:

- WXML node kind, such as `Document`, `Element`, `Attr`, `Directive::If`,
  `TemplateRef`, `TemplateData`, `Slot`, or `Wxs`;
- representative name where the node owns one, such as element name,
  attribute name, directive name, template name, slot name, or import path;
- node span for representative boundary checks;
- foreign leaf marker for `ExprContainer.expr` and `TemplateData.object`.

Required representative source:

```xml
<wxs module="m" src="./m.wxs" />
<template name="itemTpl"><view>{{item.name}}</view></template>
<view wx:for="{{items}}" wx:if="{{ready}}" hidden="{{hidden}}" slot="body">
  <slot name="main"><text class="a {{b}}">Hello {{name}}</text></slot>
  <template is="{{itemTpl}}" data="{{...item, index: idx}}" />
</view>
```

Required projection expectations:

- projection starts with `Document`;
- projection includes `Wxs`, `TemplateDef`, ordinary `Element`, `Slot`,
  `Text`, and `TemplateRef`;
- projection includes attr/value boundaries for `class="a {{b}}"`;
- projection includes directive boundaries for `wx:for`, `wx:if`, and `hidden`;
- projection records foreign leaves for expression containers and template-data
  object literals without descending into SWC expression/object internals.

## Unsupported Shapes And Replan Conditions

This contract intentionally rejects these shapes for the first implementation:

- annotating `swc_ecma_ast::Expr`, `swc_ecma_ast::ObjectLit`, or other foreign
  AST nodes as WXML-owned nodes;
- treating `Span`, `Atom`, `PathBuf`, `source_file`, raw/cooked strings,
  booleans, quote metadata, or diagnostic messages as traversed WXML children;
- relying on `#[ast_node]` alone as proof of WXML-owned child boundaries;
- introducing a shared source provenance wrapper before direct
  `source_file: Option<PathBuf>` fields are proven insufficient;
- changing `parse_wxml(source_file: Option<PathBuf>, source: &str)` only to
  satisfy macro annotation.

Replan if `swc_common::ast_node` cannot compile on representative WXML-owned
structs/enums without changing parser semantics. In that case, update this
document first, then update the action validation plan.

## No-Fallback Rule

This contract has no compatibility fallback path for the first implementation:

- do not silently drop `#[ast_node]` annotation and still mark E5 as closed;
- do not silently descend into SWC expression/object AST and still mark E6 as
  closed;
- do not silently omit diagnostic `source_file` fields and still mark E4b/E4c
  as closed;
- do not broaden this action into WXML language behavior fixes to keep tests
  passing;
- if any defined contract item cannot be implemented as written, stop and
  update this document plus the action validation plan before continuing.

## Source-File Provenance Contract

WXML parsing accepts a caller-provided source file:

```rust
parse_wxml(source_file: Option<PathBuf>, source: &str) -> ParseResult
parse_wxml_expression(source_file: Option<PathBuf>, source: &str) -> Result<ExprContainer, WxmlExpressionError>
parse_template_data(source_file: Option<PathBuf>, source: &str) -> Result<TemplateData, WxmlTemplateDataError>
```

defined rules:

- the parser preserves the caller-provided path exactly;
- the parser does not canonicalize, resolve, normalize, or require the path to
  exist;
- `Document.source_file` stores the caller-provided path for successful WXML
  parses;
- target `ParseError.source_file` stores the caller-provided path for WXML parse
  diagnostics;
- target `WxmlExpressionError.source_file` stores the caller-provided path for
  expression diagnostics;
- target `WxmlTemplateDataError.source_file` stores the caller-provided path for
  template-data diagnostics;
- provenance is metadata payload and must not be traversed as an AST child;
- source positions still use `Span`; source file explains which input those
  spans refer to.

Current implementation drift:

- `Document` already has `source_file: Option<PathBuf>`.
- Parser/expression/template-data error structs currently expose `span`, `kind`,
  and `message`, but do not expose `source_file`.

defined target public field shape:

```rust
pub struct ParseError {
    pub span: Span,
    pub source_file: Option<PathBuf>,
    pub kind: ParseErrorKind,
    pub message: String,
}

pub struct WxmlExpressionError {
    pub span: Span,
    pub source_file: Option<PathBuf>,
    pub kind: WxmlExpressionErrorKind,
    pub message: String,
}

pub struct WxmlTemplateDataError {
    pub span: Span,
    pub source_file: Option<PathBuf>,
    pub kind: WxmlTemplateDataErrorKind,
    pub message: String,
}
```

No shared provenance wrapper is introduced. The direct `source_file` field keeps
diagnostics easy to inspect and matches the existing `Document.source_file`
shape.

Error propagation rules:

- `parse_wxml` creates every `ParseError` with `Parser.source_file.clone()`.
- `parse_wxml_expression` creates every `WxmlExpressionError` with the
  caller-provided `source_file.clone()`.
- `parse_template_data` creates every `WxmlTemplateDataError` with the
  caller-provided `source_file.clone()`.
- ordinary expression parsing and Template-data entry parsing use the same
  crate-private `validate_accepted_expression` category owner. Template data
  retains a category failure as
  `WxmlTemplateDataErrorKind::RejectedExpression(ExpressionCategoryError)`;
  it must not translate that failure into generic Template-data syntax or
  silently accept a category rejected by ordinary WXML expressions.
- expression and template-data parsers may still pass a cloned path into SWC
  `FileName::Real`, but they must retain a separate clone for diagnostics;
- When expression or template-data diagnostics are wrapped into a WXML
  `ParseError`, the outer `ParseError.source_file` preserves the same
  caller-provided path.
- Template-data category failures remap the retained SWC span against the
  isolated authored entry. The preferred span is the rejected computed key,
  value, spread operand, or nested expression; the fallback is the isolated
  entry span. Synthetic wrapper positions and the complete Template-data body
  are not default fallback locations.

defined provenance tests:

- `wxml_document_preserves_source_file`
- `wxml_parse_error_preserves_source_file`
- `wxml_expression_error_preserves_source_file`
- `wxml_template_data_error_preserves_source_file`
- `wxml_source_file_is_not_canonicalized`

## Projection And Reversibility

Projection tests should assert stable semantic views, not full debug output.

Acceptable projections:

- preorder WXML node kind sequence;
- element/tag/attr/directive names;
- spans for representative nodes;
- value variant sequence;
- count and location of foreign expression leaves;
- special node classification.

Full source printing roundtrip is out of scope. Reversibility here means the
projection can prove AST shape and payload boundaries survived macro/projection
annotation without losing parser semantics.

## Parser Stability

The public parser contract remains:

```rust
parse_wxml(source_file: Option<PathBuf>, source: &str) -> ParseResult
```

Any AST annotation or helper introduced under this contract must preserve
existing parse outputs for the current validation matrix. Parser tests remain
the stability gate; projection tests are additional contract evidence.
