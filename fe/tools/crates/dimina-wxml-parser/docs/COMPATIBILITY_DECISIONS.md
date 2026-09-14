# Compatibility-Open Expression Category Decisions

**Date:** 2026-06-27
**Status:** complete
**Evidence:** all decisions are implemented and tested.
**Purpose:** Document decisions for compatibility-open expression categories

## Decision Process

This document records final decisions for all compatibility-open (deferred) expression categories listed in EXPRESSION_DECISION_SYSTEM.md. Each decision is based on:

1. **Safety**: Does this feature introduce side effects or mutation?
2. **Utility**: Is this feature commonly needed in template expressions?
3. **Complexity**: Does this add significant parsing/runtime complexity?
4. **Precedent**: Do similar template systems support this?

## Decision Summary

| Feature | Decision | Priority | Reason |
|---------|----------|----------|--------|
| Optional chaining (`?.`) | ✅ **Accept** | High | Safe, useful for null handling |
| Nullish coalescing (`??`) | ✅ **Accept** | High | Safe, better than `\|\|` for defaults |
| Template literals | ✅ **Accept** | Medium | Safe, useful for string composition |
| Arrow functions | ❌ **Reject** | Medium | Breaks pure-expression model |
| Object spread | ✅ **Accept** | Medium | Safe, useful for data composition |
| Array spread | ✅ **Accept** | Medium | Safe, useful for array composition |
| Call spread | ✅ **Accept** | Medium | Safe, needed with spread data |
| Object shorthand | ✅ **Accept** | Low | Syntactic sugar, common pattern |
| Computed property keys | ✅ **Accept** | Low | Safe, dynamic key access |
| Array holes | ❌ **Reject** | Low | Unclear semantics, rare use |
| RegExp literals | ❌ **Reject** | Low | Better done in JS logic |
| `this` expression | ❌ **Reject** | Low | Implicit context, breaks clarity |
| `typeof` operator | ✅ **Accept** | Low | Safe introspection |
| `void` operator | ❌ **Reject** | Low | No template use case |
| `delete` operator | ❌ **Reject** | Low | Side effect, mutation |

## Detailed Decisions

### Priority: High

#### ✅ Optional Chaining (`user?.name`)

**Decision: Accept**

**Rationale:**
- **Safety**: Pure read operation, no side effects
- **Utility**: Extremely common in templates to avoid `Cannot read property of undefined`
- **Precedent**: Supported by modern template systems (Vue 3.2+, Angular 12+)
- **Example use case**:
  ```wxml
  <view>{{user?.profile?.name ?? 'Anonymous'}}</view>
  ```

**Migration**: Change `DeferredCategory` → `Accepted` in validator

---

#### ✅ Nullish Coalescing (`value ?? 'default'`)

**Decision: Accept**

**Rationale:**
- **Safety**: Pure expression, no side effects
- **Utility**: Better default value semantics than `||` (doesn't treat `0`, `''`, `false` as nullish)
- **Precedent**: ES2020 standard, widely adopted
- **Example use case**:
  ```wxml
  <view>{{count ?? 0}}</view>  <!-- count=0 renders "0", not default -->
  <view>{{count || 0}}</view>  <!-- count=0 renders "0" due to || -->
  ```

**Migration**: Change `DeferredCategory` → `Accepted` in validator

---

### Priority: Medium

#### ✅ Template Literals (`` `Hello ${name}` ``)

**Decision: Accept**

**Rationale:**
- **Safety**: Pure string composition, no side effects
- **Utility**: Much cleaner than string concatenation for multi-part strings
- **Complexity**: Already parsed by SWC, no additional effort
- **Example use case**:
  ```wxml
  <view>{{'Hello ' + name + ', you have ' + count + ' items'}}</view>
  <!-- vs -->
  <view>{{`Hello ${name}, you have ${count} items`}}</view>
  ```

**Migration**: Change `DeferredCategory` → `Accepted` in validator

---

#### ❌ Arrow Functions (`items.filter(x => x.active)`)

**Decision: Reject**

**Rationale:**
- **Safety**: Introduces function declarations in templates
- **Philosophy**: Templates should use pure expressions, not define logic
- **Alternative**: Data transformation belongs in JS/TS logic layer
- **Complexity**: Would need to validate no side effects in arrow body
- **Example anti-pattern**:
  ```wxml
  <!-- ❌ Bad: logic in template -->
  <view wx:for="{{items.filter(x => x.active)}}">...</view>

  <!-- ✅ Good: logic in JS -->
  Page({ data: { activeItems: items.filter(x => x.active) } })
  <view wx:for="{{activeItems}}">...</view>
  ```

**Migration**: Change `DeferredCategory` → `RejectedCategory` in validator

---

#### ✅ Object Spread (`{...user, age: 18}`)

**Decision: Accept**

**Rationale:**
- **Safety**: Pure data composition, no side effects
- **Utility**: Clean way to override/merge object properties
- **Precedent**: ES2018, standard feature
- **Example use case**:
  ```wxml
  <custom-component data="{{...baseConfig, theme: 'dark'}}"></custom-component>
  ```

**Note**: This is different from template `data="{{...obj}}"` which has separate semantics per WXML-EXPRESSION-SPEC.md

**Migration**: Change `DeferredCategory` → `Accepted` in validator

---

#### ✅ Array Spread (`[...items, newItem]`)

**Decision: Accept**

**Rationale:**
- **Safety**: Pure array composition, no mutation
- **Utility**: Combine arrays without `.concat()`
- **Example use case**:
  ```wxml
  <view wx:for="{{[...featured, ...regular]}}">...</view>
  ```

**Migration**: Change `DeferredCategory` → `Accepted` in validator

---

#### ✅ Call Spread (`fn(...args)`)

**Decision: Accept**

**Rationale:**
- **Safety**: Pure, just unpacks array to arguments
- **Utility**: Needed when using spread elsewhere
- **Consistency**: If we accept array spread, this follows naturally
- **Example use case**:
  ```wxml
  <view>{{format(...dateComponents)}}</view>
  ```

**Migration**: Change `DeferredCategory` → `Accepted` in validator

---

### Priority: Low

#### ✅ Object Shorthand (`{name, age}`)

**Decision: Accept**

**Rationale:**
- **Safety**: Just syntactic sugar for `{name: name, age: age}`
- **Utility**: Common pattern, reduces verbosity
- **Example use case**:
  ```wxml
  <custom-component data="{{name, age, email}}"></custom-component>
  ```

**Migration**: Change `DeferredCategory` → `Accepted` in validator

---

#### ✅ Computed Property Keys (`{[keyName]: value}`)

**Decision: Accept**

**Rationale:**
- **Safety**: Pure expression evaluation
- **Utility**: Dynamic object key construction
- **Example use case**:
  ```wxml
  <view>{{ {[selectedField]: fieldValue} }}</view>
  ```

**Migration**: Change `DeferredCategory` → `Accepted` in validator

---

#### ❌ Array Holes (`[,, third]`)

**Decision: Reject**

**Rationale:**
- **Clarity**: Unclear semantics, confusing to read
- **Utility**: Extremely rare legitimate use case
- **Alternative**: Use explicit `undefined` if needed: `[undefined, undefined, third]`

**Migration**: Change `DeferredCategory` → `RejectedCategory` in validator

---

#### ❌ RegExp Literals (`/pattern/g`)

**Decision: Reject**

**Rationale:**
- **Philosophy**: Pattern matching logic belongs in JS layer
- **Complexity**: Adds regex parsing complexity
- **Alternative**: Call regex methods from JS: `utils.match(str)`
- **Example**:
  ```wxml
  <!-- ❌ Bad -->
  <view>{{text.match(/\d+/g)}}</view>

  <!-- ✅ Good -->
  <view>{{utils.extractNumbers(text)}}</view>
  ```

**Migration**: Change `DeferredCategory` → `RejectedCategory` in validator

---

#### ❌ `this` Expression (`this.data.value`)

**Decision: Reject**

**Rationale:**
- **Clarity**: `this` is implicit context, reduces clarity
- **Convention**: WXML bindings use direct data references, not `this.data.x`
- **Confusion**: In WeChat mini-programs, `data` is already the context
- **Example**:
  ```wxml
  <!-- ❌ Bad: this is unnecessary and confusing -->
  <view>{{this.data.message}}</view>

  <!-- ✅ Good: direct reference -->
  <view>{{message}}</view>
  ```

**Migration**: Change `DeferredCategory` → `RejectedCategory` in validator

---

#### ✅ `typeof` Operator (`typeof value`)

**Decision: Accept**

**Rationale:**
- **Safety**: Pure introspection, no side effects
- **Utility**: Useful for conditional rendering based on type
- **Example use case**:
  ```wxml
  <view wx:if="{{typeof error === 'string'}}">{{error}}</view>
  <view wx:else>{{error.message}}</view>
  ```

**Migration**: Change `DeferredCategory` → `Accepted` in validator

---

#### ❌ `void` Operator (`void expression`)

**Decision: Reject**

**Rationale:**
- **Utility**: No legitimate template use case
- **Purpose**: `void` is primarily for `javascript:` URLs and explicit `undefined`, not templates
- **Alternative**: Use `undefined` literal if needed

**Migration**: Change `DeferredCategory` → `RejectedCategory` in validator

---

#### ❌ `delete` Operator (`delete obj.prop`)

**Decision: Reject**

**Rationale:**
- **Safety**: **Side effect** - mutates objects
- **Philosophy**: Templates must be side-effect-free
- **Alternative**: Object transformation belongs in JS logic layer

**Migration**: Change `DeferredCategory` → `RejectedCategory` in validator

---

## Notes

- All accepted features are ES2018+ standard JavaScript features
- All rejected features either have side effects or introduce logic that belongs in JS layer
- This maintains the principle: **templates are for rendering, not for logic**
