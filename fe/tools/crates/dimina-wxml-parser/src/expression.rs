//! WXML expression parsing

use crate::{ExprContainer, WxmlExpressionError, WxmlExpressionErrorKind};
use std::path::PathBuf;
use swc_atoms::Atom;
use swc_common::{sync::Lrc, FileName, SourceMap, Span, Spanned};
use swc_ecma_parser::{lexer::Lexer, Parser, StringInput, Syntax};

/// Expression category decision for WXML expression contract validation
#[derive(Debug, Clone, PartialEq)]
enum ExprDecision {
    /// Expression category is explicitly accepted and supported
    Accepted,
    /// Expression category is explicitly rejected with reason and span
    Rejected(&'static str, Span),
    /// Expression category decision is deferred (compatibility-open)
    /// Currently treated as error but not claimed as unsupported
    Deferred(&'static str, Span),
}

pub(crate) fn parse_expression_internal(
    source_file: Option<PathBuf>,
    source: &str,
) -> Result<ExprContainer, WxmlExpressionError> {
    let cm = SourceMap::default();
    let source_file_for_errors = source_file.clone();
    let fm = cm.new_source_file(
        Lrc::new(source_file.map(FileName::Real).unwrap_or(FileName::Anon)),
        source.to_string(),
    );

    // Get the base offset for this source file
    let base_offset = fm.start_pos;

    let lexer = Lexer::new(
        Syntax::Es(Default::default()),
        Default::default(),
        StringInput::from(&*fm),
        None,
    );

    let mut parser = Parser::new_from(lexer);

    // Check for empty expression first
    if source.trim().is_empty() {
        return Err(WxmlExpressionError {
            span: Span::default(),
            source_file: source_file_for_errors.clone(),
            kind: WxmlExpressionErrorKind::Empty,
            message: "expression cannot be empty".to_string(),
        });
    }

    match parser.parse_expr() {
        Ok(expr) => {
            // Validate expression category against WXML contract
            match validate_expression_category(&*expr) {
                ExprDecision::Accepted => {
                    // Expression is explicitly supported
                }
                ExprDecision::Rejected(reason, swc_span) => {
                    let relative_span =
                        Span::new(swc_span.lo - base_offset, swc_span.hi - base_offset);
                    return Err(WxmlExpressionError {
                        span: relative_span,
                        source_file: source_file_for_errors.clone(),
                        kind: WxmlExpressionErrorKind::RejectedCategory,
                        message: format!("{} is not allowed in WXML binding", reason),
                    });
                }
                ExprDecision::Deferred(category, swc_span) => {
                    // Compatibility-open: not yet validated or tested
                    // Returned as DeferredCategory error, not RejectedCategory
                    let relative_span =
                        Span::new(swc_span.lo - base_offset, swc_span.hi - base_offset);
                    return Err(WxmlExpressionError {
                        span: relative_span,
                        source_file: source_file_for_errors.clone(),
                        kind: WxmlExpressionErrorKind::DeferredCategory,
                        message: format!(
                            "{} is not yet supported in WXML binding (compatibility-open)",
                            category
                        ),
                    });
                }
            }

            // Convert span for the container
            let swc_span = expr.span();
            let relative_span = Span::new(swc_span.lo - base_offset, swc_span.hi - base_offset);
            Ok(ExprContainer {
                span: relative_span,
                raw: Atom::from(source),
                expr,
            })
        }
        Err(e) => {
            // SWC 把 `class`/`enum` 等保留字当关键字，无法作 Ident；WXML 数据字段允许这些名字。
            // SpanView / 编译管线目前只消费 raw，合成 Ident 保解析畅通。
            if let Some(ident) = reserved_word_ident(source) {
                let trimmed = source.trim();
                let lead = source.len() - source.trim_start().len();
                let relative_span = Span::new(
                    swc_common::BytePos(lead as u32),
                    swc_common::BytePos((lead + trimmed.len()) as u32),
                );
                return Ok(ExprContainer {
                    span: relative_span,
                    raw: Atom::from(source),
                    expr: Box::new(ident),
                });
            }
            Err(WxmlExpressionError {
                span: Span::default(),
                source_file: source_file_for_errors.clone(),
                kind: WxmlExpressionErrorKind::Syntax,
                message: format!("{:?}", e),
            })
        }
    }
}

fn reserved_word_ident(source: &str) -> Option<swc_ecma_ast::Expr> {
	let trimmed = source.trim();
	if trimmed.is_empty() {
		return None;
	}
	// 单标识符形态（含保留字）
	let mut chars = trimmed.chars();
	let first = chars.next()?;
	if !(first.is_ascii_alphabetic() || first == '_' || first == '$') {
		return None;
	}
	if !chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$') {
		return None;
	}
	use swc_ecma_ast::{Expr, Ident};
	Some(Expr::Ident(Ident {
		span: Span::default(),
		ctxt: Default::default(),
		sym: Atom::from(trimmed),
		optional: false,
	}))
}

/// Validate call arguments (used by both normal Call and OptChainBase::Call)
///
/// Spread in call arguments is accepted (2026-06-27).
/// This helper ensures both normal calls and optional calls validate args consistently.
fn validate_call_args(args: &[swc_ecma_ast::ExprOrSpread]) -> ExprDecision {
    for arg in args {
        let arg_decision = validate_expression_category(&arg.expr);
        if !matches!(arg_decision, ExprDecision::Accepted) {
            return arg_decision;
        }
    }
    ExprDecision::Accepted
}

/// Validate expression category against WXML contract
///
/// Returns ExprDecision indicating whether the expression is:
/// - Accepted: explicitly supported
/// - Rejected: explicitly not allowed (with span of the problematic expression)
/// - Deferred: compatibility-open (not yet decided, with span)
fn validate_expression_category(expr: &swc_ecma_ast::Expr) -> ExprDecision {
    use swc_ecma_ast::Expr;

    match expr {
        // Rejected categories - explicitly not allowed in WXML bindings
        Expr::Assign(node) => ExprDecision::Rejected("assignment expression", node.span()),
        Expr::Update(node) => ExprDecision::Rejected("update expression", node.span()),
        Expr::Seq(node) => ExprDecision::Rejected("comma expression", node.span()),
        Expr::New(node) => ExprDecision::Rejected("new expression", node.span()),
        Expr::Fn(node) => ExprDecision::Rejected("function expression", node.span()),
        Expr::Class(node) => ExprDecision::Rejected("class expression", node.span()),
        Expr::Await(node) => ExprDecision::Rejected("await expression", node.span()),
        Expr::Yield(node) => ExprDecision::Rejected("yield expression", node.span()),
        Expr::SuperProp(node) => ExprDecision::Rejected("super expression", node.span()),
        Expr::TaggedTpl(node) => ExprDecision::Rejected("tagged template expression", node.span()),

        // New rejected categories from compatibility decisions (2026-06-27)
        Expr::Arrow(node) => ExprDecision::Rejected(
            "arrow function (templates should not define logic)",
            node.span(),
        ),
        Expr::This(node) => {
            ExprDecision::Rejected("this expression (use direct data references)", node.span())
        }

        // Accepted categories from compatibility decisions (2026-06-27)
        Expr::OptChain(opt_chain) => {
            // Optional chaining: user?.name, obj?.[key], fn?.()
            // Validate the base expression recursively
            use swc_ecma_ast::OptChainBase;
            match &*opt_chain.base {
                OptChainBase::Member(member) => {
                    let obj_decision = validate_expression_category(&member.obj);
                    if !matches!(obj_decision, ExprDecision::Accepted) {
                        return obj_decision;
                    }
                    // Also validate computed property if present
                    if let swc_ecma_ast::MemberProp::Computed(computed) = &member.prop {
                        return validate_expression_category(&computed.expr);
                    }
                    ExprDecision::Accepted
                }
                OptChainBase::Call(call) => {
                    // Optional call: fn?.()
                    // Validate callee
                    let callee_decision = validate_expression_category(&call.callee);
                    if !matches!(callee_decision, ExprDecision::Accepted) {
                        return callee_decision;
                    }
                    // Validate all arguments using shared validator
                    validate_call_args(&call.args)
                }
            }
        }
        Expr::Tpl(tpl) => {
            // Template literal: `Hello ${name}`
            // Validate all expressions within the template
            for expr in &tpl.exprs {
                let expr_decision = validate_expression_category(expr);
                if !matches!(expr_decision, ExprDecision::Accepted) {
                    return expr_decision;
                }
            }
            ExprDecision::Accepted
        }

        // Literal subcategories - RegExp is rejected
        Expr::Lit(lit) => {
            use swc_ecma_ast::Lit;
            match lit {
                Lit::Regex(node) => {
                    ExprDecision::Rejected("regexp literal (use JS logic layer)", node.span)
                }
                _ => ExprDecision::Accepted,
            }
        }

        // Unary operators - typeof is accepted, void/delete are rejected
        Expr::Unary(unary) => {
            use swc_ecma_ast::UnaryOp;
            match unary.op {
                UnaryOp::TypeOf => {
                    // typeof is accepted for type introspection
                    validate_expression_category(&unary.arg)
                }
                UnaryOp::Void => {
                    ExprDecision::Rejected("void operator (no template use case)", unary.span)
                }
                UnaryOp::Delete => ExprDecision::Rejected(
                    "delete operator (templates must be side-effect-free)",
                    unary.span,
                ),
                _ => validate_expression_category(&unary.arg),
            }
        }

        // Binary operators - ?? (nullish coalescing) is accepted
        Expr::Bin(bin) => {
            // Nullish coalescing is now accepted
            let left_decision = validate_expression_category(&bin.left);
            if !matches!(left_decision, ExprDecision::Accepted) {
                return left_decision;
            }
            validate_expression_category(&bin.right)
        }

        // Recursively validate nested expressions
        Expr::Member(member) => {
            let obj_decision = validate_expression_category(&member.obj);
            if !matches!(obj_decision, ExprDecision::Accepted) {
                return obj_decision;
            }
            // Also validate computed property: obj[expr]
            if let swc_ecma_ast::MemberProp::Computed(computed) = &member.prop {
                let prop_decision = validate_expression_category(&computed.expr);
                if !matches!(prop_decision, ExprDecision::Accepted) {
                    return prop_decision;
                }
            }
            ExprDecision::Accepted
        }
        Expr::Cond(cond) => {
            let test_decision = validate_expression_category(&cond.test);
            if !matches!(test_decision, ExprDecision::Accepted) {
                return test_decision;
            }
            let cons_decision = validate_expression_category(&cond.cons);
            if !matches!(cons_decision, ExprDecision::Accepted) {
                return cons_decision;
            }
            validate_expression_category(&cond.alt)
        }
        Expr::Call(call) => {
            // Validate callee
            match &call.callee {
                swc_ecma_ast::Callee::Expr(callee_expr) => {
                    let callee_decision = validate_expression_category(callee_expr);
                    if !matches!(callee_decision, ExprDecision::Accepted) {
                        return callee_decision;
                    }
                }
                swc_ecma_ast::Callee::Import(node) => {
                    // Dynamic import is explicitly rejected
                    return ExprDecision::Rejected("dynamic import", node.span);
                }
                swc_ecma_ast::Callee::Super(node) => {
                    // Super call is explicitly rejected
                    return ExprDecision::Rejected("super call", node.span);
                }
            }
            // Validate all arguments using shared validator
            validate_call_args(&call.args)
        }
        Expr::Array(array) => {
            for elem in &array.elems {
                match elem {
                    Some(elem) => {
                        // Spread in array is now accepted (2026-06-27)
                        let elem_decision = validate_expression_category(&elem.expr);
                        if !matches!(elem_decision, ExprDecision::Accepted) {
                            return elem_decision;
                        }
                    }
                    None => {
                        // Array holes are rejected (2026-06-27)
                        return ExprDecision::Rejected(
                            "array holes (use explicit undefined)",
                            array.span,
                        );
                    }
                }
            }
            ExprDecision::Accepted
        }
        Expr::Object(obj) => {
            for prop in &obj.props {
                match prop {
                    swc_ecma_ast::PropOrSpread::Prop(prop) => {
                        use swc_ecma_ast::Prop;
                        match &**prop {
                            Prop::KeyValue(kv) => {
                                // Computed property keys are now accepted (2026-06-27)
                                // Validate the key expression if it's computed
                                use swc_ecma_ast::PropName;
                                if let PropName::Computed(computed) = &kv.key {
                                    let key_decision = validate_expression_category(&computed.expr);
                                    if !matches!(key_decision, ExprDecision::Accepted) {
                                        return key_decision;
                                    }
                                }
                                // Validate the value expression
                                let val_decision = validate_expression_category(&kv.value);
                                if !matches!(val_decision, ExprDecision::Accepted) {
                                    return val_decision;
                                }
                            }
                            Prop::Shorthand(_) => {
                                // Object shorthand is now accepted (2026-06-27)
                                // {name, age} is shorthand for {name: name, age: age}
                            }
                            Prop::Getter(_) | Prop::Setter(_) | Prop::Method(_) => {
                                return ExprDecision::Rejected("method property", prop.span());
                            }
                            _ => {}
                        }
                    }
                    swc_ecma_ast::PropOrSpread::Spread(spread) => {
                        // Object spread is now accepted (2026-06-27)
                        // Validate the spread argument expression
                        let spread_decision = validate_expression_category(&spread.expr);
                        if !matches!(spread_decision, ExprDecision::Accepted) {
                            return spread_decision;
                        }
                    }
                }
            }
            ExprDecision::Accepted
        }
        Expr::Paren(paren) => validate_expression_category(&paren.expr),

        // Accepted categories - explicitly supported basic literals and identifiers
        Expr::Ident(_) => ExprDecision::Accepted,

        // Remaining expression types - treat as deferred for safety
        // This ensures unknown/new ES features don't silently pass through
        _ => ExprDecision::Deferred("uncategorized expression type", expr.span()),
    }
}
