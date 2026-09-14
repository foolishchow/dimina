//! Source-file provenance tests
//!
//! Validates that:
//! - Document preserves caller-provided source_file
//! - ParseError preserves caller-provided source_file
//! - WxmlExpressionError preserves caller-provided source_file
//! - WxmlTemplateDataError preserves caller-provided source_file
//! - Source files are not canonicalized

use dimina_wxml_parser::{parse_template_data, parse_wxml, parse_wxml_expression};
use std::path::PathBuf;

#[test]
fn wxml_document_preserves_source_file() {
    let source_path = PathBuf::from("/fake/path/app.wxml");
    let source = r#"<view>Hello</view>"#;

    let result = parse_wxml(Some(source_path.clone()), source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    assert_eq!(doc.source_file, Some(source_path));
}

#[test]
fn wxml_parse_error_preserves_source_file() {
    let source_path = PathBuf::from("/fake/path/error.wxml");
    let source = r#"<view><text></view>"#; // mismatched tags

    let result = parse_wxml(Some(source_path.clone()), source);
    assert!(result.is_err());
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    assert_eq!(errors[0].source_file, Some(source_path));
}

#[test]
fn wxml_expression_error_preserves_source_file() {
    let source_path = PathBuf::from("/fake/path/expr.js");
    let source = "function() {}"; // rejected expression category

    let result = parse_wxml_expression(Some(source_path.clone()), source);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.source_file, Some(source_path));
}

#[test]
fn wxml_template_data_error_preserves_source_file() {
    let source_path = PathBuf::from("/fake/path/data.js");
    let source = ""; // empty template data

    let result = parse_template_data(Some(source_path.clone()), source);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.source_file, Some(source_path));
}

#[test]
fn wxml_source_file_is_not_canonicalized() {
    // Use relative path with ".." and "." that would canonicalize differently
    let source_path = PathBuf::from("./foo/../bar/./baz.wxml");
    let source = r#"<view>Test</view>"#;

    let result = parse_wxml(Some(source_path.clone()), source);
    assert!(result.is_ok());
    let doc = result.unwrap();

    // Parser should preserve exact path, not canonicalize to "bar/baz.wxml"
    assert_eq!(doc.source_file, Some(source_path.clone()));
    assert!(doc.source_file.unwrap().to_string_lossy().contains(".."));
}
