# FE Tools Packer Orchestrator

- Action: `fe-tools-packer-orchestrator`
- Status: `complete`
- Updated: 2026-09-22
- Status authority: [Action Status](../../../STATUS.md)
- 前置：[`fe-tools-orchestrator-state`](../fe-tools-orchestrator-state/README.md)（**complete**；`PackerSessionState`）
- 前置：[`fe-tools-packer-core-shape`](../fe-tools-packer-core-shape/README.md)（**complete**；`PackerOrchestrator` interface §8）
- 相关 deferred：[`fe-tools-incremental-unify`](../../deferred/fe-tools-incremental-unify/README.md)（本门 complete 后可重评估）
- 文档集：[README](README.md) · [requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

形状契约已定义 **PackerOrchestrator** 为唯一主动组件（D-PCS-5/8/9），且 session 已有 `PackerSessionState`。真实开车曾散落在 `build-pipeline` / `stage-channel` / watch / `runOnce`，无单一 `orchestrate`。

## Goal（已交付）

主编排与图·cache **写权**收敛为 **`PackerOrchestrator.orchestrate(...)`**：双端同一实现；过程体迁入 orch；公开 `build` 仅适配器；返回 buildResult（D-OR-7）。

## 设计决策（冻结）

| ID | 决策 |
| --- | --- |
| D-OR-0 | **B** 编排归位 + 写权 |
| D-OR-1 | CLI/`runOnce` + watch 双端 `orchestrate` |
| D-OR-2 | 硬编码三车道（registry stub） |
| D-OR-3 | 不升级增量（≠ incremental-unify） |
| D-OR-4 | 单次 state 短命；持久化另门 |
| D-OR-5 | **P2** pipeline 过程体迁入 orch；`build-pipeline` 死 shim |
| D-OR-6 | Options M1（含 `skipMaterialize`）；无 dependencyGraph/cache 入 options |
| D-OR-7 | 返回 buildResult；`EmitEntry[]` 另门 |
| D-OR-8 | 装配边界：ALS 在 orch；store/lifecycle/`useAppIdDir` 经内部调用面 |

## 交付物

- `fe/tools/bundler/src/packer/orchestrator.ts` — `createPackerOrchestrator` / `orchestrate`
- `src/index.ts` — 入口适配
- `watch-runner` / `watch-plan` — 经 orch；停传 cache/快照
- `build-pipeline.ts` — 死 shim
- `packer/types.ts` — `OrchestrateOptions` 扩展

## 闭合证据

- A-OR1..9 / P-OR01..09 **全 pass**（见 [acceptance](acceptance.md) · [validation](validation.md)）
- `tsc --noEmit` 0；vitest 绿（`compile-cli-cache` flaky 单跑 pass）
- examples **diff=0**（HEAD baseline vs orch，6 apps，`diff -rq` 0）

## Non-goals（仍另门）

- incremental-unify；单次/Session 持久 state；`EmitEntry[]` 返回收敛；真 registry；MC3c；PackerContext 路 2

## Closure

- 终端状态：`complete`（2026-09-22）
- 归档：`docs/actions/_archive/complete/fe-tools-packer-orchestrator/`
