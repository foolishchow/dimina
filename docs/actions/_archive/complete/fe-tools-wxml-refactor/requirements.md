# Requirements — fe-tools-wxml-refactor

Status: **冻结（2026-09-15）** — D-WR-1..9；F-WR-R2/R3：W1 逐字 / W2 可改访问面（含 wxs/asset 薄适配）。

## R-WR0（MUST）W1 函数归位

- 将 technical-design §3 所列 **23** 个函数从 `view/index.js` 归位至 `view/wxml/transform/` 与 `view/wxml/backends/`。
- **仅 W1：** 函数体与签名**逐字**搬迁（含仍接收 `$` / 内联 `cheerio.load` 的现状）；不得借搬迁改逻辑。
- **计数澄清：** 域内 wxml 相关 **24** = 本门 **23** + `transTagWxs`（留 wxs 轨道，本门不搬、不要求从 index「清零」）。
- 保持 compileML/buildCompileView/compileModule 等 view 编排入口可用。

## R-WR1（MUST）Document 标准形状

- JS Document 采用 `docs/wxml/WXML-AST-TYPES.md` 与 napi/Rust AST 对齐的投影形状；字段**始终存在**（null/[] 语义见 D-WR-5/7 与 technical-design）。
- `Element.attrs` 统一为 `Attr[]`；Value 为 Static/Expr/Template 三态；具备 span/children/selfClosing 等标准字段。
- 特殊节点类型化：`wxs`、`template-def`、`template-ref`、`import`、`include`、`slot` 不依赖标签名字符串判别。
- transform/backend 仅经 technical-design §4.2 Document 操作面访问树（操作面按 load / vue / vue-tools 消费者穷举）。

## R-WR2（MUST）cheerio 封装

- cheerio 仅存在于 parser/投影实现内部；**load** / transform / backend（含 vue-tools）不 import cheerio、不消费 `_$`/`_elem` 投影句柄。
- **W2 允许**改访问面与函数签名（例如 `$`→Document、去掉 `normalizeTemplateSyntax` 的 cheerio 环路、`getProps` 入参改 Attr[]）；**禁止**改变最终编译语义（行为 0 = 产物+sourcemap，D-WR-9）。
- `normalizeTemplateDom` 等就地改 Document；目标形态见 technical-design §4.5。
- **load 边界（§4.6）：** W2 须对仍被 load 调用的 `transTagWxs`、`transAsses` 做 Document 薄适配（可改签名与 `$`→§4.2；**不**迁 `view/wxs`/`view/asset`、不改收集/编译语义）；禁止为迁就二者在 load 保留 `_$`。

## R-WR3（MUST）napi 默认装配

- 接入 `view/wxml/parser/napi.js`，SpanView 直接构造标准 Document，不再增加形状适配层。
- `WXML_PARSER` 取 `napi|cheerio`，缺省为 `napi`；非法值失败并带 `[wxml]` 诊断。
- `cheerio` 路径保留，作为可验证回退与对拍基线。

## R-WR4（MUST）行为与范围

- W1/W2/W3 全量 vitest 通过；默认 napi 与 cheerio 产物 code、sourcemap diff=0。
- W2 的行为 0 以产物和 sourcemap 为准，不要求源码或中间 Document 字节相等。
- `fe/packages` 零改动；不做表达式 AST 消费、transform 纯化、第二 backend、logic/style/wxs **目录**归位（W2 对 `transTagWxs`/`transAsses` 的 §4.6 薄适配除外）。

## R-WR5（MUST）语义对拍与证据

- 同源 fixture 运行 cheerio/napi 两路，比较节点类型、名称、属性和值分类、directives、特殊节点字段及可用 span。
- cheerio 缺失的属性级 span 允许为 `null`，不得因此判定语义不等价。
- 消融验证 parser 开关与标准 Document 依赖；持久决策回流 architecture-notes。