# Web Container HMR L2/L3（A3）

- Action: `hmr-l2-l3`
- Status: `complete`
- Archived: 2026-09-08
- Updated: 2026-09-08
- Promoted: 2026-09-08（Readiness 评审 pass；F-A1..F-A6 + F-B1 已清）
- Status authority: [Action Status](../../../STATUS.md)
- 父 Action：[compiler-improvement](../compiler-improvement/README.md)（umbrella，gate A3）
- 设计权威：[Compiler Architecture RFC](../../../../Compiler-Architecture-RFC.md) §4.1、§4.2、§4.5、§7 假设 1、§5-A3（本文不重复，冲突时以 RFC 为准并回改本文）

## Background

A2 已完成 Web 容器 dev 链路、L0/L1 reload 与统一 ws/reloadLevel 协议。A2 对 L2/L3 只做级别上报与页面刷新回退：CSS 变更和模板变更尚不能在运行实例内保留 service 状态地生效。

render 代码审计已确认：`runtime.setupData` 已按 pageId 累积 setData 状态，具备本地快照基础；但 `loader.createModule` 对已存在 path 直接返回，且 `runtime.firstRender` 只有整 app unmount/createApp/mount，没有页面级 remount API。因此 L3 需要明确的 Web 容器侧原型，而不是假设存在的能力。

## Goal

在**仅限 Web 容器、仅限 dev-only、feature flag 隔离**的边界内，实现并验证：

1. **L2 CSS hot swap**：样式变更无需重建 service 或页面实例即可更新 Web 渲染层样式；
2. **L3 模板热重挂**：模板模块更新后，在保留 service 状态与最近 setData 数据的前提下，对目标页面 remount 并回放 render 侧快照；
3. L3 原型若无法证明生命周期/数据时序安全，稳定回退到 A2 的 L1 页面 relaunch，不阻塞交付。

## Non-goals

- 不支持原生四端容器（Harmony/其他原生宿主）的 HMR；不修改其运行时、bridge 或行为。
- 不修改 compiler 产物、`modDefine` 契约、模块 ID、输出目录、sourcemap 或 dev server/ws 协议。
- 不做 L4 logic 状态保留热替换。
- 不做生产模式 HMR；不默认改变生产构建路径。
- 不重写 service 层，不要求 service 重发 firstRender/setData 数据。
- 不保证页面内部副作用（canvas、scroll、onMounted/watch 外部资源）在 remount 后保留；L3 只承诺 service 状态与 setData 数据快照。
- 不以性能优化为目标。

## Scope

**允许修改（Web 容器 dev-only）**：

- `fe/packages/render/src/core/loader.js`：view module 替换/版本失效机制；
- `fe/packages/render/src/core/runtime.js`：页面级 remount、snapshot capture/replay、生命周期保护；
- `fe/packages/render/src/core/message.js` 或等价 Web render 消息入口：接收 dev-only HMR 指令；
- `fe/packages/container-sdk/src/`：dev-only `sendDevCommand` API 与 bridge 转发、运行时 feature flag；
- `fe/packages/compiler/src/common/dev-host.js`：宿主页 ws 分发 js 升级 L2/L3 执行端（**F-A5 定案**：该文件是 dev server 组成部分而非编译产物、非 ws 协议形状，允许修改；分发逻辑仅限调用 `container.sendDevCommand`）；
- `fe/packages/render/__tests__/`、`fe/packages/container-sdk/__tests__/`：契约/生命周期测试。

继续禁止：`fe/packages/compiler/src/common/dev-server.js`、`dev-reload.js`、`dev-proxy.js` 的任何修改，以及 §4.5 ws 消息形状与编译产物的任何变化。

**必须不改**：

- `fe/packages/compiler` 的产物生成与 A2 §4.5 ws 消息形状；
- 原生端运行时、bridge 契约与非 Web 容器代码；
- service 侧状态管理和业务 API 语义。

## Design inputs

- [RFC §4.1 dev/HMR 生效边界](../../../../Compiler-Architecture-RFC.md)：编译/编排容器无关；预览宿主与 HMR 生效端 Web 容器专属。
- [RFC §4.2 HMR Ladder](../../../../Compiler-Architecture-RFC.md)：L2 CSS、L3 模板 remount + service 状态保留、失败降级 L1。
- [RFC §4.5 dev server 契约](../../../../Compiler-Architecture-RFC.md)：ws/reloadLevel 协议已冻结，A3 不改协议，只升级 Web 宿主执行端。
- [RFC §7 假设 1](../../../../Compiler-Architecture-RFC.md)：setupData 快照回放条件成立；module replace 与页面级 remount 尚需原型。
- [render source audit](source-audit.md)：现有 loader/runtime 数据流、模块缓存、firstRender 与 setData 路径。
- A1/A2 归档 Action：事件契约与 dev server 契约为历史证据和接口输入，不重新定义。

## Deliverables

- Web 容器 dev-only feature flag 与能力探测；
- L2 CSS hot swap 实现与契约测试；
- L3 view module replace + page-level remount + setupData snapshot replay 原型与契约测试；
- L3 生命周期/失败降级测试：首次进入、返回、快速连续保存、展开收起循环、编译失败；
- A2 ws `reloadLevel` 不变的端到端验证：L2/L3 级别由 dev server 上报，Web 宿主执行增强；
- 原型不可行时的 L3→L1 降级记录，不扩散到原生容器。

## Readiness gaps

- Readiness 评审已通过（2026-09-08，verdict pass；F-A1..F-A6 已修复、F-B1 已清）；已 promote `ready`，实施已完成。
- A2 已完成，RFC 假设 1 已条件通过；无全局前置阻塞。
- 已冻结（2026-09-08 Readiness 评审修复 F-A1..F-A6）：
  - **feature flag = 运行时 opt-in**（生产 dist 中 `import.meta.env.DEV` 固化为 false，构建期条件不可用；宿主页 ws 就绪后经 bridge 注入标志，原生/生产无该消息类型天然隔离，见 technical-design §1）；
  - **HMR 指令通道 = 宿主页 ws → `container.sendDevCommand` → bridge(target:'render') → `message.on('hmr')`（technical-design §1）；
  - L2 style registry 区分 `scope:'app'|'page'`（§2）；快照 = deepToRaw 式深拷贝保留 dataFunction 引用（§4）；
  - `dev-host.js` 允许修改边界已明确（Scope）；页面级 remount 事务提交点与 L1 fallback 细节在 technical-design §4/§5，已完成并经 P-007 范围护栏验证。

## Closure conditions

- 所有 MUST Acceptance 通过并有可复现证据；
- L2/L3 仅在 Web 容器 dev-only 生效，原生端和生产路径无行为变化；
- L3 不可行时已以证据降级 L1，不得以未验证假设宣称完成；
- 契约/架构发现回写 RFC §4.2/§7 与 umbrella roadmap；
- STATUS、路径、导航、归档一致。

## Closure decision（2026-09-08）

- **终局决策**：`complete`，归档至 `docs/actions/_archive/complete/hmr-l2-l3/`。
- **验收**：A-001~A-013 全部 `passed`（[acceptance](acceptance.md)），证据见 [validation](validation.md)（P-001…P-007，含 P-006a）。
- **实现提交**：P-001 `966fe3c3`、P-002 `3c2a04c4`、P-003 `c995f2ca`、P-004 `85aa8835`、P-005 `474fb10a`、P-006a `46b91d6e`、P-006 `fd157447`、时序修复 `c26f0a1d`、P-007 `80307696`；最终闭合提交待生成。
- **持久发现回写**：RFC §4.1 定稿 Web 容器边界，§4.2 回写 A3 实施结论与 L1 fallback；RFC §7 假设 1 保留条件成立判定；revision v1.6。
- **残余风险**：真实浏览器 DOM/视觉与 container iframe relaunch 未在当前环境执行（无 Playwright/Puppeteer）；已有真实 HTTP/WS 冒烟、jsdom 事务规格、render/container-sdk 全量与生产/native 范围护栏，不阻塞本 Action 的自动化验收。
