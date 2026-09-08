# Requirements — compiler-improvement (umbrella)

需求从 [RFC §1.1 目标](../../Compiler-Architecture-RFC.md) 派生；RFC 变更时本文同步修订。

## R-001（MUST）dev 一体化

`dmcc dev <workPath>` 一条命令完成编译、预览、代理；使用者无需进入 `fe/` 工作区，无需理解 container 与产物目录约定。

## R-002（MUST）HMR L1 页面 relaunch

logic 变更后自动生效：worker 重 eval logic、当前页 relaunch；复用 `appManager.restartMiniProgram`。

## R-003（SHOULD）HMR L2 CSS 热替换

仅 style 阶段变更时，向渲染层推送 css 重载，logic 与页面实例不动。

## R-004（SHOULD，允许降级）HMR L3 模板热重挂

仅 view 阶段变更时，页面 view 模块重取并 remount，service 状态保留（首选 render 侧快照回放）。时序不成立时降级为 L1，降级决策与证据入 RFC §7。

## R-005（MUST）失败不中断运行实例

任何级别的编译失败都不得中断运行中的实例：dev server 仅暴露最后一次成功发布的快照；失败保留旧产物并明确提示。

## R-006（MUST）统一挂载面

编译器生命周期可挂载：dev server、宿主插件、未来 lynx adapter 通过同一套 hook / target / 插件契约接入；以一个不改核心的示例插件证明。

## R-007（MUST）产物契约护栏

改造期间产物除 `.map` 外字节级不变；`.map` 允许语义等价差异并以断点有效性验收；57 个既有 spec 全程全绿。

## R-008（MUST）umbrella 治理

每个门开工前 formalize 为子 Action 并满足其 `ready` 门；子 Action 闭合时持久发现回流 RFC 与 `docs/`。

## R-009（MUST）B/C 轨道终局决策

umbrella 闭合前，B 轨道（Rust 宿主）与 C1（Lynx PoC）各有明确终局决策（立项子 Action 或 `deferred` 并记录再激活条件）。

## 约束

- 非目标以 RFC §1.2 为准，整体继承。
- 混合变更 reloadLevel 合成规则、L0 检测等机制细节以 RFC §4.2 为准。
