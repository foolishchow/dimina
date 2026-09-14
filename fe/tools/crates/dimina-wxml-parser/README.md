# dimina-wxml-parser

Parser and typed AST owner for WXML source.

## Role

The parser and AST boundary executes in the standalone `wxml-compiler`
pipeline and remains reuse evidence for the replacement compiler.

The parser recognizes the defined syntax and preserves source provenance for
downstream owners. It does not resolve `import`/`include`, expand template
definitions, execute WXS, or prove full WeChat runtime compatibility.

## Public Entry

```rust
use dimina_wxml_parser::parse_wxml;

let document = parse_wxml(None, "<view>{{message}}</view>")?;
```

## Validation

```sh
cargo test -p dimina-wxml-parser
```

Durable syntax, AST, expression, validation, and SWC-node contracts live under
[docs](docs/). Current cross-owner execution status is recorded in
[the action index](../../docs/actions/STATUS.md).
