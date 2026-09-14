# Implementation plan — fe-tools-wxml-bridge

Status: **in_progress（2026-09-14）** — W0..W2 实施中；基线 `d75f001a`；各门 PR，禁混（P5）

## W0 触达序（入树基建 · 无代码行为面）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `fe/tools/crates/dimina-wxml-parser/VENDOR.md` | 溯源 + 同步责任 + docs 主从 + 桥约束（D-WB-5） |
| 2 | `fe/tools/crates/Cargo.toml` + `.gitignore` + **Cargo.lock** | workspace 正式化（继承字段、members、target/ 忽略）——已落地复验；**Cargo.lock 提交**（可复现构建，钉住 swc 依赖树；`fe/.gitignore` 加 `!tools/crates/Cargo.lock` 例外；W1 加 serde/napi 依赖时更新） |
| 3 | `docs/actions/fe-tools-sidecar/architecture-notes.md` | **D-WIR-1 修订入档**（D-WB-2；oxc 先例、单 crate 边界、`fe/packages` 禁触） |
| 4 | 验证 | `cargo test`（workspace）483 绿；validator 全绿；docs 主从声明在 VENDOR |

## W1 触达序（napi 桥 + SpanView）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `crates/dimina-wxml-parser-napi/`（新） | napi-rs 子 crate；`parseWxmlSpanView(source, sourceFile?)` → 紧凑 JSON（span/raw/结构；不含 `.expr`/`.object`）。**前提（D-WB-7）**：vendored crate 加 serde derives（span/raw 面；非表达式）并被 VENDOR 记修改；**若 `#[ast_node]` 与 derive 冲突 → 手写 serializer 兜底（F20），首步定二选一，可测锚=SpanView 不含 swc 表达式字段** |
| 2 | `fe/tools/wxml-parser-napi/package.json`（新 JS 薄包） | `@dimina/wxml-parser-napi`；`scripts.build = napi build`；**禁止 `prepare` 钩子自动构建**（防污染 `pnpm install`）；`main` 加载 `.node`；未构建时 `[wxml]` 指引 |
| 3 | 测例 | JS 侧 SpanView 对拍：与 crate 测试同源用例（node span / attr span / expr-body span / raw / sourceFile 透传三一致） |
| 4 | 验证 | `cargo test` 483 绿（crate 回归）；napi build 产出 `.node`；JS 单测绿；性能基准（parse 100 页耗时）记录；**`pnpm install` 复验 `tools/crates` 被静默跳过、`wxml-parser-napi` 被纳入 workspace（F15）**（注：W2 集成期可优先 worker 内解析，非硬验收） |
| 5 | 消融 | 拔 `.node`/桥暴露 → SpanView 测试失败 → 恢复 |

## W2 触达序（sourcemap 修复）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 0 | **实证探针（F14）** | base 无 include 页行保持率探针（W1 基线 map 对拍）→ 落定不变量形态：行结构保持 → 取"等于今日"硬形态；否则"语义正确 + 差异观测" |
| 1 | 抽查集 | `rg '<include|<import' examples/miniprogram/base` 枚举含 include/import 页面 → 工作列表入 acceptance |
| 2 | view inMap 构建 | 编排壳/工具：由 SpanView（load 后真实 span）建“生成行/列 → {sourceFile, span.start}”两层映射；替代 `createLineSourcemap` 猜射。**双调用点**：主 inMap（:745）+ templateModuleRender inMap（:531，tm.sourceInfo.startLine → SpanView）；含多根包装/component-host 偏移处理；transHtmlTag 行结构残余标记；**setSourcesContent 覆盖所有映射 sourceFile（含 include/import）** |
| 3 | 测例 | map 断言：抽查集页面 inMap 行目标 = 真 {file,line}；**无 include/import 页面行级 = 语义正确 {file,line}**（若 Step 0 探针显示行保持，升级"= 今日 1:1"硬回归）；差异观测记录；列级可验 |
| 4 | 验证 | code 严格 diff=0（P-WB02）；map 断言全过；vitest 全量绿 |
| 5 | 消融 | span 断供（SpanView→null）→ map 断言失败 → 恢复 |

## 不做（本 Action）

- 换 cheerio 投影（W3+）；表达式 AST 消费；style 切缝；logic 改动
- 预编译多平台 `.node` 分发；napi struct 深面（先 JSON 上限）
- 不向 didi 推送；`fe/packages` 零污染

## 验证

升 `in_progress` 时记基线 SHA（随门递进：W0 = in_progress HEAD；W1 = W0 合入后；W2 = W1 合入后）；dist 同步前置沿用（`node scripts/sync-dist-from-src.js`，涉及 view 路径对拍前必须）→ [validation.md](validation.md) P-WB00..（Result 届时回填）