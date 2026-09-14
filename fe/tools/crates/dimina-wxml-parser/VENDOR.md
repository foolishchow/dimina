# VENDOR — dimina-wxml-parser

- **Source**: 外部工作区（Rust/wxml-compiler 方向）复制，用户手动搬运
- **Copy date**: 2026-09-14
- **Source path / commit**: ⏳ 待用户补录（本字段由用户持有）
- **Home**: `fe/tools/crates/dimina-wxml-parser`（Cargo workspace 成员，fe-tools-sidecar 分支）
- **Reproduction**: `cd fe/tools/crates && cargo test`（**483 tests green**，2026-09-14 验证）
- **Sync responsibility**: 本 crate 为私有旁路资产（tools 区）；上游演进/修复需经用户手动同步并更新本文件；**不得**随 `packages/*` 同构规则自动合并
- **Docs**: 仓库 `docs/wxml/` 为规范真源（fe-tools-wxml-bridge 决策）；本 crate `docs/` 为复制快照、不再双写（何为主从见 fe-tools-wxml-bridge）
- **Constraints**: D-WIR-1 已被 `fe-tools-wxml-bridge` D-WB-2 修订——Rust parser 可作为 napi 桥接组件进 tools 工具链（对齐 oxc-parser 先例），边界 = 单 crate 桥、非工具链 Rust 化；桥接实现仅限 `fe/tools/`，不触碰 `fe/packages/*`
- **Vendored modifications**: D-WB-7 授权给 AST 加 **serde derives**（span/raw 面；swc 表达式类型不序列化）以产出紧凑 JSON SpanView——重随上游源码时需重放该修改