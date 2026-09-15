# Implementation Plan — fe-tools-wxml-refactor

Status: **`in_progress`** — 基线 `342af2f5`；**W1–W3 已交付**；待 Close。

## 基线与纪律

- 授权基线：`342af2f5`；每门以前一门合入后 HEAD 为基线。
- `fe/packages` 零触碰；不做无关格式化。
- **W1：** 函数体/签名逐字；**W2：** 允许改访问面与签名，禁止改编译语义；**W3：** 装配开关，不改 transform 语义。
- 每门独立跑 P-WR05 + 对拍（W1/W2：相对基线；W3：napi vs cheerio，见 validation P-WR06）。
- 与 `fe-tools-incremental-target` 分 PR（Experience §8）。

## W1 — 函数归位

1. 建 `view/wxml/transform/` 与 `view/wxml/backends/`；按 technical-design §3 **逐名**搬迁 23 函数（含仍用 `$`/cheerio 的现状）。
2. import map：稳定相对路径；expression/wxs/asset 过渡导出——**W1 不改其实现**（仍可吃 `$`）。
3. `view/index.js` 只留编排 + 未归位域；重导 W1 exports；`ctx.tools` 组成不变。
4. 更新路径与 worker 模块链加载检查。
5. Gate：P-WR01 + P-WR05 + 相对基线产物对拍。

## W2 — 标准 Document

1. 固化 `document.js` contract + §4.2 全表操作面（含 tools 用的 setAttr/removeAttr/insertBefore/getChildren/listAttrs）。
2. `parser/cheerio.js` 投影完整形状；attr span 不可得填 null。
3. 收回 load / vue / vue-tools 对 cheerio/`_$` 的直接消费；按 §4.5 废除 normalize 的 cheerio 环路。
4. 按 §4.6 对 `transTagWxs` / `transAsses` 做 Document 薄适配（不迁目录）；其余 tools 按需 `$`→Document / Attr[]。
5. Fixture + grep 零泄漏；Gate：P-WR02/03/05 + 产物对拍（D-WR-9）。

## W3 — napi 默认装配

1. `parser/napi.js` + `parser/index.js`；无 shape adapter。
2. `WXML_PARSER` 缺省 napi；非法值 `[wxml]`。
3. 语义对拍 + P-WR06 产物对拍 + P-WR05。
4. P-WR07 分项消融。

**W3 完成（2026-09-15）：** 默认 napi；cheerio 回退；P-WR05 580/580；P-WR06 diff=0；P-WR07 消融有效。

## 文档与闭合

- 回填 validation/acceptance Actual；回流 architecture-notes。
- 三门通过后升 `complete` 并归档；未授权不得实施。
