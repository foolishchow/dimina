# FE Tools HMR Compiler（Umbrella）

- Action: `fe-tools-hmr-compiler`
- Status: `ready`
- Updated: 2026-10-09
- Status authority: [Action Status](../STATUS.md)
- 术语 / 结构真源：[docs/fe-tools/architecture-notes](../../fe-tools/architecture-notes.md)（Packer / Scheme）
- 文档集：[requirements](requirements.md) · [design.draft](design.draft.md) · [acceptance](acceptance.md) · [roadmap](roadmap.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`
- 前置：增量链 G1–G5 + IRC + SMPU 全 `complete`（[navigation](../../fe-tools/README.md)）；Packer shape（[types](../../../fe/tools/bundler/src/packer/types.ts) · [convergence](../../../fe/tools/bundler/src/model/convergence.ts)）已定义未接线

## 背景

增量链（G1 graph-persist → G2 fingerprints → G3 invalidation → G4 view-style-compile-res → G5 view-style-cache-skip）+ IRC（residuals closeout）+ SMPU（dual-path 下线）全 complete。watch 路径已增量编译 + state reuse + cache + invalidatedModules 端到端链全通。

**但 dev server 仍全量 reload**：`preview-adapter.notifyBuildPublished()` → 客户端全页刷新，未消费 per-module 增量结果。HMR（Hot Module Replacement）需要编译侧支持单模块 recompile + 增量推送。

**编译侧 4 个缺口阻塞 HMR**（[design.draft §1](design.draft.md) 实证）：
1. **EMIT 全量**（emitBuckets，非增量）——`orchestrator:268` Logic emit 全量 re-emit；`deriveFromGraph`（`convergence.ts:6`）定义未调
2. **registry 3 空壳**——`orchestrator:54` `emptyRegistry`（loader/compile/emit 全 stub），Packer shape 未实体化
3. **view/style cache per-page-bundle**（非 per-module）——G5 D-G5-4' per-page-bundle 粒度，HMR 需 per-module
4. **per-module HMR push 未做**——`dev-reload.ts` RELOAD_LEVELS 无 HMR level（L0-L3 page-level）；`dev-server.ts:195` 全量 reload payload

## Goal

**编译侧 HMR**——deriveFromGraph 接线 + registry 实体化 + per-module view/style cache + per-module HMR push，使 dev server 增量推送（非全量 reload）。伞主要交付**路线与子门顺序**；产品代码在子门实施。

## Non-goals

- **runtime HMR API**（mini-program 运行时 partial update）——运行时侧，非本伞范围（需产品/运行时团队）
- **整包 Packer extraction**（packer-research 已否决；重评估条件见 packer-research）
- 改 view / style 车道业务语义；改 `fe/packages`
- 在本伞直接改 `fe/tools/bundler/src`（无子门授权时）
- 复活已归档 [`fe-tools-incremental-unify`](../_archive/deferred/fe-tools-incremental-unify/README.md) 的 deferred scope（A-IU-1..5 已全 complete via G4/G5）

## 边界

```text
本伞:     HMR 编译侧路线 + 子门顺序 + Non-goals（文档）
子门 H1:  deriveFromGraph 接线（emit 从 emitBuckets 全量改 graph 派生增量）→ [`fe-tools-hmr-emit-derive`](../fe-tools-hmr-emit-derive/README.md)（**`draft`**）
子门 H2:  registry 实体化（Loader/Compiler/Emitter 替代 legacy compile-target）
子门 H3:  per-module view/style cache（G5 per-page-bundle 粒度反转）
子门 H4:  per-module HMR push（dev server 消费增量 payload）
不做:     runtime HMR API；整包 Packer extraction
```

> **§8 修正**：原 H1「load/compile 分离」预判有误（增量链已分离 load/compile）。design.draft §1.1 实证后重编号：H1=deriveFromGraph（原 H2）、H2=registry（原 H3）、H3=per-module cache（新发现）、H4=push（不变）。

## 产品门（伞级）

| 门 | 内容 | 验收 |
| --- | --- | --- |
| **HMR0** | 词汇与子门顺序冻结 | D-HMR-1..N 在档；roadmap 一致 |
| **HMR1+** | 由子门交付 | 伞只跟踪，不替代子门 acceptance |

## Design inputs

- 增量链 G1-G5+IRC+SMPU（complete）——HMR 基础设施已就绪
- Packer shape：`types.ts`（Loader/Compiler/Emitter/Registry 接口）+ `convergence.ts`（deriveFromGraph）+ `session-state.ts`（graph+cache+viewCache/styleCache+fingerprints+invalidatedModules）
- `env.ts` god module（W3「不拆」决策——H2 registry 实体化后自然消解 cycle ①）
- 3 registry 空壳（`orchestrator:54` emptyRegistry）
- `deriveFromGraph`（`convergence.ts:6`，定义未调）
- 目录边界缺口（2 cycle + 2 leak，见 [目录分析](design.draft.md)）——H1-H2 subsume ①②③

## Readiness gaps

- **规模评估待做**（design.draft）——4 子门拆分粒度 + 依赖序 + 行为 0 边界
- **runtime HMR API 依赖**（运行时侧——非本伞范围，但 H4 per-module push 需 runtime 协议对齐）
- **D-HMR-2 design gate**：deriveFromGraph 接线策略（渐进 vs 一次性）待 design.draft 评

## 闭合条件

- HMR0 交付；子门 H1-H4 complete（或书面 deferred 且伞目标降级成文）
- 持久发现回流 `docs/fe-tools/architecture-notes.md`
- STATUS / 导航一致；伞级 A-HMR* 全 pass
- 行为 0：one-shot diff=0 不变（各子门 production 重构不破 baseline）

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-09 | 立项 `draft`：从 SMPU complete 后的"HMR 先做"决策；4 子门预判（H1-H4）；design.draft 规模评估待做 |
