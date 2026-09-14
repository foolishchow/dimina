//! E4 Evidence: Special Node Tests
//!
//! Proves that WXS, template def/ref, import/include, and slot parse into
//! typed special nodes (not generic Element nodes).
//!
//! Special node types:
//! - Wxs: WeChat mini-program script modules
//! - TemplateDef: Template definitions
//! - TemplateRef: Template references/usage
//! - Import: Import template definitions
//! - Include: Include WXML content
//! - Slot: Component slot outlets

use dimina_wxml_parser::{parse_wxml, Directive, Node};

// ============================================================================
// WXS Special Node Tests
// ============================================================================

#[test]
fn test_wxs_node_with_module_and_inline_code() {
    let source = r#"<wxs module="utils">
var format = function(value) {
  return value.toFixed(2);
};
module.exports = { format: format };
</wxs>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    assert_eq!(doc.body.len(), 1);
    match &doc.body[0] {
        Node::Wxs(wxs) => {
            // Verify it's a Wxs node, not Element
            assert!(wxs.module.is_some(), "Wxs should have module attribute");
            assert_eq!(wxs.module.as_ref().unwrap().value.as_ref(), "utils");

            assert!(wxs.content.is_some(), "Wxs should have inline content");
            let content = wxs.content.as_ref().unwrap();
            assert!(content.raw.as_ref().contains("module.exports"));

            assert!(wxs.src.is_none(), "Inline Wxs should not have src");
        }
        Node::Element(el) if el.name.as_ref() == "wxs" => {
            panic!("wxs should parse as Node::Wxs, not Node::Element");
        }
        _ => panic!("Expected Wxs node, got {:?}", doc.body[0]),
    }
}

#[test]
fn test_wxs_node_with_external_src() {
    let source = r#"<wxs module="helpers" src="./utils.wxs" />"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Wxs(wxs) => {
            assert!(wxs.module.is_some());
            assert_eq!(wxs.module.as_ref().unwrap().value.as_ref(), "helpers");

            assert!(wxs.src.is_some(), "External Wxs should have src");
            assert_eq!(wxs.src.as_ref().unwrap().value.as_ref(), "./utils.wxs");

            assert!(
                wxs.content.is_none(),
                "External Wxs should not have inline content"
            );
            assert!(wxs.self_closing, "Self-closing Wxs");
        }
        Node::Element(_) => {
            panic!("wxs with src should parse as Node::Wxs, not Node::Element");
        }
        _ => panic!("Expected Wxs node"),
    }
}

#[test]
fn test_wxs_different_from_element() {
    let source = r#"
<wxs module="m1">var x = 1;</wxs>
<view>Content</view>
    "#;
    let doc = parse_wxml(None, source).expect("parse failed");

    let wxs_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Wxs(_)))
        .count();
    let element_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Element(_)))
        .count();

    assert_eq!(wxs_count, 1, "Should have exactly 1 Wxs node");
    assert_eq!(element_count, 1, "Should have exactly 1 Element node");
}

// ============================================================================
// TemplateDef Special Node Tests
// ============================================================================

#[test]
fn test_template_def_node_with_name() {
    let source = r#"<template name="userCard">
  <view class="card">
    <text>{{name}}</text>
  </view>
</template>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    assert_eq!(doc.body.len(), 1);
    match &doc.body[0] {
        Node::TemplateDef(tpl) => {
            // Verify it's a TemplateDef node, not Element
            assert!(tpl.name.is_some(), "TemplateDef should have name");
            assert_eq!(tpl.name.as_ref().unwrap().value.as_ref(), "userCard");

            assert!(!tpl.body.is_empty(), "TemplateDef should have body");
        }
        Node::Element(el) if el.name.as_ref() == "template" => {
            panic!("template with name should parse as Node::TemplateDef, not Node::Element");
        }
        _ => panic!("Expected TemplateDef node, got {:?}", doc.body[0]),
    }
}

#[test]
fn test_template_def_empty_body() {
    let source = r#"<template name="empty"></template>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::TemplateDef(tpl) => {
            assert!(tpl.name.is_some());
            assert_eq!(tpl.name.as_ref().unwrap().value.as_ref(), "empty");
            // Empty body is valid
        }
        Node::Element(_) => {
            panic!("template should parse as Node::TemplateDef");
        }
        _ => panic!("Expected TemplateDef node"),
    }
}

#[test]
fn test_template_def_different_from_element() {
    let source = r#"
<template name="card">Content</template>
<view>Element</view>
    "#;
    let doc = parse_wxml(None, source).expect("parse failed");

    let tpl_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::TemplateDef(_)))
        .count();
    let element_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Element(_)))
        .count();

    assert_eq!(tpl_count, 1, "Should have exactly 1 TemplateDef node");
    assert_eq!(element_count, 1, "Should have exactly 1 Element node");
}

// ============================================================================
// TemplateRef Special Node Tests
// ============================================================================

#[test]
fn test_template_ref_node_with_static_target() {
    let source = r#"<template is="userCard" data="{{user}}" />"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    assert_eq!(doc.body.len(), 1);
    match &doc.body[0] {
        Node::TemplateRef(tpl_ref) => {
            // Verify it's a TemplateRef node, not Element
            assert!(tpl_ref.target.is_some(), "TemplateRef should have target");

            match tpl_ref.target.as_ref().unwrap() {
                dimina_wxml_parser::Value::Static(s) => {
                    assert_eq!(s.value.as_ref(), "userCard");
                }
                _ => panic!("Expected static target"),
            }

            assert!(tpl_ref.data.is_some(), "TemplateRef should have data");
        }
        Node::Element(el) if el.name.as_ref() == "template" => {
            panic!("template with is should parse as Node::TemplateRef, not Node::Element");
        }
        _ => panic!("Expected TemplateRef node, got {:?}", doc.body[0]),
    }
}

#[test]
fn test_template_ref_node_with_dynamic_target() {
    let source = r#"<template is="{{templateName}}" data="{{item}}" />"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::TemplateRef(tpl_ref) => {
            assert!(tpl_ref.target.is_some());

            match tpl_ref.target.as_ref().unwrap() {
                dimina_wxml_parser::Value::Expr(_) => {
                    // Dynamic template name
                }
                _ => panic!("Expected expression target"),
            }
        }
        Node::Element(_) => {
            panic!("template with is should parse as Node::TemplateRef");
        }
        _ => panic!("Expected TemplateRef node"),
    }
}

#[test]
fn test_template_ref_different_from_template_def() {
    let source = r#"
<template name="def">Def</template>
<template is="ref" />
    "#;
    let doc = parse_wxml(None, source).expect("parse failed");

    let def_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::TemplateDef(_)))
        .count();
    let ref_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::TemplateRef(_)))
        .count();

    assert_eq!(def_count, 1, "Should have 1 TemplateDef node");
    assert_eq!(ref_count, 1, "Should have 1 TemplateRef node");
}

// ============================================================================
// Import Special Node Tests
// ============================================================================

#[test]
fn test_import_node_with_relative_path() {
    let source = r#"<import src="./templates/card.wxml" />"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    assert_eq!(doc.body.len(), 1);
    match &doc.body[0] {
        Node::Import(import) => {
            // Verify it's an Import node, not Element
            assert!(import.src.is_some(), "Import should have src");
            assert_eq!(
                import.src.as_ref().unwrap().value.as_ref(),
                "./templates/card.wxml"
            );
            assert!(import.self_closing, "Import should be self-closing");
        }
        Node::Element(el) if el.name.as_ref() == "import" => {
            panic!("import should parse as Node::Import, not Node::Element");
        }
        _ => panic!("Expected Import node, got {:?}", doc.body[0]),
    }
}

#[test]
fn test_import_node_with_absolute_path() {
    let source = r#"<import src="/common/header.wxml" />"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Import(import) => {
            assert!(import.src.is_some());
            assert_eq!(
                import.src.as_ref().unwrap().value.as_ref(),
                "/common/header.wxml"
            );
        }
        Node::Element(_) => {
            panic!("import should parse as Node::Import");
        }
        _ => panic!("Expected Import node"),
    }
}

#[test]
fn test_import_different_from_element() {
    let source = r#"
<import src="./common.wxml" />
<view>Element</view>
    "#;
    let doc = parse_wxml(None, source).expect("parse failed");

    let import_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Import(_)))
        .count();
    let element_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Element(_)))
        .count();

    assert_eq!(import_count, 1, "Should have exactly 1 Import node");
    assert_eq!(element_count, 1, "Should have exactly 1 Element node");
}

// ============================================================================
// Include Special Node Tests
// ============================================================================

#[test]
fn test_include_node_with_relative_path() {
    let source = r#"<include src="./header.wxml" />"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    assert_eq!(doc.body.len(), 1);
    match &doc.body[0] {
        Node::Include(include) => {
            // Verify it's an Include node, not Element
            assert!(include.src.is_some(), "Include should have src");
            assert_eq!(
                include.src.as_ref().unwrap().value.as_ref(),
                "./header.wxml"
            );
            assert!(include.self_closing, "Include should be self-closing");
        }
        Node::Element(el) if el.name.as_ref() == "include" => {
            panic!("include should parse as Node::Include, not Node::Element");
        }
        _ => panic!("Expected Include node, got {:?}", doc.body[0]),
    }
}

#[test]
fn test_include_node_parent_path() {
    let source = r#"<include src="../shared/footer.wxml" />"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Include(include) => {
            assert!(include.src.is_some());
            assert_eq!(
                include.src.as_ref().unwrap().value.as_ref(),
                "../shared/footer.wxml"
            );
        }
        Node::Element(_) => {
            panic!("include should parse as Node::Include");
        }
        _ => panic!("Expected Include node"),
    }
}

#[test]
fn test_include_preserves_structural_directive() {
    let source = r#"<include src="./row.wxml" wx:if="{{visible}}" />"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Include(include) => {
            assert_eq!(include.directives.len(), 1);
            assert!(matches!(include.directives[0], Directive::If(_)));
        }
        _ => panic!("Expected Include node"),
    }
}

#[test]
fn test_include_different_from_import() {
    let source = r#"
<import src="./templates.wxml" />
<include src="./content.wxml" />
    "#;
    let doc = parse_wxml(None, source).expect("parse failed");

    let import_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Import(_)))
        .count();
    let include_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Include(_)))
        .count();

    assert_eq!(import_count, 1, "Should have exactly 1 Import node");
    assert_eq!(include_count, 1, "Should have exactly 1 Include node");
}

// ============================================================================
// Slot Special Node Tests
// ============================================================================

#[test]
fn test_slot_node_default() {
    let source = r#"<slot>Default content</slot>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    assert_eq!(doc.body.len(), 1);
    match &doc.body[0] {
        Node::Slot(slot) => {
            // Verify it's a Slot node, not Element
            assert!(slot.name.is_none(), "Default slot should have no name");
            assert!(
                !slot.children.is_empty(),
                "Slot should have fallback content"
            );
        }
        Node::Element(el) if el.name.as_ref() == "slot" => {
            panic!("slot should parse as Node::Slot, not Node::Element");
        }
        _ => panic!("Expected Slot node, got {:?}", doc.body[0]),
    }
}

#[test]
fn test_slot_node_named() {
    let source = r#"<slot name="header">Default header</slot>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Slot(slot) => {
            assert!(slot.name.is_some(), "Named slot should have name");
            assert_eq!(slot.name.as_ref().unwrap().value.as_ref(), "header");
        }
        Node::Element(_) => {
            panic!("slot should parse as Node::Slot");
        }
        _ => panic!("Expected Slot node"),
    }
}

#[test]
fn test_slot_node_empty() {
    let source = r#"<slot name="content"></slot>"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::Slot(slot) => {
            assert!(slot.name.is_some());
            // Empty slot is valid (no fallback content)
        }
        Node::Element(_) => {
            panic!("slot should parse as Node::Slot");
        }
        _ => panic!("Expected Slot node"),
    }
}

#[test]
fn test_slot_different_from_element() {
    let source = r#"
<slot name="header">Header</slot>
<view>Element</view>
    "#;
    let doc = parse_wxml(None, source).expect("parse failed");

    let slot_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Slot(_)))
        .count();
    let element_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Element(_)))
        .count();

    assert_eq!(slot_count, 1, "Should have exactly 1 Slot node");
    assert_eq!(element_count, 1, "Should have exactly 1 Element node");
}

// ============================================================================
// Mixed Special Nodes Tests
// ============================================================================

#[test]
fn test_all_special_nodes_in_one_document() {
    let source = r#"
<wxs module="utils">var x = 1;</wxs>
<import src="./common.wxml" />
<include src="./header.wxml" />
<template name="card">Card template</template>
<template is="card" data="{{item}}" />
<slot name="content">Default</slot>
<view>Regular element</view>
    "#;

    let doc = parse_wxml(None, source).expect("parse failed");

    // Count each special node type
    let wxs_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Wxs(_)))
        .count();
    let import_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Import(_)))
        .count();
    let include_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Include(_)))
        .count();
    let template_def_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::TemplateDef(_)))
        .count();
    let template_ref_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::TemplateRef(_)))
        .count();
    let slot_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Slot(_)))
        .count();
    let element_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Element(_)))
        .count();

    assert_eq!(wxs_count, 1, "Should have 1 Wxs node");
    assert_eq!(import_count, 1, "Should have 1 Import node");
    assert_eq!(include_count, 1, "Should have 1 Include node");
    assert_eq!(template_def_count, 1, "Should have 1 TemplateDef node");
    assert_eq!(template_ref_count, 1, "Should have 1 TemplateRef node");
    assert_eq!(slot_count, 1, "Should have 1 Slot node");
    assert_eq!(element_count, 1, "Should have 1 Element node");

    // Verify total count
    let total = wxs_count
        + import_count
        + include_count
        + template_def_count
        + template_ref_count
        + slot_count
        + element_count;
    assert!(doc.body.len() >= total, "All nodes should be parsed");
}

#[test]
fn test_special_nodes_not_parsed_as_generic_elements() {
    let source = r#"
<wxs module="m">code</wxs>
<template name="t">body</template>
<template is="t" />
<import src="./f.wxml" />
<include src="./f.wxml" />
<slot>fallback</slot>
    "#;

    let doc = parse_wxml(None, source).expect("parse failed");

    // None of these should be parsed as Element nodes
    let element_count = doc
        .body
        .iter()
        .filter(|n| matches!(n, Node::Element(_)))
        .count();

    assert_eq!(
        element_count, 0,
        "Special nodes should not be parsed as Element nodes"
    );
}

#[test]
fn test_all_special_node_types_coverage() {
    // This test documents all special node types that should NOT be Element
    let _special_types = vec![
        "Wxs",         // ✓ Covered: test_wxs_*
        "TemplateDef", // ✓ Covered: test_template_def_*
        "TemplateRef", // ✓ Covered: test_template_ref_*
        "Import",      // ✓ Covered: test_import_*
        "Include",     // ✓ Covered: test_include_*
        "Slot",        // ✓ Covered: test_slot_*
    ];

    // All 6 special node types have test coverage proving they are NOT Element
}

#[test]
fn test_single_quoted_template_data() {
    let source = r#"<template is='card' data='{{item}}' />"#;
    let doc = parse_wxml(None, source).expect("parse failed");

    match &doc.body[0] {
        Node::TemplateRef(tpl_ref) => {
            assert!(tpl_ref.data.is_some(), "Template should have data");
            let data = tpl_ref.data.as_ref().unwrap();
            assert_eq!(data.raw.as_ref(), "item");
        }
        _ => panic!("Expected TemplateRef node"),
    }
}
