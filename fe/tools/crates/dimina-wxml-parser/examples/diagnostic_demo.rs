use dimina_wxml_parser::{parse_wxml, ParseErrorKind};

fn main() {
    println!("=== Expression Error Diagnostics Demo ===\n");

    let test_cases = vec![
        ("Assignment", r#"<view>{{a = 1}}</view>"#),
        ("Update", r#"<view>{{i++}}</view>"#),
        ("Comma", r#"<view>{{a, b}}</view>"#),
        ("New", r#"<view>{{new Date()}}</view>"#),
        ("Function", r#"<view>{{function() {}}}</view>"#),
        ("Await", r#"<view>{{await value}}</view>"#),
    ];

    for (name, source) in test_cases {
        println!("{}:", name);
        println!("  Source: {}", source);
        match parse_wxml(None, source) {
            Ok(_) => println!("  ✓ Parsed OK (unexpected)"),
            Err(errors) => {
                for err in errors {
                    match &err.kind {
                        ParseErrorKind::ExpressionError(kind) => {
                            println!("  ✗ ExpressionError({:?})", kind);
                            println!("    Message: {}", err.message);
                        }
                        other => {
                            println!("  ✗ {:?}", other);
                            println!("    Message: {}", err.message);
                        }
                    }
                }
            }
        }
        println!();
    }
}
