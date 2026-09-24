# Requirements — fe-tools-hmr-emit-derive

Status: **complete（2026-10-09）**

## 问题陈述

HMR-compiler 伞 H1。orchestrator Logic emit task（`orchestrator.ts:266-296`）当前读 `ctx.emitBuckets`（logic worker 全量输出 main + subs buckets）→ emit-engine 全量 re-emit。HMR 需增量 emit（只 emit 受影响 modules）。

`deriveFromGraph`（`convergence.ts:6`）已定义（graph→cache→EmitModule 派生，只读），但未接线。

**核心挑战**（D-ED-1）：deriveFromGraph 是 **per-entry**（`getDependencyClosure(entryId)` → 单 entry 的依赖闭包），emitBuckets 是 **per-bucket**（main = 所有主包页 modules；subs = 分包根下 modules）。entry 映射非 trivial——main bucket ≠ 单 entry 闭包。

## Goal

orchestrator Logic emit task 改调 `deriveFromGraph`（非 `emitBuckets`），使 emit 集 = graph 派生。行为 0（one-shot diff=0）。

## Requirements

### R-ED-1（MUST）— deriveFromGraph 接线
orchestrator Logic emit task 改调 `deriveFromGraph(graph, cache, entryId)`（非读 `ctx.emitBuckets`）。emit 集 = graph 派生。

### R-ED-2（MUST）— entry 映射
deriveFromGraph per-entry → emitBuckets per-bucket 映射冻结（D-ED-1）：
- main bucket（entryId='logic', relPrefix='main'）= app + 主包页 union 闭包
- subs bucket（entryId='logic:'+root, relPrefix=root）= 分包 root 下页 union 闭包
- 序保一致（派生序 == emitBuckets 序，行为 0 前提）

### R-ED-3（MUST）— 行为 0
one-shot 6 项目 production 路径 diff=0 对 baseline（deriveFromGraph 派生 == emitBuckets 输出字节一致）+ tsc 0 + vitest 全绿。

### R-ED-4（MUST）— logic-only
view/style emit 不动（已 per-page in-domain via emitEntry/emitStyle，不经 emitBuckets）。H1 只改 orchestrator Logic emit task。

### R-ED-5（SHOULD）— emitBuckets 移除
验证字节一致后移除 emitBuckets（D-ED-2 锁后定策略 A/B）。

## Constraints

- **logic-only**：deriveFromGraph 仅派生 logic EmitModule[]（convergence.ts:12 自述"非 logic 不在 ModuleResultCache"）
- **行为 0 三件套**：vitest 全绿 + tsc 0 + 6 项目 diff=0
- **graph/cache 只读**：deriveFromGraph 不改 graph/cache（convergence.ts 注释自述）
- **emit-engine/produceEntry 不变**：仅改调用方 orchestrator（input modules 来源变，emit 逻辑不变）

## Non-scope

- view/style emit（H1 不动——已 per-page in-domain）
- per-module HMR push（H4）
- registry 实体化（H2）
- per-module view/style cache（H3）
- 改 emit-engine / produceEntry 内部
- 改 logic worker（logicCompile 仍可返 emitBuckets 作 fallback，D-ED-2 锁后定）

## 依赖

- 增量链 G1-G5+IRC+SMPU complete（cache + graph 就绪）
- `deriveFromGraph`（convergence.ts:6，定义未调）
- `ModuleResultCache`（logic worker 已 fill，buildJSByPath cache.set）
- HMR-compiler 伞 `ready`（D-HMR-1 子门顺序冻）
