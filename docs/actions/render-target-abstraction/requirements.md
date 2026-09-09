# Requirements — render-target-abstraction

## R-001（MUST）显式 target 解析

compiler 的唯一 target 来源是 `build(..., options)` 中的 `options.target`；未指定时默认 `webview`，显式 `webview` 与默认语义一致；未知 target 在 lifecycle 与任何构建副作用前给出明确结构化错误，不静默回退。CLI 的 `--target <name>` 只负责映射为 `options.target`；watch 增量重建继承初始 target；`dmcc dev` 本门固定使用 `webview`。

## R-002（MUST）view/style adapter 边界

view 与 style 编译通过**阶段级** target adapter/接口调用。首个 `webview` adapter 只包装现有 view/style worker（保留阶段输入、worker payload、文件写入与错误语义），不假设单模块纯函数，也不复制或改变编译语义。

## R-003（MUST）target-neutral 核心

logic、service、bridge、modDefine、模块 ID、发布目录、兼容性警告和 HMR/ws 协议不依赖 target 分支且保持现状。

## R-004（MUST）产物一致

默认 target 与显式 `webview` target 对同一输入生成逐字节一致产物，覆盖无 sourcemap 与 sourcemap 模式、全部 examples/miniprogram 示例。

## R-005（MUST）既有行为无回归

compiler 既有规格、CLI、watch、dev、render/container-sdk 相邻规格保持全绿。

## R-006（MUST）不实现 Lynx/rspack

本 Action 只定义 future adapter seam；不得引入 Lynx、`.lyx`、rspeedy 或 rspack 到 compiler 核心。

## R-007（MUST）target 失败可诊断

adapter 缺失、配置非法或 target 编译失败必须返回结构化错误，不产生误标记为成功的产物。

## R-008（SHOULD）生命周期可观察

A4 首版**不增加 target 到既有 lifecycle payload**；target 只在 resolver/adapter 内部诊断中记录。这样保持 A1 事件契约与既有 observer 兼容；未来如需公开/观察 target，另行更新契约。

## R-009（MAY）未来 adapter 可扩展

接口允许未来 adapter 处理不同 view/style 源码与输出策略，但不要求本 Action 实现第二个 target。

## Non-scope

L2/L3 HMR、原生容器、Rust host、公开插件 API、Lynx PoC、性能优化均不在本 Action 范围内。
