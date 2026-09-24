# Validation — fe-tools-incremental-chain-residuals-closeout

Status: **draft（2026-10-09）**

## 验证方法

| ID | 方法 | check | evidence |
|---|---|---|---|
| P-IRC-1 | 代码审阅 | ① `watch-runner.ts:90` 后实例化 view/style cache（D-IRC-1）② one-shot 创建点（`index.ts:38`/`build-pipeline.ts:23`）保持 undefined ③ viewCompileResults 注释（D-IRC-2）④ `docs/fe-tools/README.md` 状态对齐 ⑤ `git diff` 范围 | 待审 |
| P-IRC-2 | R1 接线回归测 | 经 `createBuildWatcher`（不手建 Map）触发 initial build + rebuild → `sessionState.viewCache` 非空 + size>0 + 含 page bundle | 待测 |
| P-IRC-3 | 行为 0 one-shot diff | one-shot build 6 项目 diff=0（R1 接线后 one-shot 仍 undefined→no-op→全量；不变） | 待测 |
| P-IRC-4 | tsc + vitest | tsc 0 errors；vitest 全绿（含 R6 `.css` 断言 + R8 env reset + R1 回归测） | 待测 |
| P-IRC-5 | V-PC-5 类型约束 | changed files 无 `as any`/`@ts-nocheck`/`[key: string]: unknown` 新增 | 待测 |
| P-IRC-6 | watch 字节恒等 | 真实 watcher 路径 cache 启用 → rebuild 产物 view/style 字节一致（P-G506 式但经真实 watcher，不手建 Map） | 待测 |
| P-IRC-7 | residual tracker 状态 | R1/R6/R7/R8/R4/R9 标 `fixed`（R9 若降级 Non-acceptance）；R3/R5/X1/R2 标 wontfix/downgraded | 待更新 |

## 流程

1. R1 接线（watch-runner 实例化）
2. R6/R7/R8/R4/R9 实施（R9 SHOULD，可降级）
3. R1 真实 watcher 回归测（不手建 Map）
4. vitest 全量 + tsc
5. one-shot 6 项目 diff=0（baseline `git stash`）
6. watch 字节恒等集成测（真实 watcher）
7. V-PC-5 grep
8. residual tracker 状态更新
9. 回写 G5 文档 + architecture-notes

## 行为 0 边界

- **one-shot**：R1 仅改 watch-runner，one-shot 创建点不动 → undefined → no-op → 全量 → diff=0（不变）
- **watch**：cache 启用 → 效能提升；产物字节恒等（cached code/map = 全量结果，emitEntry 确定性）——真实 watcher 集成测验
