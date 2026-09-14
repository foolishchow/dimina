# Implementation plan — fe-tools-wxml-bridge

Status: **ready（2026-09-14）** — D-WB 已拍板；升 `in_progress` 时记基线 SHA；W0/W1/W2 各自 PR，禁混（P5）

## W0 触达序（入树基建 · 无代码行为面）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `fe/tools/crates/dimina-wxml-parser/VENDOR.md` | 溯源 + 同步责任 + docs 主从 + 桥约束（D-WB-5） |
| 2 | `fe/tools/crates/Cargo.toml` + `.gitignore` | workspace 正式化（继承字段、members、target/ 忽略）——已落地，复验 |
| 3 | `docs/actions/fe-tools-sidecar/architecture-notes.md` | **D-WIR-1 修订入档**（D-WB-2；oxc 先例、单 crate 边界、`fe/packages` 禁触） |
| 4 | 验证 | `cargo test`（workspace）483 绿；validator 全绿；docs 主从声明在 VENDOR |

## W1 触达序（napi 桥 + SpanView）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `crates/dimina-wxml-parser-napi/`（新） | napi-rs 子 crate；`parseWxmlSpanView(source, sourceFile?)` → 紧凑 JSON（span/raw/结构；不含 `.expr`/`.object`） |
| 2 | `fe/tools/wxml-parser-napi/package.json`（新 JS 薄包） | `@dimina/wxml-parser-napi`；`scripts.build = napi build`；`main` 加载 `.node`；未构建时 `[wxml]` 指引 |
| 3 | 测例 | JS 侧 SpanView 对拍：与 crate 测试同源用例（node span / attr span / expr-body span / raw / sourceFile 透传三一致） |
| 4 | 验证 | `cargo test` 483 绿（crate 回归）；napi build 产出 `.node`；JS 单测绿；性能基准（parse 100 页耗时）记录 |
| 5 | 消融 | 拔 `.node`/桥暴露 → SpanView 测试失败 → 恢复 |

## W2 触达序（sourcemap 修复）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | 抽查集 | `rg '<include|<import' examples/miniprogram/base` 枚举含 include/import 页面 → 工作列表入 acceptance |
| 2 | view inMap 构建 | 编排壳/工具：由 SpanView（load 后真实 span）建“生成行/列 → {sourceFile, span.start}”两层映射；替代 `createLineSourcemap` 猜射（含多根包装/component-host 偏移处理；transHtmlTag 行结构残余标记） |
| 3 | 测例 | map 断言：抽查集页面 inMap 行目标 = 真 {file,line}；**无 include/import 页面行级 = 今日 1:1**（不变量）；列级可验 |
| 4 | 验证 | code 严格 diff=0（P-WB02）；map 断言全过；vitest 全量绿 |
| 5 | 消融 | span 断供（SpanView→null）→ map 断言失败 → 恢复 |

## 不做（本 Action）

- 换 cheerio 投影（W3+）；表达式 AST 消费；style 切缝；logic 改动
- 预编译多平台 `.node` 分发；napi struct 深面（先 JSON 上限）
- 不向 didi 推送；`fe/packages` 零污染

## 验证

升 `in_progress` 时记基线 SHA（随门递进：W0 = in_progress HEAD；W1 = W0 合入后；W2 = W1 合入后）；dist 同步前置沿用（`node scripts/sync-dist-from-src.js`，涉及 view 路径对拍前必须）→ [validation.md](validation.md) P-WB00..（Result 届时回填）