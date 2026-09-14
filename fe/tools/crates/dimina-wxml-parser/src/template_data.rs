//! WXML template data parsing

use crate::{TemplateData, WxmlTemplateDataError, WxmlTemplateDataErrorKind};
use std::path::PathBuf;
use swc_atoms::Atom;
use swc_common::{sync::Lrc, FileName, SourceMap, Span};
use swc_ecma_ast::Expr;
use swc_ecma_parser::{lexer::Lexer, Parser, StringInput, Syntax};

pub(crate) fn parse_template_data_internal(
    source_file: Option<PathBuf>,
    source: &str,
    original_span: Span,
) -> Result<TemplateData, WxmlTemplateDataError> {
    // Clone source_file early for error construction
    let source_file_for_errors = source_file.clone();

    // Check for empty template data first
    if source.trim().is_empty() {
        return Err(WxmlTemplateDataError {
            span: original_span,
            source_file: source_file_for_errors.clone(),
            kind: WxmlTemplateDataErrorKind::Empty,
            message: "template data cannot be empty".to_string(),
        });
    }

    // Normalize WXML template data grammar to object literal
    // Examples:
    // - "text: 'x'" -> "({ text: 'x' })"
    // - "...item" -> "({ ...item })"
    // - "foo, bar" -> "({ foo, bar })"
    let normalized = format!("({{ {} }})", source);

    let cm = SourceMap::default();
    let fm = cm.new_source_file(
        Lrc::new(source_file.map(FileName::Real).unwrap_or(FileName::Anon)),
        normalized.clone(),
    );

    let lexer = Lexer::new(
        Syntax::Es(Default::default()),
        Default::default(),
        StringInput::from(&*fm),
        None,
    );

    let mut parser = Parser::new_from(lexer);

    match parser.parse_expr() {
        Ok(expr) => {
            if let Expr::Paren(paren) = *expr {
                if let Expr::Object(obj_lit) = *paren.expr {
                    Ok(TemplateData {
                        span: original_span,
                        raw: Atom::from(source),
                        object: obj_lit,
                    })
                } else {
                    Err(WxmlTemplateDataError {
                        span: original_span,
                        source_file: source_file_for_errors.clone(),
                        kind: WxmlTemplateDataErrorKind::InvalidTemplateData,
                        message: format!(
                            "template data must normalize to object literal, got: {:?}",
                            paren.expr
                        ),
                    })
                }
            } else {
                Err(WxmlTemplateDataError {
                    span: original_span,
                    source_file: source_file_for_errors.clone(),
                    kind: WxmlTemplateDataErrorKind::InvalidTemplateData,
                    message: format!(
                        "template data parsing result is not parenthesized expression, got: {:?}",
                        expr
                    ),
                })
            }
        }
        Err(e) => Err(WxmlTemplateDataError {
            span: original_span,
            source_file: source_file_for_errors.clone(),
            kind: WxmlTemplateDataErrorKind::Syntax,
            message: format!("{:?}", e),
        }),
    }
}
