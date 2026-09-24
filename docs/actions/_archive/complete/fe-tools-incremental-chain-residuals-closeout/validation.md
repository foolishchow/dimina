# Validation — fe-tools-incremental-chain-residuals-closeout

Status: **complete（2026-10-09）**

## 验证方法

| ID | 方法 | check | evidence |
|---|---|---|---|
| P-IRC1 | 代码审阅 | ① `watch-runner.ts:91-93` 实例化 view/style cache（D-IRC-1）② one-shot 创建点（`index.ts:38`/`build-pipeline.ts:23`）保持 undefined ③ viewCompileResults 注释更新（D-IRC-2，:172）④ `docs/fe-tools/README.md` 导航补全 ⑤ R9 hasMiss 条件化 | ✅ 审阅过 |
| P-IRC2 | R1 接线回归测 | 注入 `state: new PackerSessionState()` + mock build → watch-runner R1 接线赋值 → `state.viewCache` 是 `Map` instance（非 undefined）+ `styleCache` 同（不手建 Map） | ✅ `watch-runner.spec.js` D-IRC-5 测 pass |
| P-IRC3 | 行为 0 one-shot diff | one-shot build 6 项目 diff=0（R1 接线后 one-shot 仍 undefined→no-op→全量；R9 hasMiss=true→ensureWxsScan 仍运行，不变） | ✅ `/tmp/verify-irc-behavior0.mjs` 6 项目 diff=0 |
| P-IRC4 | tsc + vitest | tsc 0 errors；vitest 全绿（含 R6 `.css` 断言 + R8 env reset + R1 回归测） | ✅ tsc 0；vitest 84 files / 626 tests（compile-cli-cache flaky 单跑 pass） |
| P-IRC5 | V-PC-5 类型约束 | changed files 无 `as any`/`@ts-nocheck`/`[key: string]: unknown` 新增 | ✅ watch-runner.ts 3→3 pre-existing（buildResult 断言）；view/index.ts 0→0；IRC 0 新 violation |
| P-IRC6 | watch 字节恒等（既有覆盖） | R1 接线不改字节恒等（cache 启用后 cached code/map = 全量结果）——既有 committed 集成测（`view-style-cache-skip.spec.js` integration，state reuse + cache-hit）仍 pass 即足；不另起真实 watcher 集成 | 既有集成测 pass |
| P-IRC7 | residual tracker 状态 | R1/R6/R7/R8/R4/R9 标 `fixed`（R9 条件化实施，未降级）；R3/R5/X1 标 open；R2 标 downgraded | ✅ tracker 更新 |

## 流程

1. R1 接线（watch-runner 实例化）
2. R6/R7/R8/R4/R9 实施（R9 SHOULD，可降级）
3. R1 接线回归测（注入 state + mock build，不手建 Map）
4. vitest 全量 + tsc
5. one-shot 6 项目 diff=0（baseline `git stash`）
6. 既有 committed 集成测仍 pass（state reuse + cache-hit 字节恒等）
7. V-PC-5 grep
8. residual tracker 状态更新
9. 回写 G5 文档 + architecture-notes

## 行为 0 边界

- **one-shot**：R1 仅改 watch-runner，one-shot 创建点不动 → undefined → no-op → 全量 → diff=0（不变）
- **watch**：cache 启用 → 效能提升；产物字节恒等（cached code/map = 全量结果，emitEntry 确定性）——既有集成测覆盖
