# Acceptance — fe-tools-wxml-refactor

Status: **draft（2026-09-15）** — 验收门已冻结；实施后回填 Actual。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-WR0 | R-WR0 | 23 个 WXML 域顶层函数归位到 transform/backend；view/index.js 不再保留其定义；函数体/签名逐字不变 | P-WR01 + grep/抽样 diff | pending |
| A-WR1 | R-WR1 | JS Document 对齐 Rust AST shape：attrs=Attr[]、Value 三态、directives/slot/selfClosing、span/sourceFile；字段无 parser-specific 缺失 | P-WR02 + contract fixture | pending |
| A-WR2 | R-WR2 | transform/load/backend 零 cheerio import、零 _$/_elem 消费；include/import/serialize/origin 行为保持 | P-WR02/P-WR03 + grep | pending |
| A-WR3 | R-WR3 | `WXML_PARSER` 默认 napi；显式 cheerio 可用；非法值 `[wxml]` 失败；napi 无 shape adapter | P-WR04 | pending |
| A-WR4 | R-WR4 | 全量 vitest 绿；默认 napi 与 cheerio code、sourcemap diff=0；fe/packages 零 diff | P-WR05/P-WR06 | pending |
| A-WR5 | R-WR5 | 双 parser 语义对拍：type/name/value/directive/special/span 一致；cheerio attr span=null 被允许；消融有效且恢复通过 | P-WR04/P-WR07 | pending |

## 行为 0 解释

W1 是纯搬迁，要求 code+sourcemap diff=0。W2 允许 Document 内部结构性变化（attrs 对象→Attr[]），行为 0 以最终产物、sourcemap、全量回归为准，不要求源码或中间 Document JSON 字节相同。W3 默认 napi 与显式 cheerio 的最终 code+sourcemap 必须相同。

## Non-acceptance

- 表达式 SWC AST 消费、transform 纯化、第二 backend。
- logic/style/wxs 其他函数的全面归位。
- 多平台预编译 napi 分发、性能优化、真机/预览视觉验收。