//! Template data parsing tests
//! These tests target E5 evidence requirements

use dimina_wxml_parser::{parse_wxml, Node};

#[test]
fn test_template_data_object_literal() {
    // data="{{text: 'forbar'}}" should normalize to { text: 'forbar' }
    let source = r#"<template is="card" data="{{text: 'forbar'}}" />"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse template data object literal");

    let doc = result.unwrap();
    assert_eq!(doc.body.len(), 1);

    match &doc.body[0] {
        Node::TemplateRef(tpl) => {
            assert!(tpl.data.is_some(), "Should have template data");
            let data = tpl.data.as_ref().unwrap();
            assert_eq!(data.object.props.len(), 1, "Should have one property");
        }
        _ => panic!("Expected TemplateRef node"),
    }
}

#[test]
fn test_template_data_spread() {
    // data="{{...item}}" should normalize to { ...item }
    let source = r#"<template is="card" data="{{...item}}" />"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse template data spread");

    let doc = result.unwrap();
    match &doc.body[0] {
        Node::TemplateRef(tpl) => {
            assert!(tpl.data.is_some(), "Should have template data");
            let data = tpl.data.as_ref().unwrap();
            assert_eq!(data.object.props.len(), 1, "Should have one spread");
        }
        _ => panic!("Expected TemplateRef node"),
    }
}

#[test]
fn test_template_data_shorthand() {
    // data="{{foo, bar}}" should normalize to { foo, bar }
    let source = r#"<template is="card" data="{{foo, bar}}" />"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse template data shorthand");

    let doc = result.unwrap();
    match &doc.body[0] {
        Node::TemplateRef(tpl) => {
            assert!(tpl.data.is_some(), "Should have template data");
            let data = tpl.data.as_ref().unwrap();
            assert_eq!(data.object.props.len(), 2, "Should have two properties");
        }
        _ => panic!("Expected TemplateRef node"),
    }
}

#[test]
fn test_template_data_mixed() {
    // data="{{...obj1, ...obj2, a, c: 6}}"
    let source = r#"<template is="card" data="{{...obj1, ...obj2, a, c: 6}}" />"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse mixed template data");

    let doc = result.unwrap();
    match &doc.body[0] {
        Node::TemplateRef(tpl) => {
            assert!(tpl.data.is_some(), "Should have template data");
            let data = tpl.data.as_ref().unwrap();
            assert_eq!(data.object.props.len(), 4, "Should have four entries");
        }
        _ => panic!("Expected TemplateRef node"),
    }
}

#[test]
fn test_template_data_rejects_static() {
    // data="item" (static, no {{}}) should be rejected
    let source = r#"<template is="card" data="item" />"#;
    let result = parse_wxml(None, source);
    assert!(result.is_err(), "Static template data should be rejected");
}

#[test]
fn test_template_data_rejects_mixed_content() {
    // data="prefix{{foo}}" should be rejected (mixed static/dynamic)
    let source = r#"<template is="card" data="prefix{{foo}}" />"#;
    let result = parse_wxml(None, source);
    assert!(
        result.is_err(),
        "Mixed static/dynamic content should be rejected"
    );

    // data="{{foo}}suffix" should be rejected
    let source2 = r#"<template is="card" data="{{foo}}suffix" />"#;
    let result2 = parse_wxml(None, source2);
    assert!(
        result2.is_err(),
        "Mixed static/dynamic content should be rejected"
    );

    // data="prefix{{foo}}suffix" should be rejected
    let source3 = r#"<template is="card" data="prefix{{foo}}suffix" />"#;
    let result3 = parse_wxml(None, source3);
    assert!(
        result3.is_err(),
        "Mixed static/dynamic content should be rejected"
    );
}

#[test]
fn test_template_data_rejects_normal_expression() {
    // data="{{a + b}}" is not valid template data grammar
    let source = r#"<template is="card" data="{{a + b}}" />"#;
    let result = parse_wxml(None, source);
    assert!(
        result.is_err(),
        "Normal expression should be rejected as template data"
    );
}

#[test]
fn test_template_data_rejects_empty() {
    // data="{{}}" should be rejected as empty
    // E7: error should have proper source span pointing to the empty body
    let source = r#"<template is="card" data="{{}}" />"#;
    let result = parse_wxml(None, source);
    assert!(result.is_err(), "Empty template data should be rejected");

    // Verify error has a valid span (not default)
    let errors = result.unwrap_err();
    assert_eq!(errors.len(), 1, "Should have exactly one error");
    let err = &errors[0];
    assert_ne!(err.span.lo.0, 0, "Error span should not be default");
    assert_ne!(err.span.hi.0, 0, "Error span should not be default");
    // The span should be empty (lo == hi) since the body is empty
    assert_eq!(
        err.span.lo, err.span.hi,
        "Empty body should have empty span"
    );
}

#[test]
fn test_template_data_span_reversibility() {
    // E12: source[TemplateData.span] should equal TemplateData.raw
    // Test with whitespace: data=" {{ foo, bar }} "
    let source = r#"<template is="card" data=" {{ foo, bar }} " />"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse template data with whitespace");

    let doc = result.unwrap();
    match &doc.body[0] {
        Node::TemplateRef(tpl) => {
            let data = tpl.data.as_ref().expect("Should have template data");
            // TemplateData.raw is the trimmed body content
            assert_eq!(data.raw.as_ref(), "foo, bar");
            // E12: source[span] should equal raw
            let span_start = data.span.lo.0 as usize;
            let span_end = data.span.hi.0 as usize;
            let span_slice = &source[span_start..span_end];
            assert_eq!(
                span_slice,
                data.raw.as_ref(),
                "E12 reversibility: source[TemplateData.span] must equal TemplateData.raw"
            );
        }
        _ => panic!("Expected TemplateRef node"),
    }
}
