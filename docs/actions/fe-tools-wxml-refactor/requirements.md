# Requirements — fe-tools-wxml-refactor

Status: **冻结（2026-09-15）** — D-WR-1..9 全部拍板；Readiness 五件套。

## R-WR0（MUST）W1 函数归位

- 将 WXML transform/backend 函数从 `view/index.js` 归位至 `view/wxml/transform/` 与 `view/wxml/backends/`；函数体逐字不改。
- 精确实施集合为 23 个：transform 10 个 + Vue backend 工具 13 个；`transTagWxs` 按既有归属留在 wxs 轨道，不混入本门。
- 保持 compileML/buildCompileView/compileModule 等 view 编排入口可用。

## R-WR1（MUST）Document 标准形状

- JS Document 采用 `docs/wxml/WXML-AST-TYPES.md` 与 napi/Rust AST 对齐的投影形状。
- `Element.attrs` 统一为 `Attr[]`，不保留 parser-specific 的平铺对象。
- Value 统一为 Static/Expr/Template 三态；节点具备 `span`、`children`、`selfClosing` 等标准字段。
- 特殊节点类型化：`wxs`、`template-def`、`template-ref`、`import`、`include`、`slot` 不依赖标签名字符串判别。
- `null` 表示有意义但当前 parser 无法提供；`[]` 表示空集合；不得通过字段缺失表达 parser 能力差异。

## R-WR2（MUST）cheerio 封装

- cheerio 仅存在于 parser/投影实现内部；transform/backend 不 import cheerio、不消费 `_$`/`_elem` 投影句柄。
- W2 改造允许 IR 结构变化，但不得改变最终编译语义。

## R-WR3（MUST）napi 默认装配

- 接入 `view/wxml/parser/napi.js`，SpanView 直接构造标准 Document，不再增加形状适配层。
- `WXML_PARSER` 取 `napi|cheerio`，缺省为 `napi`；非法值失败并带 `[wxml]` 诊断。
- `cheerio` 路径保留，作为可验证回退与对拍基线。

## R-WR4（MUST）行为与范围

- W1/W2/W3 全量 vitest 通过；默认 napi 与 cheerio 产物 code、sourcemap diff=0。
- W2 的行为 0 以产物和 sourcemap 为准，不要求源码或中间 Document 字节相等。
- `fe/packages` 零改动；不做表达式 AST 消费、transform 纯化、第二 backend、logic/style/wxs 其他函数归位。

## R-WR5（MUST）语义对拍与证据

- 同源 fixture 运行 cheerio/napi 两路，比较节点类型、名称、属性和值分类、directives、特殊节点字段及可用 span。
- cheerio 缺失的属性级 span 允许为 `null`，不得因此判定语义不等价。
- 消融验证 parser 开关与标准 Document 依赖；持久决策回流 architecture-notes。