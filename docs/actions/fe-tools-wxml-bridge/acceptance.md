# Acceptance — fe-tools-wxml-bridge

Status: **ready（2026-09-14）** — A-WB0..05；D-WB 已拍板；实施另授权 `in_progress`，证据回填

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-WB0 | R-WB0 | VENDOR 在档（溯源/主从/桥约束/**vendored 修改记录**）；workspace 483 tests 绿；docs 主从声明；D-WIR-1 修订入档 | P-WB00 / 源码审查 | pending |
| A-WB1 | R-WB1 | napi 子 crate 暴露 `parseWxmlSpanView` 输出 SpanView JSON（三层 span + raw + sourceFile 透传；无表达式负载）；JS 薄包可加载 `.node`；对拍一致 | P-WB01 / P-WB03 | pending |
| A-WB2 | R-WB2 | view `inMap` 由真 span 构建（**双点**：主 :745 + 模板 :531）；include/import 跨文件归位（行级正确 + 列级可用）；映射 sourceFile 均 setSourcesContent | P-WB04 / P-WB02 | pending |
| A-WB3 | R-WB3 | code 严格 diff=0；**行级语义正确**（无 include/import 页 = 真实 {file,line}；今日 1:1 为对照基线 + 差异观测；W2 Step 0 探针后若行保持成立则加"= 今日"硬回归）；更准断言（抽查集 = 真 {file,line}） | P-WB02 / P-WB04 | pending |
| A-WB4 | R-WB4 | 改动限 `fe/tools/`（crates + wxml-parser-napi + view 路径）；`fe/packages` 零 diff；不推送 | P-WB05 | pending |
| A-WB5 | R-WB5 | 失败路径 `[wxml]` + sourceFile/loc；SpanView sourceFile 透传 | P-WB01 / P-WB04 + 审查 | pending |

## Non-acceptance（本门不验）

| 项 | 说明 |
| --- | --- |
| 表达式 AST / 真 parser 替换投影 | W3+ 另立 |
| style 切缝 / logic 改动 | S13 剩余 / 非本门 |
| 预编译 `.node` 分发；formatter/lint/IDE；预览/真机/视觉 | Non-requirements |

## Notes

- **消融 ×2（MUST）**：W1 拔桥 → SpanView 测试失败；W2 拔 span → map 断言失败。纪律按 Experience-Review §6。
- **基线随门递进**（P-WB02）：W0/W1/W2 各基线 = 前门合入后 HEAD。
- **transHtmlTag 行结构残余**：该变换对行结构的影响由 W2 Step 0 探针落定（F14）——行保持则取硬不变量；否则语义正确 + 差异观测（F16 统一口径，弃"仍正确"模糊后门）。
- 升 `in_progress` 需明确授权。