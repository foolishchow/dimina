//! dimina-wxml-parser-napi — SpanView bridge (fe-tools-wxml-bridge · W1)
//!
//! napi-rs 绑定，把 `dimina_wxml_parser::parse_wxml` 的 Document 序列化为
//! **紧凑 JSON SpanView**（span/raw/结构；**不含** swc 表达式负载 `.expr` /
//! `.object`）。实现采用**手写 serializer**（F20 兜底路线，不修改 vendored
//! crate 的 AST 类型、不需要 serde derives——D-WB-7 二选一落定为手写）。
//!
//! 契约（docs/wxml PARSING-SPEC §0.4 同构）：
//! - span = { start, end } 半开 byte 偏移（swc Span lo/hi；文件内局部）；
//! - Element 无 raw 字段 → raw 由 source[lo..hi] 字节切片派生；
//! - ExprContainer / TemplateData 仅保留 span + raw（丢弃 expr / object 负载）；
//! - sourceFile 由调用方传入并透传（R-WB5）。

use std::path::PathBuf;

use dimina_wxml_parser as wxml;
use napi::{Error, Result, Status};
use napi_derive::napi;
use serde_json::{json, Map, Value};
use swc_common::{BytePos, Span};

#[napi]
pub fn parse_wxml_span_view(source: String, source_file: Option<String>) -> Result<String> {
	let result = wxml::parse_wxml(source_file.as_ref().map(PathBuf::from), &source);
	match result {
		Ok(document) => {
			let view = document_to_view(&document, &source, source_file.as_deref());
			Ok(view.to_string())
		}
		Err(errors) => {
			let errs: Vec<Value> = errors.iter().map(parse_error_to_view).collect();
			Err(Error::new(
				Status::GenericFailure,
				json!({ "errors": errs }).to_string(),
			))
		}
	}
}

// ---------------------------------------------------------------------------
// view 构造
// ---------------------------------------------------------------------------

fn pos(p: BytePos) -> u32 {
	p.0
}

fn span(span: Span) -> Value {
	json!({ "start": pos(span.lo), "end": pos(span.hi) })
}

/// source 切片派生 raw（span 为 byte 半开；落在字符边界）
fn raw<'a>(source: &'a str, span: Span) -> String {
	let lo = span.lo.0 as usize;
	let hi = span.hi.0 as usize;
	source.get(lo..hi).unwrap_or("").to_string()
}

fn atom(value: &swc_atoms::Atom) -> String {
	value.to_string()
}

fn document_to_view(doc: &wxml::Document, source: &str, source_file: Option<&str>) -> Value {
	let mut obj = Map::new();
	obj.insert("span".into(), span(doc.span));
	obj.insert(
		"body".into(),
		Value::Array(doc.body.iter().map(|n| node_to_view(n, source)).collect()),
	);
	if let Some(sf) = source_file {
		obj.insert("sourceFile".into(), Value::String(sf.to_string()));
	}
	Value::Object(obj)
}

fn node_to_view(node: &wxml::Node, source: &str) -> Value {
	match node {
		wxml::Node::Element(e) => element_to_view(e, source),
		wxml::Node::Text(t) => json!({
			"type": "text",
			"value": value_to_view(&t.value, source),
			"span": span(t.span),
			"raw": raw(source, t.span),
		}),
		wxml::Node::Comment(c) => json!({
			"type": "comment",
			"text": atom(&c.text),
			"raw": raw(source, c.span),
			"span": span(c.span),
		}),
		wxml::Node::Wxs(w) => json!({
			"type": "wxs",
			"module": w.module.as_ref().map(|m| json!({ "value": atom(&m.value), "raw": atom(&m.raw), "span": span(m.span) })),
			"src": w.src.as_ref().map(|s| source_path_to_view(s)),
			"content": w.content.as_ref().map(|c| json!({ "raw": atom(&c.raw), "span": span(c.span) })),
			"selfClosing": w.self_closing,
			"span": span(w.span),
			"raw": raw(source, w.span),
		}),
		wxml::Node::TemplateDef(t) => json!({
			"type": "templateDef",
			"name": t.name.as_ref().map(|n| json!({ "value": atom(&n.value), "raw": atom(&n.raw), "span": span(n.span) })),
			"body": Value::Array(t.body.iter().map(|n| node_to_view(n, source)).collect()),
			"selfClosing": t.self_closing,
			"span": span(t.span),
			"raw": raw(source, t.span),
		}),
		wxml::Node::TemplateRef(t) => json!({
			"type": "templateRef",
			"target": t.target.as_ref().map(|v| value_to_view(v, source)),
			"data": t.data.as_ref().map(|d| json!({ "raw": atom(&d.raw), "span": span(d.span) })),
			"selfClosing": t.self_closing,
			"span": span(t.span),
			"raw": raw(source, t.span),
		}),
		wxml::Node::Import(i) => json!({
			"type": "import",
			"src": i.src.as_ref().map(source_path_to_view),
			"selfClosing": i.self_closing,
			"span": span(i.span),
			"raw": raw(source, i.span),
		}),
		wxml::Node::Include(i) => json!({
			"type": "include",
			"src": i.src.as_ref().map(source_path_to_view),
			"selfClosing": i.self_closing,
			"span": span(i.span),
			"raw": raw(source, i.span),
		}),
		wxml::Node::Slot(s) => json!({
			"type": "slot",
			"name": s.name.as_ref().map(|n| json!({ "value": atom(&n.value), "raw": atom(&n.raw), "span": span(n.span) })),
			"directives": Value::Array(s.directives.iter().map(directive_to_view).collect()),
			"children": Value::Array(s.children.iter().map(|n| node_to_view(n, source)).collect()),
			"selfClosing": s.self_closing,
			"span": span(s.span),
			"raw": raw(source, s.span),
		}),
	}
}

fn source_path_to_view(p: &wxml::SourcePath) -> Value {
	json!({ "value": atom(&p.value), "raw": atom(&p.raw), "span": span(p.span) })
}

fn element_to_view(e: &wxml::Element, source: &str) -> Value {
	json!({
		"type": "element",
		"name": atom(&e.name),
		"attrs": Value::Array(e.attrs.iter().map(|a| {
			json!({
				"name": atom(&a.name),
				"value": a.value.as_ref().map(|v| value_to_view(v, source)),
				"span": span(a.span),
				"raw": raw(source, a.span),
			})
		}).collect()),
		"directives": Value::Array(e.directives.iter().map(directive_to_view).collect()),
		"slot": e.slot.as_ref().map(|s| json!({ "name": atom(&s.name.value), "span": span(s.span) })),
		"children": Value::Array(e.children.iter().map(|n| node_to_view(n, source)).collect()),
		"selfClosing": e.self_closing,
		"span": span(e.span),
		"raw": raw(source, e.span),
	})
}

fn value_to_view(v: &wxml::Value, source: &str) -> Value {
	match v {
		wxml::Value::Static(s) => json!({
			"kind": "static",
			"value": atom(&s.value),
			"raw": atom(&s.raw),
			"span": span(s.span),
		}),
		wxml::Value::Expr(e) => json!({
			"kind": "expr",
			"raw": atom(&e.raw),
			// vendored crate: ExprContainer.span 是表达式体相对偏移（expression.rs 减 base_offset）
			// —— 与 §0.4「源码绝对」不符；无容器上下文无法精确重映射，标 relative 留档（W3+ 列级再处理）
			"relative": true,
			"span": span(e.span),
		}),
		wxml::Value::Template(t) => {
			let raw_str = atom(&t.raw);
			// 经 raw 字节遍历重映射 parts 到源码绝对偏移（template 整值 span 已知）
			let parts = remap_template_parts(&t.parts, &raw_str, source, t.span);
			json!({
				"kind": "template",
				"raw": raw_str,
				"span": span(t.span),
				"parts": parts,
			})
		},
	}
}

fn directive_to_view(d: &wxml::Directive) -> Value {
	match d {
		wxml::Directive::If(i) => json!({
			"kind": "if",
			"test": { "raw": atom(&i.test.raw), "span": span(i.test.span) },
			"span": span(i.span),
		}),
		wxml::Directive::Elif(e) => json!({
			"kind": "elif",
			"test": { "raw": atom(&e.test.raw), "span": span(e.test.span) },
			"span": span(e.span),
		}),
		wxml::Directive::Else(e) => json!({
			"kind": "else",
			"test": null,
			"span": span(e.span),
		}),
		wxml::Directive::For(f) => json!({
			"kind": "for",
			"test": { "raw": atom(&f.source.raw), "span": span(f.source.span) },
			"item": f.item.as_ref().map(|a| atom(a)),
			"index": f.index.as_ref().map(|a| atom(a)),
			"span": span(f.span),
		}),
		wxml::Directive::Key(k) => json!({
			"kind": "key",
			"test": null,
			"value": key_value_to_view(&k.value),
			"span": span(k.span),
		}),
		wxml::Directive::Hidden(h) => json!({
			"kind": "hidden",
			"test": h.test.as_ref().map(|v| match v {
				wxml::Value::Static(s) => json!({ "kind": "static", "raw": atom(&s.raw), "span": span(s.span) }),
				wxml::Value::Expr(e) => json!({ "kind": "expr", "raw": atom(&e.raw), "span": span(e.span), "relative": true }),
				wxml::Value::Template(t) => json!({ "kind": "template", "raw": atom(&t.raw), "span": span(t.span) }),
			}),
			"span": span(h.span),
		}),
	}
}

fn key_value_to_view(v: &wxml::KeyValue) -> Value {
	match v {
		wxml::KeyValue::StarThis => json!({ "kind": "starThis", "raw": "*this" }),
		wxml::KeyValue::Identifier(a) => json!({ "kind": "identifier", "raw": atom(a) }),
		wxml::KeyValue::Expr(e) => json!({ "kind": "expr", "raw": atom(&e.raw), "span": span(e.span), "relative": true }),
	}
}

fn parse_error_to_view(e: &wxml::ParseError) -> Value {
	json!({
		"span": span(e.span),
		"sourceFile": e.source_file.as_ref().map(|p| p.to_string_lossy().to_string()),
		"kind": format!("{:?}", e.kind),
		"message": e.message,
	})
}
/// 模板值 parts → 源码绝对 span 重映射（§0.4 对齐；字节遍历 raw）
/// parts 与 raw 交替 static/expr；expr 部分在 raw 内为 `{{...}}`。
fn remap_template_parts(
	parts: &[wxml::TemplatePart],
	raw: &str,
	_source: &str,
	base: Span,
) -> Value {
	let bytes = raw.as_bytes();
	let mut pos: usize = 0;
	let mut out: Vec<Value> = Vec::with_capacity(parts.len());
	for part in parts {
		match part {
			wxml::TemplatePart::Static(s) => {
				let len = s.raw.len(); // raw 字节长（静态段原文）
				let abs_start = base.lo.0 + pos as u32;
				let abs_end = abs_start + len as u32;
				out.push(json!({
					"kind": "static",
					"value": atom(&s.value),
					"raw": atom(&s.raw),
					"span": { "start": abs_start, "end": abs_end },
				}));
				pos += len;
			}
			wxml::TemplatePart::Expr(e) => {
				// 定位 `{{`（当前 pos 起）
				let open_at = bytes[pos..].windows(2).position(|w| w == b"{{")
					.map(|i| pos + i).unwrap_or(pos);
				let body_start = open_at + 2; // 跳过 `{{`
				let body_len = (e.span.hi.0 - e.span.lo.0) as usize;
				let abs_start = base.lo.0 + body_start as u32;
				let abs_end = abs_start + body_len as u32;
				out.push(json!({
					"kind": "expr",
					"raw": atom(&e.raw),
					"span": { "start": abs_start, "end": abs_end },
				}));
				// 前进到 `}}` 之后
				let close_at = bytes[open_at..].windows(2).position(|w| w == b"}}")
					.map(|i| open_at + i + 2).unwrap_or(pos + 2);
				pos = close_at;
			}
		}
	}
	Value::Array(out)
}
