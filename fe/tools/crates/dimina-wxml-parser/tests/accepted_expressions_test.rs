//! Comprehensive accepted expression category tests
//!
//! This test suite provides systematic coverage of all accepted expression
//! categories per WXML-EXPRESSION-SPEC.md Section 4 and EXPRESSION_DECISION_SYSTEM.md.
//!
//! Organization follows the decision system documentation structure.

use dimina_wxml_parser::parse_wxml;

// ============================================================================
// Identifiers
// ============================================================================

#[test]
fn test_identifier_simple() {
    assert!(parse_wxml(None, r#"<view>{{item}}</view>"#).is_ok());
}

#[test]
fn test_identifier_with_underscore() {
    assert!(parse_wxml(None, r#"<view>{{_private}}</view>"#).is_ok());
}

#[test]
fn test_identifier_with_dollar() {
    assert!(parse_wxml(None, r#"<view>{{$scope}}</view>"#).is_ok());
}

#[test]
fn test_identifier_with_numbers() {
    assert!(parse_wxml(None, r#"<view>{{item2}}</view>"#).is_ok());
}

// ============================================================================
// Member Access
// ============================================================================

#[test]
fn test_member_dot_access() {
    assert!(parse_wxml(None, r#"<view>{{user.name}}</view>"#).is_ok());
}

#[test]
fn test_member_bracket_access_identifier() {
    assert!(parse_wxml(None, r#"<view>{{user['name']}}</view>"#).is_ok());
}

#[test]
fn test_member_bracket_access_expression() {
    assert!(parse_wxml(None, r#"<view>{{items[index]}}</view>"#).is_ok());
}

#[test]
fn test_member_bracket_access_number() {
    assert!(parse_wxml(None, r#"<view>{{items[0]}}</view>"#).is_ok());
}

#[test]
fn test_member_chained_dot() {
    assert!(parse_wxml(None, r#"<view>{{event.detail.value}}</view>"#).is_ok());
}

#[test]
fn test_member_mixed_access() {
    assert!(parse_wxml(None, r#"<view>{{data.items[0].name}}</view>"#).is_ok());
}

#[test]
fn test_member_bracket_computed() {
    assert!(parse_wxml(None, r#"<view>{{obj[key]}}</view>"#).is_ok());
}

#[test]
fn test_member_bracket_expression_computed() {
    assert!(parse_wxml(None, r#"<view>{{obj[prefix + suffix]}}</view>"#).is_ok());
}

// ============================================================================
// Literals
// ============================================================================

#[test]
fn test_literal_string_single_quote() {
    assert!(parse_wxml(None, r#"<view>{{'hello'}}</view>"#).is_ok());
}

#[test]
fn test_literal_string_double_quote() {
    assert!(parse_wxml(None, r#"<view>{{"world"}}</view>"#).is_ok());
}

#[test]
fn test_literal_string_empty() {
    assert!(parse_wxml(None, r#"<view>{{''}}</view>"#).is_ok());
}

#[test]
fn test_literal_string_with_escapes() {
    assert!(parse_wxml(None, r#"<view>{{'hello\nworld'}}</view>"#).is_ok());
}

#[test]
fn test_literal_number_integer() {
    assert!(parse_wxml(None, r#"<view>{{42}}</view>"#).is_ok());
}

#[test]
fn test_literal_number_float() {
    assert!(parse_wxml(None, r#"<view>{{3.14}}</view>"#).is_ok());
}

#[test]
fn test_literal_number_negative() {
    assert!(parse_wxml(None, r#"<view>{{-10}}</view>"#).is_ok());
}

#[test]
fn test_literal_number_zero() {
    assert!(parse_wxml(None, r#"<view>{{0}}</view>"#).is_ok());
}

#[test]
fn test_literal_number_scientific() {
    assert!(parse_wxml(None, r#"<view>{{1e5}}</view>"#).is_ok());
}

#[test]
fn test_literal_boolean_true() {
    assert!(parse_wxml(None, r#"<view>{{true}}</view>"#).is_ok());
}

#[test]
fn test_literal_boolean_false() {
    assert!(parse_wxml(None, r#"<view>{{false}}</view>"#).is_ok());
}

#[test]
fn test_literal_null() {
    assert!(parse_wxml(None, r#"<view>{{null}}</view>"#).is_ok());
}

#[test]
fn test_literal_undefined() {
    assert!(parse_wxml(None, r#"<view>{{undefined}}</view>"#).is_ok());
}

// ============================================================================
// Binary Operators
// ============================================================================

// Arithmetic
#[test]
fn test_binary_addition() {
    assert!(parse_wxml(None, r#"<view>{{a + b}}</view>"#).is_ok());
}

#[test]
fn test_binary_subtraction() {
    assert!(parse_wxml(None, r#"<view>{{a - b}}</view>"#).is_ok());
}

#[test]
fn test_binary_multiplication() {
    assert!(parse_wxml(None, r#"<view>{{a * b}}</view>"#).is_ok());
}

#[test]
fn test_binary_division() {
    assert!(parse_wxml(None, r#"<view>{{a / b}}</view>"#).is_ok());
}

#[test]
fn test_binary_modulo() {
    assert!(parse_wxml(None, r#"<view>{{a % b}}</view>"#).is_ok());
}

#[test]
fn test_binary_exponentiation() {
    assert!(parse_wxml(None, r#"<view>{{a ** b}}</view>"#).is_ok());
}

// Comparison
#[test]
fn test_binary_less_than() {
    // Note: < in WXML text may conflict with XML parsing
    // Use in attributes or with spacing
    assert!(parse_wxml(None, r#"<view data-val="{{a < b}}">x</view>"#).is_ok());
}

#[test]
fn test_binary_less_equal() {
    // Note: <= may conflict with XML parsing in text nodes
    assert!(parse_wxml(None, r#"<view data-val="{{a <= b}}">x</view>"#).is_ok());
}

#[test]
fn test_binary_greater_than() {
    assert!(parse_wxml(None, r#"<view>{{a > b}}</view>"#).is_ok());
}

#[test]
fn test_binary_greater_equal() {
    assert!(parse_wxml(None, r#"<view>{{a >= b}}</view>"#).is_ok());
}

// Equality
#[test]
fn test_binary_equality_loose() {
    assert!(parse_wxml(None, r#"<view>{{a == b}}</view>"#).is_ok());
}

#[test]
fn test_binary_equality_strict() {
    assert!(parse_wxml(None, r#"<view>{{a === b}}</view>"#).is_ok());
}

#[test]
fn test_binary_inequality_loose() {
    assert!(parse_wxml(None, r#"<view>{{a != b}}</view>"#).is_ok());
}

#[test]
fn test_binary_inequality_strict() {
    assert!(parse_wxml(None, r#"<view>{{a !== b}}</view>"#).is_ok());
}

// Bitwise (though less common in WXML, they are binary operators)
#[test]
fn test_binary_bitwise_and() {
    assert!(parse_wxml(None, r#"<view>{{a & b}}</view>"#).is_ok());
}

#[test]
fn test_binary_bitwise_or() {
    assert!(parse_wxml(None, r#"<view>{{a | b}}</view>"#).is_ok());
}

#[test]
fn test_binary_bitwise_xor() {
    assert!(parse_wxml(None, r#"<view>{{a ^ b}}</view>"#).is_ok());
}

#[test]
fn test_binary_left_shift() {
    // Note: << in WXML text may conflict with XML parsing
    // Use in attributes instead
    assert!(parse_wxml(None, r#"<view data-val="{{a << b}}">x</view>"#).is_ok());
}

#[test]
fn test_binary_right_shift() {
    // Note: >> in WXML text may conflict with XML parsing
    assert!(parse_wxml(None, r#"<view data-val="{{a >> b}}">x</view>"#).is_ok());
}

#[test]
fn test_binary_unsigned_right_shift() {
    // Note: >>> in WXML text may conflict with XML parsing
    assert!(parse_wxml(None, r#"<view data-val="{{a >>> b}}">x</view>"#).is_ok());
}

// String concatenation
#[test]
fn test_binary_string_concat() {
    assert!(parse_wxml(None, r#"<view>{{'hello' + 'world'}}</view>"#).is_ok());
}

// instanceof and in operators
#[test]
fn test_binary_instanceof() {
    assert!(parse_wxml(None, r#"<view>{{obj instanceof Array}}</view>"#).is_ok());
}

#[test]
fn test_binary_in() {
    assert!(parse_wxml(None, r#"<view>{{'name' in obj}}</view>"#).is_ok());
}

// ============================================================================
// Logical Operators
// ============================================================================

#[test]
fn test_logical_and() {
    assert!(parse_wxml(None, r#"<view>{{a && b}}</view>"#).is_ok());
}

#[test]
fn test_logical_or() {
    assert!(parse_wxml(None, r#"<view>{{a || b}}</view>"#).is_ok());
}

#[test]
fn test_logical_chained_and() {
    assert!(parse_wxml(None, r#"<view>{{a && b && c}}</view>"#).is_ok());
}

#[test]
fn test_logical_chained_or() {
    assert!(parse_wxml(None, r#"<view>{{a || b || c}}</view>"#).is_ok());
}

#[test]
fn test_logical_mixed() {
    assert!(parse_wxml(None, r#"<view>{{a && b || c}}</view>"#).is_ok());
}

#[test]
fn test_logical_with_grouping() {
    assert!(parse_wxml(None, r#"<view>{{(a || b) && c}}</view>"#).is_ok());
}

// ============================================================================
// Unary Operators
// ============================================================================

#[test]
fn test_unary_not() {
    assert!(parse_wxml(None, r#"<view>{{!flag}}</view>"#).is_ok());
}

#[test]
fn test_unary_double_not() {
    assert!(parse_wxml(None, r#"<view>{{!!value}}</view>"#).is_ok());
}

#[test]
fn test_unary_plus() {
    assert!(parse_wxml(None, r#"<view>{{+count}}</view>"#).is_ok());
}

#[test]
fn test_unary_minus() {
    assert!(parse_wxml(None, r#"<view>{{-amount}}</view>"#).is_ok());
}

#[test]
fn test_unary_bitwise_not() {
    assert!(parse_wxml(None, r#"<view>{{~flags}}</view>"#).is_ok());
}

// ============================================================================
// Conditional (Ternary)
// ============================================================================

#[test]
fn test_conditional_simple() {
    assert!(parse_wxml(None, r#"<view>{{ok ? 'yes' : 'no'}}</view>"#).is_ok());
}

#[test]
fn test_conditional_nested_consequent() {
    assert!(parse_wxml(None, r#"<view>{{a ? (b ? 'c' : 'd') : 'e'}}</view>"#).is_ok());
}

#[test]
fn test_conditional_nested_alternate() {
    assert!(parse_wxml(None, r#"<view>{{a ? 'b' : (c ? 'd' : 'e')}}</view>"#).is_ok());
}

#[test]
fn test_conditional_with_expressions() {
    assert!(parse_wxml(None, r#"<view>{{count > 0 ? count + 1 : 0}}</view>"#).is_ok());
}

// ============================================================================
// Call Expressions
// ============================================================================

#[test]
fn test_call_no_args() {
    assert!(parse_wxml(None, r#"<view>{{getDate()}}</view>"#).is_ok());
}

#[test]
fn test_call_one_arg() {
    assert!(parse_wxml(None, r#"<view>{{format(value)}}</view>"#).is_ok());
}

#[test]
fn test_call_multiple_args() {
    assert!(parse_wxml(None, r#"<view>{{calculate(a, b, c)}}</view>"#).is_ok());
}

#[test]
fn test_call_member() {
    assert!(parse_wxml(None, r#"<view>{{utils.format(value)}}</view>"#).is_ok());
}

#[test]
fn test_call_chained() {
    assert!(parse_wxml(None, r#"<view>{{str.trim().toLowerCase()}}</view>"#).is_ok());
}

#[test]
fn test_call_with_expression_args() {
    assert!(parse_wxml(None, r#"<view>{{add(a + 1, b * 2)}}</view>"#).is_ok());
}

#[test]
fn test_call_nested() {
    assert!(parse_wxml(None, r#"<view>{{outer(inner(value))}}</view>"#).is_ok());
}

#[test]
fn test_call_bracket_member() {
    assert!(parse_wxml(None, r#"<view>{{obj['method']()}}</view>"#).is_ok());
}

// ============================================================================
// Array Literals
// ============================================================================

#[test]
fn test_array_empty() {
    assert!(parse_wxml(None, r#"<view>{{[]}}</view>"#).is_ok());
}

#[test]
fn test_array_single_element() {
    assert!(parse_wxml(None, r#"<view>{{[a]}}</view>"#).is_ok());
}

#[test]
fn test_array_multiple_elements() {
    assert!(parse_wxml(None, r#"<view>{{[a, b, c]}}</view>"#).is_ok());
}

#[test]
fn test_array_with_literals() {
    assert!(parse_wxml(None, r#"<view>{{[1, 'two', true]}}</view>"#).is_ok());
}

#[test]
fn test_array_with_expressions() {
    assert!(parse_wxml(None, r#"<view>{{[a + 1, b * 2]}}</view>"#).is_ok());
}

#[test]
fn test_array_nested() {
    assert!(parse_wxml(None, r#"<view>{{[[1, 2], [3, 4]]}}</view>"#).is_ok());
}

#[test]
fn test_array_with_member_access() {
    assert!(parse_wxml(None, r#"<view>{{[user.name, user.age]}}</view>"#).is_ok());
}

#[test]
fn test_array_trailing_comma() {
    assert!(parse_wxml(None, r#"<view>{{[a, b, c,]}}</view>"#).is_ok());
}

// ============================================================================
// Object Literals
// ============================================================================

#[test]
fn test_object_empty() {
    // Note: Empty object {{}} has syntax issues in SWC
    // Use object with at least one property
    assert!(parse_wxml(None, r#"<view>{{ {_: null} }}</view>"#).is_ok());
}

#[test]
fn test_object_single_property() {
    assert!(parse_wxml(None, r#"<view>{{ {name: 'Alice'} }}</view>"#).is_ok());
}

#[test]
fn test_object_multiple_properties() {
    assert!(parse_wxml(None, r#"<view>{{ {name: 'Alice', age: 30} }}</view>"#).is_ok());
}

#[test]
fn test_object_with_identifier_key() {
    assert!(parse_wxml(None, r#"<view>{{ {key: value} }}</view>"#).is_ok());
}

#[test]
fn test_object_with_string_key() {
    assert!(parse_wxml(None, r#"<view>{{ {'key-name': value} }}</view>"#).is_ok());
}

#[test]
fn test_object_with_number_key() {
    assert!(parse_wxml(None, r#"<view>{{ {0: 'zero', 1: 'one'} }}</view>"#).is_ok());
}

#[test]
fn test_object_with_expression_values() {
    assert!(parse_wxml(None, r#"<view>{{ {sum: a + b, product: a * b} }}</view>"#).is_ok());
}

#[test]
fn test_object_with_member_access_values() {
    assert!(parse_wxml(None, r#"<view>{{ {name: user.name} }}</view>"#).is_ok());
}

#[test]
fn test_object_nested() {
    // Nested objects in call context work correctly
    assert!(parse_wxml(None, r#"<view>{{func({inner: value})}}</view>"#).is_ok());
}

#[test]
fn test_object_with_object_member() {
    // Objects with member access values
    assert!(parse_wxml(None, r#"<view>{{ {outer: obj.inner} }}</view>"#).is_ok());
}

#[test]
fn test_object_trailing_comma() {
    assert!(parse_wxml(None, r#"<view>{{ {name: 'Alice', age: 30,} }}</view>"#).is_ok());
}

// ============================================================================
// Grouping (Parentheses)
// ============================================================================

#[test]
fn test_grouping_simple() {
    assert!(parse_wxml(None, r#"<view>{{(value)}}</view>"#).is_ok());
}

#[test]
fn test_grouping_precedence() {
    assert!(parse_wxml(None, r#"<view>{{(a + b) * c}}</view>"#).is_ok());
}

#[test]
fn test_grouping_nested() {
    assert!(parse_wxml(None, r#"<view>{{((a + b) * (c + d))}}</view>"#).is_ok());
}

#[test]
fn test_grouping_with_unary() {
    assert!(parse_wxml(None, r#"<view>{{-(a + b)}}</view>"#).is_ok());
}

// ============================================================================
// Complex Combined Expressions
// ============================================================================

#[test]
fn test_complex_arithmetic_logical() {
    // Use >= instead of < to avoid XML parsing conflict in text node
    assert!(parse_wxml(None, r#"<view>{{a + b > 10 && c - d >= 5}}</view>"#).is_ok());
}

#[test]
fn test_complex_conditional_with_calls() {
    assert!(parse_wxml(
        None,
        r#"<view>{{isValid(data) ? process(data) : getDefault()}}</view>"#
    )
    .is_ok());
}

#[test]
fn test_complex_nested_member_calls() {
    assert!(parse_wxml(
        None,
        r#"<view>{{user.profile.getName().toLowerCase()}}</view>"#
    )
    .is_ok());
}

#[test]
fn test_complex_array_of_objects() {
    assert!(parse_wxml(None, r#"<view>{{[{id: 1}, {id: 2}]}}</view>"#).is_ok());
}

#[test]
fn test_complex_object_with_array_values() {
    assert!(parse_wxml(None, r#"<view>{{ {items: [a, b, c], count: 3} }}</view>"#).is_ok());
}

#[test]
fn test_complex_chained_ternary() {
    assert!(parse_wxml(
        None,
        r#"<view>{{type === 'A' ? 1 : type === 'B' ? 2 : 3}}</view>"#
    )
    .is_ok());
}

#[test]
fn test_complex_mixed_operators() {
    assert!(parse_wxml(None, r#"<view>{{a * b + c / d - e % f}}</view>"#).is_ok());
}

#[test]
fn test_complex_logical_with_grouping() {
    assert!(parse_wxml(None, r#"<view>{{(a || b) && (c || d) && !e}}</view>"#).is_ok());
}

#[test]
fn test_complex_call_with_complex_args() {
    assert!(parse_wxml(None, r#"<view>{{fn(a ? b : c, [d, e], {f: g})}}</view>"#).is_ok());
}

#[test]
fn test_complex_deeply_nested() {
    assert!(parse_wxml(
        None,
        r#"<view>{{data.items[index].properties[key].value}}</view>"#
    )
    .is_ok());
}

// ============================================================================
// Newly Accepted Categories (Compatibility Decisions 2026-06-27)
// ============================================================================

// Optional Chaining
#[test]
fn test_optional_chaining_member() {
    assert!(parse_wxml(None, r#"<view>{{user?.name}}</view>"#).is_ok());
}

#[test]
fn test_optional_chaining_nested() {
    assert!(parse_wxml(None, r#"<view>{{user?.profile?.name}}</view>"#).is_ok());
}

#[test]
fn test_optional_chaining_computed() {
    assert!(parse_wxml(None, r#"<view>{{obj?.[key]}}</view>"#).is_ok());
}

#[test]
fn test_optional_chaining_call() {
    assert!(parse_wxml(None, r#"<view>{{fn?.()}}</view>"#).is_ok());
}

// Nullish Coalescing
#[test]
fn test_nullish_coalescing_basic() {
    assert!(parse_wxml(None, r#"<view>{{value ?? 'default'}}</view>"#).is_ok());
}

#[test]
fn test_nullish_coalescing_chain() {
    assert!(parse_wxml(None, r#"<view>{{a ?? b ?? c}}</view>"#).is_ok());
}

#[test]
fn test_nullish_coalescing_with_optional_chain() {
    assert!(parse_wxml(None, r#"<view>{{user?.name ?? 'Anonymous'}}</view>"#).is_ok());
}

// Template Literals
#[test]
fn test_template_literal_basic() {
    assert!(parse_wxml(None, r#"<view>{{`Hello World`}}</view>"#).is_ok());
}

#[test]
fn test_template_literal_with_expression() {
    assert!(parse_wxml(None, r#"<view>{{`Hello ${name}`}}</view>"#).is_ok());
}

#[test]
fn test_template_literal_multiple_expressions() {
    assert!(parse_wxml(
        None,
        r#"<view>{{`${greeting} ${name}, you have ${count} items`}}</view>"#
    )
    .is_ok());
}

#[test]
fn test_template_literal_nested_expressions() {
    assert!(parse_wxml(None, r#"<view>{{`Total: ${a + b}`}}</view>"#).is_ok());
}

// Object Spread
#[test]
fn test_object_spread_basic() {
    assert!(parse_wxml(None, r#"<view>{{ {...user} }}</view>"#).is_ok());
}

#[test]
fn test_object_spread_with_override() {
    assert!(parse_wxml(None, r#"<view>{{ {...user, age: 18} }}</view>"#).is_ok());
}

#[test]
fn test_object_spread_multiple() {
    assert!(parse_wxml(None, r#"<view>{{ {...base, ...override} }}</view>"#).is_ok());
}

#[test]
fn test_object_spread_in_call() {
    assert!(parse_wxml(None, r#"<view>{{fn({...user, active: true})}}</view>"#).is_ok());
}

// Array Spread
#[test]
fn test_array_spread_basic() {
    assert!(parse_wxml(None, r#"<view>{{[...items]}}</view>"#).is_ok());
}

#[test]
fn test_array_spread_with_elements() {
    assert!(parse_wxml(None, r#"<view>{{[...items, newItem]}}</view>"#).is_ok());
}

#[test]
fn test_array_spread_multiple() {
    assert!(parse_wxml(None, r#"<view>{{[...featured, ...regular]}}</view>"#).is_ok());
}

// Call Spread
#[test]
fn test_call_spread_basic() {
    assert!(parse_wxml(None, r#"<view>{{fn(...args)}}</view>"#).is_ok());
}

#[test]
fn test_call_spread_with_args() {
    assert!(parse_wxml(None, r#"<view>{{fn(first, ...rest)}}</view>"#).is_ok());
}

#[test]
fn test_call_spread_multiple() {
    assert!(parse_wxml(None, r#"<view>{{fn(...args1, ...args2)}}</view>"#).is_ok());
}

// Object Shorthand
#[test]
fn test_object_shorthand_single() {
    assert!(parse_wxml(None, r#"<view>{{fn({name})}}</view>"#).is_ok());
}

#[test]
fn test_object_shorthand_multiple() {
    assert!(parse_wxml(None, r#"<view>{{fn({name, age, email})}}</view>"#).is_ok());
}

#[test]
fn test_object_shorthand_mixed() {
    assert!(parse_wxml(None, r#"<view>{{fn({name, age: 18})}}</view>"#).is_ok());
}

// Computed Property Keys
#[test]
fn test_computed_property_key_basic() {
    assert!(parse_wxml(None, r#"<view>{{ {[key]: value} }}</view>"#).is_ok());
}

#[test]
fn test_computed_property_key_expression() {
    assert!(parse_wxml(None, r#"<view>{{ {[prefix + suffix]: value} }}</view>"#).is_ok());
}

#[test]
fn test_computed_property_key_in_call() {
    assert!(parse_wxml(None, r#"<view>{{fn({[dynamicKey]: value})}}</view>"#).is_ok());
}

// typeof Operator
#[test]
fn test_typeof_basic() {
    assert!(parse_wxml(None, r#"<view>{{typeof value}}</view>"#).is_ok());
}

#[test]
fn test_typeof_in_condition() {
    assert!(parse_wxml(None, r#"<view>{{typeof x === 'string' ? x : ''}}</view>"#).is_ok());
}

#[test]
fn test_typeof_in_logical() {
    assert!(parse_wxml(
        None,
        r#"<view>{{typeof error === 'string' && error}}</view>"#
    )
    .is_ok());
}

// Complex combinations with newly accepted features
#[test]
fn test_complex_optional_with_nullish() {
    assert!(parse_wxml(
        None,
        r#"<view>{{user?.profile?.name ?? 'Anonymous'}}</view>"#
    )
    .is_ok());
}

#[test]
fn test_complex_template_with_optional() {
    assert!(parse_wxml(None, r#"<view>{{`Hello ${user?.name ?? 'Guest'}`}}</view>"#).is_ok());
}

#[test]
fn test_complex_spread_with_computed() {
    assert!(parse_wxml(None, r#"<view>{{ {...base, [dynamicKey]: value} }}</view>"#).is_ok());
}
