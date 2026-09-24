# Implementation Plan — fe-tools-view-style-cache-skip

Status: **complete（2026-10-09）**

> 前置：design gate RG5-1..4 review 解决（readiness）后方可升 `ready` + 实施。RG5-1（view cache-hit 递归 emit）= 核心 readiness blocker。

## Step 0 — design gate review（readiness）

- [x] RG5-1 view cache-hit 递归 emit 语义拍板（**实施期 P-G506 反转**：F6 graph 重建→D-G5-4' per-page-bundle，存原序 bundle）
- [x] RG5-2 view dependencies:[] 决策（D-G5-4'：不消费，保持 placeholder）
- [x] RG5-3 style cache-hit per-page 拍板（D-G5-5）
- [x] RG5-4 cache-hit 与 intra-build 协同拍板

## Step 1 — 准备

- [x] 确认 G4 complete（数据源 + 写就位）
- [x] 确认 G3 complete（getInvalidatedModules 全 kind——cache-hit invalidated 判定基础）

## Step 2 — 生产代码

| 文件 | 改动 | 状态 |
|---|---|---|
| `session-state.ts` | `PackerSessionState` 加 `viewCache?: Map<string, ViewCompiledModule[]>`（per-page-bundle，D-G5-4'）+ `styleCache?: Map<string, StyleCompiledModule>`（bare，D-G5-1） | ✅ |
| `orchestrator.ts` | state→ctx plumbing 镜像 logic（:171/:181，D-G5-2） | ✅ |
| `stage-channel.ts` | worker input viewCache/styleCache 快照（`new Map(c)` 非 toJSON，F12，D-G5-2）+ view 写块改 per-page-bundle（D-G5-4'） | ✅ |
| `style/index.ts` | `compileSS` cache-hit skip per-page（D-G5-5）+ 收 styleCache/invalidated 参数 | ✅ |
| `view/index.ts` | `compileML` cache-hit skip per-page-bundle（D-G5-4'）+ 返 `{results, pageBundles}` + viewCompile 返 `{viewCompileResults, viewPageBundles}` | ✅ |

## Step 3 — 测试

- [x] cache-hit 单测（`view-style-cache-skip.spec.js` 6 tests：compileSS cache-hit/miss/no-cache + compileML per-page-bundle cache-hit/miss/no-cache）
- [x] view cache-hit 单测（per-page-bundle：① bundle cached 无 invalidated → skip viewParseWalk re-emit 原序 ② bundle invalidated → 全量 recompile ③ no-cache one-shot 全量）
- [x] style cache-hit per-page 单测
- [x] G4 test 同步更新（`view-style-compile-res.spec.js` ① per-page-bundle shape）
- vitest 84 files / 623 tests 全绿（compile-cli-cache flaky 单跑 pass）

## Step 4 — 验证（P-G501..506）

- [x] P-G501 code review（tsc 0 errors）
- [x] P-G502 cache-hit 单测（6 tests pass）
- [x] P-G503 one-shot diff=0（6 项目 build diff -r = 0，G5=G4 行为）
- [x] P-G504 tsc 0 + vitest 623/623 全绿
- [x] P-G505 V-PC-5（changed files 0 `as any` + 0 索引签名）
- [x] P-G506 watch cache-hit byte-identity：view 0 pages_* diff + style 0 .wxss diff（per-page-bundle 原序 re-emit）
  - **residual（out-of-scope，pre-existing）**：logic cache 7 logic.js diff + static-copy 22（invalidatedModules=[] 时 build-pipeline 跳静态拷贝）——G4 baseline 同样存在，需独立 Action（logic-cache-byte-identity + incremental-static-copy）

## Step 5 — 回流

- [x] architecture-notes：G5 条目（incremental-unify 闭合 + A-IU-3/4 落地 + 行为 0 + D-G5-4' per-page-bundle 实施期反转）
- 估时 0.5h

## Step 6 — 归档（Close workflow）

- [x] mv → `_archive/complete/fe-tools-view-style-cache-skip/`
- [x] 6 类相对链接修复（+2 层外部链接、兄弟链接变 `../`）
- [x] 6 docs Status → complete；STATUS.md/TODO.md 更新；validator 0/0

## 依赖

- G4 ✅ complete（数据源 + 写就位——G5 接读 + skip）
- G3 ✅ complete（getInvalidatedModules 全 kind——invalidated 判定）
- G1 ✅ + G2 ✅（graph persist + fingerprints——watch 增量基础）
