# Requirements — fe-tools-hmr-compiler

Status: **draft（2026-10-09）**

## 问题陈述

增量链 G1-G5+IRC+SMPU complete 后，watch 路径已增量编译（state reuse + cache + invalidatedModules 端到端链全通）。**但 dev server 仍全量 reload**——`preview-adapter.notifyBuildPublished()` → 客户端全页刷新，未消费 per-module 增量结果。

HMR（Hot Module Replacement）需要编译侧 4 件事：
1. 单模块 recompile（load/compile 分离）
2. graph 派生 emit 集（deriveFromGraph 接线）
3. Packer shape 实体化（registry 替代 legacy compile-target）
4. 增量 payload 推送（per-module HMR push）

**当前编译侧 4 缺口**：
- `compile-target` 混 load（graph building）与 compile（per-module）→ HMR 无法单模块 recompile
- `deriveFromGraph`（`convergence.ts:6`）定义未调，production emit 走 `emitBuckets`（legacy）
- `orchestrator:54` `emptyRegistry`（loader/compile/emit 全 stub）→ Packer shape 未实体化
- `runtime.ts` postMessage 全量 payload，dev server 不消费增量

## Goal

编译侧 HMR——4 子门交付（H1 load/compile 分离 → H2 deriveFromGraph 接线 → H3 registry 实体化 → H4 per-module HMR push），使 dev server 增量推送（非全量 reload）。

## Requirements

### R-HMR-1（MUST）— load/compile 分离
compile-target 拆 load（graph building：storeInfo + reconcile）与 compile（per-module：parse-walk + transform），使 HMR 能单模块 recompile（不重 load 全图）。

### R-HMR-2（MUST）— deriveFromGraph 接线
production emit 路径从 `emitBuckets`（legacy aggregated）改 `deriveFromGraph`（graph→cache→EmitModule 派生），使 emit 集 = graph 派生（非手动 bucket）。

### R-HMR-3（MUST）— registry 实体化
`orchestrator:54` `emptyRegistry`（loader/compile/emit 全 stub）→ 实体化 Loader/Compiler/Emitter registry，替代 legacy compile-target 路径。Packer shape（types.ts）激活。

### R-HMR-4（MUST）— per-module HMR push
`runtime.ts` postMessage 从全量 payload 改增量 payload（per-module）；dev server（preview-adapter）消费增量结果推送（非全量 reload）。

### R-HMR-5（MUST）— 行为 0
各子门 production 重构不破 baseline——one-shot 6 项目 diff=0 不变；watch 路径字节恒等延续（SMPU 后 production == verify baseline）。

### R-HMR-6（SHOULD）— 目录 cycle 消解
load/compile 分离自然消解目录边界缺口：
- ① core⇄packer（env.ts god module——storeInfo/load 迁出后 env.ts 反向 import 消解）
- ② pipeline⇄domain（emit.ts 归位——domain 不再向上 import pipeline）
- ③ model→pipeline（stage/emit 概念随 registry 实体化归位）

## Constraints

- **W3 决策延续**：env.ts 不整体拆（packer-research W3）——load/compile 分离通过迁移 storeInfo/load 到 model/packer，env.ts 自然消解（非显式拆 env.ts）
- **行为 0 三件套**：vitest 全绿 + tsc 0 errors + 全量 examples diff=0（各子门均须过）
- **HMR 边界**：one-shot 路径不变（D-OS-1「单次 build 不传 state」延续）；watch 路径渐进启用 HMR
- **runtime 协议**：H4 per-module push 需 runtime HMR API 对齐（运行时侧——非本伞实施，但 H4 依赖协议定义）

## Non-scope

- **runtime HMR API**（mini-program 运行时 partial update——运行时侧，需产品/运行时团队）
- **整包 Packer extraction**（packer-research 已否决）
- 改 view/style 车道业务语义
- 复活 incremental-unify deferred scope（A-IU-1..5 已 complete via G4/G5）
- dev server WebSocket 协议重写（H4 消费增量，不重写传输层）

## 依赖

- 增量链 G1-G5+IRC+SMPU（complete）——HMR 基础设施
- Packer shape（types.ts + convergence.ts + session-state.ts）——target 架构已定义
- runtime HMR API（运行时侧）——H4 per-module push 的协议依赖
