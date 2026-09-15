# Implementation Plan — fe-tools-wxml-refactor

Status: **ready 候选（2026-09-15）** — 待 promotion 后授权；三门禁混，按 W1→W2→W3 顺序。

## 基线与纪律

- promotion 时记录 HEAD；每门以此前一门合入后的 HEAD 为基线。
- `fe/packages` 零触碰；不改函数体/签名，不做无关格式化。
- 每门独立跑 full vitest 与 base 工程产物对拍；dist 同步先于 CLI 对拍。

## W1 — 函数归位（纯搬迁）

1. 建 `view/wxml/transform/` 与 `view/wxml/backends/`；逐函数 git/文本搬迁 23 个函数：transform 10、Vue tools 13。
2. 以 import map 补齐依赖：core/shared/WXML parser imports 走稳定相对路径；expression/wxs/asset 尚未归位的辅助符号通过过渡导出解决，不改其实现。
3. `view/index.js` 仅保留编排入口、worker 协议及未归位域；重新导入 W1 exports，现有 `ctx.tools` 组成保持不变。
4. 更新 load/vue/backend 与 specs 的路径；模块链加载检查覆盖 index、transform、backend、worker。
5. W1 gate：23 函数 grep 零残留、函数体抽样逐字、full vitest、code+sourcemap diff=0。

## W2 — 标准 Document

1. 固化 `document.js` 的 JS contract：Document/Node/Attr/Value 工厂，统一 null/[] 语义，attrs 改为 Attr[]。
2. 新建/改造 `parser/cheerio.js`：从 cheerio 投影构造完整标准形状；实现 Value 三态、directives、slot、selfClosing、特殊节点类型；属性 span 不可得时填 null。
3. 将 `parse.js` 的 cheerio 细节收回 parser；移除 load.js/vue.js 对 `_$`、`_elem` 和 cheerio API 的直接消费；按实际操作面提供 Document 方法。
4. 改造 load include/import、asset 与 Vue backend 的消费点；保持 sourceFile/span/origin 传播与序列化语义。
5. 添加标准 Document fixture 与 cheerio 对拍；W2 gate：transform/backend 零 cheerio import，所有中间契约字段存在，产物+sourcemap diff=0。

## W3 — napi 默认装配

1. 新建 `parser/napi.js` 与 `parser/index.js`；SpanView 递归构造标准 Document，不增加 shape adapter。
2. 接入 `WXML_PARSER`：缺省 napi；显式 `cheerio` 回退；非法值带 `[wxml]` 失败。
3. 同源 fixture 跑两路语义对拍；覆盖普通节点、Value 三态、directives、special nodes、include/import、sourceFile/span。
4. 用默认 napi 和 `WXML_PARSER=cheerio` 分别编译 base/fixture；执行 code+sourcemap 对拍与完整回归。
5. 消融：移除 parser switch 证明 cheerio 回退失败；移除标准 shape 分类证明 transform/backend 断言失败；恢复后复跑同命令。

## 文档与闭合

- 将实际命令、fixture、差异结果回填 validation/acceptance。
- 将标准 Document contract、parser 选择机制和任何持久限制回流 architecture-notes。
- 三门均通过后 README/STATUS 升 `complete` 并归档；未授权不得实施。