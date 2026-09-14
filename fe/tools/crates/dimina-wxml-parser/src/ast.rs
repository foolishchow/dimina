//! WXML AST types
//!
//! Abstract syntax tree definitions for WXML documents.
//! Uses Atom for string interning and Span for source tracking.

use std::path::PathBuf;
use swc_atoms::Atom;
use swc_common::{ast_node, Span};

/// WXML Document root
#[derive(Eq)]
#[ast_node("Document")]
pub struct Document {
    pub span: Span,
    pub body: Vec<Node>,
    pub source_file: Option<PathBuf>,
}

/// WXML Node
#[derive(Eq)]
#[ast_node]
pub enum Node {
    #[tag("Element")]
    Element(Element),
    #[tag("Text")]
    Text(Text),
    #[tag("Comment")]
    Comment(Comment),
    #[tag("Wxs")]
    Wxs(Wxs),
    #[tag("TemplateDef")]
    TemplateDef(TemplateDef),
    #[tag("TemplateRef")]
    TemplateRef(TemplateRef),
    #[tag("Import")]
    Import(Import),
    #[tag("Include")]
    Include(Include),
    #[tag("Slot")]
    Slot(Slot),
}

/// WXML Element
#[derive(Eq)]
#[ast_node("Element")]
pub struct Element {
    pub span: Span,
    pub name: Atom,
    pub attrs: Vec<Attr>,
    pub directives: Vec<Directive>,
    pub slot: Option<SlotAssignment>,
    pub children: Vec<Node>,
    pub self_closing: bool,
}

/// WXML Attribute
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Attr {
    pub span: Span,
    pub name: Atom,
    pub value: Option<Value>,
}

/// WXML Attribute Value
#[derive(Eq)]
#[ast_node]
pub enum Value {
    #[tag("Static")]
    Static(StaticValue),
    #[tag("Expr")]
    Expr(ExprContainer),
    #[tag("Template")]
    Template(TemplateValue),
}

/// Static string value
#[derive(Eq)]
#[ast_node("StaticValue")]
pub struct StaticValue {
    pub span: Span,
    pub raw: Atom,
    pub value: Atom,
}

/// Expression container
#[derive(Eq)]
#[ast_node("ExprContainer")]
pub struct ExprContainer {
    pub span: Span,
    pub raw: Atom,
    pub expr: Box<swc_ecma_ast::Expr>,
}

/// Template value with mixed content
#[derive(Eq)]
#[ast_node("TemplateValue")]
pub struct TemplateValue {
    pub span: Span,
    pub raw: Atom,
    pub parts: Vec<TemplatePart>,
}

/// Part of a template value
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TemplatePart {
    Static(StaticValue),
    Expr(ExprContainer),
}

/// WXML Directive
#[derive(Eq)]
#[ast_node]
pub enum Directive {
    #[tag("If")]
    If(IfDirective),
    #[tag("Elif")]
    Elif(ElifDirective),
    #[tag("Else")]
    Else(ElseDirective),
    #[tag("For")]
    For(ForDirective),
    #[tag("Key")]
    Key(KeyDirective),
    #[tag("Hidden")]
    Hidden(HiddenDirective),
}

/// if directive
#[derive(Eq)]
#[ast_node("IfDirective")]
pub struct IfDirective {
    pub test: ExprContainer,
    pub span: Span,
}

/// elif directive
#[derive(Eq)]
#[ast_node("ElifDirective")]
pub struct ElifDirective {
    pub test: ExprContainer,
    pub span: Span,
}

/// else directive
#[derive(Eq)]
#[ast_node("ElseDirective")]
pub struct ElseDirective {
    pub span: Span,
}

/// for directive
#[derive(Eq)]
#[ast_node("ForDirective")]
pub struct ForDirective {
    pub source: ExprContainer,
    pub item: Option<Atom>,
    pub index: Option<Atom>,
    pub span: Span,
}

/// key directive
#[derive(Eq)]
#[ast_node("KeyDirective")]
pub struct KeyDirective {
    pub value: KeyValue,
    pub span: Span,
}

/// key value
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KeyValue {
    StarThis,
    Identifier(Atom),
    Expr(ExprContainer),
}

/// hidden directive
#[derive(Eq)]
#[ast_node("HiddenDirective")]
pub struct HiddenDirective {
    pub test: Option<Value>,
    pub span: Span,
}

/// Text node
#[derive(Eq)]
#[ast_node("Text")]
pub struct Text {
    pub span: Span,
    pub value: Value,
}

/// Comment node
#[derive(Eq)]
#[ast_node("Comment")]
pub struct Comment {
    pub span: Span,
    pub text: Atom,
    pub raw: Atom,
}

/// Template data for `<template data="...">`
///
/// Represents template data attribute values like `data="{{foo, bar}}"`.
///
/// ## Semantics
///
/// The attribute value must be exactly one interpolation (with optional outer whitespace):
/// - Valid: `data="{{foo}}"`, `data=" {{foo}} "`, `data="{{...obj}}"`
/// - Invalid: `data="foo"` (no interpolation), `data="x{{foo}}"` (mixed content)
///
/// ## Field definitions
///
/// - `raw`: The trimmed template data body content, without `{{` / `}}` wrapper and without
///   inner leading/trailing whitespace. For example:
///   - `data="{{foo}}"` → raw = `"foo"`
///   - `data="{{ foo }}"` → raw = `"foo"`
///   - `data=" {{ foo, bar }} "` → raw = `"foo, bar"`
///
/// - `span`: Points to the exact location of `raw` in the source. Satisfies the reversibility
///   contract: `source[span.lo..span.hi] == raw` (E12).
///
/// - `object`: The normalized JavaScript object literal AST. The WXML template data grammar
///   is normalized by wrapping as `({ ... })` before parsing with SWC.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateData {
    pub span: Span,
    pub raw: Atom,
    pub object: swc_ecma_ast::ObjectLit,
}

/// Slot assignment
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SlotAssignment {
    pub span: Span,
    pub name: SlotName,
}

/// WXS module
#[derive(Eq)]
#[ast_node("Wxs")]
pub struct Wxs {
    pub span: Span,
    pub module: Option<WxsModuleName>,
    pub src: Option<SourcePath>,
    pub content: Option<WxsContent>,
    pub self_closing: bool,
}

/// WXS module name
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WxsModuleName {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}

/// WXS content
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WxsContent {
    pub span: Span,
    pub raw: Atom,
}

/// Template definition
#[derive(Eq)]
#[ast_node("TemplateDef")]
pub struct TemplateDef {
    pub span: Span,
    pub name: Option<TemplateName>,
    pub body: Vec<Node>,
    pub self_closing: bool,
}

/// Template name
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateName {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}

/// Template reference
#[derive(Eq)]
#[ast_node("TemplateRef")]
pub struct TemplateRef {
    pub span: Span,
    pub target: Option<Value>,
    pub data: Option<TemplateData>,
    pub self_closing: bool,
}

/// Import statement
#[derive(Eq)]
#[ast_node("Import")]
pub struct Import {
    pub span: Span,
    pub src: Option<SourcePath>,
    pub self_closing: bool,
}

/// Include statement
#[derive(Eq)]
#[ast_node("Include")]
pub struct Include {
    pub span: Span,
    pub src: Option<SourcePath>,
    pub directives: Vec<Directive>,
    pub self_closing: bool,
}

/// Source path
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourcePath {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}

/// Slot node
#[derive(Eq)]
#[ast_node("Slot")]
pub struct Slot {
    pub span: Span,
    pub name: Option<SlotName>,
    pub directives: Vec<Directive>,
    pub children: Vec<Node>,
    pub self_closing: bool,
}

/// Slot name
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SlotName {
    pub span: Span,
    pub value: Atom,
    pub raw: Atom,
}

/// Projection row for WXML AST contract validation
///
/// Used by stable projection helpers to prove WXML-owned child boundaries
/// and foreign AST leaf policy.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WxmlProjectionRow {
    pub kind: &'static str,
    pub name: Option<Atom>,
    pub span: Span,
    pub foreign_leaf: Option<&'static str>,
}

/// Project WXML document into stable projection rows
///
/// This is a stable projection helper for contract validation, not a general
/// visitor framework. It walks WXML-owned nodes and records foreign AST leaves
/// without descending into them.
#[doc(hidden)]
pub fn project_document(doc: &Document) -> Vec<WxmlProjectionRow> {
    let mut rows = Vec::new();

    rows.push(WxmlProjectionRow {
        kind: "Document",
        name: None,
        span: doc.span,
        foreign_leaf: None,
    });

    for node in &doc.body {
        project_node(node, &mut rows);
    }

    rows
}

fn project_node(node: &Node, rows: &mut Vec<WxmlProjectionRow>) {
    match node {
        Node::Element(el) => project_element(el, rows),
        Node::Text(text) => project_text(text, rows),
        Node::Comment(comment) => project_comment(comment, rows),
        Node::Wxs(wxs) => project_wxs(wxs, rows),
        Node::TemplateDef(tpl_def) => project_template_def(tpl_def, rows),
        Node::TemplateRef(tpl_ref) => project_template_ref(tpl_ref, rows),
        Node::Import(import) => project_import(import, rows),
        Node::Include(include) => project_include(include, rows),
        Node::Slot(slot) => project_slot(slot, rows),
    }
}

fn project_element(el: &Element, rows: &mut Vec<WxmlProjectionRow>) {
    rows.push(WxmlProjectionRow {
        kind: "Element",
        name: Some(el.name.clone()),
        span: el.span,
        foreign_leaf: None,
    });

    for attr in &el.attrs {
        project_attr(attr, rows);
    }

    for directive in &el.directives {
        project_directive(directive, rows);
    }

    for child in &el.children {
        project_node(child, rows);
    }
}

fn project_attr(attr: &Attr, rows: &mut Vec<WxmlProjectionRow>) {
    rows.push(WxmlProjectionRow {
        kind: "Attr",
        name: Some(attr.name.clone()),
        span: attr.span,
        foreign_leaf: None,
    });

    if let Some(value) = &attr.value {
        project_value(value, rows);
    }
}

fn project_value(value: &Value, rows: &mut Vec<WxmlProjectionRow>) {
    match value {
        Value::Static(s) => {
            rows.push(WxmlProjectionRow {
                kind: "Value::Static",
                name: None,
                span: s.span,
                foreign_leaf: None,
            });
        }
        Value::Expr(expr) => {
            // ExprContainer.expr is foreign_ast_leaf - do not descend into SWC AST
            rows.push(WxmlProjectionRow {
                kind: "Value::Expr",
                name: None,
                span: expr.span,
                foreign_leaf: Some("swc_ecma_ast::Expr"),
            });
        }
        Value::Template(tpl) => {
            rows.push(WxmlProjectionRow {
                kind: "Value::Template",
                name: None,
                span: tpl.span,
                foreign_leaf: None,
            });
            for part in &tpl.parts {
                project_template_part(part, rows);
            }
        }
    }
}

fn project_template_part(part: &TemplatePart, rows: &mut Vec<WxmlProjectionRow>) {
    match part {
        TemplatePart::Static(s) => {
            rows.push(WxmlProjectionRow {
                kind: "TemplatePart::Static",
                name: None,
                span: s.span,
                foreign_leaf: None,
            });
        }
        TemplatePart::Expr(expr) => {
            rows.push(WxmlProjectionRow {
                kind: "TemplatePart::Expr",
                name: None,
                span: expr.span,
                foreign_leaf: Some("swc_ecma_ast::Expr"),
            });
        }
    }
}

fn project_directive(directive: &Directive, rows: &mut Vec<WxmlProjectionRow>) {
    match directive {
        Directive::If(dir) => {
            rows.push(WxmlProjectionRow {
                kind: "Directive::If",
                name: None,
                span: dir.span,
                foreign_leaf: None,
            });
            // dir.test is ExprContainer with foreign_ast_leaf
            rows.push(WxmlProjectionRow {
                kind: "ExprContainer",
                name: None,
                span: dir.test.span,
                foreign_leaf: Some("swc_ecma_ast::Expr"),
            });
        }
        Directive::Elif(dir) => {
            rows.push(WxmlProjectionRow {
                kind: "Directive::Elif",
                name: None,
                span: dir.span,
                foreign_leaf: None,
            });
            rows.push(WxmlProjectionRow {
                kind: "ExprContainer",
                name: None,
                span: dir.test.span,
                foreign_leaf: Some("swc_ecma_ast::Expr"),
            });
        }
        Directive::Else(dir) => {
            rows.push(WxmlProjectionRow {
                kind: "Directive::Else",
                name: None,
                span: dir.span,
                foreign_leaf: None,
            });
        }
        Directive::For(dir) => {
            rows.push(WxmlProjectionRow {
                kind: "Directive::For",
                name: None,
                span: dir.span,
                foreign_leaf: None,
            });
            rows.push(WxmlProjectionRow {
                kind: "ExprContainer",
                name: None,
                span: dir.source.span,
                foreign_leaf: Some("swc_ecma_ast::Expr"),
            });
        }
        Directive::Key(dir) => {
            rows.push(WxmlProjectionRow {
                kind: "Directive::Key",
                name: None,
                span: dir.span,
                foreign_leaf: None,
            });
            if let KeyValue::Expr(expr) = &dir.value {
                rows.push(WxmlProjectionRow {
                    kind: "ExprContainer",
                    name: None,
                    span: expr.span,
                    foreign_leaf: Some("swc_ecma_ast::Expr"),
                });
            }
        }
        Directive::Hidden(dir) => {
            rows.push(WxmlProjectionRow {
                kind: "Directive::Hidden",
                name: None,
                span: dir.span,
                foreign_leaf: None,
            });
            if let Some(value) = &dir.test {
                project_value(value, rows);
            }
        }
    }
}

fn project_text(text: &Text, rows: &mut Vec<WxmlProjectionRow>) {
    rows.push(WxmlProjectionRow {
        kind: "Text",
        name: None,
        span: text.span,
        foreign_leaf: None,
    });
    project_value(&text.value, rows);
}

fn project_comment(comment: &Comment, rows: &mut Vec<WxmlProjectionRow>) {
    rows.push(WxmlProjectionRow {
        kind: "Comment",
        name: None,
        span: comment.span,
        foreign_leaf: None,
    });
}

fn project_wxs(wxs: &Wxs, rows: &mut Vec<WxmlProjectionRow>) {
    rows.push(WxmlProjectionRow {
        kind: "Wxs",
        name: wxs.module.as_ref().map(|m| m.value.clone()),
        span: wxs.span,
        foreign_leaf: None,
    });
}

fn project_template_def(tpl_def: &TemplateDef, rows: &mut Vec<WxmlProjectionRow>) {
    rows.push(WxmlProjectionRow {
        kind: "TemplateDef",
        name: tpl_def.name.as_ref().map(|n| n.value.clone()),
        span: tpl_def.span,
        foreign_leaf: None,
    });

    for child in &tpl_def.body {
        project_node(child, rows);
    }
}

fn project_template_ref(tpl_ref: &TemplateRef, rows: &mut Vec<WxmlProjectionRow>) {
    rows.push(WxmlProjectionRow {
        kind: "TemplateRef",
        name: None,
        span: tpl_ref.span,
        foreign_leaf: None,
    });

    if let Some(target) = &tpl_ref.target {
        project_value(target, rows);
    }

    if let Some(data) = &tpl_ref.data {
        // TemplateData.object is foreign_ast_leaf - do not descend into SWC ObjectLit
        rows.push(WxmlProjectionRow {
            kind: "TemplateData",
            name: None,
            span: data.span,
            foreign_leaf: Some("swc_ecma_ast::ObjectLit"),
        });
    }
}

fn project_import(import: &Import, rows: &mut Vec<WxmlProjectionRow>) {
    rows.push(WxmlProjectionRow {
        kind: "Import",
        name: import.src.as_ref().map(|s| s.value.clone()),
        span: import.span,
        foreign_leaf: None,
    });
}

fn project_include(include: &Include, rows: &mut Vec<WxmlProjectionRow>) {
    rows.push(WxmlProjectionRow {
        kind: "Include",
        name: include.src.as_ref().map(|s| s.value.clone()),
        span: include.span,
        foreign_leaf: None,
    });
}

fn project_slot(slot: &Slot, rows: &mut Vec<WxmlProjectionRow>) {
    rows.push(WxmlProjectionRow {
        kind: "Slot",
        name: slot.name.as_ref().map(|n| n.value.clone()),
        span: slot.span,
        foreign_leaf: None,
    });

    for directive in &slot.directives {
        project_directive(directive, rows);
    }

    for child in &slot.children {
        project_node(child, rows);
    }
}
