//! Expression category validation tests
//! These tests verify that the parser correctly accepts valid expression categories
//! and rejects invalid categories as defined in WXML-EXPRESSION-SPEC.md Section 4 and 5.

use dimina_wxml_parser::{parse_wxml, ParseErrorKind, WxmlExpressionErrorKind};

// ============================================================================
// Section 4: Accepted Normal Expression Categories
// ============================================================================

#[test]
fn test_accepted_identifier() {
    let source = r#"<view>{{message}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept identifier expression");
}

#[test]
fn test_accepted_member_access() {
    let source = r#"<view>{{user.name}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept member access expression");
}

#[test]
fn test_accepted_nested_member_access() {
    let source = r#"<view>{{event.detail.value}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept nested member access");
}

#[test]
fn test_accepted_index_access() {
    let source = r#"<view>{{items[index]}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept index access expression");
}

#[test]
fn test_accepted_literal_number() {
    let source = r#"<view>{{42}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept number literal");
}

#[test]
fn test_accepted_literal_string() {
    let source = r#"<view>{{'hello'}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept string literal");
}

#[test]
fn test_accepted_literal_boolean() {
    let source = r#"<view>{{true}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept boolean literal");
}

#[test]
fn test_accepted_literal_null() {
    let source = r#"<view>{{null}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept null literal");
}

#[test]
fn test_accepted_unary_not() {
    let source = r#"<view>{{!visible}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept unary ! expression");
}

#[test]
fn test_accepted_unary_minus() {
    let source = r#"<view>{{-count}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept unary - expression");
}

#[test]
fn test_accepted_unary_plus() {
    let source = r#"<view>{{+count}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept unary + expression");
}

#[test]
fn test_accepted_binary_addition() {
    let source = r#"<view>{{a + b}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept binary + expression");
}

#[test]
fn test_accepted_binary_comparison() {
    let source = r#"<view>{{a >= b}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept binary comparison");
}

#[test]
fn test_accepted_binary_equality() {
    let source = r#"<view>{{id === selectedId}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept equality expression");
}

#[test]
fn test_accepted_logical_and() {
    let source = r#"<view>{{a && b}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept logical && expression");
}

#[test]
fn test_accepted_logical_or() {
    let source = r#"<view>{{a || b}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept logical || expression");
}

#[test]
fn test_accepted_conditional() {
    let source = r#"<view>{{ok ? a : b}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept conditional expression");
}

#[test]
fn test_accepted_call_expression() {
    let source = r#"<view>{{utils.format(value)}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept call expression");
}

#[test]
fn test_accepted_array_literal() {
    let source = r#"<view>{{[a, b, c]}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept array literal");
}

#[test]
fn test_accepted_object_literal() {
    let source = r#"<view>{{ {name: user.name} }}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept object literal");
}

#[test]
fn test_accepted_grouping() {
    let source = r#"<view>{{(a + b) * c}}</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should accept grouping expression");
}

// ============================================================================
// Section 5: Rejected Normal Expression Categories
// ============================================================================

#[test]
fn test_rejected_assignment() {
    let source = r#"<view>{{a = 1}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject assignment expression");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("assignment"));
}

#[test]
fn test_rejected_assignment_compound() {
    let source = r#"<view>{{a += 1}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_rejected_update_postfix() {
    let source = r#"<view>{{i++}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject postfix update");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("update"));
}

#[test]
fn test_rejected_update_prefix() {
    let source = r#"<view>{{--i}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject prefix update");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_rejected_comma_expression() {
    let source = r#"<view>{{a, b}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject comma expression");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("comma"));
}

#[test]
fn test_rejected_new_expression() {
    let source = r#"<view>{{new Date()}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject new expression");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("new"));
}

#[test]
fn test_rejected_function_expression() {
    let source = r#"<view>{{function() {}}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject function expression");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("function"));
}

#[test]
fn test_rejected_class_expression() {
    let source = r#"<view>{{class A {}}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject class expression");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    // Class expression causes syntax error in expression position
    assert!(matches!(err.kind, ParseErrorKind::ExpressionError(_)));
}

#[test]
fn test_rejected_await_expression() {
    let source = r#"<view>{{await value}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject await expression");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("await"));
}

// Note: yield expression requires generator context which SWC parse_expr doesn't provide,
// so "yield value" gets parsed as identifier "yield". Skip testing yield rejection.

// Note: super requires class context, difficult to test in isolation
// Note: tagged template requires specific syntax structure

// ============================================================================
// Nested rejected expressions (ensure recursive validation)
// ============================================================================

#[test]
fn test_rejected_assignment_in_binary() {
    let source = r#"<view>{{(a = 1) + 2}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject assignment nested in binary");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_rejected_update_in_call_arg() {
    let source = r#"<view>{{func(i++)}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject update in call argument");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_rejected_new_in_array() {
    let source = r#"<view>{{[new Date()]}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject new in array element");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
}

#[test]
fn test_rejected_function_in_object() {
    let source = r#"<view>{{ {fn: function() {}} }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject function in object property");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    // Function expression in object causes syntax error
    assert!(matches!(err.kind, ParseErrorKind::ExpressionError(_)));
}
