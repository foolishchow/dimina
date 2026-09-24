# Implementation Plan — fe-tools-view-style-cache-skip

Status: **ready（2026-10-09）**

> 前置：design gate RG5-1..4 review 解决（readiness）后方可升 `ready` + 实施。RG5-1（view cache-hit 递归 emit）= 核心 readiness blocker。

## Step 0 — design gate review（readiness）

- [ ] RG5-1 view cache-hit 递归 emit 语义拍板（F6 细化：allCached 预检 + ③ 降级 + ONE emitEntry；residual = graph/顺序一致性验证题）
- [ ] RG5-2 view dependencies:[] 决策（与 RG5-1 联动）
- [ ] RG5-3 style cache-hit per-page 拍板
- [ ] RG5-4 cache-hit 与 intra-build 协同拍板

## Step 1 — 准备

- [ ] 确认 G4 complete（数据源 + 写就位）
- [ ] 确认 G3 complete（getInvalidatedModules 全 kind——cache-hit invalidated 判定基础）

## Step 2 — 生产代码

| 文件 | 改动 | 估时 |
|---|---|---|
| `session-state.ts` | `PackerSessionState` 加 `viewCache`/`styleCache` bare Map 字段（D-G5-1） | 0.5h |
| `orchestrator.ts` | state→ctx plumbing 镜像 logic（:172/:182，D-G5-2） | 0.5h |
| `stage-channel.ts` | worker input viewCache/styleCache 快照（镜像 cache IIFE，D-G5-2） | 0.5h |
| `style/index.ts` | `compileSS` cache-hit skip per-page（RG5-3，D-G5-5）+ 收 viewCache/invalidated 参数 | 1h |
| `view/index.ts` | `compileML` cache-hit skip（RG5-1 决策后，D-G5-4）+ 收 viewCache/invalidated 参数 | 2h |

## Step 3 — 测试

- [ ] cache-hit 单测（mock ctx 注入：① cache-hit skip compile ② cache-miss 写 cache ③ no-op one-shot ④ logic 回归）
- [ ] view cache-hit 单测（F6：① allCached page+全 subs cached 无 invalidated → skip viewParseWalk ONE emitEntry ② sub invalidated → ③ 降级全量 recompile ③ F7 modules[] 顺序一致性）
- [ ] style cache-hit per-page 单测
- 估时 2h

## Step 4 — 验证（P-G501..506）

- [ ] P-G501..506 全过（tsc + vitest + 行为 0 全量 diff=0 + V-PC-5 + cache-hit 单测 + watch cache-hit byte-identity 集成）
- 估时 2h

## Step 5 — 回流

- [ ] architecture-notes：G5 条目（incremental-unify 闭合 + A-IU-3/4 落地 + 行为 0）
- 估时 0.5h

## Step 6 — 归档（Close workflow）

- [ ] mv → `_archive/complete/fe-tools-view-style-cache-skip/`
- [ ] 6 类相对链接修复（+2 层外部链接、兄弟链接变 `../`）
- [ ] 6 docs Status → complete；STATUS.md/TODO.md 更新；validator 0/0
- 估时 0.5h

## 依赖

- G4 ✅ complete（数据源 + 写就位——G5 接读 + skip）
- G3 ✅ complete（getInvalidatedModules 全 kind——invalidated 判定）
- G1 ✅ + G2 ✅（graph persist + fingerprints——watch 增量基础）
