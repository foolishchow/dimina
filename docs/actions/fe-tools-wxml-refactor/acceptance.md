# Acceptance — fe-tools-wxml-refactor

Status: **实施中（`in_progress`）** — W1–W3 已交付；A-\* 全 pass；待 Close / 归档。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-WR0 | R-WR0 | **W1：** technical-design §3 的 **23** 函数归位；`view/index.js` 无其定义；`transTagWxs` 不要求迁走；**本门搬迁时**函数体/签名逐字不变 | P-WR01 | **pass**（W1） |
| A-WR1 | R-WR1 | JS Document 标准形状：attrs=Attr[]、Value 三态、directives/slot/selfClosing、span/sourceFile；无 parser-specific 缺键 | P-WR02 | **pass**（W2） |
| A-WR2 | R-WR2 | **W2：** load/vue/vue-tools 零 cheerio/`_$`/`_elem`；经 §4.2 全表；§4.5 normalize 无 cheerio 环路；§4.6 `transTagWxs`/`transAsses` Document 薄适配（不迁目录）；允许改访问面/签名；include/import/serialize/origin 与产物语义保持 | P-WR02/P-WR03 | **pass**（W2） |
| A-WR3 | R-WR3 | `WXML_PARSER` 默认 napi；显式 cheerio 可用；非法值 `[wxml]` 失败；napi 无 shape adapter | P-WR04 | **pass**（W3） |
| A-WR4 | R-WR4 | 全量 vitest 绿；默认 napi vs cheerio code+sourcemap diff=0；fe/packages 零 diff | P-WR05/P-WR06 | **pass**（W3：580/580；P-WR06 diff=0） |
| A-WR5 | R-WR5 | 双 parser 语义对拍；cheerio attr span=null 允许；消融有效且恢复通过（Experience §6） | P-WR04/P-WR07 | **pass**（W3） |

## 行为 0 解释

W1 纯搬迁（逐字）：产物+sourcemap diff=0。W2 允许 Document 结构、tools 访问面/签名、以及 `transTagWxs`/`transAsses` 薄适配变化（D-WR-9 / R-WR2 / §4.6）：行为 0 = 最终产物+sourcemap+全量回归。W3：默认 napi 与显式 cheerio 的最终 code+sourcemap 必须相同。

## Non-acceptance

- 表达式 SWC AST 消费、transform 纯化、第二 backend、wxs/logic/style 全面归位。
- 多平台 napi 预编译分发、性能、真机/预览视觉、微信真源重标定。
