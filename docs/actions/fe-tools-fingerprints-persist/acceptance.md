# Acceptance — fe-tools-fingerprints-persist

Status: **draft（2026-10-07）** — A-FP1..4 pending。

| ID | Req | Criterion | Validation | Status |
|---|---|---|---|---|
| A-FP1 | R-FP-1 | `PackerSessionState` 有 `fingerprints: Map<string, FileFP>` 字段；`watch-runner` 每次 rebuild 后 `sessionState.fingerprints = plan.fingerprints` | P-FP01 | pending |
| A-FP2 | R-FP-2 | `createWatchBuildPlan` 接收 `prevFingerprints`；tracked 文件 content hash 未变 → 从 `actuallyChanged` 过滤；`actuallyChanged` 用于 closure/stages/prepareNpm；真实文件 dedup 测试通过（mtime-only → skip；content change → incremental） | P-FP02 | pending |
| A-FP3 | R-FP-3 | 首次 build 修正后与修正前全量 7 项目 diff=0 | P-FP03 | pending |
| A-FP4 | R-FP-4 | vitest 全绿（回归） | P-FP04 | pending |

## Non-acceptance

- `PackerSessionState` 无 `fingerprints` 字段
- `createWatchBuildPlan` 不接收 `prevFingerprints`
- `fingerprintFile` 未 export
- 首次 build diff≠0
- vitest 回归失败
