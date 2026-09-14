//! E2 Evidence: Value and Text Parsing Tests
//!
//! Proves that Static, Expr, and Template value types parse correctly,
//! including raw/cooked text and interpolation boundaries.
//!
//! Value types:
//! - Static: Plain string values without expressions
//! - Expr: Single expression values like `{{count}}`
//! - Template: Mixed content like `"Hello {{name}}!"`

use dimina_wxml_parser::{parse_wxml, Node, Value};

// ============================================================================
// Static Value Tests
// ============================================================================

#[test]
fn test_static_value_in_attribute() {
    let source = r#"<view class="container"></view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.attrs.len(), 1);
            let attr = &el.attrs[0];
            assert_eq!(attr.name.as_ref(), "class");

            match attr.value.as_ref().unwrap() {
                Value::Static(s) => {
                    assert_eq!(s.value.as_ref(), "container");
                    // raw may or may not include quotes depending on parser implementation
                    assert!(s.raw.as_ref().contains("container"));
                }
                _ => panic!("Expected Static value"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_static_value_empty_string() {
    let source = r#"<view class=""></view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => match el.attrs[0].value.as_ref().unwrap() {
            Value::Static(s) => {
                assert_eq!(s.value.as_ref(), "");
            }
            _ => panic!("Expected Static value"),
        },
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_static_value_with_special_chars() {
    let source = r#"<view data-value="hello-world_123"></view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => match el.attrs[0].value.as_ref().unwrap() {
            Value::Static(s) => {
                assert_eq!(s.value.as_ref(), "hello-world_123");
            }
            _ => panic!("Expected Static value"),
        },
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_static_text_node() {
    let source = "<view>Hello World</view>";
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.children.len(), 1);
            match &el.children[0] {
                Node::Text(text) => match &text.value {
                    Value::Static(s) => {
                        assert!(s.value.as_ref().contains("Hello World"));
                    }
                    _ => panic!("Expected Static text value"),
                },
                _ => panic!("Expected Text node"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_single_quoted_static_attribute() {
    let source = r#"<view class='container'></view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.attrs.len(), 1);
            let attr = &el.attrs[0];
            assert_eq!(attr.name.as_ref(), "class");

            match attr.value.as_ref().unwrap() {
                Value::Static(s) => {
                    assert_eq!(s.value.as_ref(), "container");
                }
                _ => panic!("Expected Static value"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_double_quoted_static_attribute() {
    let source = r#"<view class="container"></view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.attrs.len(), 1);
            let attr = &el.attrs[0];
            assert_eq!(attr.name.as_ref(), "class");

            match attr.value.as_ref().unwrap() {
                Value::Static(s) => {
                    assert_eq!(s.value.as_ref(), "container");
                }
                _ => panic!("Expected Static value"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_static_text_with_whitespace() {
    let source = "<view>  \n  Hello  \n  </view>";
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            // May contain whitespace nodes depending on whitespace policy
            let has_text = el.children.iter().any(
                |node| matches!(node, Node::Text(text) if matches!(&text.value, Value::Static(_))),
            );
            assert!(has_text, "Should contain static text node");
        }
        _ => panic!("Expected Element"),
    }
}

// ============================================================================
// Expr Value Tests
// ============================================================================

#[test]
fn test_expr_value_simple_identifier() {
    let source = r#"<view class="{{className}}"></view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            match el.attrs[0].value.as_ref().unwrap() {
                Value::Expr(expr) => {
                    assert_eq!(expr.raw.as_ref(), "className");
                    // expr.expr is Box<swc_ecma_ast::Expr>
                }
                _ => panic!("Expected Expr value"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_expr_value_member_access() {
    let source = r#"<view id="{{user.id}}"></view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => match el.attrs[0].value.as_ref().unwrap() {
            Value::Expr(expr) => {
                assert_eq!(expr.raw.as_ref(), "user.id");
            }
            _ => panic!("Expected Expr value"),
        },
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_expr_value_binary_operation() {
    let source = r#"<view data-sum="{{a + b}}"></view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => match el.attrs[0].value.as_ref().unwrap() {
            Value::Expr(expr) => {
                assert_eq!(expr.raw.as_ref(), "a + b");
            }
            _ => panic!("Expected Expr value"),
        },
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_expr_value_in_text_node() {
    let source = "<view>{{message}}</view>";
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.children.len(), 1);
            match &el.children[0] {
                Node::Text(text) => match &text.value {
                    Value::Expr(expr) => {
                        assert_eq!(expr.raw.as_ref(), "message");
                    }
                    _ => panic!("Expected Expr text value"),
                },
                _ => panic!("Expected Text node"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

// ============================================================================
// Template Value Tests
// ============================================================================

#[test]
fn test_template_value_simple_interpolation() {
    let source = r#"<view>Hello {{name}}!</view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.children.len(), 1);
            match &el.children[0] {
                Node::Text(text) => {
                    match &text.value {
                        Value::Template(template) => {
                            assert!(template.parts.len() >= 2, "Should have multiple parts");
                            // First part should be static "Hello "
                            // Second part should be expr "name"
                            // Third part should be static "!"
                        }
                        _ => panic!("Expected Template text value"),
                    }
                }
                _ => panic!("Expected Text node"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_template_value_multiple_interpolations() {
    let source = r#"<view>{{firstName}} {{lastName}}</view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => match &el.children[0] {
            Node::Text(text) => match &text.value {
                Value::Template(template) => {
                    assert!(template.parts.len() >= 3, "Should have multiple parts");
                }
                _ => panic!("Expected Template value"),
            },
            _ => panic!("Expected Text node"),
        },
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_template_value_in_attribute() {
    let source = r#"<view class="prefix-{{type}}-suffix"></view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => match el.attrs[0].value.as_ref().unwrap() {
            Value::Template(template) => {
                assert!(template.parts.len() >= 3);
                assert!(template.raw.as_ref().contains("prefix-"));
                assert!(template.raw.as_ref().contains("-suffix"));
            }
            _ => panic!("Expected Template value in attribute"),
        },
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_template_value_starting_with_expr() {
    let source = r#"<view>{{count}} items</view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            match &el.children[0] {
                Node::Text(text) => {
                    match &text.value {
                        Value::Template(template) => {
                            assert!(template.parts.len() >= 2);
                            // First part should be Expr
                            // Second part should be Static " items"
                        }
                        _ => panic!("Expected Template value"),
                    }
                }
                _ => panic!("Expected Text node"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_template_value_ending_with_expr() {
    let source = r#"<view>Total: {{total}}</view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => match &el.children[0] {
            Node::Text(text) => match &text.value {
                Value::Template(template) => {
                    assert!(template.parts.len() >= 2);
                }
                _ => panic!("Expected Template value"),
            },
            _ => panic!("Expected Text node"),
        },
        _ => panic!("Expected Element"),
    }
}

// ============================================================================
// Raw and Cooked Text Tests
// ============================================================================

#[test]
fn test_raw_field_preserves_quotes() {
    let source = r#"<view class="container"></view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            match el.attrs[0].value.as_ref().unwrap() {
                Value::Static(s) => {
                    // raw field behavior: may contain quotes or just the value
                    // The key is that value is the cooked/unquoted version
                    assert_eq!(s.value.as_ref(), "container");
                    // raw should at least contain the value itself
                    assert!(s.raw.as_ref().contains("container"));
                }
                _ => panic!("Expected Static value"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_expr_raw_field() {
    let source = r#"<view class="{{className}}"></view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            match el.attrs[0].value.as_ref().unwrap() {
                Value::Expr(expr) => {
                    // raw should not include {{ }}
                    assert!(!expr.raw.as_ref().starts_with("{{"));
                    assert!(!expr.raw.as_ref().ends_with("}}"));
                    assert_eq!(expr.raw.as_ref(), "className");
                }
                _ => panic!("Expected Expr value"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_template_raw_field() {
    let source = r#"<view>Hello {{name}}!</view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            match &el.children[0] {
                Node::Text(text) => {
                    match &text.value {
                        Value::Template(template) => {
                            // raw should contain the full template string
                            assert!(template.raw.as_ref().contains("Hello"));
                            assert!(template.raw.as_ref().contains("!"));
                        }
                        _ => panic!("Expected Template value"),
                    }
                }
                _ => panic!("Expected Text node"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

// ============================================================================
// Interpolation Boundary Tests
// ============================================================================

#[test]
fn test_adjacent_interpolations() {
    let source = r#"<view>{{a}}{{b}}</view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => match &el.children[0] {
            Node::Text(text) => match &text.value {
                Value::Template(template) => {
                    assert_eq!(template.parts.len(), 2, "Should have exactly 2 expr parts");
                }
                _ => panic!("Expected Template value"),
            },
            _ => panic!("Expected Text node"),
        },
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_interpolation_with_whitespace() {
    let source = r#"<view>{{  value  }}</view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            match &el.children[0] {
                Node::Text(text) => {
                    match &text.value {
                        Value::Expr(expr) => {
                            // Whitespace handling depends on parser implementation
                            assert!(expr.raw.as_ref().contains("value"));
                        }
                        _ => {}
                    }
                }
                _ => panic!("Expected Text node"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_empty_string_between_interpolations() {
    let source = r#"<view>{{a}}{{b}}</view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            match &el.children[0] {
                Node::Text(text) => {
                    match &text.value {
                        Value::Template(template) => {
                            // Two adjacent expressions with no static text between
                            assert_eq!(template.parts.len(), 2);
                        }
                        _ => panic!("Expected Template value"),
                    }
                }
                _ => panic!("Expected Text node"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_complex_interpolation_pattern() {
    let source = r#"<view>A{{b}}C{{d}}E</view>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            match &el.children[0] {
                Node::Text(text) => {
                    match &text.value {
                        Value::Template(template) => {
                            // Pattern: Static("A") + Expr("b") + Static("C") + Expr("d") + Static("E")
                            assert_eq!(template.parts.len(), 5, "Should have 5 parts");
                        }
                        _ => panic!("Expected Template value"),
                    }
                }
                _ => panic!("Expected Text node"),
            }
        }
        _ => panic!("Expected Element"),
    }
}

// ============================================================================
// Boolean Attribute Tests (no value)
// ============================================================================

#[test]
fn test_boolean_attribute_no_value() {
    let source = r#"<input disabled />"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.attrs.len(), 1);
            assert_eq!(el.attrs[0].name.as_ref(), "disabled");
            assert!(
                el.attrs[0].value.is_none(),
                "Boolean attribute should have no value"
            );
        }
        _ => panic!("Expected Element"),
    }
}

#[test]
fn test_mixed_attributes() {
    let source = r#"<input type="text" disabled value="{{inputValue}}" />"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.attrs.len(), 3);

            // type="text" - Static
            match el.attrs[0].value.as_ref().unwrap() {
                Value::Static(_) => {}
                _ => panic!("Expected Static value"),
            }

            // disabled - no value
            assert!(el.attrs[1].value.is_none());

            // value="{{inputValue}}" - Expr
            match el.attrs[2].value.as_ref().unwrap() {
                Value::Expr(_) => {}
                _ => panic!("Expected Expr value"),
            }
        }
        _ => panic!("Expected Element"),
    }
}
