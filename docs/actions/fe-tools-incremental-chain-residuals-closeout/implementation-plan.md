# Implementation Plan — fe-tools-incremental-chain-residuals-closeout

Status: **draft（2026-10-09）**

> 前置：无 readiness blocker（设计已明确）。draft → review → ready → 实施。

## Step 1 — 准备

- [ ] 确认 G5 complete（cache-hit 算法 + 字段就位）
- [ ] 确认 residuals tracker R1..R9 状态（open）

## Step 2 — 生产代码

| 文件 | 改动 | residual | 状态 |
|---|---|---|---|
| `watch-runner.ts` | `:90` 后加 `if (!sessionState.viewCache) sessionState.viewCache = new Map()` + `styleCache` 同（D-IRC-1） | R1 | pending |
| `view/index.ts` | viewCompile 返回 shape 处加注释（viewCompileResults vestigial-but-intentional，HMR-future dirty signal，D-IRC-2） | R7 | pending |
| `view/index.ts`（SHOULD） | compileML `ensureWxsScan` 移入 `hasMiss` 条件分支（D-IRC-3；非平凡则降级） | R9 | pending |
| `docs/fe-tools/README.md` | packer-context 等状态标注与 STATUS.md 对齐 | R4 | pending |
| architecture-notes + IRC docs | 记录 R1 接线修正 G5 A-G51 叙事超前（**G5 归档不重写**，immutable） | R-IRC-8 | pending |

**不改**：`index.ts:38` / `build-pipeline.ts:23`（one-shot 创建点保持 undefined→no-op→diff=0）。

## Step 3 — 测试

| 文件 | 改动 | residual | 状态 |
|---|---|---|---|
| `view-style-cache-skip.spec.js` 集成 ① | 加 `pages_home_index.css` build1==build2 字节恒等断言（D-IRC R6） | R6 | pending |
| `view-style-cache-skip.spec.js` integration `afterEach` | 加 `delete process.env.DIMINA_COMPILER_DIFF_VERIFY`（D-IRC R8） | R8 | pending |
| 新增 R1 接线回归测 | 注入 `state: new PackerSessionState()` + mock build → watch-runner R1 接线赋 `viewCache`/`styleCache` → 断言 `state.viewCache` 是 `Map` instance（非 undefined）+ `styleCache` 同（D-IRC-5，不手建 Map） | R1 | pending |

## Step 4 — 验证（P-IRC-1..N）

- [ ] P-IRC-1 代码审阅（watch-runner 接线 + one-shot 不动 + 注释 + doc 对齐）
- [ ] P-IRC-2 R1 接线回归测 pass（注入 state + mock build，不手建 Map）
- [ ] P-IRC-3 行为 0 one-shot diff=0（6 项目，R1 接线后不变）
- [ ] P-IRC-4 tsc 0 errors + vitest 全绿（含 R6/R8 修正 + R1 回归测）
- [ ] P-IRC-5 V-PC-5（changed files 0 `as any` / 0 索引签名）
- [ ] P-IRC-6 既有 committed 集成测（state reuse + cache-hit）仍 pass（R1 接线不改字节恒等）
- [ ] P-IRC-7 residual tracker R1/R6/R7/R8/R4/R9 标 `fixed`（R9 若降级则 Non-acceptance）

## Step 5 — 回流

- [ ] architecture-notes：IRC 条目（R1 接线闭合 + residual closeout）
- [ ] IRC docs 记录 R1 修正 G5 A-G51 叙事超前（G5 归档不重写）

## Step 6 — 归档（Close workflow）

- [ ] mv → `_archive/complete/fe-tools-incremental-chain-residuals-closeout/`
- [ ] 相对链接修复
- [ ] 6 docs Status → complete；STATUS.md/TODO.md 更新；validator 0/0

## 依赖

- G5 ✅ complete（cache-hit 算法 + 字段）
- 三轮回顾 ✅（residual tracker R1..R9 + X1）
