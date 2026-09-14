//! Expression error span mapping tests
//! Verify that expression error spans correctly point to WXML source positions

use dimina_wxml_parser::{parse_wxml, ParseErrorKind, WxmlExpressionErrorKind};

#[test]
fn test_expression_error_span_exact_assignment() {
    // Test exact span for assignment expression
    let source = r#"<view class="{{a = 1}}">content</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject assignment in attribute");
    let errors = result.unwrap_err();
    let err = &errors[0];

    // Verify error kind
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));

    // Extract spanned text and verify it's exactly "a = 1"
    let lo = err.span.lo.0 as usize;
    let hi = err.span.hi.0 as usize;
    let spanned_text = &source[lo..hi];
    assert_eq!(spanned_text, "a = 1", "span should cover exactly 'a = 1'");
}

#[test]
fn test_expression_error_span_exact_update() {
    // Test exact span for update expression
    let source = r#"<view>before {{i++}} after</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject update in text");
    let errors = result.unwrap_err();
    let err = &errors[0];

    // Verify error kind
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));

    // Extract spanned text and verify it's exactly "i++"
    let lo = err.span.lo.0 as usize;
    let hi = err.span.hi.0 as usize;
    let spanned_text = &source[lo..hi];
    assert_eq!(spanned_text, "i++", "span should cover exactly 'i++'");
}

#[test]
fn test_expression_error_span_exact_nested() {
    // Test exact span for nested new expression
    let source = r#"<view>{{ [new Date()] }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject new expression");
    let errors = result.unwrap_err();
    let err = &errors[0];

    // Verify error kind
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));

    // Extract spanned text - should point to the problematic 'new Date()' expression
    let lo = err.span.lo.0 as usize;
    let hi = err.span.hi.0 as usize;
    let spanned_text = &source[lo..hi];
    assert_eq!(
        spanned_text, "new Date()",
        "span should point to the problematic 'new Date()' expression"
    );
}

#[test]
fn test_expression_error_span_with_whitespace() {
    // Test span handling with extra whitespace
    let source = r#"<view class="{{  a += 1  }}">content</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject compound assignment");
    let errors = result.unwrap_err();
    let err = &errors[0];

    // Verify error kind
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));

    // Extract spanned text and verify it's the trimmed expression
    let lo = err.span.lo.0 as usize;
    let hi = err.span.hi.0 as usize;
    let spanned_text = &source[lo..hi];
    assert_eq!(
        spanned_text, "a += 1",
        "span should cover exactly 'a += 1' (trimmed)"
    );
}

#[test]
fn test_empty_expression_span() {
    let source = r#"<view class="{{}}">content</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject empty expression");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];

    // Verify error kind
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::Empty)
    ));

    // Verify span is within reasonable bounds (inside the attribute value)
    let span = err.span;
    let lo = span.lo.0 as usize;
    let hi = span.hi.0 as usize;

    assert!(
        lo >= 13,
        "span lo should be >= 13 (in or after class=\"{{{{}})"
    );
    assert!(hi <= 17, "span hi should be <= 17 (in or before }})");
}

#[test]
fn test_syntax_error_span() {
    // Syntax error in expression
    let source = r#"<view>{{ a + }}extra</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject syntax error");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];

    // Verify error kind
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::Syntax)
    ));

    // Verify span is in reasonable range
    let span = err.span;
    let lo = span.lo.0 as usize;
    let hi = span.hi.0 as usize;

    assert!(lo >= 6, "span should be after <view>{{");
    assert!(hi <= 15, "span should be before }}");
}

#[test]
fn test_nested_expression_error_span() {
    // Rejected expression nested in array - should point to exact problematic expression
    let source = r#"<view>{{ [new Date()] }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject new expression");
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let err = &errors[0];

    // Verify error kind
    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));

    // Verify span points to exactly "new Date()" not the whole array
    let span = err.span;
    let lo = span.lo.0 as usize;
    let hi = span.hi.0 as usize;
    let spanned_text = &source[lo..hi];

    assert_eq!(
        spanned_text, "new Date()",
        "span should point to exactly 'new Date()'"
    );
}

#[test]
fn test_nested_object_error_span() {
    // Test nested arrow function in object - should point to arrow function
    let source = r#"<view>{{ { handler: () => {} } }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject arrow function");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));

    let lo = err.span.lo.0 as usize;
    let hi = err.span.hi.0 as usize;
    let spanned_text = &source[lo..hi];

    assert_eq!(
        spanned_text, "() => {}",
        "span should point to exactly '() => {{}}'"
    );
}

#[test]
fn test_nested_call_error_span() {
    // Test arrow function nested in call - should point to arrow function
    let source = r#"<view>{{ items.filter(x => x.active) }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject arrow function");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));

    let lo = err.span.lo.0 as usize;
    let hi = err.span.hi.0 as usize;
    let spanned_text = &source[lo..hi];

    assert_eq!(
        spanned_text, "x => x.active",
        "span should point to exactly 'x => x.active'"
    );
}

#[test]
fn test_nested_conditional_error_span() {
    // Test rejected expression in conditional - should point to the exact problematic part
    let source = r#"<view>{{ condition ? a++ : b }}</view>"#;
    let result = parse_wxml(None, source);

    assert!(result.is_err(), "Should reject update expression");
    let errors = result.unwrap_err();
    let err = &errors[0];

    assert!(matches!(
        err.kind,
        ParseErrorKind::ExpressionError(WxmlExpressionErrorKind::RejectedCategory)
    ));

    let lo = err.span.lo.0 as usize;
    let hi = err.span.hi.0 as usize;
    let spanned_text = &source[lo..hi];

    assert_eq!(spanned_text, "a++", "span should point to exactly 'a++'");
}
