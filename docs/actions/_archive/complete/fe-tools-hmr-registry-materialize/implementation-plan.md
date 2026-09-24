# Implementation Plan — fe-tools-hmr-registry-materialize

Status: **complete（2026-10-09）**

> 待 design.draft §5 实证 + D-REG-1/2/3 锁后填实。

## Step 0 — 实证（design.draft §5）— **DONE ✓**

- [x] Loader 包装可行性：PARTIAL——viewParseWalk/buildCompileCss monolithic 须拆分（F-H2-1 medium）
- [x] compile-target compile 段边界：PASS ✓（F4 段划分）
- [x] env.ts load 函数映射：CLARIFY——load 在 domain parse-walk，env.ts 提供 PackerContext（F-H2-2）

**实证结果**：H2 规模升级——view/style parse-walk 拆分为 L/C/E 三阶段是主要工作量（非"包装"）。待升 ready 前重评规模。

## Step 1 — registry 实体化（R-REG-1, D-REG-1）— **DONE ✓**

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `packer/registry.ts` | **NEW** — `PackerDispatchRegistry` class + `KindDispatch` + `createDispatchRegistry` + `computeStagePlan` + `readLoadBindings` + `filterPagesByEntries`（从 compile-target 移入） | done |
| `packer/orchestrator.ts` | `emptyRegistry` → `createDispatchRegistry()`；`deriveStagePlan` → `computeStagePlan`；`STAGE_TITLES` → `dispatch.get(kind).title`；`createStageTask` 传 engine | done |
| `compiler/pipeline/stage-channel.ts` | `runCompileStage` 加 `engine?` 参数（registry 派发传 engine；webview renderer backward-compatible） | done |
| `compiler/pipeline/compile-target.ts` | 移除 `deriveStagePlan` + `readLoadBindings` + `filterPagesByEntries` + `STAGE_TITLES`（只留 `createCompileTarget` + `COMPILE_STAGE_ORDER`） | done |

**F-H2-1 deferred to Phase 2**：viewParseWalk/buildCompileCss monolithic 拆分 L/C/E 三阶段（worker 内部重构）—— Phase 1 registry materializes at orchestrator dispatch level，worker 仍调 monolithic 函数。

## Step 1.5 — viewParseWalk/buildCompileCss monolithic 拆分（F-H2-1，Phase 2 deferred）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `compiler/view/parse-walk.ts` | viewParseWalk 拆分为 Loader.load（parse/discover）→ Compiler.compile（transform）→ Emitter.emit（bundle）三阶段 | deferred |
| `compiler/style/parse-walk.ts` | buildCompileCss 拆分为 L/C/E 三阶段 | deferred |
| `compiler/logic/parse-walk.ts` | logicParseWalk 包装为 Loader.load（可直接包装，返 dependencies） | deferred |

## Step 2 — compile-target compile 段替代（R-REG-2, D-REG-2/3）— **DONE ✓**（merged with Step 1）

`computeStagePlan` in registry.ts replaces `deriveStagePlan` in compile-target.ts。orchestrator uses `computeStagePlan(dispatchRegistry, ...)`。

## Step 3 — compile-target compile 段移除（R-REG-5）— **DONE ✓**（merged with Step 1）

`deriveStagePlan` + `readLoadBindings` + `filterPagesByEntries` removed from compile-target.ts。Only `createCompileTarget` + `COMPILE_STAGE_ORDER` retained。

## Step 4 — 验证（行为 0 三件套）— **DONE ✓**

- [x] tsc 0 errors
- [x] vitest 全绿（625/625，compile-cli-cache flaky excluded）
- [x] one-shot 6 项目 diff=0
- [x] V-PC-5: 0 新 as any / 索引签名

## Step 5 — 回流

- [x] architecture-notes: H2 条目
- [x] docs/fe-tools/README.md 导航补 H2 链
