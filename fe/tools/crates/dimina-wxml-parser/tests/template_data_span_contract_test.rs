//! Span contract verification for parse_template_data public API

use dimina_wxml_parser::parse_template_data;

#[test]
fn test_span_contract_simple() {
    let source = "item";
    let result = parse_template_data(None, source);
    assert!(result.is_ok());

    let data = result.unwrap();

    // Verify span contract: source[span] == raw
    let lo = data.span.lo.0 as usize;
    let hi = data.span.hi.0 as usize;
    let span_slice = &source[lo..hi];

    assert_eq!(
        span_slice,
        data.raw.as_ref(),
        "Span contract violated: source[span] != raw"
    );
}

#[test]
fn test_span_contract_spread() {
    let source = "...item";
    let result = parse_template_data(None, source);
    assert!(result.is_ok());

    let data = result.unwrap();
    let lo = data.span.lo.0 as usize;
    let hi = data.span.hi.0 as usize;

    assert_eq!(&source[lo..hi], data.raw.as_ref());
}

#[test]
fn test_span_contract_multiple() {
    let source = "foo, bar";
    let result = parse_template_data(None, source);
    assert!(result.is_ok());

    let data = result.unwrap();
    let lo = data.span.lo.0 as usize;
    let hi = data.span.hi.0 as usize;

    assert_eq!(&source[lo..hi], data.raw.as_ref());
}

#[test]
fn test_span_contract_key_value() {
    let source = "text: 'forbar', id: index";
    let result = parse_template_data(None, source);
    assert!(result.is_ok());

    let data = result.unwrap();
    let lo = data.span.lo.0 as usize;
    let hi = data.span.hi.0 as usize;

    assert_eq!(&source[lo..hi], data.raw.as_ref());
}

#[test]
fn test_span_contract_mixed() {
    let source = "...obj1, ...obj2, a, c: 6";
    let result = parse_template_data(None, source);
    assert!(result.is_ok());

    let data = result.unwrap();
    let lo = data.span.lo.0 as usize;
    let hi = data.span.hi.0 as usize;

    assert_eq!(&source[lo..hi], data.raw.as_ref());
}

#[test]
fn test_span_covers_full_input() {
    let source = "foo, bar, baz";
    let result = parse_template_data(None, source);
    assert!(result.is_ok());

    let data = result.unwrap();

    // Verify span covers entire input
    assert_eq!(data.span.lo.0, 0);
    assert_eq!(data.span.hi.0, source.len() as u32);
}

#[test]
fn test_span_contract_with_whitespace() {
    // Note: raw is the original source, not trimmed
    let source = "  foo, bar  ";
    let result = parse_template_data(None, source);
    assert!(result.is_ok());

    let data = result.unwrap();
    let lo = data.span.lo.0 as usize;
    let hi = data.span.hi.0 as usize;

    assert_eq!(&source[lo..hi], data.raw.as_ref());
    assert_eq!(data.raw.as_ref(), "  foo, bar  ");
}
