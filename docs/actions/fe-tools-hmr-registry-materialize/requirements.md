# Requirements — fe-tools-hmr-registry-materialize

Status: **ready（2026-10-09）**

## 问题陈述

HMR-compiler 伞 H2。orchestrator `emptyRegistry`（stub）+ legacy `compile-target` 两段式仍是唯一 compile 入口。Packer shape `types.ts` 已定义 Loader/Compiler/Emitter 接口但未接线。H2 实体化 registry，使 compile 经 registry 派发。

## Goal

`emptyRegistry` → 实体 Loader/Compiler/Emitter registry。compile 路径经 registry 派发（非 compile-target 硬编码 stage）。

## Requirements

### R-REG-1（MUST）— registry 实体化
emptyRegistry → 实体 registry。Loader/Compiler/Emitter 按 kind 注册（logic/view/style/app/component）。orchestrator 经 registry.get(kind) 派发。

### R-REG-2（MUST）— compile-target compile 段替代
compile-target 的 compile 编排（deriveStagePlan stages + workerOptions）→ registry 派发（Loader.load → Compiler.compile → Emitter.emit）。

**⚠️ F-H2-1**：viewParseWalk/buildCompileCss 是 monolithic（parse+compile+emit 一函数）。registry 分离须拆分 monolithic 为 L/C/E 三阶段——非"包装现有路径"。view/style 拆分是主要工作量。

### R-REG-3（MUST）— 行为 0
one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿。

### R-REG-4（MUST）— env.ts gradual migration
load 函数 → Loader registry（gradual，非 big-bang split）。env.ts 薄壳继续瘦身（W3 一致）。

### R-REG-5（SHOULD）— compile-target 移除
验证字节一致后移除 compile-target compile 段（D-REG-1 锁后定策略）。

## Constraints

- **types.ts 接口不变**：Loader/Compiler/Emitter 形状已冻（D-PCS-5/7）
- **行为 0 三件套**：vitest + tsc + 6 项目 diff=0
- **W3 gradual**：env.ts 不整体拆（packer-research W3），gradual migration
- **compile-target 静态段保留**：createCompileTarget（Listr 前 fail-fast）可能保留（非 compile 段）

## Non-scope

- per-module view/style cache（H3）
- per-module HMR push（H4）
- types.ts 接口改
- env.ts big-bang split
- compile-target 静态段（createCompileTarget 可能保留）

## 依赖

- H1 `complete`（deriveFromGraph 接线——emit 已 graph 派生）
- Packer shape `types.ts` Loader/Compiler/Emitter（已定义）
- 增量链 G1-G5+IRC+SMPU complete
- HMR-compiler 伞 `ready`（D-HMR-1 子门顺序冻）
