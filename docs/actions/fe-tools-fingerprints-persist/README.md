# fe-tools-fingerprints-persist

- Status: `draft`
- Created: 2026-10-07
- ID: `fe-tools-fingerprints-persist`

## Problem

`watch-plan.ts` `createWatchBuildPlan` 每次返回 `fingerprints: new Map()`——不持久化、不使用。`fingerprint.ts` 已实现 `fingerprintFile`（mtime 预筛 + content hash 确认）但未导出、未接入 watch。后果：chokidar 事件是唯一触发器——文件 mtime 变了但内容没变时，触发不必要的 rebuild（false positive）。

## Goal

持久化 fingerprints 到 `PackerSessionState`，`createWatchBuildPlan` 接入 `fingerprintFile` 做 content-based dedup——mtime 变但 content hash 没变的文件从 `actuallyChanged` 中过滤掉。

## Deliverables

| # | File | Change |
|---|---|---|
| 1 | `src/packer/session-state.ts` | add `fingerprints: Map<string, FileFP>` field |
| 2 | `src/model/fingerprint.ts` | export `fingerprintFile` (currently not exported) |
| 3 | `src/watch/watch-plan.ts` | add `prevFingerprints` param; early fingerprint all `changedFiles`; filter tracked by content hash; all returns return updated `fingerprints` |
| 4 | `src/watch/watch-runner.ts` | pass `prevFingerprints: sessionState.fingerprints`; persist `sessionState.fingerprints = plan.fingerprints` |
| 5 | `__tests__/watch-scheduler.spec.js` | add real-file dedup test（temp file：首次 plan → incremental；`utimesSync` mtime-only → skip；内容修改 → incremental） |

## Dependencies

- [`fe-tools-graph-persist`](../_archive/complete/fe-tools-graph-persist/README.md)（**complete**；G1——storeInfo state 路径走 reconcile，graph 持久化）
- `fingerprint.ts`（existing——D-BM-2：`fingerprintFile` + `FileFP` 已实现）

## Non-goals

- 全量 scan（`scanFingerprints` 扫描所有 tracked files）——partial scan（event-triggered files only）已足够 dedup
- Entry 级 `inputHash`（`computeEntryInputHash`）——separate concern，future cache key
- 跨进程持久——fingerprints session-scoped（PackerSessionState），不序列化
- G3 `getInvalidatedModules` 泛化全 kind（另门）
- G4 view/style worker 返回 compileRes（另门）
- G5 view/style ModuleResultCache（= incremental-unify，等 G3+G4 完成后重激活）

## Constraints

- 行为 0 原则：首次 build 产物字节完全不变。
- 不改 `fingerprint.ts` 的 `fingerprintFile` / `scanFingerprints` 逻辑（已正确）。
- 不改 `build()`/`orchestrate()` 传参（D-OR-6/8 有意不传 dependencyGraph 快照）；watch-runner 内部 `createWatchBuildPlan` 调用可加 `prevFingerprints` + persist（D-FP-8）。
- 不加 `any` / `as any` / `@ts-nocheck` / `[key: string]`。

## Closure conditions

- A-FP1..4 全部 ✅；
- 首次 build diff=0；
- vitest 全绿（回归）；
- 回流 architecture-notes。

## References

- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-graph-persist`](../_archive/complete/fe-tools-graph-persist/README.md)（**complete**；G1）
- [Experience-Review.md](../../Experience-Review.md) §12 行为 0 全量验证
- [`fe-tools-orchestrator-state`](../_archive/complete/fe-tools-orchestrator-state/README.md)（PackerSessionState）
