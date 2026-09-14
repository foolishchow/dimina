# Requirements — fe-tools-wxml-bridge

Status: **冻结（2026-09-14）** — 与 design v1 / acceptance 对齐；D-WB-1..6 已拍板；改契约须同步三文

## R-WB0（MUST）入树基建（W0）

- `fe/tools/crates/dimina-wxml-parser/VENDOR.md` 在档（溯源 / 同步责任 / docs 主从 / 桥约束）；
- Cargo workspace `fe/tools/crates/` 正式化（members + workspace.package 继承 + `.gitignore` target/；**483 tests 绿**）；
- **docs 主从**：仓库 `docs/wxml/` 为真源；crate `docs/` 冻结快照（VENDOR 声明，不双写）；
- **D-WIR-1 修订入档**（架构注记）：Rust parser 作 napi 桥接组件进 tools（对齐 oxc-parser；边界=单 crate 桥）。

## R-WB1（MUST）napi 桥 + SpanView（W1）

- napi 子 crate（design D-WB-3 形态）暴露 `parseWxmlSpanView(source, sourceFile?)`：
  - Document 树（element/text/comment/特殊节点分类，按 `docs/wxml` 形状）；
  - **span 三层**（PARSING-SPEC §0.4 同构）：node 全形 span（配对含开闭标签）/ attr span（含 `=` 与引号）/ **expr-body span（不含 `{{` `}}` 定界）**；
  - `raw`（节点原文，含 `{{}}` 定界原样）与 `sourceFile` 透传；
  - **不含** `.expr` / `.object`（SWC 表达式负载）——SpanView view 面；
- JS 侧可加载 `.node` 并单测对拍（span/raw/结构三一致，与 crate 测试同源用例）；
- **platform 不进入 SpanView 契约**（对齐 R-WIR4）。

## R-WB2（MUST）sourcemap 修复（W2）

- view 路径 `inMap` 改由真 span 构建（替代 `createLineSourcemap` 1:1 猜射）：
  - include/import 展开行**跨文件归位**（生成行 → 正确 {sourceFile, line}）；
  - **列级可用**（生成列 → 真 span 列）；
- style 路径不改（S13 剩余；映射不改）。

## R-WB3（MUST）验证契约（新框架）

- **code 严格 diff=0**（D-WIR-9 对产物 code 保持）；
- **map 允许变化**（修复即变）且**必须更准**：
  - **行级不变量**：无 include/import 页面的映射行目标与今日 1:1 一致；
  - **更准判定**：include/import 页面映射行目标 = 真 {file,line}（抽查集断言）；列级为新增能力，可验不可缺；
- 消融按 Experience §6（桥拔除 → SpanView 测试失败；span 断供 → map 断言失败）。

## R-WB4（MUST）范围与语言

- 桥接限 `fe/tools/`；`fe/packages` 零污染；不向 didi 推送；
- 不换 cheerio 投影（W3+ 另立）；不消费表达式 AST；不做 formatter/lint/IDE；
- 预编译二进制分发不进本门（本地 cargo build；CI Rust 工具链记入伞 gap）。

## R-WB5（MUST）诊断与来源可溯

- 失败路径 `[wxml]` 前缀 + `sourceFile`/`loc`（对齐 R-WIR9）；
- SpanView `sourceFile` 透传递给的调用方（文件级溯源）。

## Non-requirements

- 表达式 AST 消费 / 真 parser 替换投影 / python 或第二语言
- style 切缝（S13 剩余）；logic 路径改动
- 发布版预编译 `.node` 多平台分发；formatter/lint/IDE