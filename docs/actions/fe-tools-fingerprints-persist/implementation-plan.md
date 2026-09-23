# Implementation Plan — fe-tools-fingerprints-persist

Status: **draft（2026-10-07）** — 未授 `in_progress` 不改 `src`。

约束：D-FP-1..8；行为 0；不改 fingerprint.ts 逻辑；不改 watch-runner 传参；不加 any。

## Steps

| # | Task | Status |
|---|---|---|
| 0 | 立项 `draft` + review | **done** |
| 1 | 升 `ready`（另授） | pending |
| 2 | `session-state.ts`：add `fingerprints: Map<string, FileFP>`（D-FP-1） | pending |
| 3 | `fingerprint.ts`：export `fingerprintFile`（D-FP-2） | pending |
| 4 | `watch-plan.ts`：`prevFingerprints` param + early fingerprint + content-hash filter + all returns updated fingerprints（D-FP-3..7） | pending |
| 5 | `watch-runner.ts`：pass `prevFingerprints` + persist `plan.fingerprints`（D-FP-8） | pending |
| 6 | P-FP* / A-FP*；回流 architecture-notes；close 另授 | pending |
