# Implementation Plan — fe-tools-hmr-registry-materialize

Status: **ready（2026-10-09）**

> 待 design.draft §5 实证 + D-REG-1/2/3 锁后填实。

## Step 0 — 实证（design.draft §5）— **DONE ✓**

- [x] Loader 包装可行性：PARTIAL——viewParseWalk/buildCompileCss monolithic 须拆分（F-H2-1 medium）
- [x] compile-target compile 段边界：PASS ✓（F4 段划分）
- [x] env.ts load 函数映射：CLARIFY——load 在 domain parse-walk，env.ts 提供 PackerContext（F-H2-2）

**实证结果**：H2 规模升级——view/style parse-walk 拆分为 L/C/E 三阶段是主要工作量（非"包装"）。待升 ready 前重评规模。

## Step 1 — registry 实体化（R-REG-1, D-REG-1）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `packer/orchestrator.ts:54` | emptyRegistry → 实体 registry（Loader/Compiler/Emitter 注册） | pending |
| `packer/types.ts` | registry 实现（非接口——接口已冻） | pending |

## Step 1.5 — viewParseWalk/buildCompileCss monolithic 拆分（F-H2-1，L+主要工作量）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `compiler/view/parse-walk.ts` | viewParseWalk 拆分为 Loader.load（parse/discover）→ Compiler.compile（transform）→ Emitter.emit（bundle）三阶段 | pending |
| `compiler/style/parse-walk.ts` | buildCompileCss 拆分为 L/C/E 三阶段 | pending |
| `compiler/logic/parse-walk.ts` | logicParseWalk 包装为 Loader.load（可直接包装，返 dependencies） | pending |

## Step 2 — compile-target compile 段替代（R-REG-2, D-REG-2/3）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `compiler/pipeline/compile-target.ts` | deriveStagePlan compile 段 → registry 派发 | pending |
| `compiler/pipeline/stage-channel.ts` | runCompileStage → registry.get(kind).compile? | pending |
| `compiler/core/env.ts` | load 函数 → Loader registry（gradual） | pending |

## Step 3 — compile-target compile 段移除（R-REG-5）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `compiler/pipeline/compile-target.ts` | deriveStagePlan dead code 移除（静态段保留） | pending |

## Step 4 — 验证（行为 0 三件套）

- [ ] tsc 0 errors
- [ ] vitest 全绿
- [ ] one-shot 6 项目 diff=0
- [ ] V-PC-5: 0 新 as any / 索引签名

## Step 5 — 回流

- [ ] architecture-notes: H2 条目
- [ ] docs/fe-tools/README.md 导航补 H2 链
