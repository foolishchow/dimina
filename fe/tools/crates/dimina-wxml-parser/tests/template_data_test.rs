//! Template data parsing tests

use dimina_wxml_parser::{parse_template_data, WxmlTemplateDataErrorKind};

#[test]
fn test_simple_identifier() {
    // {{item}} → { item: item }
    let result = parse_template_data(None, "item");
    assert!(result.is_ok(), "Should parse simple identifier");
    let data = result.unwrap();
    assert_eq!(data.raw.as_ref(), "item");
    assert_eq!(data.object.props.len(), 1);
}

#[test]
fn test_spread_operator() {
    // {{...item}} → { ...item }
    let result = parse_template_data(None, "...item");
    assert!(result.is_ok(), "Should parse spread operator");
    let data = result.unwrap();
    assert_eq!(data.raw.as_ref(), "...item");
    assert_eq!(data.object.props.len(), 1);
}

#[test]
fn test_multiple_identifiers() {
    // {{foo, bar}} → { foo: foo, bar: bar }
    let result = parse_template_data(None, "foo, bar");
    assert!(result.is_ok(), "Should parse multiple identifiers");
    let data = result.unwrap();
    assert_eq!(data.raw.as_ref(), "foo, bar");
    assert_eq!(data.object.props.len(), 2);
}

#[test]
fn test_key_value_pairs() {
    // {{text: 'forbar', id: index}} → { text: 'forbar', id: index }
    let result = parse_template_data(None, "text: 'forbar', id: index");
    assert!(result.is_ok(), "Should parse key-value pairs");
    let data = result.unwrap();
    assert_eq!(data.object.props.len(), 2);
}

#[test]
fn test_mixed_spread_and_properties() {
    // {{...item, text: 'custom'}}
    let result = parse_template_data(None, "...item, text: 'custom'");
    assert!(result.is_ok(), "Should parse mixed spread and properties");
    let data = result.unwrap();
    assert_eq!(data.object.props.len(), 2);
}

#[test]
fn test_nested_object() {
    // {{user: {name: 'Alice', age: 30}}}
    let result = parse_template_data(None, "user: {name: 'Alice', age: 30}");
    assert!(result.is_ok(), "Should parse nested object");
    let data = result.unwrap();
    assert_eq!(data.object.props.len(), 1);
}

#[test]
fn test_empty_template_data() {
    let result = parse_template_data(None, "");
    assert!(result.is_err(), "Should reject empty template data");
    let err = result.unwrap_err();
    assert!(matches!(err.kind, WxmlTemplateDataErrorKind::Empty));
    assert!(err.message.contains("empty"));
}

#[test]
fn test_empty_template_data_whitespace() {
    let result = parse_template_data(None, "   ");
    assert!(
        result.is_err(),
        "Should reject whitespace-only template data"
    );
    let err = result.unwrap_err();
    assert!(matches!(err.kind, WxmlTemplateDataErrorKind::Empty));
}

#[test]
fn test_syntax_error() {
    // "item," is valid JS shorthand property with trailing comma - actually parses OK
    // Use a real syntax error instead
    let result = parse_template_data(None, "item:");
    assert!(result.is_err(), "Should reject syntax error");
    let err = result.unwrap_err();
    assert!(matches!(err.kind, WxmlTemplateDataErrorKind::Syntax));
}

#[test]
fn test_invalid_non_object() {
    // "1 + 2" wrapped as "({ 1 + 2 })" is invalid object syntax
    let result = parse_template_data(None, "1 + 2");
    assert!(result.is_err(), "Should reject non-object expression");
    let err = result.unwrap_err();
    // This will be a Syntax error because "({ 1 + 2 })" is invalid
    assert!(matches!(err.kind, WxmlTemplateDataErrorKind::Syntax));
}
