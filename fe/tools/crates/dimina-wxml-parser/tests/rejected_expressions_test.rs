//! Comprehensive rejected expression category tests
//!
//! This test suite provides systematic coverage of all rejected expression
//! categories per WXML-EXPRESSION-SPEC.md Section 5 and EXPRESSION_DECISION_SYSTEM.md.
//!
//! These expressions are explicitly not allowed and will produce RejectedCategory errors.

use dimina_wxml_parser::{parse_wxml, ParseErrorKind, WxmlExpressionErrorKind};

// ============================================================================
// Assignment Expressions
// ============================================================================

#[test]
fn test_assignment_simple() {
    let source = r#"<view>{{a = 1}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject simple assignment");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("assignment"));
    assert!(err.message.contains("not allowed"));
}

#[test]
fn test_assignment_compound_add() {
    let source = r#"<view>{{a += 1}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment +=");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("assignment"));
}

#[test]
fn test_assignment_compound_sub() {
    let source = r#"<view>{{a -= 2}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment -=");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_assignment_compound_mul() {
    let source = r#"<view>{{a *= 3}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment *=");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_assignment_compound_div() {
    let source = r#"<view>{{a /= 2}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment /=");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_assignment_compound_mod() {
    let source = r#"<view>{{a %= 5}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment %=");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_assignment_compound_exp() {
    let source = r#"<view>{{a **= 2}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment **=");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_assignment_compound_bitwise_and() {
    let source = r#"<view>{{a &= b}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment &=");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_assignment_compound_bitwise_or() {
    let source = r#"<view>{{a |= b}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment |=");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_assignment_compound_bitwise_xor() {
    let source = r#"<view>{{a ^= b}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment ^=");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_assignment_compound_left_shift() {
    let source = r#"<view data-val="{{a <<= 2}}">x</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment <<=");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_assignment_compound_right_shift() {
    let source = r#"<view data-val="{{a >>= 2}}">x</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment >>=");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_assignment_compound_unsigned_right_shift() {
    let source = r#"<view data-val="{{a >>>= 2}}">x</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment >>>=");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_assignment_nested_in_binary() {
    let source = r#"<view>{{(a = 1) + 2}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject assignment nested in binary expression"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_assignment_in_conditional() {
    let source = r#"<view>{{flag ? (a = 1) : (b = 2)}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject assignment in conditional");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

// ============================================================================
// Update Expressions
// ============================================================================

#[test]
fn test_update_postfix_increment() {
    let source = r#"<view>{{i++}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject postfix increment");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("update"));
}

#[test]
fn test_update_postfix_decrement() {
    let source = r#"<view>{{i--}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject postfix decrement");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_update_prefix_increment() {
    let source = r#"<view>{{++i}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject prefix increment");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_update_prefix_decrement() {
    let source = r#"<view>{{--i}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject prefix decrement");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_update_in_call_arg() {
    let source = r#"<view>{{fn(i++)}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject update in call argument");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_update_in_array() {
    let source = r#"<view>{{[a, b++, c]}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject update in array literal");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

// ============================================================================
// Comma Expression
// ============================================================================

#[test]
fn test_comma_expression() {
    let source = r#"<view>{{a, b}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject comma expression");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("comma"));
}

#[test]
fn test_comma_expression_multiple() {
    let source = r#"<view>{{a, b, c}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject comma expression with multiple values"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_comma_in_grouping() {
    let source = r#"<view>{{(a, b)}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject comma in grouping");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

// ============================================================================
// New Expression
// ============================================================================

#[test]
fn test_new_expression_no_args() {
    let source = r#"<view>{{new Date}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject new expression without call");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("new expression"));
}

#[test]
fn test_new_expression_with_call() {
    let source = r#"<view>{{new Date()}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject new expression with call");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_new_with_args() {
    let source = r#"<view>{{new Person('Alice', 30)}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject new expression with arguments"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_new_in_array() {
    let source = r#"<view>{{[new Date()]}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject new expression in array");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_new_member_access() {
    let source = r#"<view>{{new utils.Helper()}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject new with member access");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

// ============================================================================
// Function Expression
// ============================================================================

#[test]
fn test_function_expression_anonymous() {
    let source = r#"<view>{{function() {}}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject anonymous function expression"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("function"));
}

#[test]
fn test_function_expression_named() {
    let source = r#"<view>{{function myFunc() {}}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject named function expression");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_function_with_params() {
    let source = r#"<view>{{function(a, b) { return a + b; }}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject function with parameters");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_function_in_object() {
    let source = r#"<view>{{ {fn: function() {}} }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject function as object property value"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    // Empty function causes syntax error from SWC
    assert!(
        matches!(
            err.kind,
            ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::Syntax)
        ) || matches!(
            err.kind,
            ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
        )
    );
}

// ============================================================================
// Class Expression
// ============================================================================

#[test]
fn test_class_expression_anonymous() {
    let source = r#"<view>{{class {}}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject anonymous class expression");
    let errors = result.unwrap_err();
    let err = &errors[0];

    // Empty class causes syntax error from SWC
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::Syntax)
    ));
}

#[test]
fn test_class_expression_named() {
    let source = r#"<view>{{class MyClass {}}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject named class expression");
    let errors = result.unwrap_err();
    let err = &errors[0];

    // Empty class causes syntax error from SWC
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::Syntax)
    ));
}

// ============================================================================
// Await Expression
// ============================================================================

#[test]
fn test_await_expression() {
    let source = r#"<view>{{await promise}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject await expression");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("await"));
}

#[test]
fn test_await_call() {
    let source = r#"<view>{{await fetchData()}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject await with call expression");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

// ============================================================================
// Dynamic Import
// ============================================================================

#[test]
fn test_dynamic_import() {
    let source = r#"<view>{{import('./module.js')}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject dynamic import");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("dynamic import"));
}

#[test]
fn test_dynamic_import_with_await() {
    let source = r#"<view>{{await import('./module.js')}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject await import");
    let errors = result.unwrap_err();
    let err = &errors[0];

    // Will be rejected due to await or dynamic import
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

// ============================================================================
// Newly Rejected Categories (Compatibility Decisions 2026-06-27)
// ============================================================================

// Arrow Functions - now explicitly rejected
#[test]
fn test_arrow_function_rejected() {
    let source = r#"<view>{{items.filter(x => x.active)}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject arrow function");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("arrow function"));
}

#[test]
fn test_arrow_function_in_call_rejected() {
    let source = r#"<view>{{items.map(x => x * 2)}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject arrow function in call");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

// Array Holes - now explicitly rejected
#[test]
fn test_array_holes_rejected() {
    let source = r#"<view>{{[,, third]}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject array holes");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("array holes"));
}

#[test]
fn test_array_holes_mixed_rejected() {
    let source = r#"<view>{{[first, , third]}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject array with holes");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

// RegExp Literals - now explicitly rejected
#[test]
fn test_regexp_literal_rejected() {
    let source = r#"<view>{{/pattern/g}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject regexp literal");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("regexp"));
}

#[test]
fn test_regexp_with_flags_rejected() {
    let source = r#"<view>{{/\d+/gi}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject regexp with flags");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

// this Expression - now explicitly rejected
#[test]
fn test_this_expression_rejected() {
    let source = r#"<view>{{this.data.value}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject this expression");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("this expression"));
}

#[test]
fn test_this_member_access_rejected() {
    let source = r#"<view>{{this.value}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject this member access");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

// void Operator - now explicitly rejected
#[test]
fn test_void_operator_rejected() {
    let source = r#"<view>{{void expr}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject void operator");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("void"));
}

#[test]
fn test_void_zero_rejected() {
    let source = r#"<view>{{void 0}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject void 0");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

// delete Operator - now explicitly rejected
#[test]
fn test_delete_operator_rejected() {
    let source = r#"<view>{{delete obj.prop}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject delete operator");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("delete"));
}

#[test]
fn test_delete_computed_rejected() {
    let source = r#"<view>{{delete obj[key]}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject delete with computed property"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}
