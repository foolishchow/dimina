//! WXML parsing implementation
//! Hand-written recursive descent parser

use crate::{
    Attr, Comment, Directive, Document, Element, ElifDirective, ElseDirective, ForDirective,
    HiddenDirective, IfDirective, Import, Include, KeyDirective, KeyValue, Node, ParseError,
    ParseErrorKind, ParseResult, Slot, SlotAssignment, SlotName, SourcePath, StaticValue,
    TemplateDef, TemplateName, TemplatePart, TemplateRef, TemplateValue, Text, Value, Wxs,
    WxsContent, WxsModuleName,
};
use std::path::PathBuf;
use swc_atoms::Atom;
use swc_common::{BytePos, Span};

pub(crate) fn parse_wxml_internal(source_file: Option<PathBuf>, source: &str) -> ParseResult {
    let mut parser = Parser::new(source_file, source);
    parser.parse_document()
}

struct Parser {
    source_file: Option<PathBuf>,
    source: String,
    index: usize,
    in_element_body: bool, // Track whether we're inside element/template/slot body
}

impl Parser {
    fn new(source_file: Option<PathBuf>, source: &str) -> Self {
        Self {
            source_file,
            source: source.to_string(),
            index: 0,
            in_element_body: false,
        }
    }

    fn parse_document(&mut self) -> ParseResult {
        let start = self.index;
        let mut children = Vec::new();
        let mut errors = Vec::new();

        while self.index < self.source.len() {
            let start_index = self.index;
            match self.parse_node() {
                Ok(Some(node)) => {
                    children.push(node);
                }
                Ok(None) => {
                    // If parse_node returned None without advancing, we must advance
                    // to avoid infinite loop. This can happen when hitting a closing tag
                    // at document level (no parent element to handle it).
                    if self.index == start_index {
                        // Advance by one UTF-8 character to avoid splitting multi-byte chars
                        if let Some(ch) = self.current_char() {
                            self.index += ch.len_utf8();
                        } else {
                            self.index += 1;
                        }
                    }
                }
                Err(e) => {
                    errors.push(e);
                    // Advance index to avoid infinite loop on parse errors
                    // If parse_node didn't advance, skip at least one UTF-8 character
                    if self.index == start_index {
                        if let Some(ch) = self.current_char() {
                            self.index += ch.len_utf8();
                        } else {
                            self.index += 1;
                        }
                    }
                }
            }
        }

        if !errors.is_empty() {
            return Err(errors);
        }

        Ok(Document {
            span: self.make_span(start, self.source.len()),
            body: children,
            source_file: self.source_file.clone(),
        })
    }

    fn parse_node(&mut self) -> Result<Option<Node>, ParseError> {
        // Look for next '<'
        if let Some(open_offset) = self.source[self.index..].find('<') {
            let open = self.index + open_offset;

            // Handle text before '<'
            if open > self.index {
                let text = self.parse_text(self.index, open)?;
                self.index = open;
                if let Some(node) = text {
                    return Ok(Some(node));
                }
            }

            // Now at '<', parse tag or comment
            if self.source[open..].starts_with("<!--") {
                return self.parse_comment().map(Some);
            } else if self.source[open..].starts_with("</") {
                // Closing tag - signal to parent that we hit a closing tag
                // At document level, this is a stray closing tag - skip it
                if !self.in_element_body {
                    // Find end of closing tag and skip it
                    if let Some(close_offset) = self.source[open..].find('>') {
                        self.index = open + close_offset + 1;
                    } else {
                        self.index = open + 2; // At least skip </
                    }
                }
                return Ok(None);
            } else if self.source[open..].starts_with("<!") || self.source[open..].starts_with("<?")
            {
                // Skip declarations
                self.skip_to_close()?;
                return Ok(None);
            } else {
                // Parse element or special node
                return self.parse_element_or_special();
            }
        }

        // No more '<', handle remaining text
        if self.index < self.source.len() {
            let text = self.parse_text(self.index, self.source.len())?;
            self.index = self.source.len();
            return Ok(text);
        }

        Ok(None)
    }

    fn parse_element(&mut self) -> Result<Element, ParseError> {
        let start = self.index;
        assert_eq!(self.current_char(), Some('<'));
        self.index += 1;

        // Parse tag name
        let tag_name_start = self.index;
        while self.index < self.source.len() {
            let ch = self.current_char().unwrap();
            if ch.is_whitespace() || ch == '>' || ch == '/' {
                break;
            }
            self.index += ch.len_utf8();
        }
        let tag_name = self.source[tag_name_start..self.index].to_string();
        if tag_name.is_empty() {
            return Err(self.error(ParseErrorKind::Other("Empty tag name".to_string())));
        }

        // Parse attributes and directives
        let mut attributes = Vec::new();
        let mut directives = Vec::new();
        let mut slot_assignment = None;
        let mut for_item = None;
        let mut for_index = None;

        loop {
            self.skip_whitespace();
            if self.index >= self.source.len() {
                return Err(self.error(ParseErrorKind::UnclosedTag { tag: tag_name }));
            }

            if self.current_char() == Some('>') {
                break;
            }
            if self.current_char() == Some('/') {
                // Self-closing
                break;
            }

            let attr = self.parse_attribute()?;
            match attr.name.as_ref() {
                "wx:for-item" => {
                    if let Some(Value::Static(v)) = attr.value {
                        for_item = Some(v.value);
                    }
                }
                "wx:for-index" => {
                    if let Some(Value::Static(v)) = attr.value {
                        for_index = Some(v.value);
                    }
                }
                name if name.starts_with("wx:") => {
                    let directive = self.parse_directive(&attr)?;
                    directives.push(directive);
                }
                "slot" => {
                    if let Some(Value::Static(v)) = attr.value {
                        slot_assignment = Some(SlotAssignment {
                            span: attr.span,
                            name: SlotName {
                                span: v.span,
                                value: v.value,
                                raw: v.raw,
                            },
                        });
                    }
                }
                "hidden" => {
                    directives.push(Directive::Hidden(HiddenDirective {
                        test: attr.value,
                        span: attr.span,
                    }));
                }
                _ => {
                    attributes.push(attr);
                }
            }
        }

        // Update ForDirective with item/index if present
        for directive in &mut directives {
            if let Directive::For(ref mut for_dir) = directive {
                if for_item.is_some() {
                    for_dir.item = for_item.clone();
                }
                if for_index.is_some() {
                    for_dir.index = for_index.clone();
                }
            }
        }

        // Check for self-closing
        let self_closing = self.current_char() == Some('/');
        if self_closing {
            self.index += 1;
        }

        // Consume '>'
        if self.current_char() != Some('>') {
            return Err(self.error(ParseErrorKind::UnclosedTag { tag: tag_name }));
        }
        self.index += 1;

        // Parse children if not self-closing
        let mut children = Vec::new();
        if !self_closing {
            // Special handling for <wxs> and <script> - capture raw content
            if tag_name == "wxs" || tag_name == "script" {
                let closing_tag = format!("</{}>", tag_name);
                if let Some(close_offset) = self.source[self.index..].find(&closing_tag) {
                    self.index += close_offset + closing_tag.len();
                } else {
                    return Err(self.error(ParseErrorKind::UnclosedTag {
                        tag: tag_name.clone(),
                    }));
                }
            } else {
                // Parse children - set flag to preserve whitespace in element body
                let prev_in_element_body = self.in_element_body;
                self.in_element_body = true;
                let mut child_errors = Vec::new();

                loop {
                    // Check for closing tag
                    if self.source[self.index..].starts_with(&format!("</{}", tag_name)) {
                        break;
                    }

                    if self.index >= self.source.len() {
                        self.in_element_body = prev_in_element_body;
                        return Err(self.error(ParseErrorKind::UnclosedTag { tag: tag_name }));
                    }

                    match self.parse_node() {
                        Ok(Some(node)) => children.push(node),
                        Ok(None) => break, // Hit closing tag
                        Err(e) => {
                            // Child node parsing failed. Current error recovery strategy:
                            // - Collect the error
                            // - Skip to next '<' to attempt parsing next sibling
                            // - Return after consuming closing tag to prevent duplicate errors
                            //
                            // Note: This is a fail-fast approach for child errors within
                            // a single element. Only the first child error is collected.
                            // Full multi-error collection would require architectural changes
                            // (e.g., Element carrying partial results + errors).
                            child_errors.push(e);

                            // Error recovery: try to skip to a reasonable recovery point.
                            // Look for the next tag start '<' or the closing tag.
                            let _start_index = self.index;
                            let closing_tag = format!("</{}", tag_name);

                            // Check if we're already at the closing tag
                            if self.source[self.index..].starts_with(&closing_tag) {
                                break;
                            }

                            // Try to find next '<' as a recovery point
                            if let Some(next_open) = self.source[self.index..].find('<') {
                                self.index += next_open;
                                // Check if this is the closing tag
                                if self.source[self.index..].starts_with(&closing_tag) {
                                    break;
                                }
                                // Continue loop to parse next sibling
                            } else {
                                // No more '<' found, we must be at end of file
                                // without proper closing tag
                                break;
                            }
                        }
                    }
                }

                self.in_element_body = prev_in_element_body;

                // If there were child parsing errors, return the first one after consuming closing tag
                if !child_errors.is_empty() {
                    // Try to consume the closing tag to maintain parser state
                    if self.source[self.index..].starts_with("</") {
                        self.index += 2;
                        self.skip_whitespace();

                        let _close_tag_start = self.index;
                        while self.index < self.source.len() {
                            if let Some(ch) = self.current_char() {
                                if ch == '>' {
                                    break;
                                }
                                self.index += ch.len_utf8();
                            } else {
                                break;
                            }
                        }

                        if self.current_char() == Some('>') {
                            self.index += 1;
                        }
                    }
                    // If no closing tag found, still return the child error
                    return Err(child_errors.into_iter().next().unwrap());
                }

                // Consume closing tag
                if !self.source[self.index..].starts_with("</") {
                    return Err(self.error(ParseErrorKind::UnclosedTag {
                        tag: tag_name.to_string(),
                    }));
                }
                self.index += 2;
                self.skip_whitespace();

                let close_tag_start = self.index;
                while self.index < self.source.len() {
                    if let Some(ch) = self.current_char() {
                        if ch == '>' {
                            break;
                        }
                        self.index += ch.len_utf8();
                    } else {
                        break;
                    }
                }
                let close_tag = &self.source[close_tag_start..self.index];
                if close_tag != tag_name {
                    return Err(self.error(ParseErrorKind::MismatchedTag {
                        open: tag_name.clone(),
                        close: close_tag.to_string(),
                    }));
                }

                if self.current_char() != Some('>') {
                    return Err(self.error(ParseErrorKind::UnclosedTag { tag: tag_name }));
                }
                self.index += 1;
            }
        }

        Ok(Element {
            span: self.make_span(start, self.index),
            name: Atom::from(tag_name.as_str()),
            attrs: attributes,
            directives,
            slot: slot_assignment,
            children,
            self_closing,
        })
    }

    fn parse_attribute(&mut self) -> Result<Attr, ParseError> {
        let start = self.index;

        // Parse attribute name
        let name_start = self.index;
        while self.index < self.source.len() {
            let ch = self.current_char().unwrap();
            if ch.is_whitespace() || ch == '=' || ch == '>' || ch == '/' {
                break;
            }
            self.index += ch.len_utf8();
        }
        let name = self.source[name_start..self.index].to_string();
        if name.is_empty() {
            return Err(self.error(ParseErrorKind::InvalidAttributeName {
                name: String::new(),
            }));
        }

        self.skip_whitespace();

        // Check for '='
        if self.current_char() != Some('=') {
            // Boolean attribute
            return Ok(Attr {
                span: self.make_span(start, self.index),
                name: Atom::from(name.as_str()),
                value: None,
            });
        }
        self.index += 1;
        self.skip_whitespace();

        // Parse value
        let value = self.parse_attribute_value()?;

        Ok(Attr {
            span: self.make_span(start, self.index),
            name: Atom::from(name.as_str()),
            value: Some(value),
        })
    }

    fn parse_attribute_value(&mut self) -> Result<Value, ParseError> {
        let quote = self.current_char();
        if quote != Some('"') && quote != Some('\'') {
            return Err(self.error(ParseErrorKind::Other("Expected quote".to_string())));
        }
        let quote_char = quote.unwrap();
        self.index += 1;

        let value_start = self.index;
        // Iterate by chars to handle multi-byte UTF-8
        while self.index < self.source.len() {
            if let Some(ch) = self.current_char() {
                if ch == quote_char {
                    break;
                }
                self.index += ch.len_utf8();
            } else {
                break;
            }
        }

        if self.current_char() != Some(quote_char) {
            return Err(self.error(ParseErrorKind::Other(
                "Unclosed attribute value".to_string(),
            )));
        }

        let raw = self.source[value_start..self.index].to_string();
        self.index += 1; // Skip closing quote

        // Parse value into Static/Expr/Template
        self.parse_value_content(&raw, value_start)
    }

    fn parse_value_content(&self, raw: &str, source_offset: usize) -> Result<Value, ParseError> {
        // Check for interpolations
        let parts = self.extract_template_parts(raw, source_offset)?;

        match parts.len() {
            0 => {
                // Empty value
                Ok(Value::Static(StaticValue {
                    span: self.make_span(source_offset, source_offset + raw.len()),
                    raw: Atom::from(raw),
                    value: Atom::from(raw),
                }))
            }
            1 => {
                match &parts[0] {
                    TemplatePart::Static(s) => {
                        // Pure static
                        Ok(Value::Static(s.clone()))
                    }
                    TemplatePart::Expr(_) => {
                        // Pure expression
                        if raw.trim().starts_with("{{") && raw.trim().ends_with("}}") {
                            let trimmed = raw.trim();
                            let leading_ws = raw.len() - raw.trim_start().len();
                            let expr_text = trimmed[2..trimmed.len() - 2].trim();
                            let expr_offset_in_raw = leading_ws
                                + 2
                                + (trimmed[2..trimmed.len() - 2].len()
                                    - trimmed[2..trimmed.len() - 2].trim_start().len());

                            let mut expr = crate::expression::parse_expression_internal(
                                self.source_file.clone(),
                                expr_text,
                            )
                            .map_err(|e| {
                                // Map SWC span to WXML source span
                                let wxml_span = if e.span.is_dummy() {
                                    self.make_span(
                                        source_offset + expr_offset_in_raw,
                                        source_offset + expr_offset_in_raw + expr_text.len(),
                                    )
                                } else {
                                    let local_start = e.span.lo.0 as usize;
                                    let local_end = e.span.hi.0 as usize;
                                    self.make_span(
                                        source_offset + expr_offset_in_raw + local_start,
                                        source_offset + expr_offset_in_raw + local_end,
                                    )
                                };
                                ParseError {
                                    span: wxml_span,
                                    source_file: self.source_file.clone(),
                                    kind: ParseErrorKind::ExpressionError(e.kind),
                                    message: e.message,
                                }
                            })?;

                            // Adjust ExprContainer.span from relative to absolute
                            let expr_offset_in_source = source_offset + expr_offset_in_raw;
                            if !expr.span.is_dummy() {
                                expr.span = self.make_span(
                                    expr_offset_in_source + expr.span.lo.0 as usize,
                                    expr_offset_in_source + expr.span.hi.0 as usize,
                                );
                            }

                            Ok(Value::Expr(expr))
                        } else {
                            // Template with one expression
                            Ok(Value::Template(TemplateValue {
                                span: self.make_span(source_offset, source_offset + raw.len()),
                                raw: Atom::from(raw),
                                parts,
                            }))
                        }
                    }
                }
            }
            _ => {
                // Multiple parts - template
                Ok(Value::Template(TemplateValue {
                    span: self.make_span(source_offset, source_offset + raw.len()),
                    raw: Atom::from(raw),
                    parts,
                }))
            }
        }
    }

    fn extract_template_parts(
        &self,
        text: &str,
        source_offset: usize,
    ) -> Result<Vec<TemplatePart>, ParseError> {
        let mut parts = Vec::new();
        let mut last_end = 0;
        let mut index = 0;

        while let Some(open_offset) = text[index..].find("{{") {
            let open = index + open_offset;

            // Add static text before {{
            if open > last_end {
                let static_start = source_offset + last_end;
                let static_end = source_offset + open;
                parts.push(TemplatePart::Static(StaticValue {
                    span: self.make_span(static_start, static_end),
                    value: Atom::from(&text[last_end..open]),
                    raw: Atom::from(&text[last_end..open]),
                }));
            }

            // Find closing }}
            if let Some(close_offset) = text[open + 2..].find("}}") {
                let expr_start = open + 2;
                let expr_end = open + 2 + close_offset;
                let expr_text = text[expr_start..expr_end].trim();
                let expr_trim_offset = text[expr_start..expr_end].len()
                    - text[expr_start..expr_end].trim_start().len();

                // Parse expression
                let expr = crate::expression::parse_expression_internal(
                    self.source_file.clone(),
                    expr_text,
                )
                .map_err(|e| {
                    // Map SWC span to WXML source span
                    let expr_offset_in_source = source_offset + expr_start + expr_trim_offset;
                    let wxml_span = if e.span.is_dummy() {
                        self.make_span(
                            expr_offset_in_source,
                            expr_offset_in_source + expr_text.len(),
                        )
                    } else {
                        let local_start = e.span.lo.0 as usize;
                        let local_end = e.span.hi.0 as usize;
                        self.make_span(
                            expr_offset_in_source + local_start,
                            expr_offset_in_source + local_end,
                        )
                    };
                    ParseError {
                        span: wxml_span,
                        source_file: self.source_file.clone(),
                        kind: ParseErrorKind::ExpressionError(e.kind),
                        message: e.message,
                    }
                })?;

                parts.push(TemplatePart::Expr(expr));

                index = expr_end + 2;
                last_end = index;
            } else {
                let msg = "Unclosed interpolation".to_string();
                return Err(ParseError {
                    span: Span::default(),
                    source_file: self.source_file.clone(),
                    kind: ParseErrorKind::UnclosedInterpolation,
                    message: msg,
                });
            }
        }

        // Add remaining static text
        if last_end < text.len() {
            let static_start = source_offset + last_end;
            let static_end = source_offset + text.len();
            parts.push(TemplatePart::Static(StaticValue {
                span: self.make_span(static_start, static_end),
                value: Atom::from(&text[last_end..]),
                raw: Atom::from(&text[last_end..]),
            }));
        }

        Ok(parts)
    }

    fn parse_text(&mut self, start: usize, end: usize) -> Result<Option<Node>, ParseError> {
        let raw = self.source[start..end].to_string();
        let trimmed = raw.trim();

        // Only skip whitespace-only text at document top level
        // Inside element/template/slot bodies, preserve whitespace
        if trimmed.is_empty() && !self.in_element_body {
            return Ok(None);
        }

        // Check if text contains interpolations
        if raw.contains("{{") {
            // Parse value content to handle interpolations {{...}}
            let value = self.parse_value_content(&raw, start)?;
            Ok(Some(Node::Text(Text {
                span: self.make_span(start, end),
                value,
            })))
        } else {
            // Pure static text - decode entities
            let value = self.decode_entities(&raw);
            Ok(Some(Node::Text(Text {
                span: self.make_span(start, end),
                value: Value::Static(StaticValue {
                    span: self.make_span(start, end),
                    value: Atom::from(value),
                    raw: Atom::from(raw),
                }),
            })))
        }
    }

    fn parse_comment(&mut self) -> Result<Node, ParseError> {
        let start = self.index;
        assert!(self.source[self.index..].starts_with("<!--"));
        self.index += 4;

        if let Some(close_offset) = self.source[self.index..].find("-->") {
            let text = self.source[self.index..self.index + close_offset].to_string();
            let raw = format!("<!--{}-->", text);
            self.index += close_offset + 3;
            Ok(Node::Comment(Comment {
                span: self.make_span(start, self.index),
                text: Atom::from(text),
                raw: Atom::from(raw),
            }))
        } else {
            Err(self.error(ParseErrorKind::UnclosedComment))
        }
    }

    fn skip_to_close(&mut self) -> Result<(), ParseError> {
        if let Some(close_offset) = self.source[self.index..].find('>') {
            self.index += close_offset + 1;
            Ok(())
        } else {
            Err(self.error(ParseErrorKind::Other("Unclosed tag".to_string())))
        }
    }

    fn decode_entities(&self, text: &str) -> String {
        text.replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&amp;", "&")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")
            .replace("&nbsp;", "\u{00A0}")
    }

    fn skip_whitespace(&mut self) {
        while self.index < self.source.len() {
            if let Some(ch) = self.current_char() {
                if !ch.is_whitespace() {
                    break;
                }
                self.index += ch.len_utf8();
            } else {
                break;
            }
        }
    }

    fn current_char(&self) -> Option<char> {
        self.source[self.index..].chars().next()
    }

    fn make_span(&self, start: usize, end: usize) -> Span {
        Span::new(BytePos(start as u32), BytePos(end as u32))
    }

    fn error(&self, kind: ParseErrorKind) -> ParseError {
        let message = format!("{:?}", kind);
        ParseError {
            span: self.make_span(self.index, self.index + 1),
            source_file: self.source_file.clone(),
            kind,
            message,
        }
    }

    fn parse_directive(&self, attr: &Attr) -> Result<Directive, ParseError> {
        let name = attr.name.as_ref();
        let span = attr.span;

        match name {
            "wx:if" => {
                let test = match &attr.value {
                    Some(Value::Expr(expr)) => expr.clone(),
                    _ => {
                        let msg = "wx:if requires expression value".to_string();
                        return Err(ParseError {
                            span,
                            source_file: self.source_file.clone(),
                            kind: ParseErrorKind::Other(msg.clone()),
                            message: msg,
                        });
                    }
                };
                Ok(Directive::If(IfDirective { test, span }))
            }
            "wx:elif" => {
                let test = match &attr.value {
                    Some(Value::Expr(expr)) => expr.clone(),
                    _ => {
                        let msg = "wx:elif requires expression value".to_string();
                        return Err(ParseError {
                            span,
                            source_file: self.source_file.clone(),
                            kind: ParseErrorKind::Other(msg.clone()),
                            message: msg,
                        });
                    }
                };
                Ok(Directive::Elif(ElifDirective { test, span }))
            }
            "wx:else" => Ok(Directive::Else(ElseDirective { span })),
            "wx:for" => {
                let source = match &attr.value {
                    Some(Value::Expr(expr)) => expr.clone(),
                    _ => {
                        let msg = "wx:for requires expression value".to_string();
                        return Err(ParseError {
                            span,
                            source_file: self.source_file.clone(),
                            kind: ParseErrorKind::Other(msg.clone()),
                            message: msg,
                        });
                    }
                };
                Ok(Directive::For(ForDirective {
                    source,
                    item: None,
                    index: None,
                    span,
                }))
            }
            "wx:key" => {
                let value = match &attr.value {
                    Some(Value::Static(s)) if s.value.as_ref() == "*this" => KeyValue::StarThis,
                    Some(Value::Static(s)) => KeyValue::Identifier(s.value.clone()),
                    Some(Value::Expr(expr)) => KeyValue::Expr(expr.clone()),
                    _ => {
                        let msg = "wx:key requires value".to_string();
                        return Err(ParseError {
                            span,
                            source_file: self.source_file.clone(),
                            kind: ParseErrorKind::Other(msg.clone()),
                            message: msg,
                        });
                    }
                };
                Ok(Directive::Key(KeyDirective { value, span }))
            }
            _ => {
                let msg = format!("Unknown directive: {}", name);
                Err(ParseError {
                    span,
                    source_file: self.source_file.clone(),
                    kind: ParseErrorKind::Other(msg.clone()),
                    message: msg,
                })
            }
        }
    }

    fn parse_element_or_special(&mut self) -> Result<Option<Node>, ParseError> {
        let start = self.index;
        assert_eq!(self.current_char(), Some('<'));
        self.index += 1;

        // Peek at tag name
        while self.index < self.source.len() {
            let ch = self.current_char().unwrap();
            if ch.is_whitespace() || ch == '>' || ch == '/' {
                break;
            }
            self.index += ch.len_utf8();
        }
        let tag_name = self.source[start + 1..self.index].to_string();

        // Reset to start and parse based on tag name
        self.index = start;

        match tag_name.as_str() {
            "wxs" => self.parse_wxs().map(|n| Some(Node::Wxs(n))),
            "template" => self.parse_template(),
            "import" => self.parse_import().map(|n| Some(Node::Import(n))),
            "include" => self.parse_include().map(|n| Some(Node::Include(n))),
            "slot" => self.parse_slot().map(|n| Some(Node::Slot(n))),
            _ => self.parse_element().map(|e| Some(Node::Element(e))),
        }
    }

    fn parse_wxs(&mut self) -> Result<Wxs, ParseError> {
        let start = self.index;
        assert_eq!(self.current_char(), Some('<'));
        self.index += 1;

        // Parse tag name
        while self.index < self.source.len() {
            let ch = self.current_char().unwrap();
            if ch.is_whitespace() || ch == '>' || ch == '/' {
                break;
            }
            self.index += 1;
        }

        let mut module = None;
        let mut src = None;

        // Parse attributes
        loop {
            self.skip_whitespace();
            if self.index >= self.source.len() {
                return Err(self.error(ParseErrorKind::UnclosedTag {
                    tag: "wxs".to_string(),
                }));
            }

            if self.current_char() == Some('>') || self.current_char() == Some('/') {
                break;
            }

            let attr = self.parse_attribute()?;
            match attr.name.as_ref() {
                "module" => {
                    if let Some(Value::Static(v)) = attr.value {
                        module = Some(WxsModuleName {
                            span: v.span,
                            value: v.value,
                            raw: v.raw,
                        });
                    }
                }
                "src" => {
                    if let Some(Value::Static(v)) = attr.value {
                        src = Some(SourcePath {
                            span: v.span,
                            value: v.value,
                            raw: v.raw,
                        });
                    }
                }
                _ => {} // Ignore other attributes
            }
        }

        // Check for self-closing
        let self_closing = self.current_char() == Some('/');
        if self_closing {
            self.index += 1;
        }

        // Consume '>'
        if self.current_char() != Some('>') {
            return Err(self.error(ParseErrorKind::UnclosedTag {
                tag: "wxs".to_string(),
            }));
        }
        self.index += 1;

        let mut content = None;
        if !self_closing {
            // Capture content until </wxs>
            let content_start = self.index;
            if let Some(close_offset) = self.source[self.index..].find("</wxs>") {
                let raw = self.source[content_start..content_start + close_offset].to_string();
                content = Some(WxsContent {
                    span: self.make_span(content_start, content_start + close_offset),
                    raw: Atom::from(raw),
                });
                self.index += close_offset + 6; // Skip </wxs>
            } else {
                return Err(self.error(ParseErrorKind::UnclosedTag {
                    tag: "wxs".to_string(),
                }));
            }
        }

        Ok(Wxs {
            span: self.make_span(start, self.index),
            module,
            src,
            content,
            self_closing,
        })
    }

    fn parse_template(&mut self) -> Result<Option<Node>, ParseError> {
        let start = self.index;
        assert_eq!(self.current_char(), Some('<'));
        self.index += 1;

        // Skip "template"
        self.index += 8;

        let mut name = None;
        let mut is_attr = None;
        let mut data_attr: Option<(String, Span)> = None;

        // Parse attributes
        loop {
            self.skip_whitespace();
            if self.index >= self.source.len() {
                return Err(self.error(ParseErrorKind::UnclosedTag {
                    tag: "template".to_string(),
                }));
            }

            if self.current_char() == Some('>') || self.current_char() == Some('/') {
                break;
            }

            // Check if this is a data attribute - needs special handling
            let attr_name_start = self.index;
            while self.index < self.source.len() {
                if let Some(ch) = self.current_char() {
                    if ch.is_whitespace() || ch == '=' || ch == '>' || ch == '/' {
                        break;
                    }
                    self.index += ch.len_utf8();
                } else {
                    break;
                }
            }
            let attr_name = &self.source[attr_name_start..self.index];

            if attr_name == "data" {
                // Parse data attribute specially - bypass normal attribute value parsing
                self.skip_whitespace();
                if self.current_char() != Some('=') {
                    return Err(self.error(ParseErrorKind::Other(
                        "data attribute requires a value".to_string(),
                    )));
                }
                self.index += 1;
                self.skip_whitespace();

                // Extract raw attribute value
                let quote = self.current_char();
                if quote != Some('"') && quote != Some('\'') {
                    return Err(self.error(ParseErrorKind::Other(
                        "Expected quote for data attribute".to_string(),
                    )));
                }
                let quote_char = quote.unwrap();
                self.index += 1;

                let value_start = self.index;
                while self.index < self.source.len() {
                    if let Some(ch) = self.current_char() {
                        if ch == quote_char {
                            break;
                        }
                        self.index += ch.len_utf8();
                    } else {
                        break;
                    }
                }

                if self.current_char() != Some(quote_char) {
                    return Err(self.error(ParseErrorKind::Other(
                        "Unclosed data attribute value".to_string(),
                    )));
                }

                let raw_value = &self.source[value_start..self.index];
                let value_end = self.index;
                self.index += 1; // Skip closing quote

                // Template data must be exactly one interpolation (possibly with outer whitespace)
                // Verify {{...}} pattern after trimming whitespace
                let trimmed = raw_value.trim();
                if !trimmed.starts_with("{{") || !trimmed.ends_with("}}") {
                    // Error span should point to the attribute value, not beyond it
                    let error_span = self.make_span(value_start, value_end);
                    return Err(ParseError {
                        span: error_span,
                        source_file: self.source_file.clone(),
                        kind: ParseErrorKind::Other(
                            "template data attribute must be exactly one interpolation {{...}}"
                                .to_string(),
                        ),
                        message:
                            "template data attribute must be exactly one interpolation {{...}}"
                                .to_string(),
                    });
                }

                // Calculate offset to trimmed content within raw_value
                let leading_ws = raw_value.len() - raw_value.trim_start().len();
                let trimmed_start = value_start + leading_ws;

                // Extract content between {{ and }} and trim inner whitespace
                let inner_content = &trimmed[2..trimmed.len() - 2];
                let template_data_source = inner_content.trim();

                // Calculate span for template data body (trimmed content without {{ }} wrapper)
                let inner_leading_ws = inner_content.len() - inner_content.trim_start().len();
                let body_start = trimmed_start + 2 + inner_leading_ws; // +2 for {{
                let body_end = body_start + template_data_source.len();
                let data_span = self.make_span(body_start, body_end);

                // Reject empty template data
                if template_data_source.is_empty() {
                    return Err(ParseError {
                        span: data_span,
                        source_file: self.source_file.clone(),
                        kind: ParseErrorKind::Other("template data cannot be empty".to_string()),
                        message: "template data cannot be empty".to_string(),
                    });
                }

                // Store for later use with span
                // TemplateData.raw will contain the trimmed body content (without {{ }} and inner whitespace)
                // TemplateData.span will point to this trimmed content in the source
                // This satisfies: source[span] == raw
                data_attr = Some((template_data_source.to_string(), data_span));
            } else {
                // Normal attribute parsing - reset index to start of attribute name
                self.index = attr_name_start;
                let attr = self.parse_attribute()?;
                match attr.name.as_ref() {
                    "name" => {
                        if let Some(Value::Static(v)) = attr.value {
                            name = Some(TemplateName {
                                span: v.span,
                                value: v.value,
                                raw: v.raw,
                            });
                        }
                    }
                    "is" => {
                        is_attr = attr.value;
                    }
                    _ => {} // Ignore other attributes
                }
            }
        }

        // Check for self-closing
        let self_closing = self.current_char() == Some('/');
        if self_closing {
            self.index += 1;
        }

        // Consume '>'
        if self.current_char() != Some('>') {
            return Err(self.error(ParseErrorKind::UnclosedTag {
                tag: "template".to_string(),
            }));
        }
        self.index += 1;

        // Determine if this is TemplateDef or TemplateRef
        if let Some(target) = is_attr {
            // TemplateRef - data attribute uses special grammar
            let data = if let Some((raw_source, data_span)) = data_attr {
                // Parse as template data - errors must not be silently ignored
                match crate::template_data::parse_template_data_internal(
                    self.source_file.clone(),
                    &raw_source,
                    data_span,
                ) {
                    Ok(template_data) => Some(template_data),
                    Err(e) => {
                        return Err(ParseError {
                            span: e.span,
                            source_file: self.source_file.clone(),
                            kind: ParseErrorKind::Other(format!(
                                "Invalid template data: {}",
                                e.message
                            )),
                            message: e.message,
                        });
                    }
                }
            } else {
                None
            };

            Ok(Some(Node::TemplateRef(TemplateRef {
                span: self.make_span(start, self.index),
                target: Some(target),
                data,
                self_closing,
            })))
        } else {
            // TemplateDef
            let mut body = Vec::new();
            if !self_closing {
                // Parse children until </template>
                // Set in_element_body to preserve whitespace in template body
                let prev_in_element_body = self.in_element_body;
                self.in_element_body = true;

                loop {
                    if self.source[self.index..].starts_with("</template>") {
                        self.index += 11;
                        break;
                    }

                    if self.index >= self.source.len() {
                        self.in_element_body = prev_in_element_body;
                        return Err(self.error(ParseErrorKind::UnclosedTag {
                            tag: "template".to_string(),
                        }));
                    }

                    match self.parse_node()? {
                        Some(node) => body.push(node),
                        None => break,
                    }
                }

                self.in_element_body = prev_in_element_body;
            }

            Ok(Some(Node::TemplateDef(TemplateDef {
                span: self.make_span(start, self.index),
                name,
                body,
                self_closing,
            })))
        }
    }

    fn parse_import(&mut self) -> Result<Import, ParseError> {
        let start = self.index;
        assert_eq!(self.current_char(), Some('<'));
        self.index += 1;

        // Skip "import"
        self.index += 6;

        let mut src = None;

        // Parse attributes
        loop {
            self.skip_whitespace();
            if self.index >= self.source.len() {
                return Err(self.error(ParseErrorKind::UnclosedTag {
                    tag: "import".to_string(),
                }));
            }

            if self.current_char() == Some('>') || self.current_char() == Some('/') {
                break;
            }

            let attr = self.parse_attribute()?;
            if attr.name.as_ref() == "src" {
                if let Some(Value::Static(v)) = attr.value {
                    src = Some(SourcePath {
                        span: v.span,
                        value: v.value,
                        raw: v.raw,
                    });
                }
            }
        }

        // Check for self-closing
        let self_closing = self.current_char() == Some('/');
        if self_closing {
            self.index += 1;
        }

        // Consume '>'
        if self.current_char() != Some('>') {
            return Err(self.error(ParseErrorKind::UnclosedTag {
                tag: "import".to_string(),
            }));
        }
        self.index += 1;

        if !self_closing {
            // Skip to closing tag
            if let Some(close_offset) = self.source[self.index..].find("</import>") {
                self.index += close_offset + 9;
            }
        }

        Ok(Import {
            span: self.make_span(start, self.index),
            src,
            self_closing,
        })
    }

    fn parse_include(&mut self) -> Result<Include, ParseError> {
        let start = self.index;
        assert_eq!(self.current_char(), Some('<'));
        self.index += 1;

        // Skip "include"
        self.index += 7;

        let mut src = None;
        let mut directives = Vec::new();

        // Parse attributes
        loop {
            self.skip_whitespace();
            if self.index >= self.source.len() {
                return Err(self.error(ParseErrorKind::UnclosedTag {
                    tag: "include".to_string(),
                }));
            }

            if self.current_char() == Some('>') || self.current_char() == Some('/') {
                break;
            }

            let attr = self.parse_attribute()?;
            if attr.name.as_ref() == "src" {
                if let Some(Value::Static(v)) = attr.value {
                    src = Some(SourcePath {
                        span: v.span,
                        value: v.value,
                        raw: v.raw,
                    });
                }
            } else if attr.name.starts_with("wx:") {
                directives.push(self.parse_directive(&attr)?);
            }
        }

        // Check for self-closing
        let self_closing = self.current_char() == Some('/');
        if self_closing {
            self.index += 1;
        }

        // Consume '>'
        if self.current_char() != Some('>') {
            return Err(self.error(ParseErrorKind::UnclosedTag {
                tag: "include".to_string(),
            }));
        }
        self.index += 1;

        if !self_closing {
            // Skip to closing tag
            if let Some(close_offset) = self.source[self.index..].find("</include>") {
                self.index += close_offset + 10;
            }
        }

        Ok(Include {
            span: self.make_span(start, self.index),
            src,
            directives,
            self_closing,
        })
    }

    fn parse_slot(&mut self) -> Result<Slot, ParseError> {
        let start = self.index;
        assert_eq!(self.current_char(), Some('<'));
        self.index += 1;

        // Skip "slot"
        self.index += 4;

        let mut name = None;
        let mut directives = Vec::new();

        // Parse attributes
        loop {
            self.skip_whitespace();
            if self.index >= self.source.len() {
                return Err(self.error(ParseErrorKind::UnclosedTag {
                    tag: "slot".to_string(),
                }));
            }

            if self.current_char() == Some('>') || self.current_char() == Some('/') {
                break;
            }

            let attr = self.parse_attribute()?;
            if attr.name.as_ref() == "name" {
                if let Some(Value::Static(v)) = attr.value {
                    name = Some(SlotName {
                        span: v.span,
                        value: v.value,
                        raw: v.raw,
                    });
                }
            } else if attr.name.starts_with("wx:") {
                let directive = self.parse_directive(&attr)?;
                directives.push(directive);
            }
        }

        // Check for self-closing
        let self_closing = self.current_char() == Some('/');
        if self_closing {
            self.index += 1;
        }

        // Consume '>'
        if self.current_char() != Some('>') {
            return Err(self.error(ParseErrorKind::UnclosedTag {
                tag: "slot".to_string(),
            }));
        }
        self.index += 1;

        let mut children = Vec::new();
        if !self_closing {
            // Parse fallback children
            // Set in_element_body to preserve whitespace in slot children
            let prev_in_element_body = self.in_element_body;
            self.in_element_body = true;

            loop {
                if self.source[self.index..].starts_with("</slot>") {
                    self.index += 7;
                    break;
                }

                if self.index >= self.source.len() {
                    self.in_element_body = prev_in_element_body;
                    return Err(self.error(ParseErrorKind::UnclosedTag {
                        tag: "slot".to_string(),
                    }));
                }

                match self.parse_node()? {
                    Some(node) => children.push(node),
                    None => break,
                }
            }

            self.in_element_body = prev_in_element_body;
        }

        Ok(Slot {
            span: self.make_span(start, self.index),
            name,
            directives,
            children,
            self_closing,
        })
    }
}
