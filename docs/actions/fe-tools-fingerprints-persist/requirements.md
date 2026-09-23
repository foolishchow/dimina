# Requirements — fe-tools-fingerprints-persist

Status: **draft（2026-10-07）**

## Background

`watch-plan.ts` `createWatchBuildPlan` 的 JSDoc 声明了 `prevFingerprints` 参数，但实现中未接收、未使用。每次返回 `fingerprints: new Map()`——空 Map，不持久化。

`fingerprint.ts`（D-BM-2）已实现 `fingerprintFile(filePath, prev?)`：
- `fs.statSync` 获取 mtime + size
- mtime + size 均未变 → 返回 `prev`（跳过文件读取）
- 任一变化 → `computeFileHash` 重算 content hash
- 文件不存在 → 返回 `null`

但 `fingerprintFile` 未 export（仅 `scanFingerprints` 和 `computeEntryInputHash` export）。

`PackerSessionState`（D-OS-5）持有 `graph` + `moduleCache` + `invalidatedModules`，跨 rebuild 持久——但没有 `fingerprints` 字段。

## Problem

chokidar 'change' 事件只表示 mtime 变了。mtime 变了但内容没变（`touch`、git checkout 等）→ `createWatchBuildPlan` 仍把该文件加入 `tracked` → closure → 不必要的 rebuild。

## Requirements

### R-FP-1（MUST）— PackerSessionState 持久化 fingerprints

`PackerSessionState` 新增 `fingerprints: Map<string, FileFP>` 字段。跨 rebuild 持久（watch-runner 持有同一 `sessionState` 实例）。

### R-FP-2（MUST）— watch-plan content-based dedup

`createWatchBuildPlan` 接收 `prevFingerprints?: Map<string, FileFP>`。对每个 `changedFile`：
1. 计算 relPath（`path.relative(workPath, absPath)`，POSIX 归一化）
2. 调 `fingerprintFile(absPath, prev)` 获取新指纹
3. `null`（文件删除）→ 从 fingerprints 删除，保留在 `actuallyChanged`
4. `prev` 存在且 `prev.hash === fp.hash`（内容未变）→ 从 `actuallyChanged` 过滤掉（false positive）
5. 否则 → 更新 fingerprints，保留在 `actuallyChanged`

用 `actuallyChanged`（过滤后）做 closure（`computeAffectedEntries`、`computeInvalidatedModules`、`computeStagesForFiles`、`isNpmPackageFile`）。

### R-FP-3（MUST）— 首次 build 行为 0

首次 build（无 watch）不受影响。全量 7 项目 diff=0。

### R-FP-4（MUST）— vitest 全绿（回归）

`watch-scheduler.spec.js`：`createWatchBuildPlan` 用 fake paths（`/project/...`）→ `fingerprintFile` statSync 抛 → null → 所有文件保留在 `actuallyChanged` → 行为不变。
`watch-runner.spec.js`：D-OS-3 mock state 无 `fingerprints` → `undefined` → empty Map → 同上。

## Non-scope

- 全量 scan（`scanFingerprints` 扫描所有 tracked files）
- Entry 级 `inputHash`（`computeEntryInputHash`）
- 跨进程持久（fingerprints 不序列化）
- G3 `getInvalidatedModules` 泛化全 kind
- G4 view/style worker 返回 compileRes
- G5 view/style ModuleResultCache（incremental-unify）
