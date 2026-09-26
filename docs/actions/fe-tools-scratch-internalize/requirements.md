# Requirements — fe-tools-scratch-internalize

Status authority: [Action Status](../STATUS.md)

## Problem

mkdtemp（TEMP 目录原子分配）是 Output 的 I/O 职责，却由 storeInfo 链路（`env-compute.computePathInfo`，L1 计算）承载——概念错位。storeInfo/graph bootstrap 不应关心 TEMP 目录创建。storeInfo 塌缩 + env-l1 均记录 backflow：scratch 内化推迟。

## Requirements

### R-SI-1 — BaseOutput 构造 mkdtemp（MUST）

`BaseOutput`（output.ts）构造时 `mkdtemp` → `scratch: string` 属性（dev/disk 共用）。mkdtemp 原子分配保证并行构建不冲突（复刻 computePathInfo 的 mkdtemp 语义）。

- `BaseOutput.scratch: string`（readonly，构造时设）
- `MemOutput` / `DiskOutput` 继承（构造调 super 或 BaseOutput mkdtemp）
- **dev 模式**（MemOutput）：scratch 仍创建（config-compiler/npm-builder 写 scratch——dev 临时盘；若 audit 证 dev 不须则 MemOutput 跳过——readiness gap 1）

### R-SI-2 — orchestrator 投影 state.scratch（MUST）

`orchestrator.ts` L166 创建 output 后设 `state.scratch = output.scratch`（投影——consumer 不改读源，仍读 state.scratch）。

- orchestrator L166 后：`state.scratch = output.scratch`（或 BaseOutput getter）
- **state 创建时序**：state 是 orchestrate 入参（caller 建）——orchestrator 收 state 后设 state.scratch（output 创建后）
- dev 模式：output 是 MemOutput，state.scratch = MemOutput.scratch（若 dev 须 scratch）

### R-SI-3 — computeStoreInfo/storeInfoCtx 去 mkdtemp（MUST）

`env-compute.computeStoreInfo` 去 mkdtemp（pathInfo 只 workPath，不 targetPath）+ `storeInfoCtx` 不设 state.scratch（由 orchestrator 预设 = output.scratch）。

- `computeStoreInfo` 返回 pathInfo 只含 workPath（targetPath 不算——orchestrate 链路用 output.scratch）
- `storeInfoCtx(ctx, graph, state)`：不调 computePathInfo mkdtemp；state.scratch 由 orchestrator 预设（不覆盖）
- **graph.build** 仍用 ctx.workPath（不读 targetPath——实证 graph.ts:69）

### R-SI-4 — storeInfo compat wrapper 保留 mkdtemp（MUST）

`env.ts storeInfo(workPath, options)` compat wrapper 保留 mkdtemp（测试 fixture backflow——compile-cli-cache.spec:141 测 mkdtemp 唯一性依赖）。

- storeInfo wrapper 自己 mkdtemp（非 computeStoreInfo——去 mkdtemp 后 wrapper 须补）
- storeInfo wrapper 返回 pathInfo.targetPath（compat 保留——测试 fixture 不变）
- **compat 写保留**（backflow，阶段 3 退役）

### R-SI-5 — 行为 0（MUST）

tsc 0 + vitest 88/88 + one-shot 7-diff=0。mkdtemp 全局路径→全量 7 项目 diff。

### R-SI-6 — Non-scope 守（MUST）

- compat 写不动（storeInfo wrapper 保留 compat 写 + mkdtemp）
- L2/L3 不动（getters/resetStoreInfo/singleton/Proxy 保留）
- compiler/* 不动（parse-walk 仍读 ALS getters）
- consumer 读源不改（config-compiler/npm-builder/dist-preparer/publisher 仍读 state.scratch——投影保持）
- PackerContext 构造 dedup 不处理
- dev 模式 Output 形态不改（MemOutput publish no-op 保留——仅 scratch 创建源改）

## Constraints

- 行为 0 原则：所有重构保持字节完全相同的输出
- 行为 0 全量验证：mkdtemp 全局路径 → 全量 7 项目 diff（含 air-battle）
- tsc：`node ./node_modules/typescript/bin/tsc --noEmit`
- pnpm：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs exec vitest run`
- no any / no `[key: string]: unknown`
- Node ESM 后缀必须

## Non-scope

详见 [README](README.md) Non-goals。

## backflow（内化后记录）

- 阶段 3（L2+L3 退役）：compiler/* 加 PackerContext + worker 模型调整 + singleton/getters/Proxy/resetStoreInfo 全删
- PackerContext 构造 dedup（buildPackerContext/buildFixpointCtx/toPackerContext 三同质）
- compat 写保留（storeInfo wrapper mkdtemp + compat 写——阶段 3 退役）
