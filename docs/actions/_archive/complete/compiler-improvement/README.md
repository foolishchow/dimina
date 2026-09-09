# Compiler Improvement（Umbrella）

- Action: `compiler-improvement`
- Status: `complete`
- Archived: 2026-09-08
- Updated: 2026-09-08
- Status authority: [Action Status](../../../STATUS.md)
- 设计权威：[Compiler Architecture RFC](../../../../Compiler-Architecture-RFC.md)（本 Action 不复制架构决策；RFC 是唯一的动机/目标/手段真相源，两文冲突时以 RFC 为准并回改本 Action）

## Background

编译器（DMCC）存在三个工程问题：dev 体验割裂（compile 与容器两个世界 + 写死目录约定）、热更新缺位（watch 只负责重编，无生效设计）、扩展点缺失（Listr 任务树硬编码，无统一挂载面）。已起草 RFC（含 D1–D7 决策、HMR 分级 L0–L4、A/B 双轨路线图），现已定稿（v1.0，2026-09-08）。

## Goal

作为 umbrella，本 Action 的目标是：

1. 按 RFC §5 路线图推进 A 轨道（G1 dev 一体化、G2 HMR 分级、G3 统一挂载面），以**每个门（gate）独立子 Action** 的方式交付；
2. 让 B 轨道（Rust 宿主）与 C1（Lynx PoC）获得明确的终局决策（立项子 Action / deferred），不悬置。

## Non-goals

- 以下事项见 RFC §1.2 并整体适用：性能优化、L4 状态保留热替换、webpack/swc 插件兼容、Lynx 落地、运行时语义修改。
- umbrella 自身不直接承载实现；实现发生在子 Action 中。

## Scope

- 主战场：`fe/packages/compiler`
- A3 涉及：`fe/packages/render`、`fe/packages/container-sdk`（dev-only 扩展，feature flag 隔离）
- 文档：`docs/Compiler-Architecture-RFC.md`（发现回流目标）

## Deliverables

- `dmcc dev <workPath>` 命令（dev server + 内置宿主页 + 代理 + ws）
- HMR 分级生效链路（L1 必达；L2/L3 按 RFC 假设 1 的验证结果）
- 编译器生命周期 hook / target / 插件契约及示例插件（dogfood）
- dev server 与 ws 协议的契约测试
- 每个门对应的子 Action 及其验收证据
- B/C 轨道的终局决策记录

## Umbrella 机制

- 每个门（见 [roadmap](roadmap.md)）在开工前独立 formalize 为子 Action（`draft` → `ready`），验收标准从本 Action 的 [acceptance](acceptance.md) 细化。
- 子 Action `complete` 时其持久发现回流 RFC 与 `docs/` 对应文档。
- umbrella 闭合条件：A 轨道全部子 Action `complete`，且 B/C 轨道均有终局决策记录。

## Readiness gaps

1. ~~RFC 未评审定稿~~——**已解除**：RFC 于 2026-09-08 定稿（v1.0）。
2. **A2.0 资产分发决策未定**（container-sdk 预构建产物随 compiler 分发 vs peer dependency）——**门级前置**：阻塞 A2 系子 Action 的范围界定，不阻塞 A1。
3. **L3 可行性假设未验证**（RFC §7 假设 1：render 侧快照回放的时序）——**门级前置**：不阻塞 A1/A2，必须在 A3 子 Action `ready` 前通过原型验证或明确降级。

伞级无阻塞项（后两项已按门级前置收敛到 roadmap 的就绪前置列），本 Action 进入 `ready`。

## Closure conditions

- A 轨道各门子 Action 全部 `complete`（含验收证据与回流）。
- B/C 轨道有明确终局决策（`deferred` 记录或立项的子 Action 已闭合）。
- 本 umbrella 的 MUST 验收全部通过并有证据。
- STATUS、导航、归档位置一致。

## Closure decision（2026-09-08）

- **终局决策**：`complete`，归档至 `docs/actions/_archive/complete/compiler-improvement/`。
- **验收**：A-001..A-009 全部 `passed`，均由子 Action P-001..P-007 实际执行证据支撑。
- **A 轨道**：A1/A2.0/A2/A3/A4 全部 complete 并归档，产物全程 diff=0，RFC 回流 v1.0→v1.7。
- **B/C 终局决策**：B0–B4（Rust 宿主）与 C1（Lynx PoC）均 **deferred**，再激活条件入 [TODO](../../../TODO.md)。
- **实现提交**：全部子 Action 提交记录见各归档 Action 的 closure decision；umbrella 闭合提交为本次。
- **残余风险**：各子 Action 残余（浏览器视觉工具缺失等）已分别记录在各自归档文档中；B/C deferred 再激活条件明确，无悬置项。
