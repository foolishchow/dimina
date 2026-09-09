# Render Target Abstraction（A4）

- Action: `render-target-abstraction`
- Status: `draft`
- Updated: 2026-09-08
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-improvement](../compiler-improvement/README.md)（umbrella，gate A4）
- 设计权威：[Compiler Architecture RFC](../../Compiler-Architecture-RFC.md) §3 D3、§4.1、§5-A4、§4.4/§4.5（本文不重复，冲突时以 RFC 为准）

## Background

当前 compiler 的 view/style 编译路径只有一种隐式 WebView 输出。未来 Lynx 等 target 需要替换 WebView + Vue render 这一段，但不能让 target 分支侵入 logic、service、bridge、modDefine 和发布契约。A1 已提供生命周期挂载面，A2/A3 已锁定 Web 容器 dev/HMR 边界；A4 负责建立 target 选择与 view/style 输出边界。

## Goal

引入显式 target 抽象，首个实现仅为 `webview`，并证明启用 target 参数不会改变现有 WebView 产物与行为。为未来 Lynx adapter 预留接入点，但本 Action 不实现 Lynx。

## Non-goals

- 不实现 Lynx、`.lyx`、rspeedy 或 rspack adapter；C1 需另立 RFC。
- 不把 rspack/rspack-like bundler 引入 DMCC compiler 核心。
- 不修改 logic 编译、service、bridge、container runtime 或 HMR 协议。
- 不修改 modDefine 格式、模块 ID、输出目录、兼容性警告或 sourcemap 语义。
- 不做性能优化；target 抽象只以行为、产物和边界为验收目标。

## Scope

- `fe/packages/compiler/src/`：target 类型/解析、view/style 编译调用边界；
- `fe/packages/compiler/__tests__/`：target 选择、默认值、非法值、产物回归规格；
- 必要时更新 A1 lifecycle `stage` payload 的内部 target 字段（不得改变既有默认产物）；
- 相关文档与构建配置。

明确不改：`fe/packages/render`、`fe/packages/container-sdk` 的运行时行为；原生容器；A2/A3 dev server、reloadLevel 与 ws 消息形状。

## Design inputs

- [RFC D3](../../Compiler-Architecture-RFC.md)：target 替换范围是 WebView + Vue render；logic/service/bridge/modDefine 不动。
- [RFC §5 A4](../../Compiler-Architecture-RFC.md)：先只有 `webview` 实现，服务于 G3 挂载面并为 C1 预留接入点。
- [A1 归档契约](../_archive/complete/compiler-hook-layer/technical-design.md)：stage lifecycle 为后续 target 接入的内部边界。
- [Architecture-Diagram](../../Architecture-Diagram.md)：同一 DMCC 产物由不同容器加载，平台差异集中在运行时与资源加载。

## Deliverables

- `webview` target 的显式声明、默认解析与非法 target 诊断；
- view/style 编译 target adapter/接口（首个 adapter 保持现有实现）；
- target-neutral 的 logic/service/bridge/modDefine 边界测试；
- WebView target 默认与显式选择的产物一致性证据（默认、sourcemap、全示例）；
- future adapter 接口文档，不包含 Lynx 实现。

## Readiness gaps

- 当前为 `draft`，尚未完成 Readiness Review。
- A1/A2/A3 前置已完成；无外部全局阻塞。
- 待评审冻结：target 仅通过 `options.target` 解析；CLI `--target` 只映射到该字段；adapter 为阶段级薄适配；非法 target 在 lifecycle 与任何目录副作用前失败；产物矩阵使用同绝对路径控制。

## Closure conditions

- 所有 MUST Acceptance 通过并有可复现证据；
- `webview` 默认/显式 target 产物与现状一致；
- Lynx/rspack 未进入本 Action；
- RFC/roadmap 回写、STATUS/导航/归档一致。
