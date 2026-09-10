# Compiler Hook Layer（A1）

- Action: `compiler-hook-layer`
- Status: `complete`
- Archived: 2026-09-08
- Updated: 2026-09-08
- Status authority: [Action Status](../../../STATUS.md)
- 父 Action：[compiler-improvement](../compiler-improvement/README.md)（umbrella，gate A1）
- 设计权威：[Compiler Architecture RFC](../../../../Compiler-Architecture-RFC.md) §5-A1、§4.3、D5、D6（本文不重复，冲突时以 RFC 为准并回改本文）

## Background

`fe/packages/compiler/src/index.js` 的 `runBuild()` 是一棵硬编码的 Listr 任务树（storeInfo → createDist → compileConfig → NpmBuilder → [view ‖ logic ‖ style] → publishToDist）。dev server（A2）、target 分叉（A4）、未来插件（D5）都需要在这条链路挂载能力，现状只能向任务树塞分支。

## Goal

把 `runBuild()` 的编排抽为**内部可挂载的构建生命周期**（hook 事件系统），执行顺序与并发语义完全不变，`build()` 公开契约与产物字节级不变。交付的是「后续能力不再改核心」的挂载面，不是用户可见功能。

## Non-goals

- 公开插件 API（属 D5，待插件作者群体明确后另定版本）
- dev server / ws / HMR（A2/A3）
- target 分叉（A4）
- 三个编译器、`env.js` 上下文、worker 池、发布逻辑、watch 调度器的任何行为修改
- 性能优化

## Scope

- `fe/packages/compiler/src/index.js`（编排重构主战场）
- 新增 `fe/packages/compiler/src/common/lifecycle.js`（事件与注册表，命名可在实现时定案）
- `fe/packages/compiler/__tests__/`（新增生命周期规格）
- 验证涉及但不修改：`src/bin/index.js`、`src/bin/compile.js`、`src/bin/watch.js`

## Deliverables

- 生命周期事件系统（事件名、载荷、注册/触发语义，见 [technical-design](technical-design.md)）
- `runBuild()` 由生命周期驱动，Listr 仅承担进度 UI
- 生命周期观察者规格（事件顺序、并发不序列化、监听器错误隔离）
- 产物字节级一致性证据

## Readiness gaps

无（2026-09-08 评审通过）：

1. ~~父 Action readiness gap 1~~——已解除：RFC 于 2026-09-08 定稿（v1.0）。
2. ~~事件命名与载荷为建议稿~~——已冻结：[technical-design](technical-design.md) 随本 Action 评审定稿（v1），即为本 Action 实现契约与 A2/A4 依赖契约；后续变更需同步更新本设计与 A2/A4 的依赖声明。

## Closure conditions

- [acceptance](acceptance.md) 全部 MUST 项通过并记录证据（[validation](validation.md)）；
- 事件契约（名称/载荷/语义）回写至 umbrella roadmap 与 RFC（若 RFC 措辞需补充）；
- STATUS、路径、导航一致。

## Closure decision（2026-09-08）

- **终局决策**：`complete`，归档至 `docs/actions/_archive/complete/compiler-hook-layer/`。
- **验收**：A-001~A-009 全部 `passed`（[acceptance](acceptance.md)），证据见 [validation](validation.md)（P-001…P-006）。
- **实现提交**：`72650702`（P-001）、`66fce46b`（P-002）、`32b2bd4f`（P-004）、`2d5c3c1e`（P-003/P-005 证据）；最终状态 HEAD `2d5c3c1e`。
- **持久发现回流**：事件契约定稿（12 事件、注入点 `options.lifecycle`、错误隔离语义）已回写 RFC（新增 §4.4）与 umbrella [roadmap](../compiler-improvement/roadmap.md)（A2/A4 依赖声明）。
- **残余风险**：
  - A-009（watch 重建事件序列）由 runBuild 共享路径保证（A-004 已锁定单次构建时序），CLI 无 `--lifecycle` 注入点，冒烟仅确认触发重建进入完整 build；如需 watch 级事件断言，留待 A2 dev server 的 ws 协议契约测试覆盖。
  - P-005 字节一致性在同绝对路径控制下完成；不同绝对路径会因既有 `collectAssets()` 的资源目录哈希产生可复现差异（已排除为重构影响）。
  - `dmcc` 发布 bin 指向 `dist/`，本 Action 验证走 `src/bin/`（同源）；dist 构建链路不在本 Action 范围。
