# Acceptance — render-target-abstraction

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | 缺省 options.target 与显式 `target:'webview'` 成功；CLI `--target webview` 映射一致；未知 target 在 lifecycle、resetAssetCache、目录副作用和 worker 启动前失败，错误为 `DIMINA_INVALID_TARGET` | resolver spec + CLI error + target directory check | pending |
| A-002 | R-002 | view/style 阶段均经阶段级 webview adapter；既有 worker 只被包装一次且输入/output/写入语义不变 | adapter contract spec | pending |
| A-003 | R-003 | logic/service/bridge/modDefine/模块 ID/发布目录/警告与 target 无关 | source audit + regression | pending |
| A-004 | R-004 | 默认 vs explicit webview 全部示例、nomap/sourcemap 在**同一绝对路径**下 diff=0；两轮输入/环境/target 以 validation 记录冻结 | artifact matrix logs | pending |
| A-005 | R-005 | compiler CLI/watch/dev、render/container-sdk 全量规格全绿 | command logs | pending |
| A-006 | R-006 | source diff 无 Lynx/.lyx/rspeedy/rspack/compiler-core bundler | source audit + diff | pending |
| A-007 | R-007 | adapter/resolver 失败不发布产物并保留结构化 target/stage 错误 | failure spec | pending |
| A-008 | R-008 | 首版不增加 lifecycle target 字段；既有 observer payload 与 A1 契约零 diff | decision record + observer spec | pending |
| A-009 | R-009 | 生产构建、A2 ws/HMR 与 native 路径无行为/协议变化 | build + protocol diff | pending |
| A-010 | R-010 | target resolver/adapter 关键机制消融后目标规格失败，恢复后通过 | ablation log | pending |
