# Expression Category Decision System

**Last Updated:** 2026-06-27
**Status:** complete

**Evidence:** all compatibility-open categories are decided.

## Overview

The WXML expression validator uses a three-state decision system to classify JavaScript expressions:

1. **Accepted** - Explicitly supported and tested
2. **Rejected** - Explicitly not allowed, will error
3. **Deferred** - Compatibility-open (DEPRECATED - all categories decided as of 2026-06-27)

## Decision Categories

### ✅ Accepted Categories

These are explicitly supported and have test coverage (137 tests):

**Basic Expressions:**
- Identifiers: `message`, `item`
- Member access: `user.name`, `items[0]`
- Binary operators: `a + b`, `a >= b`
- Logical operators: `a && b`, `a || b`
- Unary operators: `!visible`, `-count`, `+value`, `~flags`
- Conditional: `ok ? a : b`
- Call expressions: `utils.format(value)`
- Literals: `'string'`, `123`, `true`, `false`, `null`, `undefined`
- Arrays: `[a, b, c]`
- Objects: `{ name: user.name }`
- Grouping: `(a + b) * c`

**Modern JavaScript Features (Added 2026-06-27):**
- **Optional chaining**: `user?.name`, `obj?.[key]`, `fn?.()`
- **Nullish coalescing**: `value ?? 'default'`
- **Template literals**: `` `Hello ${name}` ``
- **Object spread**: `{...user, age: 18}`
- **Array spread**: `[...items, newItem]`
- **Call spread**: `fn(...args)`
- **Object shorthand**: `{name, age}` (shorthand for `{name: name, age: age}`)
- **Computed property keys**: `{[keyName]: value}`
- **typeof operator**: `typeof value`

### ❌ Rejected Categories

These are explicitly not allowed and will produce errors (51 tests):

**Assignment & Mutation:**
- Assignment: `a = 1`, `a += 1`, `a -= 1`, etc.
- Update: `i++`, `--i`
- Delete operator: `delete obj.prop` (side effect)

**Control Flow & Declarations:**
- Comma: `a, b`
- New: `new Date()`
- Function: `function() {}`
- Class: `class A {}`
- Arrow functions: `x => x.active` (logic belongs in JS layer)
- Await: `await value`
- Yield: `yield value`

**Context & Advanced Features:**
- Super property: `super.x`
- Super call: `super()`
- Tagged template: `` tag`string` ``
- Method properties: `{ method() {} }`
- Dynamic import: `import('./module.js')`
- This expression: `this.data.value` (use direct data references)
- RegExp literals: `/pattern/g` (logic belongs in JS layer)
- Void operator: `void expression` (no template use case)
- Array holes: `[,, third]` (unclear semantics)

### ⚠️ Deferred Categories (DEPRECATED)

**Decision record:** all compatibility-open categories were decided on
2026-06-27.

See [COMPATIBILITY_DECISIONS.md](./COMPATIBILITY_DECISIONS.md) for the decision rationale.

## Decision Principles

The three-state system served its purpose during the compatibility research phase. Decisions were made based on:

1. **Safety**: Does this feature introduce side effects or mutation?
2. **Utility**: Is this feature commonly needed in template expressions?
3. **Complexity**: Does this add significant parsing/runtime complexity?
4. **Philosophy**: Templates should use pure expressions, not define logic

**Core principle:** Templates are for rendering, not for logic.

## Implementation

```rust
enum ExprDecision {
    Accepted,
    Rejected(&'static str, Span),
    Deferred(&'static str, Span),  // Safety-net for uncategorized expressions
}
```

**Note on Deferred:** No named compatibility-open category remains deferred as of 2026-06-27.
Deferred is kept as a safety-net for uncategorized/new ES features to prevent unknown
expressions from silently passing through validation.

The validator recursively checks expressions:

```rust
match expr {
    Expr::Assign(_) => Rejected("assignment expression"),
    Expr::Arrow(_) => Rejected("arrow function (templates should not define logic)"),
    Expr::OptChain(_) => Accepted,  // Newly accepted
    Expr::Ident(_) => Accepted,
    // ...
}
```

## Error Messages

**Rejected categories**:
```
arrow function (templates should not define logic) is not allowed in WXML binding
```

**Deferred categories** (no longer used):
```
arrow function is not yet supported in WXML binding (compatibility-open)
```

## Migration from Deferred

Previously deferred categories were resolved as follows:

**Promoted to Accepted (9 features):**
- Optional chaining (`?.`)
- Nullish coalescing (`??`)
- Template literals
- Object spread
- Array spread
- Call spread
- Object shorthand
- Computed property keys
- typeof operator

**Changed to Rejected (6 features):**
- Arrow functions
- Array holes
- RegExp literals
- this expression
- void operator
- delete operator

## See Also

- [COMPATIBILITY_DECISIONS.md](./COMPATIBILITY_DECISIONS.md) - Detailed decision rationale
- [WXML-EXPRESSION-SPEC.md](./WXML-EXPRESSION-SPEC.md) - Complete expression specification
- [WXML-LANGUAGE-SPEC.md](./WXML-LANGUAGE-SPEC.md) - WXML language reference
