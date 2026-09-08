# DMCC Dev Server（A2）

- Action: `dmcc-dev-server`
- Status: `draft`
- Updated: 2026-09-08
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-improvement](../compiler-improvement/README.md)（umbrella，gate A2）
- 设计权威：[Compiler Architecture RFC](../../Compiler-Architecture-RFC.md) §4.1、§4.2、D2、§5-A2、G1（本文不重复，冲突时以 RFC 为准并回改本文）

## Background

现状 dev 体验割裂：开发者要理解 `fe/` 工作区、container 参考宿主、产物目录约定才能预览一个小程序。watch 只负责重编（`src/bin/index.js` 的 `build -w`），没有静态服务、没有内置宿主页、没有变更推送。`fe/packages/server` 的代理能力（express `/proxy` + SSRF 防护）孤立存在，未被编译器链路复用。

## Goal

实现 `dmcc dev <workPath>` 一条命令完成：编译（watch 增量）→ 静态服务（最后成功发布快照）→ 内置最小宿主页（直开目标 app）→ WebSocket 推送变更分类与 reloadLevel → L1 页面 relaunch（logic 变更生效）。使用者无需进入 `fe/` 工作区、无需理解容器与目录约定（G1）。

## Non-goals

- L2/L3（CSS 热替换 / 模板热重挂）——A3 门
- L4（状态保留热替换）——RFC 明确不做
- 公开插件 API（D5）、target 抽象（A4）、Rust 宿主（B 轨道）
- 修改三个编译器、`env.js` 上下文、worker 池、发布逻辑、watch 调度器行为（A1 已保证的契约继续冻结）
- 修改 `fe/packages/container` 参考宿主功能；container demo 的列表壳 UI 不进 `dmcc dev`
- 性能优化

## Scope

- `fe/packages/compiler/src/bin/dev.js`（新增，`dmcc dev` 命令）
- `fe/packages/compiler/src/bin/index.js`（挂载 dev 子命令）
- `fe/packages/compiler/src/common/dev-server.js`（新增：静态服务 + ws + 快照语义）
- `fe/packages/compiler/src/common/dev-reload.js`（新增：变更分类 → reloadLevel 合成）
- `fe/packages/compiler/src/common/dev-host.js`（新增：内置宿主页生成/服务）
- `fe/packages/compiler/sdk/`（container-sdk 预构建资产，随包分发，A2.0 定案）
- `fe/packages/compiler/__tests__/`（dev server / ws 契约 / reloadLevel 合成规格）
- 复用不修改：`src/common/watch.js`、`src/common/compile-stages.js`、`fe/packages/server/security.js`（SSRF 防护逻辑，如需要以源码级迁移方式复用）
- 验证涉及不修改：`src/core/*`、`src/env.js`、`src/common/publish.js`

## Design inputs

- [RFC §4.1 `dmcc dev` 形态](../../Compiler-Architecture-RFC.md)：watch → 静态服务（最后成功发布快照 + no-cache）→ 内置宿主页 → 代理 → ws 推送 `{ appId, changedStages, affectedPages, reloadLevel }`
- [RFC §4.2 HMR Ladder](../../Compiler-Architecture-RFC.md)：L0 全量重启 / L1 页面 relaunch（本门交付）；reloadLevel 合成规则（logic → L1；配置 → L0；仅 style → L2 留待 A3）。L2/L3 边界已定案：合成完整实现、宿主按刷新回退（见 technical-design §5）
- [RFC §5 A2 验收](../../Compiler-Architecture-RFC.md)：一条命令起预览（含 fe/ 外新 clone）；L1 场景验收；dev server 与 ws 协议 vitest 契约测试
- [A1 事件契约 §4.4](../../Compiler-Architecture-RFC.md)：`options.lifecycle` 注入点，`bundle:published` / `build:error` 事件驱动快照与推送
- [A2.0 资产分发定案（RFC D2）](../../Compiler-Architecture-RFC.md)：container-sdk 预构建 dist 随 `@dimina/compiler` 包分发（`sdk/` 资产目录）
- 现有实现事实：[source-audit](source-audit.md)

## Deliverables

- `dmcc dev <workPath>` 命令（watch + 静态服务 + 内置宿主页 + ws + 代理合并）
- reloadLevel 合成（L0/L1 生效；L2 级别预留但本门以刷新回退）
- dev server 与 ws 协议 vitest 契约测试
- 一个示例 app 一条命令起预览（fe/ 工作区外验证）
- 事件契约对 A2 的消费方式文档化（不回改 A1）

## Readiness gaps

- 无已知阻塞；A1（事件契约）、A2.0（资产分发）两个门级前置均已解除。
- 已冻结（2026-09-08 评审）：reloadLevel 合成规则中 L2/L3 级别的回退语义 —— 合成完整实现、宿主按刷新回退（technical-design §5），A3 只升级宿主执行端不改协议。

## Closure conditions

- [acceptance](acceptance.md) 全部 MUST 项通过并记录证据（[validation](validation.md)）；
- dev server 与 ws 协议契约定稿结论回写 RFC（若 §4.1 措辞需补充）；
- STATUS、路径、导航一致。
