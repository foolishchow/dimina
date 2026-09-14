//! Integration tests for WXML parser

use dimina_wxml_parser::{parse_wxml, parse_wxml_expression, Node};

#[test]
fn test_parse_empty_document() {
    let result = parse_wxml(None, "");
    assert!(result.is_ok());
    let doc = result.unwrap();
    assert_eq!(doc.body.len(), 0);
}

#[test]
fn test_parse_single_element() {
    let source = "<view></view>";
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    assert_eq!(doc.body.len(), 1);
    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.name.as_ref(), "view");
            assert!(!el.self_closing);
        }
        _ => panic!("Expected element node"),
    }
}

#[test]
fn test_parse_self_closing_element() {
    let source = "<input />";
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    assert_eq!(doc.body.len(), 1);
    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.name.as_ref(), "input");
            assert!(el.self_closing);
        }
        _ => panic!("Expected element node"),
    }
}

#[test]
fn test_parse_element_with_attributes() {
    let source = r#"<view class="container" id="main"></view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    assert_eq!(doc.body.len(), 1);
    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.name.as_ref(), "view");
            assert_eq!(el.attrs.len(), 2);
            assert_eq!(el.attrs[0].name.as_ref(), "class");
            assert_eq!(el.attrs[1].name.as_ref(), "id");
        }
        _ => panic!("Expected element node"),
    }
}

#[test]
fn test_parse_nested_elements() {
    let source = "<view><text>Hello</text></view>";
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    assert_eq!(doc.body.len(), 1);
    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.name.as_ref(), "view");
            assert_eq!(el.children.len(), 1);
            match &el.children[0] {
                Node::Element(text_el) => {
                    assert_eq!(text_el.name.as_ref(), "text");
                    assert_eq!(text_el.children.len(), 1);
                }
                _ => panic!("Expected element node"),
            }
        }
        _ => panic!("Expected element node"),
    }
}

#[test]
fn test_parse_text_node() {
    let source = "<view>Hello World</view>";
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.children.len(), 1);
            match &el.children[0] {
                Node::Text(text) => match &text.value {
                    dimina_wxml_parser::Value::Static(s) => {
                        assert!(s.value.as_ref().contains("Hello World"));
                    }
                    _ => panic!("Expected static text value"),
                },
                _ => panic!("Expected text node"),
            }
        }
        _ => panic!("Expected element node"),
    }
}

#[test]
fn test_parse_comment() {
    let source = "<!-- This is a comment --><view></view>";
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    assert_eq!(doc.body.len(), 2);
    match &doc.body[0] {
        Node::Comment(comment) => {
            assert!(comment.text.as_ref().contains("This is a comment"));
        }
        _ => panic!("Expected comment node"),
    }
}

#[test]
fn test_parse_directive() {
    let source = r#"<view wx:if="{{condition}}"></view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.directives.len(), 1);
            match &el.directives[0] {
                dimina_wxml_parser::Directive::If(_) => {
                    // Correct directive type
                }
                _ => panic!("Expected If directive"),
            }
        }
        _ => panic!("Expected element node"),
    }
}

#[test]
fn test_parse_wxml_expression_identifier() {
    let result = parse_wxml_expression(None, "name");
    assert!(result.is_ok());
}

#[test]
fn test_parse_wxml_expression_member() {
    let result = parse_wxml_expression(None, "user.name");
    assert!(result.is_ok());
}

#[test]
fn test_parse_wxml_expression_binary() {
    let result = parse_wxml_expression(None, "a + b");
    assert!(result.is_ok());
}

#[test]
fn test_parse_wxml_expression_call() {
    let result = parse_wxml_expression(None, "fn()");
    assert!(result.is_ok());
}

#[test]
fn test_parse_wxs() {
    let source = r#"<wxs module="utils">var format = function(x) { return x; };</wxs>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    assert_eq!(doc.body.len(), 1);
    match &doc.body[0] {
        Node::Wxs(wxs) => {
            assert!(wxs.module.is_some());
            assert_eq!(wxs.module.as_ref().unwrap().value.as_ref(), "utils");
            assert!(wxs.content.is_some());
            assert!(!wxs.self_closing);
        }
        _ => panic!("Expected Wxs node"),
    }
}

#[test]
fn test_parse_wxs_with_src() {
    let source = r#"<wxs module="utils" src="./utils.wxs" />"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    match &doc.body[0] {
        Node::Wxs(wxs) => {
            assert!(wxs.module.is_some());
            assert!(wxs.src.is_some());
            assert_eq!(wxs.src.as_ref().unwrap().value.as_ref(), "./utils.wxs");
            assert!(wxs.self_closing);
        }
        _ => panic!("Expected Wxs node"),
    }
}

#[test]
fn test_parse_template_def() {
    let source = r#"<template name="card"><view>Content</view></template>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    match &doc.body[0] {
        Node::TemplateDef(tpl) => {
            assert!(tpl.name.is_some());
            assert_eq!(tpl.name.as_ref().unwrap().value.as_ref(), "card");
            assert_eq!(tpl.body.len(), 1);
            assert!(!tpl.self_closing);
        }
        _ => panic!("Expected TemplateDef node"),
    }
}

#[test]
fn test_parse_template_ref() {
    let source = r#"<template is="card" />"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    match &doc.body[0] {
        Node::TemplateRef(tpl) => {
            assert!(tpl.target.is_some());
            assert!(tpl.self_closing);
        }
        _ => panic!("Expected TemplateRef node"),
    }
}

#[test]
fn test_parse_import() {
    let source = r#"<import src="./template.wxml" />"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    match &doc.body[0] {
        Node::Import(imp) => {
            assert!(imp.src.is_some());
            assert_eq!(imp.src.as_ref().unwrap().value.as_ref(), "./template.wxml");
            assert!(imp.self_closing);
        }
        _ => panic!("Expected Import node"),
    }
}

#[test]
fn test_parse_include() {
    let source = r#"<include src="./header.wxml" />"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    match &doc.body[0] {
        Node::Include(inc) => {
            assert!(inc.src.is_some());
            assert_eq!(inc.src.as_ref().unwrap().value.as_ref(), "./header.wxml");
            assert!(inc.self_closing);
        }
        _ => panic!("Expected Include node"),
    }
}

#[test]
fn test_parse_slot() {
    let source = r#"<slot name="header">Default content</slot>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    match &doc.body[0] {
        Node::Slot(slot) => {
            assert!(slot.name.is_some());
            assert_eq!(slot.name.as_ref().unwrap().value.as_ref(), "header");
            assert_eq!(slot.children.len(), 1);
            assert!(!slot.self_closing);
        }
        _ => panic!("Expected Slot node"),
    }
}

#[test]
fn test_parse_slot_assignment() {
    let source = r#"<view slot="header">Content</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    match &doc.body[0] {
        Node::Element(el) => {
            assert!(el.slot.is_some());
            assert_eq!(el.slot.as_ref().unwrap().name.value.as_ref(), "header");
        }
        _ => panic!("Expected Element node"),
    }
}

#[test]
fn test_parse_hidden_directive() {
    let source = r#"<view hidden="{{hidden}}">Content</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.directives.len(), 1);
            match &el.directives[0] {
                dimina_wxml_parser::Directive::Hidden(h) => {
                    assert!(h.test.is_some());
                }
                _ => panic!("Expected Hidden directive"),
            }
        }
        _ => panic!("Expected Element node"),
    }
}

#[test]
fn test_parse_for_with_item_index() {
    let source = r#"<view wx:for="{{items}}" wx:for-item="item" wx:for-index="idx"></view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());
    let doc = result.unwrap();
    match &doc.body[0] {
        Node::Element(el) => {
            assert_eq!(el.directives.len(), 1);
            match &el.directives[0] {
                dimina_wxml_parser::Directive::For(f) => {
                    assert!(f.item.is_some());
                    assert_eq!(f.item.as_ref().unwrap().as_ref(), "item");
                    assert!(f.index.is_some());
                    assert_eq!(f.index.as_ref().unwrap().as_ref(), "idx");
                }
                _ => panic!("Expected For directive"),
            }
        }
        _ => panic!("Expected Element node"),
    }
}
