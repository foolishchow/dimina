# Implementation Plan — fe-tools-fingerprints-persist

Status: **complete（2026-10-07）** — 未授 `in_progress` 不改 `src`。

约束：D-FP-1..8；行为 0；不改 fingerprint.ts 逻辑；不改 build()/orchestrate() 传参（D-OR-6/8）；watch-runner 内部可改（D-FP-8）；不加 any。

## Steps

| # | Task | Status |
|---|---|---|
| 0 | 立项 `draft` + review | **done** |
| 1 | 升 `ready` | **done** |
| 2 | `session-state.ts`：add `fingerprints: Map<string, FileFP>`（D-FP-1） | **done** |
| 3 | `fingerprint.ts`：export `fingerprintFile`（D-FP-2） | **done** |
| 4 | `watch-plan.ts`：`prevFingerprints` param + early fingerprint + content-hash filter + all returns updated fingerprints（D-FP-3..7） | **done** |
| 5 | `watch-runner.ts`：pass `prevFingerprints` + persist `plan.fingerprints`（D-FP-8） | **done** |
| 6 | `watch-scheduler.spec.js`：真实文件 dedup 测试（F1 fix） | **done** |
| 7 | P-FP* / A-FP*；回流 architecture-notes；close 另授 | **done** |
