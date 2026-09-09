# Implementation Plan — render-target-abstraction

| ID | 任务 | 依赖 | 验证点 |
| --- | --- | --- | --- |
| P-001 | 冻结 renderer 抽象：app.json/page.json renderer 字段解析、默认 webview、`DIMINA_INVALID_RENDERER` 错误与前置校验（无 CLI/API 覆盖） | — | renderer spec（app/page 声明、未知值、前置失败、无目录副作用） |
| P-002 | 新增 renderer registry/resolver 与阶段级 webview renderer 薄适配（`runViewStage`/`runStyleStage`） | P-001 | renderer contract spec；既有编译函数仍为唯一实现 | |
| P-003 | 将 view/style worker 阶段接入 resolver，不改变 worker 产物契约 | P-002 | compiler stage specs + default/explicit webview equivalence |
| P-004 | 首版不增加 lifecycle target 字段；target 只在 resolver/adapter 内部诊断中记录 | P-003 | observer compatibility spec / decision record（不增加字段） |
| P-005 | 产物矩阵：默认 vs explicit webview，nomap/sourcemap，全部示例 | P-003 | 同路径 controlled diff=0 |
| P-006 | 相邻入口回归：compiler CLI/watch/dev、render/container-sdk 与 compat sync | P-003 | 全量 suites + smoke |
| P-007 | 消融与范围护栏：移除 renderer 校验/绕过 adapter 必须使目标 spec 失败；无 Lynx/rspack/native 改动 | P-002…P-006 | ablation record + source diff |

执行约束：

- 每步保持全量相关 spec 绿；不使用性能指标作为验收目标；
- 不引入 rspack/Lynx，不修改 logic/service/bridge/HMR/ws 产品契约；
- P-005 在同绝对路径控制下完成，避免既有资源绝对路径哈希制造假差异；
- 消融补丁与临时产物不入库。

## 执行记录

| 任务 | 状态 | 日期 | 备注 |
| --- | --- | --- | --- |
| P-001 | 完成 | 2026-09-08 | target resolver/默认值/CLI 来源/非法 target 前置错误；2 用例绿 + 全量 62/411 绿；证据见 [validation](validation.md) |
| P-002…P-007 | 未开始 | — | — |
