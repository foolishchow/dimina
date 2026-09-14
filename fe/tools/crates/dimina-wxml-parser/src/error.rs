//! Parser error types

use std::path::PathBuf;
use swc_common::Span;

/// Parser error
#[derive(Debug, Clone)]
pub struct ParseError {
    pub span: Span,
    pub source_file: Option<PathBuf>,
    pub kind: ParseErrorKind,
    pub message: String,
}

/// Parser error kind
#[derive(Debug, Clone)]
pub enum ParseErrorKind {
    UnclosedTag { tag: String },
    MismatchedTag { open: String, close: String },
    InvalidAttributeName { name: String },
    UnclosedComment,
    UnclosedInterpolation,
    InvalidDirective { name: String },
    ExpressionError(WxmlExpressionErrorKind),
    Other(String),
}

/// WXML expression parsing error
#[derive(Debug, Clone)]
pub struct WxmlExpressionError {
    pub span: Span,
    pub source_file: Option<PathBuf>,
    pub kind: WxmlExpressionErrorKind,
    pub message: String,
}

/// WXML expression error kind
#[derive(Debug, Clone)]
pub enum WxmlExpressionErrorKind {
    Empty,
    Syntax,
    RejectedCategory,
    /// Compatibility-open category not yet decided (deferred)
    DeferredCategory,
    WrapperExtraction,
}

/// WXML template data parsing error
#[derive(Debug, Clone)]
pub struct WxmlTemplateDataError {
    pub span: Span,
    pub source_file: Option<PathBuf>,
    pub kind: WxmlTemplateDataErrorKind,
    pub message: String,
}

/// WXML template data error kind
#[derive(Debug, Clone)]
pub enum WxmlTemplateDataErrorKind {
    Empty,
    Syntax,
    InvalidTemplateData,
}
