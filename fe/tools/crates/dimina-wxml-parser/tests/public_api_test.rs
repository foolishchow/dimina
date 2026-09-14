//! Public API smoke tests
//!
//! Ensures that source_file fields are accessible from the public API
//! surface for all result and error types.

use dimina_wxml_parser::{parse_template_data, parse_wxml, parse_wxml_expression};
use std::path::PathBuf;

#[test]
fn public_api_document_source_file_accessible() {
    let source_path = PathBuf::from("/test/doc.wxml");
    let source = r#"<view>Test</view>"#;

    let result = parse_wxml(Some(source_path.clone()), source);
    assert!(result.is_ok());

    // Access source_file through public API
    let doc = result.unwrap();
    let _ = &doc.source_file; // Verify field is public
    assert_eq!(doc.source_file, Some(source_path));
}

#[test]
fn public_api_parse_error_source_file_accessible() {
    let source_path = PathBuf::from("/test/error.wxml");
    let source = r#"<view><text></view>"#; // mismatched tags

    let result = parse_wxml(Some(source_path.clone()), source);
    assert!(result.is_err());

    // Access source_file through public API
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    let _ = &errors[0].source_file; // Verify field is public
    let _ = &errors[0].span; // Verify other fields still public
    let _ = &errors[0].kind;
    let _ = &errors[0].message;
    assert_eq!(errors[0].source_file, Some(source_path));
}

#[test]
fn public_api_expression_error_source_file_accessible() {
    let source_path = PathBuf::from("/test/expr.js");
    let source = ""; // empty expression

    let result = parse_wxml_expression(Some(source_path.clone()), source);
    assert!(result.is_err());

    // Access source_file through public API
    let err = result.unwrap_err();
    let _ = &err.source_file; // Verify field is public
    let _ = &err.span;
    let _ = &err.kind;
    let _ = &err.message;
    assert_eq!(err.source_file, Some(source_path));
}
