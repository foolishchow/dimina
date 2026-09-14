//! Validation bypass regression tests
//!
//! Tests that verify rejected expressions cannot bypass validation through
//! accepted container expressions like optional calls and computed properties.

use dimina_wxml_parser::{parse_wxml, ParseErrorKind, WxmlExpressionErrorKind};

// ============================================================================
// Optional Call Argument Validation
// ============================================================================

#[test]
fn test_optional_call_with_update_arg_rejected() {
    // fn?.(i++) should reject the update expression in argument
    let source = r#"<view>{{fn?.(i++)}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject update expression in optional call argument"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("update expression"));
}

#[test]
fn test_optional_call_with_assignment_arg_rejected() {
    // fn?.(a = 1) should reject the assignment in argument
    let source = r#"<view>{{fn?.(a = 1)}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject assignment in optional call argument"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("assignment expression"));
}

#[test]
fn test_optional_call_with_new_arg_rejected() {
    // fn?.(new Date()) should reject new expression in argument
    let source = r#"<view>{{fn?.(new Date())}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject new expression in optional call argument"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("new expression"));
}

#[test]
fn test_optional_call_with_arrow_arg_rejected() {
    // fn?.(x => x) should reject arrow function in argument
    let source = r#"<view>{{fn?.(x => x)}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject arrow function in optional call argument"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("arrow function"));
}

#[test]
fn test_optional_call_with_valid_args_accepted() {
    // fn?.(a, b, c) should be accepted
    let source = r#"<view>{{fn?.(a, b, c)}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_ok(),
        "Should accept valid arguments in optional call"
    );
}

// ============================================================================
// Computed Property Key Validation
// ============================================================================

#[test]
fn test_computed_property_key_with_update_rejected() {
    // { [i++]: value } should reject the update expression in key
    let source = r#"<view>{{ {[i++]: value} }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject update expression in computed property key"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("update expression"));
}

#[test]
fn test_computed_property_key_with_assignment_rejected() {
    // { [a = 1]: value } should reject the assignment in key
    let source = r#"<view>{{ {[a = 1]: value} }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject assignment in computed property key"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("assignment expression"));
}

#[test]
fn test_computed_property_key_with_new_rejected() {
    // { [new Date()]: value } should reject new expression in key
    let source = r#"<view>{{ {[new Date()]: value} }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject new expression in computed property key"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("new expression"));
}

#[test]
fn test_computed_property_key_with_arrow_rejected() {
    // { [(() => 'key')()]: value } should reject arrow function in key
    let source = r#"<view>{{ {[(() => 'key')()]: value} }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject arrow function in computed property key"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("arrow function"));
}

#[test]
fn test_computed_property_key_with_valid_expr_accepted() {
    // { [keyName]: value } should be accepted
    let source = r#"<view>{{ {[keyName]: value} }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_ok(),
        "Should accept valid expression in computed property key"
    );
}

#[test]
fn test_computed_property_key_with_expression_accepted() {
    // { [a + b]: value } should be accepted
    let source = r#"<view>{{ {[a + b]: value} }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_ok(),
        "Should accept valid computed expression in property key"
    );
}

// ============================================================================
// Combined Bypass Attempts
// ============================================================================

#[test]
fn test_nested_bypass_attempts() {
    // fn?.({ [i++]: value }) - update in computed key passed to optional call
    let source = r#"<view>{{fn?.({[i++]: value})}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject nested bypass attempt");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("update expression"));
}

#[test]
fn test_deep_nesting_bypass() {
    // { [fn?.(a = 1)]: value } - assignment in optional call used as computed key
    let source = r#"<view>{{ {[fn?.(a = 1)]: value} }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject deeply nested bypass attempt"
    );
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));
    assert!(err.message.contains("assignment expression"));
}
