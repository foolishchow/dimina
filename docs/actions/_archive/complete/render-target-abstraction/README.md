# Render Target Abstraction（A4）

- Action: `render-target-abstraction`
- Status: `complete`
- Archived: 2026-09-08
- Updated: 2026-09-08
- Promoted: 2026-09-08（Readiness 评审通过；F-A4-001..005 已修复）
- Status authority: [Action Status](../../../STATUS.md)
- 父 Action：[compiler-improvement](../compiler-improvement/README.md)（umbrella，gate A4）
- 设计权威：[Compiler Architecture RFC](../../../../Compiler-Architecture-RFC.md) §3 D3、§4.1、§5-A4、§4.4/§4.5（本文不重复，冲突时以 RFC 为准）

## Background

当前 compiler 的 view/style 编译路径只有一种隐式 WebView 输出。未来 Lynx 等 target 需要替换 WebView + Vue render 这一段，但不能让 target 分支侵入 logic、service、bridge、modDefine 和发布契约。A1 已提供生命周期挂载面，A2/A3 已锁定 Web 容器 dev/HMR 边界；A4 负责建立 target 选择与 view/style 输出边界。

## Goal

引入 renderer 抽象，识别项目声明的 `renderer`（`app.json` 全局 + `page.json` 页面级，对齐微信模型），首个实现仅为 `webview`，且不暴露 renderer 选择能力。为未来 renderer adapter 预留接入点，但不实现 Lynx。

## Non-goals

- 不实现 Lynx、`.lyx`、rspeedy 或 rspack adapter；C1 需另立 RFC。
- 不把 rspack/rspack-like bundler 引入 DMCC compiler 核心。
- 不修改 logic 编译、service、bridge、container runtime 或 HMR 协议。
- 不修改 modDefine 格式、模块 ID、输出目录、兼容性警告或 sourcemap 语义。
- 不做性能优化；target 抽象只以行为、产物和边界为验收目标。

## Scope

- `fe/packages/compiler/src/`：renderer 声明解析、view/style 编译调用边界；
- `fe/packages/compiler/__tests__/`：renderer 字段解析、默认值、未知值、产物回归规格；
- 相关文档与构建配置。

明确不改：`fe/packages/render`、`fe/packages/container-sdk` 的运行时行为；原生容器；A2/A3 dev server、reloadLevel 与 ws 消息形状。

## Design inputs

- [RFC D3](../../../../Compiler-Architecture-RFC.md)：target 替换范围是 WebView + Vue render；logic/service/bridge/modDefine 不动。
- [RFC §5 A4](../../../../Compiler-Architecture-RFC.md)：先只有 `webview` 实现，服务于 G3 挂载面并为 C1 预留接入点。
- [A1 归档契约](../compiler-hook-layer/technical-design.md)：stage lifecycle 为后续 target 接入的内部边界。
- [Architecture-Diagram](../../../../Architecture-Diagram.md)：同一 DMCC 产物由不同容器加载，平台差异集中在运行时与资源加载。

## Deliverables

- `webview` renderer 的声明解析（app + page 字段）与未知 renderer 诊断；
- view/style 编译 renderer adapter/接口（首个 adapter 保持现有实现）；
- renderer-neutral 的 logic/service/bridge/modDefine 边界测试；
- 现有 WebView 产物一致的回归证据（默认构建、sourcemap、全示例）；
- future adapter 接口文档，不包含 Lynx 实现。

## Readiness gaps

- Readiness 评审已通过（2026-09-08，verdict pass；F-A4-001..005 已修复）；已 promote `ready`，待授权实施。
- A1/A2/A3 前置已完成；无外部全局阻塞。
- target 来源、阶段级 adapter、非法 target 前置失败顺序、同路径产物矩阵与 lifecycle 不增字段决策均已冻结。

## Closure conditions

- 所有 MUST Acceptance 通过并有可复现证据；
- `webview` 默认/显式 target 产物与现状一致；
- Lynx/rspack 未进入本 Action；
- RFC/roadmap 回写、STATUS/导航/归档一致。

## Closure decision（2026-09-08）

- **终局决策**：`complete`，归档至 `docs/actions/_archive/complete/render-target-abstraction/`。
- **验收**：A-001~A-010 全部 `passed`，证据见 [validation](validation.md)（P-001..P-007）。
- **实现提交**：P-001 `57101579`+`d481b7cb`+`161a0f2d`（renderer 修订）、P-002 `9ed0fe0f`、P-003..P-007 `a059f065`。
- **持久发现回写**：RFC §5 A4 行标注完成（落地 renderer 抽象，对齐微信 app.json/page.json renderer 字段）；revision v1.7；术语映射（RFC target↔实现 renderer）。
- **设计修订记录**：用户决策撤销 options.target/CLI，改为对齐微信 `app.json.renderer`+`page.json.renderer`，无 CLI/API 覆盖（`161a0f2d`）。
- **残余风险**：无重大残余；页面级混合 renderer 留待未来（届时需 RFC/容器配合）。
