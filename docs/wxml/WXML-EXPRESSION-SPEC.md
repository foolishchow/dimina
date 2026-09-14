# WXML Expression Parsing Specification

**Version:** 1.1 (Draft)
**Date:** 2026-06-26
**Purpose:** Define the WXML expression parser contract used by WXML values,
directives, template data, and slot/template-related fields.

## Status

**Status:** draft

The SWC-based expression parser is implemented, but the WXML template-data
object boundary and broader WXML acceptance remain unresolved.

This document defines the target expression contract. Current implementation
lives in `dimina-wxml-parser/src/expression.rs`.

## Before Reading

- [WXML-LANGUAGE-SPEC.md](./WXML-LANGUAGE-SPEC.md) - language-level examples and open questions.
- [WXML-AST-TYPES.md](./WXML-AST-TYPES.md) - `ExprContainer`, `Value`, `TemplateValue`.
- [WXML-PARSING-SPEC.md](./WXML-PARSING-SPEC.md) - source-to-AST parsing contract.
- [WXML-SWC-NODE-CONTRACT.md](./WXML-SWC-NODE-CONTRACT.md) - source-file
  provenance, foreign SWC AST leaf policy, projection, and no-fallback
  contract.

This document owns expression and template-data parse behavior. Diagnostic
`source_file` provenance and foreign SWC AST leaf/projection ownership are
defined in [WXML-SWC-NODE-CONTRACT.md](./WXML-SWC-NODE-CONTRACT.md). If this
document and `WXML-SWC-NODE-CONTRACT.md` conflict on diagnostic provenance,
`WXML-SWC-NODE-CONTRACT.md` is the defined contract for that boundary.

## 1. Terms And Scope

WXML expressions are the source inside `{{` and `}}`.

Examples:

```wxml
{{user.name}}
{{items[index]}}
{{visible ? 'yes' : 'no'}}
{{utils.format(name)}}
```

The expression parser consumes the inner source only:

```text
source in WXML: class="{{user.name}}"
expression parser input: user.name
```

Terms:

| Term | Meaning |
| --- | --- |
| WXML expression body | The source between `{{` and `}}`, before trimming. |
| Trimmed expression source | The expression body after removing leading and trailing whitespace. |
| Normal expression | A WXML expression body that is intended to parse as a single JavaScript expression after SWC wrapper parsing and WXML post-validation. It excludes WXML-only template data syntax such as `text: 'forbar'` and `...item`. |
| WXML template data | The WXML-only grammar inside `<template data="{{...}}">`. It constructs the object scope passed to the template and is normalized by the parser into an `ObjectLit`. |
| WXML template data spread | A template data item such as `...item`. It is normalized into an object spread property inside `TemplateData.object`. |
| Compatibility-open expression | A syntactically valid JavaScript expression whose WXML compatibility behavior is not yet fixed by this document. |

Rules:

- The parser trims leading and trailing whitespace before parsing.
- The trimmed source is preserved as expression raw source.
- This document does not define runtime evaluation semantics. It defines parse
  shape, AST storage, rejection categories, and diagnostic minimums.

## 2. Output Contract

Public expression parser APIs:

```rust
pub fn parse_wxml_expression(
    source_file: Option<PathBuf>,
    source: &str,
) -> Result<ExprContainer, WxmlExpressionError>;

pub fn parse_template_data(
    source_file: Option<PathBuf>,
    source: &str,
) -> Result<TemplateData, WxmlTemplateDataError>;
```

Rules:

- `source_file` preserves the caller-provided path exactly when available.
- The parser must not canonicalize, resolve, normalize, or require the path to
  exist.
- Expression and template-data diagnostic `source_file` behavior is verified
  by parser owner tests.

Normal expression parsing returns:

```rust
pub struct WxmlExpression {
    source: String,
    expr: Box<Expr>,
}
```

The WXML parser then embeds it in:

```rust
pub struct ExprContainer {
    pub span: Span,
    pub expr: Box<Expr>,
    pub raw: Atom,
}
```

Rules:

- `raw` is the trimmed expression source without `{{` and `}}`.
- `span` is the WXML source span for the expression body, not the SWC wrapper
  span.
- `expr` is the parsed `swc_ecma_ast::Expr`.
- Invalid expressions do not produce placeholder expression nodes.

## 3. Current SWC Wrapper Strategy

The current implementation parses normal expressions by wrapping the source in
a JavaScript variable initializer:

```js
const __dimina_wxml_expression = (<source>);
```

Then it:

1. Parses the wrapper with SWC.
2. Extracts the single variable initializer expression.
3. Recursively unwraps `Expr::Paren`.
4. Returns the inner `Expr`.

This strategy intentionally forces expression-position parsing instead of
statement parsing.

Wrapper assumptions and failure contract:

- The wrapper identifier is an internal parse carrier. It is not runtime code
  and does not bind into user scope, so a user expression containing
  `__dimina_wxml_expression` is not a scope collision.
- If SWC cannot parse the wrapper, the expression parser returns a syntax
  error.
- If the parsed module is not the expected single variable declaration with a
  single initializer, the expression parser returns a wrapper extraction error.
- If SWC parses the wrapper but the extracted expression is a category rejected
  by WXML, the expression parser returns a rejected-category error.

Normal expressions and Template-data entry expressions share one internal
category owner:

```rust
pub(crate) fn validate_accepted_expression(
    expr: &Expr,
) -> Result<(), ExpressionCategoryError>;
```

`ExpressionCategoryError` retains the rejected category, reason, and SWC span
needed for caller-specific remapping. `parse_wxml_expression` and
`parse_template_data` must both call this function; neither parser may clone,
wrap, weaken, or extend the accepted category matrix. The implementation may
keep lower-level recursive helpers private, but there is exactly one entry point
that owns the final accepted/rejected result.

Examples:

| Source | Wrapper result | WXML result |
| --- | --- | --- |
| `user.name` | Parses and extracts member expression | Accepted normal expression |
| `const` | SWC parse error inside initializer | Syntax error |
| `a = 1` | SWC parses assignment expression | Rejected category |
| `...item` | Wrapper parse fails because `(...item)` is not an expression | WXML template data path, not normal expression |

## 4. Normal Expression Categories

The normal expression parser should accept expression shapes commonly used in
WXML bindings.

| Category | Examples | Notes |
| --- | --- | --- |
| Identifier | `message`, `item` | Includes `undefined` as identifier-shaped source. |
| Member access | `user.name`, `event.detail.value` | Computed member access is accepted. |
| Optional chaining | `user?.name`, `obj?.[key]`, `fn?.()` | **Accepted** (2026-06-27) |
| Index access | `items[index]`, `array[0]` | Computed member access is accepted. |
| Call expression | `utils.format(value)`, `fn(...args)` | Call spread **accepted** (2026-06-27) |
| Literal | `'x'`, `"x"`, `1`, `true`, `false`, `null` | String, number, boolean, null literals. |
| Template literal | `` `Hello ${name}` `` | **Accepted** (2026-06-27) |
| Unary | `!visible`, `-count`, `+count`, `~flags` | Arithmetic and logical unary operators. |
| typeof operator | `typeof value` | **Accepted** (2026-06-27) |
| Binary/comparison | `a + b`, `a >= b`, `id === selectedId` | Normal JavaScript binary operators. |
| Logical | `a && b`, `a || b` | Logical AND/OR operators. |
| Nullish coalescing | `value ?? 'default'` | **Accepted** (2026-06-27) |
| Conditional | `ok ? a : b` | Ternary expression. |
| Grouping | `(a + b) * c` | Stored as the inner expression after paren unwrapping where applicable. |
| Array literal | `[a, b, c]`, `[...items]` | Array spread **accepted** (2026-06-27) |
| Object literal | `{ name: user.name }` | See object literal detail below. |

Object literal detail:

| Shape | Status | Example |
| --- | --- | --- |
| Key-value property | Accepted | `{ name: user.name }` |
| Shorthand property | **Accepted** (2026-06-27) | `{ name }` |
| Computed property key | **Accepted** (2026-06-27) | `{ [key]: value }` |
| Object spread | **Accepted** (2026-06-27) | `{ ...user, age: 18 }` |
| Method shorthand | Rejected | `{ method() {} }` |

Array literal detail:

| Shape | Status | Example |
| --- | --- | --- |
| Dense elements | Accepted | `[a, b, c]` |
| Array spread element | **Accepted** (2026-06-27) | `[...items]` |
| Sparse array hole | **Rejected** (2026-06-27) | `[, , c]` - use explicit `undefined` |

## 5. Rejected Normal Expression Categories

The target contract rejects expressions that are not safe binding expressions
or that conflict with WXML language restrictions.

| Category | Examples | Reason |
| --- | --- | --- |
| Empty expression | `` | No expression body after trimming. |
| Statements | `if (a) { b }` | WXML interpolation accepts expressions, not statements. |
| Assignment | `a = 1`, `a += 1` | Mutating binding expression. |
| Update | `i++`, `--i` | Mutating binding expression. |
| Comma expression | `a, b` | Ambiguous with WXML template data spread list and easy to misuse. |
| `new` expression | `new Date()` | Runtime object construction policy is not part of parser contract. |
| Function/class definitions | `function () {}`, `class A {}` | Creates executable definitions in binding position. |
| Arrow functions | `x => x.active` | **Rejected** (2026-06-27) - Logic belongs in JS layer. |
| Await/yield | `await value`, `yield value` | Async/generator context is not available in WXML bindings. |
| `super` | `super.x` | Class context is not available in WXML bindings. |
| Dynamic import | `import(path)` | Module loading is not expression-parser-owned. |
| Tagged template | `` tag`x` `` | Runtime tag call semantics are not part of WXML binding contract. |
| `this` expression | `this.data.value` | **Rejected** (2026-06-27) - Use direct data references. |
| RegExp literal | `/pattern/g` | **Rejected** (2026-06-27) - Logic belongs in JS layer. |
| `void` operator | `void expr` | **Rejected** (2026-06-27) - No template use case. |
| `delete` operator | `delete obj.prop` | **Rejected** (2026-06-27) - Templates must be side-effect-free. |
| Array holes | `[, , c]` | **Rejected** (2026-06-27) - Use explicit `undefined`. |

If SWC accepts one of these shapes, the WXML expression layer must still reject
it. That validation should be implemented as an AST post-check after SWC
parsing.

## 6. Compatibility-Open Expression Categories

**Decision record:** All compatibility-open categories were decided on
2026-06-27.

See [COMPATIBILITY_DECISIONS.md](./COMPATIBILITY_DECISIONS.md) for detailed decision rationale.

Previously compatibility-open categories and their final decisions:

| Category | Examples | Final Decision |
| --- | --- | --- |
| Optional chaining | `user?.name`, `obj?.[key]`, `fn?.()` | **Accepted** - Modern JS feature, widely supported |
| Nullish coalescing | `value ?? 'default'` | **Accepted** - Essential for null/undefined handling |
| Template literal | `` `Hello ${name}` `` | **Accepted** - Common templating need |
| Object spread | `{ ...user, age: 18 }` | **Accepted** - Standard JS pattern |
| Array spread | `[...items, newItem]` | **Accepted** - Standard JS pattern |
| Call spread | `fn(...args)` | **Accepted** - Standard JS pattern |
| Object shorthand | `{ name, age }` | **Accepted** - Standard JS pattern |
| Computed property key | `{ [keyName]: value }` | **Accepted** - Dynamic property access |
| typeof operator | `typeof value` | **Accepted** - Safe type introspection |
| Arrow function | `items.filter(item => item.active)` | **Rejected** - Logic belongs in JS layer |
| Array holes | `[, , third]` | **Rejected** - Unclear semantics |
| RegExp literal | `/pattern/g` | **Rejected** - Logic belongs in JS layer |
| `this` usage | `this.data.value` | **Rejected** - Use direct data references |
| `void` operator | `void expr` | **Rejected** - No template use case |
| `delete` operator | `delete obj.prop` | **Rejected** - Side effects not allowed |

## 7. WXML Template Data

WXML has a special data grammar used by `<template data="...">`:

```wxml
<template is="card" data="{{text: 'forbar'}}" />
<template is="card" data="{{...item}}" />
<template is="card" data="{{...obj1, ...obj2}}" />
<template is="card" data="{{...{ name: user.name }}}" />
```

This section is about `<template data="{{...}}">` only. It does not decide
ordinary JavaScript spread inside arrays, objects, or function calls:

```wxml
{{[...items]}}
{{{ ...user, age: 18 }}}
{{func(...args)}}
```

Ordinary JavaScript spread in arrays, objects, and function calls are **accepted**
as of 2026-06-27. See [COMPATIBILITY_DECISIONS.md](./COMPATIBILITY_DECISIONS.md).

Template data bodies are not always normal JavaScript expressions:

- `data="{{text: 'forbar'}}"` is not a JavaScript expression unless wrapped as
  an object literal.
- `data="{{...item}}"` is not a JavaScript expression unless wrapped as an
  object literal spread.

AST contract:

```rust
pub struct TemplateRef {
    pub span: Span,
    pub target: Option<Value>,
    pub data: Option<TemplateData>,
}

pub struct TemplateData {
    pub span: Span,
    pub raw: Atom,
    pub object: ObjectLit,
}
```

Parser normalization:

| WXML source | Composed object AST shape | AST |
| --- | --- | --- |
| `data="{{text: 'forbar'}}"` | `({ ["text"]: 'forbar' })` | `TemplateData { object: ObjectLit }` |
| `data="{{item}}"` | `({ item })` | `TemplateData { object: ObjectLit }` |
| `data="{{foo, bar}}"` | `({ foo, bar })` | `TemplateData { object: ObjectLit }` |
| `data="{{...item}}"` | `({ ...item })` | `TemplateData { object: ObjectLit }` |
| `data="{{...obj1, ...obj2, a, c: 6}}"` | `({ ...obj1, ...obj2, a, ["c"]: 6 })` | `TemplateData { object: ObjectLit }` |
| `data="{{...{ name: user.name }}}"` | `({ ...{ name: user.name } })` | `TemplateData { object: ObjectLit }` |

Extraction rule:

- An internal token-aware scanner identifies the exact source range of each
  top-level Template-data entry while respecting strings, comments, template
  literals, and nested `()`, `[]`, and `{}` delimiters. It cannot use source-
  wide string replacement or split on commas or colons, and it does not parse
  JavaScript expression semantics itself.
- The parser wraps and parses each isolated entry independently as a one-entry
  SWC object literal, then extracts exactly one `PropOrSpread`. A wrapper that
  does not yield exactly one entry is `InvalidTemplateData`.
- Before static-key normalization, the parser validates every authored
  expression in the extracted entry through
  `validate_accepted_expression`: shorthand validates its identifier; a static
  property validates only its value; an authored computed property validates
  key then value; and a spread validates its operand. Nested object, array,
  member, call, and other accepted shapes recurse through that same validator.
  Getter, setter, and method properties remain rejected. Synthetic static keys
  do not enter user-expression validation.
- After extraction, the parser normalizes each top-level static property key in
  the SWC AST to an equivalent computed property. Shorthand, spread, and
  authored computed entries retain their existing shape:

  ```text
  foo: value          -> ["foo"]: value
  "foo": value        -> ["foo"]: value
  1: value            -> [1]: value
  __proto__: value    -> ["__proto__"]: value
  foo                 -> foo
  ...source           -> ...source
  [key]: value        -> [key]: value
  ```

- Extracted entries are composed in authored order into one final
  `Expr::Object(ObjectLit)`. The parser does not reparse a synthesized complete
  normalized source. This avoids JavaScript's duplicate-`__proto__` early error
  and prevents one synthetic key's byte length from shifting later source
  positions.
- The scanner, isolated entry ranges, and wrappers are ephemeral. They cannot
  reinterpret nested object literals or create a persistent `TemplateDataPart`
  AST. The returned shape remains `TemplateData.object: ObjectLit`; the parser
  must not return `Value` or a normal `ExprContainer`.

Rules:

- `TemplateData.raw` contains the trimmed template data body content: the content
  between `{{` and `}}` with leading and trailing whitespace removed. For example,
  `data="{{foo}}"` yields `raw = "foo"`, and `data="{{ foo, bar }}"` yields
  `raw = "foo, bar"`.
- `TemplateData.span` is the WXML source span pointing to the exact location of
  the trimmed body. This satisfies the reversibility contract (E12):
  `source[span.lo..span.hi] == TemplateData.raw`.
- `TemplateData.object` is the normalized `swc_ecma_ast::ObjectLit`.
- The parser must not expose or persist a separate `TemplateDataPart` grammar
  when SWC `ObjectLit` can represent the normalized properties and spreads
  directly. A short-lived token-aware entry scanner is permitted and required
  for normalization; it is not a public AST or a second semantic owner.
- The parser should not store template data as `Value`, because its input
  grammar is not an ordinary WXML value expression.
- Identifier-only entries are object shorthand entries. For example,
  `data="{{item}}"` becomes `{ item: item }`, not `{ ...item }`.
- This shorthand rule is scoped to WXML template data. Ordinary object
  shorthand properties in normal expressions like `{{ { name } }}` are **accepted**
  as of 2026-06-27.
- Mixed entries preserve source order. Runtime/lowering must follow object
  literal overwrite behavior: later properties override earlier properties with
  the same key.
- Static property normalization gives every top-level static key ordinary data
  semantics. In particular, one or several authored `__proto__: value` or
  `"__proto__": value` entries parse successfully, remain ordered, and use the
  same later-write-wins rule. They never become JavaScript object-literal
  prototype setters and cannot trigger JavaScript's duplicate-`__proto__`
  early error. This rule is limited to Template data's top level; nested object
  literals retain ordinary accepted JavaScript semantics.
- Synthetic computed keys are semantically indistinguishable from authored
  computed keys to downstream Compiler consumers. A synthetic static key is a
  Constant key expression and does not make Template data RuntimeDependent.
- Every isolated entry wrapper has its own authored byte range. Copied key,
  value, spread-operand, and shorthand spans are remapped relative to that
  range before composition; an earlier synthetic key cannot shift a later
  entry. The final `ObjectLit.span` is `TemplateData.span`. `TemplateData.raw`
  and `TemplateData.span` always retain authored WXML source. A synthetic
  computed key maps back to the complete authored property-key span; generated
  brackets or quotes have no independent user diagnostic location.

Reference evidence:

- Tencent Cloud WXML template documentation shows
  `<template is="msgItem" data="{{...item}}"/>`.
- The same documentation shows `<template is="item" data="{{text: 'forbar'}}"/>`.
- Tencent Cloud WXML data binding documentation shows object shorthand:
  `data="{{foo, bar}}"` becomes `{ foo: foo, bar: bar }`.
- Tencent Cloud WXML data binding documentation states that mixed template data
  entries are allowed and later duplicate keys overwrite earlier ones.
- Existing local `WXML-LANGUAGE-SPEC.md` already lists
  `data="{{...{name: name, age: age}}}"` and
  `data="{{...obj1, ...obj2}}"`.

## 8. TemplateValue Expressions

`TemplateValue` stores WXML parts, not `Expr::Tpl`:

```rust
pub struct TemplateValue {
    pub span: Span,
    pub raw: Atom,
    pub parts: Vec<TemplatePart>,
}
```

Rules:

- Each dynamic part invokes the expression parser independently.
- Static parts preserve `StaticValue { value, raw, span }`.
- The AST does not store a synthesized JavaScript template literal.
- Later lowering may produce a runtime expression or `Expr::Tpl` if needed.

Parsing flow examples:

| Source value | AST shape |
| --- | --- |
| `{{a}}` | `Value::Expr(a)` |
| `{{a}}{{b}}` | `Value::Template([Expr(a), Expr(b)])` |
| `{{a}}   {{b}}` | `Value::Template([Expr(a), Static("   "), Expr(b)])` |
| `Hello {{name}} &amp; World` | `Value::Template([Static("Hello "), Expr(name), Static(" & World")])` |

Static value decoding:

- `StaticValue.raw` preserves the source spelling.
- `StaticValue.value` stores decoded text after WXML entity handling.
- Entity decoding belongs to static value parsing, not expression parsing.

Malformed template value handling:

- Unclosed `{{` is a WXML value parse error.
- Unmatched `}}` in static text is a WXML value parse error unless the language
  spec later defines escaping.
- Empty dynamic part, such as `{{ }}`, is an expression error.

## 9. Error Contract

### 9.1 Normal Expression Errors

Target structured error shape for normal expressions:

```rust
pub struct WxmlExpressionError {
    pub span: Span,
    pub source_file: Option<PathBuf>,
    pub kind: WxmlExpressionErrorKind,
    pub message: String,
}

pub enum WxmlExpressionErrorKind {
    Empty,
    Syntax,
    RejectedCategory,
    WrapperExtraction,
}
```

Minimum behavior:

| Kind | When |
| --- | --- |
| `Empty` | Trimmed expression source is empty. |
| `Syntax` | SWC cannot parse the wrapper or reports parser errors. |
| `RejectedCategory` | SWC parses the expression, but WXML post-check rejects its AST category. |
| `WrapperExtraction` | The parsed wrapper is not the expected single initializer expression. |

Diagnostic requirements:

- Every error must identify the WXML expression body span, not the wrapper span.
- Every error must preserve the caller-provided `source_file` when available.
- Diagnostics should distinguish syntax errors from unsupported categories.
- Rejected categories should name the rejected category where possible, such as
  `assignment expression is not allowed in WXML binding`.

Current diagnostic implementation status:

- ✅ Category-specific error messages implemented for all rejected categories
- ✅ Structured error kinds: `RejectedCategory`, `Syntax`, `Empty`
- ✅ Expression body span identification for top-level expressions
- ✅ Nested expression span precision: tested for arrays, objects, calls, conditionals
- `source_file` field behavior is covered by parser owner tests
- ⚠️ Untested nested expression shapes may still need span precision verification

Example current diagnostics:

```text
assignment expression is not allowed in WXML binding         (RejectedCategory)
arrow function (templates should not define logic) is not allowed in WXML binding  (RejectedCategory)
dynamic import is not allowed in WXML binding                (RejectedCategory)
this expression (use direct data references) is not allowed in WXML binding  (RejectedCategory)
```

All expression categories have been decided as of 2026-06-27. See [COMPATIBILITY_DECISIONS.md](./COMPATIBILITY_DECISIONS.md)
for the final decisions on previously compatibility-open categories.

### 9.2 Template Data Errors

Template data is not a normal expression, but it may reuse the same SWC parse
helper internally.

Target structured error shape for template data:

```rust
pub struct WxmlTemplateDataError {
    pub span: Span,
    pub source_file: Option<PathBuf>,
    pub kind: WxmlTemplateDataErrorKind,
    pub message: String,
}

pub enum WxmlTemplateDataErrorKind {
    Empty,
    Syntax,
    InvalidTemplateData,
    RejectedExpression(ExpressionCategoryError),
}
```

Minimum behavior:

| Kind | When |
| --- | --- |
| `Empty` | Trimmed template data source is empty. |
| `Syntax` | Token-aware entry isolation or one isolated object-literal wrapper cannot be parsed. |
| `InvalidTemplateData` | An isolated wrapper does not extract exactly one accepted Template-data entry. |
| `RejectedExpression` | An authored shorthand, computed key, property value, spread operand, or nested expression is outside the shared WXML accepted-expression categories. |

Template data diagnostics must identify the `data` expression body span,
preserve the caller-provided `source_file` when available, and mention that
template data expects object-scope syntax. `RejectedExpression` retains the
shared category reason. After entry-local span remapping, it points to the
rejected computed-key expression, value expression, spread operand, or nested
subexpression. If that precise remap is unavailable, it falls back to the
isolated authored entry span, never a wrapper span or automatically the complete
`TemplateData.span`.

## 10. Span And Source Mapping

The SWC wrapper changes byte offsets.

Example:

```text
WXML source:     class="{{user.name}}"
                         ^^^^^^^^^ span in WXML source

Expression body: user.name
                 ^^^^^^^^^ offset 0 in trimmed expression source

Wrapper source:  const __dimina_wxml_expression = (user.name);
                                                    ^^^^^^^^^ wrapper offset
```

The real problem:

- SWC returns spans based on the wrapper source.
- WXML diagnostics need spans based on the original WXML source.
- `ExprContainer.span` is already the WXML expression body span.

Contract until remapping exists:

- `ExprContainer.span` is the authoritative WXML span for expression-level
  diagnostics.
- Internal SWC expression spans must not be exposed as WXML spans unless they
  are remapped.
- If a diagnostic points to a nested expression subrange, it must either use a
  remapped span or use `ExprContainer.span`.

Open design decision:

```text
Should parser remap all SWC expression internals at parse time, or should
diagnostic/sourcemap work introduce a remap table consumed by later phases?
```

## 11. Current Implementation Gap And Impact

Current `expression.rs` already supports:

- trimming expression source,
- rejecting empty source,
- SWC wrapper parsing,
- extracting the wrapper initializer,
- unwrapping parentheses,
- tests for identifier, member path, call, and invalid source.

Implementation status and remaining gaps:

| Item | Status |
| --- | --- |
| Post-parse rejection for assignment/update/comma/new/function/class/etc. | ✅ Implemented via `RejectedCategory` error kind |
| Post-parse deferral for compatibility-open categories | ✅ Deprecated - all categories decided (2026-06-27) |
| Structured expression diagnostics | ✅ Implemented with category-specific error messages |
| WXML template data normalization | Basic whole-body object-wrapper parsing exists; token-aware entry isolation, single-entry SWC parsing, shared authored-expression validation, AST static-key normalization, safe repeated `__proto__`, per-entry span remapping, and final ObjectLit composition are implementation gaps required by this contract |
| Shared expression-category owner | `expression.rs` has recursive category logic, but extracting one crate-private final validator entry point and calling it for Template-data shorthand/key/value/spread paths remain implementation gaps |
| Source-span remapping for internal SWC spans | ⚠️ Partial: top-level spans work, nested expression errors may point at whole body |
| Compatibility-open category decisions | ✅ Completed - all 15 categories decided (9 accepted, 6 rejected) |
| Broader expression parity testing | ✅ Core matrix fully covered with 205 expression category tests (192 core + 13 bypass prevention) |

Note: Passing existing parser tests validates the three-state decision system
(accepted/rejected/deferred). The matrix-based validation provides contract enforcement.
As of 2026-06-27, all compatibility-open categories have been decided - see
COMPATIBILITY_DECISIONS.md for rationale.

## 12. Current Implementation Evidence

The accepted/rejected matrix and recursive post-check over ordinary
`swc_ecma_ast::Expr` inputs exist in `expression.rs`, with focused category
tests and structured expression diagnostics. That evidence applies to the
ordinary expression entry point only.

`template_data.rs` still parses one synthesized whole-body object wrapper and
extracts an `ObjectLit` directly. It does not yet isolate entries, normalize
static keys in AST, call the shared final category validator, or remap rejected
entry expressions independently. Existing Template-data parsing therefore does
not satisfy the target contract in this document. Required implementation work
is the gap table in Section 11; passing the existing ordinary-expression or
Template-data extraction tests cannot close it.
