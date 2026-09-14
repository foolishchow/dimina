//! WXML Parser
//!
//! This crate provides parsing for WeChat Mini Program WXML documents.

use std::path::PathBuf;

mod ast;
mod error;
mod expression;
mod parse;
mod template_data;

// Re-export public types
pub use ast::*;
pub use error::*;

/// Parse result type
pub type ParseResult = Result<Document, Vec<ParseError>>;

/// Parse WXML source text into a Document AST
///
/// # Arguments
///
/// * `source_file` - Optional file path for error reporting
/// * `source` - WXML source text
///
/// # Returns
///
/// Returns `Ok(Document)` on success, or `Err(Vec<ParseError>)` with all parse errors
pub fn parse_wxml(source_file: Option<PathBuf>, source: &str) -> ParseResult {
    parse::parse_wxml_internal(source_file, source)
}

/// Parse a WXML expression (content inside `{{ ... }}`)
///
/// # Arguments
///
/// * `source_file` - Optional file path for error reporting
/// * `source` - Expression source text (without the `{{ }}` delimiters)
///
/// # Returns
///
/// Returns `Ok(ExprContainer)` on success, or `Err(WxmlExpressionError)` on failure
pub fn parse_wxml_expression(
    source_file: Option<PathBuf>,
    source: &str,
) -> Result<ExprContainer, WxmlExpressionError> {
    expression::parse_expression_internal(source_file, source)
}

/// Parse template data (content inside `<template data="{{ ... }}">`)
///
/// # Arguments
///
/// * `source_file` - Optional file path for error reporting
/// * `source` - Template data source text (without the `{{ }}` delimiters)
///
/// # Returns
///
/// Returns `Ok(TemplateData)` on success, or `Err(WxmlTemplateDataError)` on failure
///
/// # Span Contract
///
/// The returned `TemplateData.span` covers the entire input source: `[0, source.len())`
pub fn parse_template_data(
    source_file: Option<PathBuf>,
    source: &str,
) -> Result<TemplateData, WxmlTemplateDataError> {
    let full_span = swc_common::Span::new(
        swc_common::BytePos(0),
        swc_common::BytePos(source.len() as u32),
    );
    template_data::parse_template_data_internal(source_file, source, full_span)
}
