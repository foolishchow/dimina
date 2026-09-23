# Technical Design — fe-tools-fingerprints-persist

Status: **draft（2026-10-07）**

权威参考：[Experience-Review.md](../../Experience-Review.md) · [graph-persist](../_archive/complete/fe-tools-graph-persist/README.md) · [orchestrator-state](../_archive/complete/fe-tools-orchestrator-state/README.md)

## §1 现状

### 1.1 PackerSessionState（session-state.ts）

```typescript
export class PackerSessionState {
    readonly graph: PackerGraph = new PackerGraph()
    readonly moduleCache: ModuleResultCache = new ModuleResultCache()
    invalidatedModules: Set<string> = new Set()
}
```

无 `fingerprints` 字段。

### 1.2 fingerprint.ts

```typescript
export interface FileFP { missing?: boolean; mtimeMs?: number; ctimeMs?: number; size?: number; hash?: string }
function fingerprintFile(filePath: string, prev?: FileFP): FileFP | null { ... }  // 未 export
export function scanFingerprints(...)  // export
export function computeEntryInputHash(...)  // export
```

`fingerprintFile` 未 export——仅被 `scanFingerprints` 内部调用。

### 1.3 watch-plan.ts createWatchBuildPlan

```typescript
function createWatchBuildPlan({ changedFiles, dependencyGraph, workPath: _workPath, publishedPath }) {
    // ...
    return { ..., fingerprints: new Map() }  // 空 Map，不使用
}
```

`workPath` 前缀 `_`（未使用）。JSDoc 声明 `prevFingerprints` 但签名无此参数。

### 1.4 watch-runner.ts rebuild

```typescript
const plan = createWatchBuildPlan({
    changedFiles: change.changedFiles,
    dependencyGraph: sessionState.graph,
    workPath,
    publishedPath,
})
if (plan.skip) { return }
// plan.fingerprints 未使用
```

## §2 Design

### D-FP-1: PackerSessionState add fingerprints

```typescript
import type { FileFP } from '../model/fingerprint.ts'

export class PackerSessionState {
    readonly graph: PackerGraph = new PackerGraph()
    readonly moduleCache: ModuleResultCache = new ModuleResultCache()
    fingerprints: Map<string, FileFP> = new Map()  // non-readonly（每次 rebuild 重新赋值，同 invalidatedModules）
    invalidatedModules: Set<string> = new Set()
}
```

`non-readonly`——`watch-runner` 每次 rebuild 重新赋值 `sessionState.fingerprints = plan.fingerprints`。与 `invalidatedModules` 一致。

### D-FP-2: fingerprint.ts export fingerprintFile

```typescript
export function fingerprintFile(filePath: string, prev?: FileFP): FileFP | null { ... }
```

仅加 `export` 关键字。函数逻辑不变。

**注意（F4）**：`model/compile-cache.ts` 存在同名 `fingerprintFile`，但契约不同（返回 `{ missing: true }` 而非 `null`；含 ctimeMs 预筛；全 64 hex；用于 npm 依赖缓存）。本 Action 只用 `model/fingerprint.ts` 的实现，两者不混用。

### D-FP-3: createWatchBuildPlan add prevFingerprints param + use workPath

```typescript
function createWatchBuildPlan({
    changedFiles, dependencyGraph, workPath, publishedPath, prevFingerprints,
}: {
    changedFiles: string[]
    dependencyGraph: { ... }
    workPath: string
    publishedPath: string
    prevFingerprints?: Map<string, FileFP>
}) {
    const fingerprints = new Map(prevFingerprints ?? [])
    // ...
}
```

`workPath` 去掉 `_` 前缀——用于 `path.relative(workPath, absPath)` 计算 relPath。

### D-FP-4: Early fingerprint all changedFiles

在 `changedFiles.length === 0` 检查之后、json 检查之前：

```typescript
// G2: fingerprint all changedFiles (for all return paths)
for (const absPath of changedFiles) {
    const relPath = path.relative(workPath, absPath).split(path.sep).join('/')
    const prev = prevFingerprints?.get(relPath)
    const fp = fingerprintFile(absPath, prev)
    if (fp === null) {
        fingerprints.delete(relPath)  // 文件删除
    } else {
        fingerprints.set(relPath, fp)
    }
}
```

早指纹保证：所有 return 路径（json 全量、untracked 全量、incremental）都返回更新后的 `fingerprints`。

### D-FP-5: Filter tracked by content hash

在 untracked 检查之后、closure 之前：

```typescript
const actuallyChanged: string[] = []
for (const absPath of tracked) {
    const relPath = path.relative(workPath, absPath).split(path.sep).join('/')
    const fp = fingerprints.get(relPath)  // 已在 D-FP-4 计算
    const prev = prevFingerprints?.get(relPath)
    if (fp === undefined) {
        // fingerprintFile 返回 null（文件删除）→ 保留
        actuallyChanged.push(absPath)
    } else if (prev && prev.hash === fp.hash) {
        // content 未变 → false positive，跳过
    } else {
        // 新文件或 content 变了 → 保留
        actuallyChanged.push(absPath)
    }
}

if (actuallyChanged.length === 0) {
    return { skip: true, incremental: false, configChanged: false, options: {}, fingerprints }
}
```

### D-FP-6: All returns return updated fingerprints

所有 return 路径返回 `fingerprints`（而非 `new Map()`）：

| 路径 | return fingerprints |
|---|---|
| empty changedFiles | `new Map(prevFingerprints ?? [])`（未指纹，原样返回） |
| json 全量 | `fingerprints`（已更新） |
| untracked 全量 | `fingerprints`（已更新） |
| tracked=0 skip | `fingerprints`（已更新） |
| actuallyChanged=0 skip | `fingerprints`（已更新） |
| affectedEntries=0 skip | `fingerprints`（已更新） |
| stages=0 全量 | `fingerprints`（已更新） |
| incremental | `fingerprints`（已更新） |

### D-FP-7: Use actuallyChanged for all downstream

```typescript
const affectedSet = computeAffectedEntries(dependencyGraph, actuallyChanged)  // 非 tracked
const invalidatedModules = computeInvalidatedModules(dependencyGraph, actuallyChanged)  // 非 tracked
const stages = computeStagesForFiles(dependencyGraph, actuallyChanged)  // 非 tracked
prepareNpm: actuallyChanged.some((abs) => isNpmPackageFile(abs))  // 非 changedFiles
```

### D-FP-8: watch-runner pass + persist

```typescript
const plan = createWatchBuildPlan({
    changedFiles: change.changedFiles,
    dependencyGraph: sessionState.graph,
    workPath,
    publishedPath,
    prevFingerprints: sessionState.fingerprints,  // NEW
})
sessionState.fingerprints = plan.fingerprints  // NEW: persist（even on skip）
if (plan.skip) { return }
```

在 `plan.skip` 检查之前 persist——即使 skip，fingerprints 也已更新（false positive 文件的 mtime/size 已刷新）。

## §3 Behavior-0 分析

### 3.1 首次 build

无 watch → 不走 `createWatchBuildPlan` → 不受影响。diff=0。

### 3.2 Watch rebuild

- content-unchanged tracked files → 从 `actuallyChanged` 过滤 → closure 更小或 skip → 输出不变（content 没变 → rebuild 产出相同字节）
- content-changed files → 保留 → closure 正常 → rebuild 正常

### 3.3 vitest 回归

- `watch-scheduler.spec.js`：fake paths（`/project/...`）→ `fingerprintFile` statSync 抛 → null → 所有文件保留 → 行为不变。`fingerprints` 返回 empty Map → `expect.anything()` 匹配。
- `watch-runner.spec.js` D-OS-3：mock state 无 `fingerprints` → `undefined` → empty Map → 同上。

### 3.4 新增真实文件 dedup 测试（F1 fix）

`watch-scheduler.spec.js` 加一个真实文件用例（`fs.mkdtempSync` + `fs.writeFileSync` + `fs.utimesSync`）：

1. **首次 plan**（新文件，无 prev）→ `fingerprintFile` 返回 hash → `prev` undefined → 保留 → `incremental: true`
2. **mtime-only**（`utimesSync` 改 mtime +10s，内容不变）→ `fingerprintFile` 重算 hash（相同）→ `prev.hash === fp.hash` → 过滤 → `skip: true`
3. **内容修改**（`writeFileSync` 改内容）→ `fingerprintFile` 重算 hash（不同）→ 保留 → `incremental: true`

锁住 D-FP-5 的 content-hash 过滤分支（fake paths 测试走不到该分支）。

## §4 验收映射

| Design | Requirement | Acceptance |
|---|---|---|
| D-FP-1 PackerSessionState add fingerprints | R-FP-1 | A-FP1 |
| D-FP-3+4+5 watch-plan content-based dedup | R-FP-2 | A-FP2 |
| D-FP-6+7 all returns + actuallyChanged | R-FP-2 | A-FP2 |
| D-FP-8 watch-runner pass + persist | R-FP-1 | A-FP1 |
| §3.1 首次 build 不受影响 | R-FP-3 | A-FP3 |
| §3.3 vitest 回归 | R-FP-4 | A-FP4 |

## §5 Readiness gaps

无。`fingerprintFile` + `FileFP` 已实现（D-BM-2）。G1（graph-persist）已完成。只需 wire up。
