//! UTF-8 safety tests
//! These tests verify that the parser correctly handles multi-byte UTF-8 characters
//! in all positions: tag names, attribute names, attribute values, text content, comments

use dimina_wxml_parser::parse_wxml;

#[test]
fn test_utf8_tag_name() {
    // Tag name with multi-byte UTF-8 characters
    // Note: While XML/WXML spec typically uses ASCII tag names, the parser
    // should handle UTF-8 gracefully without panicking
    let source = r#"<组件>内容</组件>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse UTF-8 tag names without panic");
}

#[test]
fn test_utf8_attribute_name() {
    // Attribute name with multi-byte UTF-8 characters
    let source = r#"<view 属性="值"></view>"#;
    let result = parse_wxml(None, source);
    assert!(
        result.is_ok(),
        "Should parse UTF-8 attribute names without panic"
    );
}

#[test]
fn test_utf8_tag_and_attr_name() {
    // Both tag and attribute names with UTF-8
    let source = r#"<视图 数据="测试">内容</视图>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse UTF-8 tag and attribute names");
}

#[test]
fn test_utf8_text_content() {
    // Text with multi-byte UTF-8 characters (Chinese, emoji)
    let source = r#"<view>你好世界 🌍</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse UTF-8 text content");

    let doc = result.unwrap();
    assert_eq!(doc.body.len(), 1);
}

#[test]
fn test_utf8_attribute_value() {
    // Attribute value with multi-byte UTF-8 characters
    let source = r#"<view data-text="你好世界 🌍"></view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse UTF-8 attribute values");
}

#[test]
fn test_utf8_static_interpolation() {
    // Static value with UTF-8 characters
    let source = r#"<view data="你好"></view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse UTF-8 static values");
}

#[test]
fn test_utf8_mixed_template() {
    // Template value with UTF-8 characters
    let source = r#"<view data="前缀{{value}}后缀"></view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse UTF-8 mixed template values");
}

#[test]
fn test_utf8_comment() {
    // Comment with UTF-8 characters
    let source = r#"<!-- 这是一个注释 🎉 --><view></view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse UTF-8 comments");
}

#[test]
fn test_utf8_closing_tag() {
    // This test specifically targets closing tag parsing which uses ch.len_utf8()
    // Multiple elements with UTF-8 content to stress test the parser
    let source = r#"<view>文本1</view><view>文本2</view><view>文本3</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse multiple elements with UTF-8");

    let doc = result.unwrap();
    assert_eq!(doc.body.len(), 3, "Should have 3 view elements");
}

#[test]
fn test_utf8_self_closing_after_utf8_content() {
    // Self-closing tag after UTF-8 content
    let source = r#"<view>中文内容</view><image src="test.jpg" />"#;
    let result = parse_wxml(None, source);
    assert!(
        result.is_ok(),
        "Should parse self-closing after UTF-8 content"
    );
}

#[test]
fn test_utf8_mixed_ascii_and_multibyte() {
    // Mix of ASCII and multi-byte characters in various positions
    let source = r#"<view class="测试类" data-中文="值">混合 content 内容</view>"#;
    let result = parse_wxml(None, source);
    assert!(result.is_ok(), "Should parse mixed ASCII and UTF-8");
}

#[test]
fn test_utf8_emoji_in_tag_name() {
    // Emoji in tag name (extreme case)
    let source = r#"<view🎉>content</view🎉>"#;
    let result = parse_wxml(None, source);
    assert!(
        result.is_ok(),
        "Should handle emoji in tag names without panic"
    );
}
