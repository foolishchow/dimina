//! Empty expression validation tests

use dimina_wxml_parser::{parse_wxml, ParseErrorKind, WxmlExpressionErrorKind};

#[test]
fn test_empty_expression_no_space() {
    let source = r#"<view>{{}}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject empty expression");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::Empty)
    ));
    assert!(err.message.contains("empty"));
}

#[test]
fn test_empty_expression_with_spaces() {
    let source = r#"<view>{{   }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject empty expression with spaces"
    );
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::Empty)
    ));
}

#[test]
fn test_empty_expression_in_attribute() {
    let source = r#"<view class="{{ }}">content</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject empty expression in attribute"
    );
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::Empty)
    ));
}

#[test]
fn test_empty_expression_in_template() {
    let source = r#"<view>text {{  }} more</view>"#;
    let result = parse_wxml(None, source);

    assert!(
        result.is_err(),
        "Should reject empty expression in template"
    );
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::Empty)
    ));
}
