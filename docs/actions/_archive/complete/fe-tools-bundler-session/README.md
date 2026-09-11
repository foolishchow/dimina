# FE Tools Bundler Session

- Action: `fe-tools-bundler-session`
- Status: `complete`
- Updated: 2026-09-10（O1–O3 交付 + 消融×3 + 独立复核；闭合并归档）
- Status authority: [Action Status](../../../STATUS.md)
- 关系：独立架构 Action（**不是** umbrella 子门）。背景见 [`fe-tools-sidecar`](../../../fe-tools-sidecar/README.md)；闭合不依赖伞 `ready`。与 [`fe-tools-bundler-unvite`](../fe-tools-bundler-unvite/README.md) 无依赖（已 complete）。
- 曾用名：`fe-tools-bundler-core`（讨论中改名：本门是**会话/编排门面**，不是编译内核或插件宿主）。
- 工作分支建议：长线 [`feature/fe-tools-sidecar`](../../../fe-tools-sidecar/README.md)，或短分支 `feature/fe-tools-bundler-session`。
- 设计权威：已随实施落地——`fe/tools/bundler/src/session/` 为实现真源；本文档集（探针 + [technical-design](technical-design.md)）转为历史设计记录。

## Positioning

| 本门是 | 本门不是 |
| --- | --- |
| `resolveBundlerConfig` + `createBundler` 会话 | 编译内核 / `runBuild` 算法搬家 |
| CLI → session → 委托现有 pipeline | app/page loader 插件化 |
| 行为目标 **0 变化** | 公开 npm 插件生态 |

管道内 builtin 阶段（`storeInfo` / compilers / publish）见 [stages.draft.md](./stages.draft.md)（**清单 only**，无 plugin API）。真·阶段抽出 / 管道插件化另 Action。

## Design probes

| 探针 | 作用 |
| --- | --- |
| [config.draft.mjs](config.draft.mjs) | 工具侧项目配置 knobs（paths/compile/fileTypes/server；plugins 字段保留但 **非本门主叙事**） |
| [config.draft.types.js](config.draft.types.js) | 共享 JSDoc / `ResolvedBundlerInput` |
| [resolve.draft.mjs](resolve.draft.mjs) | `resolveBundlerConfig`（D-R1..D-R4） |
| [orchestrator.draft.mjs](orchestrator.draft.mjs) | `createBundler` 会话形状 |
| [orchestrator.draft.md](orchestrator.draft.md) | 短索引 |
| [stages.draft.md](stages.draft.md) | **Builtin 阶段/能力表** ↔ 今日函数名 |

## Background

`@dimina/bundler` 已有一次编译、watch、`dimina-cli dev` 与 A1 lifecycle，但缺少共享会话：CLI/dev 手拼；`createBuildWatcher` 与会话无关。小程序工程装载（`app.json` 等）仍在 `storeInfo` / `runBuild` 内——本门**不重做**，只委托。

## Goal（2026-09-10 评审冻结，可实施）

1. `resolveBundlerConfig` → `ResolvedBundlerInput`；
2. `createBundler(resolved)` → `.build` / `.watch` / `.dev`，委托今日 `runBuild` / `createBuildWatcher` / preview adapter；
3. CLI（`build` / `build -w` / `dev`）经 session，不再平行手拼；
4. 保留公开 `export default build` 与 `./watch`；
5. 文档固定 builtin 阶段清单（[stages.draft](stages.draft.md)），为后续抽出留锚点——**本门不抽图、不定 plugin API**。

## 产品门映射（M-E1，实施计划）

| 门 | 交付物 | CLI 接线 | acceptance | validation | 依赖 |
| --- | --- | --- | --- | --- | --- |
| **O1 build** | session 模块（`createBundler` + `.build` + `session.lifecycle` 只读暴露）；`resolveBundlerConfig`（build 路径）；**子路径导出** `@dimina/bundler/session`（M-K1/B）；default `build()` **不委托**（M-F1，见 technical-design §4）；新测例 `__tests__/bundler-session.spec.js` + `__tests__/bin-session-contract.spec.js`（L-K1） | `dimina-cli build`（one-shot）经 session | A-BS01（build 部分）/ 03 / 04 / 05 / 07 | P-001 / 002 / 004 / 006 | — |
| **O2 watch** | `.watch()`（委托 `createBuildWatcher`，lifecycle 经 `options.lifecycle`）；bin-session-contract 扩 `-w` | `dimina-cli build -w` 经 `session.watch()` | + A-BS02（build 部分）/ 03（watch 契约） | + P-002（`-w` 冒烟） | O1 |
| **O3 dev** | `.dev()`（经 `session.watch` + preview adapter + R7 回滚）；`common/sdk-root.js` 迁入；bundler-session.spec 补 R7/A-BS08 注入测例 | `dimina-cli dev` 经 `session.dev()` | + A-BS02（全）/ 03（D1a）/ 08 | + P-003 / 007 | O2 |

每门均跑全量回归（A-BS05 = P-001）；门间可独立验收、独立提交。session 方法按门增量暴露：O1 仅 `.build`，O2 +`.watch`，O3 +`.dev`——终态满足 R-BC1 全集（各阶段 `exports["./session"]` 指向的模块均完整可用，L-L3）。

## Non-goals

- 抽出阶段图可执行结构（原 BC-2）；
- 管道插件 / `transform` / `replaceStage` / 把 app·page load 做成 `use` 插件；
- 以 lifecycle `api.on` 作为「主 plugin 模型」定稿（钩子轨可正交保留，非本门必达）；
- 独立 npm 包；模板 IR；改 `view/logic/style` 算法；TS 迁移；改 `packages/*`。

## 已接受讨论点（摘要）

Resolve：D-R1..D-R4（见 resolve / orchestrator 探针）。  
编排：CLI `-w` ⊆ session；`.dev` 必须经 `session.watch`；preview adapter 对齐 D1a。  
Plugin：**OPEN / 非本门主交付**。

## Scope（草案）

| 纳入（预期） | 说明 |
| --- | --- |
| 包内 session 模块（推荐 `src/session/`：`index.js`=`createBundler` · `resolve.js`=`resolveBundlerConfig` · `preview-adapter.js`；勿叫 `bundler-core`） | `createBundler` + preview 编排；session `import default build from '../index.js'`（M-F1 约束） |
| bin / 公开入口接线 | 算法不改 |
| 探针与阶段清单 | 设计期 |

| 不纳入 | 说明 |
| --- | --- |
| `src/core/*-compiler.js` / `env.storeInfo` 重写 | 零行为改动 |
| 阶段图抽出、管道插件 | 另 Action |

## Readiness

**`ready`**（2026-09-10）。经 14 轮审查（6 维度族：边界/可行性/适配性/功能完整性/文件规划/验收闭环，方法见 [Action-Review-Playbook](../../../../Action-Review-Playbook.md)）后升级：需求（R-BC1..7 + Non-reqs + 已知限制）、设计（探针 + 零循环拓扑 + §4.5 文件清单）、计划（O1–O3 门映射）、验收（A-BS01..08 客观判据）、验证（P-001..007 可执行）俱足。历史注记：早期曾误标 ready 已纠正；本次为评审通过后的正式升级。实施仍需明确授权（`in_progress`）。

## Closure（2026-09-10 执行完毕）

**四条件全部满足**：

① **交付** ✅ — O1 `dd6668a4` / O2 `45ae450f` / O3 `30a52cd9`；A-BS01..08 全 pass、P-001..007 实际证据（见 [acceptance](acceptance.md) / [validation](validation.md)，含消融记录）；独立复核（`c31b6c26`）补齐 R-BC3 最硬证据：**产物字节级等价**（nomap 94 文件 + `--sourcemap` 185 文件，diff 均 exit 0）。
② **消融** ✅ — 三处全部执行，四要素记录于 [validation](validation.md) 消融段。
③ **Backflow** ✅ — 伞 TS-3 行控制面状态已更新；**`./session` API 文档去向：defer 至 TS-4**（理由：tools 为私有孵化面不推 didi，模块级 JSDoc 已覆盖使用面，随伞终态 B 门禁成文统一同步）。
④ **一致性** ✅ — STATUS/归档/伞/TODO 指针一次变更同步。

**残留（已知限制，随归档保留）**：lifecycle 无 `off()`（A1 v1），dev 监听跨循环累积（无害）；若 A1 后续扩展 `off()`，另立 Action 处理。

## Documents

| 文档 | 作用 |
| --- | --- |
| [requirements](requirements.md) | MUST（随讨论修订；旧 L0 plugin MUST 已降级） |
| [stages.draft](stages.draft.md) | Builtin 阶段表 |
| [technical-design](technical-design.md) | 设计索引 + 对象模型（对齐探针） |
| [acceptance](acceptance.md) / [validation](validation.md) | 待随范围重写 |
