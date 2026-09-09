# Acceptance — render-target-abstraction

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | 缺省 target 与显式 `webview` 成功；未知 target 在构建前结构化失败 | resolver spec + CLI error | pending |
| A-002 | R-002 | view/style 均经 webview adapter，既有实现只被调用一次且输出不变 | adapter contract spec | pending |
| A-003 | R-003 | logic/service/bridge/modDefine/模块 ID/发布目录/警告与 target 无关 | source audit + regression | pending |
| A-004 | R-004 | 默认 vs explicit webview 全部示例、nomap/sourcemap 在同绝对路径下 diff=0 | artifact matrix logs | pending |
| A-005 | R-005 | compiler CLI/watch/dev、render/container-sdk 全量规格全绿 | command logs | pending |
| A-006 | R-006 | source diff 无 Lynx/.lyx/rspeedy/rspack/compiler-core bundler | source audit + diff | pending |
| A-007 | R-007 | adapter/resolver 失败不发布产物并保留结构化 target/stage 错误 | failure spec | pending |
| A-008 | R-008 | lifecycle target 诊断字段（若采用）不破坏既有 observer；否则有明确不增加决策 | observer spec + decision record | pending |
| A-009 | R-009 | 生产构建、A2 ws/HMR 与 native 路径无行为/协议变化 | build + protocol diff | pending |
| A-010 | R-010 | target resolver/adapter 关键机制消融后目标规格失败，恢复后通过 | ablation log | pending |
