# FE Tools HMR Push（H4 子门）

- Action: `fe-tools-hmr-push`
- Status: `ready`
- Updated: 2026-10-09
- Status authority: [Action Status](../STATUS.md)
- 父伞：[`fe-tools-hmr-compiler`](../fe-tools-hmr-compiler/README.md)（**`ready`**；H4 子门）
- 文档集：[requirements](requirements.md) · [design.draft](design.draft.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`
- 前置：H1+H3 `complete`（deriveFromGraph 接线 + per-module cache——增量 payload 数据源就绪）

## 背景

HMR-compiler 伞 H4 子门。design.draft §3.3 watch 路径渐进启用。H4 per-module HMR push 仅 watch 路径——dev server 消费增量 payload，推 per-module hot-swap（非全量 reload）。

**现状**：`dev-reload.ts:22` RELOAD_LEVELS L0-L3（无 HMR level）。`dev-server.ts:195` notifyBuildPublished → broadcast reload（全量）。H1（deriveFromGraph）+ H3（per-module cache）完成后，编译侧有增量 payload 数据源，H4 接 dev server 消费。

**runtime 依赖**：per-module push 需 runtime HMR API 协议（mini-program 运行时 partial update）。**运行时侧，非本子门实施**。D-HMR-5 fallback：编译侧增量 payload 先交付，dev server fallback L1 page-level reload，runtime 就绪后激活 L_HMR。

## Goal

dev-reload 加 HMR level + dev-server 增量 payload 推送 + materialize 增量化。编译侧 HMR 完成（增量 payload），runtime 激活是外部时序。

## Non-goals

- runtime HMR API 协议定义（运行时侧）
- runtime per-module hot-swap 实现
- per-module cache（H3）
- registry 实体化（H2）

## Scope

```text
H4:  dev-reload 加 L_HMR level（per-module hot-swap）
     dev-server 增量 payload 推送（非全量 reload）
     materialize 增量化（只写变更产物）
     fallback L1（runtime 未就绪时 page-level reload）
不做: runtime HMR API; runtime hot-swap; H2/H3
```

## Design inputs

- `dev/dev-reload.ts:22` RELOAD_LEVELS L0-L3
- `dev/dev-server.ts:195` notifyBuildPublished → broadcast reload
- `compiler/pipeline/publish.ts` publishToDist（全量发布）
- D-HMR-5（伞级）：runtime fallback——编译侧增量 payload 先交付，fallback L1
- H1 deriveLogicBuckets（增量 emit 数据源）
- H3 per-module cache（增量 cache 数据源）

## Readiness gaps

- **D-PUSH-1 HMR level 设计**（design.draft §1）：L_HMR level 语义——per-module payload vs page-level reload
- **D-PUSH-2 fallback downgrade 机制**（design.draft §2）：dev server 如何知 runtime 未就绪 → downgrade L_HMR→L1？
- **D-PUSH-3 materialize 增量化**（design.draft §3）：publishToDist 全量 → 增量（只写变更产物）

## 闭合条件

- D-PUSH-1/2/3 锁 + 实施
- dev-reload L_HMR level
- dev-server 增量 payload 推送
- materialize 增量化
- fallback L1 机制
- 行为 0：one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿
- 持久发现回流 architecture-notes
- STATUS / 导航一致
- **H4 不阻塞伞 close**——编译侧 HMR 完成，runtime 激活外部时序
