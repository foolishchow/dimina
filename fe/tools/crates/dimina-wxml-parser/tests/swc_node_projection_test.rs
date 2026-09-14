//! WXML AST projection tests
//!
//! Validates that:
//! - Projection visits WXML-owned nodes
//! - Projection treats swc_ecma_ast::Expr as foreign_ast_leaf
//! - Projection treats swc_ecma_ast::ObjectLit as foreign_ast_leaf
//! - Projection preserves special node kinds
//! - Projection preserves value boundaries

use dimina_wxml_parser::parse_wxml;

/// Representative WXML source from WXML-SWC-NODE-CONTRACT.md
const REPRESENTATIVE_SOURCE: &str = r#"
<wxs module="m" src="./m.wxs" />
<template name="itemTpl"><view>{{item.name}}</view></template>
<view wx:for="{{items}}" wx:if="{{ready}}" hidden="{{hidden}}" slot="body">
  <slot name="main"><text class="a {{b}}">Hello {{name}}</text></slot>
  <template is="{{itemTpl}}" data="{{...item, index: idx}}" />
</view>
"#;

#[test]
fn wxml_ast_projection_visits_wxml_owned_nodes() {
    let result = parse_wxml(None, REPRESENTATIVE_SOURCE);
    assert!(result.is_ok(), "parse failed: {:?}", result.err());

    let doc = result.unwrap();
    let rows = dimina_wxml_parser::project_document(&doc);

    // Must project Document as root
    assert!(
        rows.iter().any(|r| r.kind == "Document"),
        "missing Document"
    );

    // Must project special nodes: Wxs, TemplateDef, TemplateRef, Slot
    assert!(rows.iter().any(|r| r.kind == "Wxs"), "missing Wxs");
    assert!(
        rows.iter().any(|r| r.kind == "TemplateDef"),
        "missing TemplateDef"
    );
    assert!(
        rows.iter().any(|r| r.kind == "TemplateRef"),
        "missing TemplateRef"
    );
    assert!(rows.iter().any(|r| r.kind == "Slot"), "missing Slot");

    // Must project ordinary Element nodes
    let elements: Vec<_> = rows.iter().filter(|r| r.kind == "Element").collect();
    assert!(
        elements.len() >= 3,
        "expected at least 3 elements (view, view, text)"
    );

    // Must project Text nodes
    assert!(rows.iter().any(|r| r.kind == "Text"), "missing Text");
}

#[test]
fn wxml_ast_projection_treats_swc_expr_as_foreign_leaf() {
    let result = parse_wxml(None, REPRESENTATIVE_SOURCE);
    assert!(result.is_ok());

    let doc = result.unwrap();
    let rows = dimina_wxml_parser::project_document(&doc);

    // ExprContainer fields must be marked as foreign_ast_leaf
    let expr_leaves: Vec<_> = rows
        .iter()
        .filter(|r| r.foreign_leaf == Some("swc_ecma_ast::Expr"))
        .collect();

    // Must have foreign leaves for:
    // - wx:for source
    // - wx:if test
    // - hidden directive value
    // - interpolations in text and attr values
    assert!(
        expr_leaves.len() >= 3,
        "expected at least 3 swc_ecma_ast::Expr foreign leaves, got {}",
        expr_leaves.len()
    );

    // TemplateData.object must be marked as foreign_ast_leaf
    let template_data_leaves: Vec<_> = rows
        .iter()
        .filter(|r| r.foreign_leaf == Some("swc_ecma_ast::ObjectLit"))
        .collect();

    assert_eq!(
        template_data_leaves.len(),
        1,
        "expected 1 swc_ecma_ast::ObjectLit foreign leaf for template data"
    );
}

#[test]
fn wxml_ast_projection_preserves_special_node_kinds() {
    let result = parse_wxml(None, REPRESENTATIVE_SOURCE);
    assert!(result.is_ok());

    let doc = result.unwrap();
    let rows = dimina_wxml_parser::project_document(&doc);

    // Must preserve directive kinds
    assert!(
        rows.iter().any(|r| r.kind == "Directive::For"),
        "missing Directive::For"
    );
    assert!(
        rows.iter().any(|r| r.kind == "Directive::If"),
        "missing Directive::If"
    );
    assert!(
        rows.iter().any(|r| r.kind == "Directive::Hidden"),
        "missing Directive::Hidden"
    );

    // Must preserve node names where present
    let wxs = rows.iter().find(|r| r.kind == "Wxs").unwrap();
    assert!(wxs.name.is_some(), "Wxs node should have module name");

    let template_def = rows.iter().find(|r| r.kind == "TemplateDef").unwrap();
    assert!(template_def.name.is_some(), "TemplateDef should have name");

    let slot = rows.iter().find(|r| r.kind == "Slot").unwrap();
    assert!(slot.name.is_some(), "Slot should have name");
}

#[test]
fn wxml_ast_projection_preserves_value_boundaries() {
    // Test that mixed-content template values preserve part boundaries
    let source = r#"<text class="a {{b}}">static</text>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok());

    let doc = result.unwrap();
    let rows = dimina_wxml_parser::project_document(&doc);

    // Must project the template value container
    assert!(
        rows.iter().any(|r| r.kind == "Value::Template"),
        "missing Value::Template for class attr"
    );

    // Must project template parts: Static and Expr
    assert!(
        rows.iter().any(|r| r.kind == "TemplatePart::Static"),
        "missing TemplatePart::Static"
    );
    assert!(
        rows.iter().any(|r| r.kind == "TemplatePart::Expr"),
        "missing TemplatePart::Expr"
    );

    // Expr part must be foreign leaf
    let expr_part_leaf = rows
        .iter()
        .find(|r| r.kind == "TemplatePart::Expr" && r.foreign_leaf.is_some());
    assert!(
        expr_part_leaf.is_some(),
        "TemplatePart::Expr should be foreign leaf"
    );
}
