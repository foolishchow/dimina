# Validation — fe-tools-fingerprints-persist

Status: **draft（2026-10-07）**

## Checkpoints

| ID | Check | Method | Req | Status |
|---|---|---|---|---|
| P-FP01 | fingerprints 持久化 | 审阅代码：`PackerSessionState.fingerprints` 字段；`watch-runner` pass + persist | R-FP-1 / A-FP1 | pending |
| P-FP02 | content-based dedup | 审阅代码：`createWatchBuildPlan` 接收 `prevFingerprints`；`fingerprintFile` 过滤 false positives；`actuallyChanged` 用于下游 | R-FP-2 / A-FP2 | pending |
| P-FP03 | 首次 build 行为 0 | `DIMINA_COMPILER_DIFF_VERIFY=1`；全量 7 项目 diff=0（stash baseline vs new） | R-FP-3 / A-FP3 | pending |
| P-FP04 | vitest 回归 | vitest 全绿（回归）；tsc 0 | R-FP-4 / A-FP4 | pending |

## Type constraints (V-PC-5)

- `fingerprintFile` export：0 new `any` / `as any` / `@ts-nocheck` / `[key: string]`
- `PackerSessionState.fingerprints`：`Map<string, FileFP>` — 无索引签名
- `createWatchBuildPlan` param：`prevFingerprints?: Map<string, FileFP>` — optional，clean

## Actual log

| Date | Entry |
|---|---|
| 2026-10-07 | 立项 `draft`。 |
