# Technical Design — fe-tools-emit-relocate

Status: **ready（2026-09-21）** — D-ER-0..7 全冻结。

权威参考：[Experience-Review.md](../../Experience-Review.md)

## §0 当前架构

### §0.1 emit 在 worker 内（streaming）

```text
worker (logicCompile):
  compileJS(pages) → CompileInfo[]
  writeCompileRes(compileRes, root):
    compileRes.map → EmitModule[]
    emitEntry({ entryId: 'logic' / 'logic:root', modules, transform: { strategy: 'perModule', ... }, ... }):
      strategy.apply → EmitEntry
      sink.write(entry) → postMessage({ type: 'output', entry }) → main: BuildModel.add
  return { compileRes, logicDependencies, dependencyGraph }
```

- `writeCompileRes` 在 `logicCompile` 内调（L676-678）
- `emitEntry` 在 `pipeline/emit.ts`，perModule 策略：sourcemap rebase + mergeSourcemap / esbuild minify / modDefine 拼接
- `emitEntry` 末尾 `sink.write(entry)` = streaming（worker 期间发，返回前）

### §0.2 分组

`logicCompile` 分别调：
- `writeCompileRes(mainCompileRes, null)` → `entryId: 'logic'`, `relPrefix: 'main'`
- `writeCompileRes(subCompileRes, root)` → `entryId: 'logic:'+root`, `relPrefix: root`

返回的 `allCompileRes = [...mainCompileRes, ...allSubCompileRes]` 是 flat 的——分组信息只在 `writeCompileRes` 调用时存在。

### §0.3 emitEntry 结构

```ts
export async function emitEntry(params: EmitEntryParams) {
    const strategy = strategies[params.transform.strategy]  // 'perModule' | 'bundle'
    const { entry } = await strategy.apply(params)           // → EmitEntry
    const { sink } = abilityContext.getStore() ?? {}
    sink?.write(entry)                                        // streaming
}
```

- `strategy.apply` 是纯函数（输入 params → 输出 EmitEntry）
- `sink.write` 是 streaming 出口

## §1 目标架构

### §1.1 worker 只 compile

```text
worker (logicCompile):
  compileJS(pages) → CompileInfo[]
  return { compileRes, logicDependencies, dependencyGraph }  ← 不调 writeCompileRes
```

### §1.2 主线程编排

```text
main (build-pipeline, worker 返回后):
  1. update cache + merge graph                    ← M2 已有
  2. 从 storeInfo 取 page 列表
  3. 分组:
     for each mainPage: graph.getDependencyClosure(pageId) → IDs
     合并 → mainIDSet
     allCompileRes.filter(m => mainIDSet.has(m.path)) → mainCompileRes（保序）
     for each subRoot:
       for each subPage in root: getDependencyClosure → IDs
       合并 → subIDSet[root]
       allCompileRes.filter(m => subIDSet[root].has(m.path)) → subCompileRes[root]
  4. 逐组发 emit-worker:
     emit-worker.send({ entryId: 'logic', modules: mainCompileRes.map(toEmitModule), transform, ... })
     emit-worker.send({ entryId: 'logic:'+root, modules: subCompileRes[root].map(...), ... })
  5. 收 EmitEntry → BuildModel.add
  6. materialize
```

### §1.3 emit-worker

```text
emit-worker:
  receive { entryId, kind, modules: [EmitModule], transform, sourcemap, ... }
  → produceEntry(params) → EmitEntry
  → postMessage(EmitEntry)
  main: BuildModel.add(EmitEntry)
```

## §2 接口表

| 组件 | 变更 |
| --- | --- |
| `compiler/logic/index.ts` | 删 `writeCompileRes` 调用（L676-678）；worker 不再 emit |
| `pipeline/emit.ts` | 拆 `produceEntry(params) → EmitEntry`（纯函数，`strategy.apply` 提取）+ `emitEntry(params)`（produce + sink，兼容 view/style streaming） |
| `pipeline/emit-engine.ts`（新增） | `defineEngine` 定义 emit-engine：compile 调 `produceEntry` 返回 `{ entry }` |
| `pipeline/emit-worker-entry.ts`（新增） | `runWorker(emitEngine)` |
| `compiler/worker-runtime/executor.ts` | 泛化 `executeTask`：`pages` 变可选；`ENTRY_PATH` 加 `'emit'`；resolve 透传 payload（strip protocol fields `success`/`type`/`completedTasks`/`outputCount`） |
| `pipeline/build-pipeline.ts` | worker 返回后：分组 → 发 emit-worker → 收 EmitEntry → BuildModel.add |
| `compiler/core/env.ts` | `getPages()` 等 API 供主线程取 page 列表 + packageRoot |
| `model/dependency-graph.ts` | 不变（`getDependencyClosure` 已在 MC3a 交付） |
| `model/convergence.ts` | 不变（`deriveFromGraph` 不接入——deferred） |

## §3 emit-engine 设计（D-ER-4/5/6 冻结）

### §3.1 emit-engine

```ts
// pipeline/emit-engine.ts（新增）
import { defineEngine } from '../worker-runtime/define-engine.ts'
import { produceEntry } from './emit.ts'

export const emitEngine = defineEngine({
    name: 'emit',
    buildConfig: (msg) => ({ ...msg }),  // 透传
    compile: async ({ msg }) => {
        const params = msg as EmitEntryParams
        const entry = await produceEntry(params)  // 纯函数 → EmitEntry
        return { entry }  // 通过 compileResult 返回
    },
    successPayload: () => ({}),  // 无 graph
    cleanup: () => {},
})
```

### §3.2 emit-worker-entry

```ts
// pipeline/emit-worker-entry.ts（新增）
import { emitEngine } from './emit-engine.ts'
import { runWorker } from '../worker-runtime/runtime.ts'
runWorker(emitEngine)
```

### §3.3 executeTask 泛化（D-ER-7）

```ts
// compiler/worker-runtime/executor.ts

// 1. ENTRY_PATH 加 'emit'
const ENTRY_PATH = { ..., emit: `../pipeline/emit-worker-entry${WORKER_EXT}` }

// 2. input.pages 变可选
interface ExecuteTaskInput {
    pages?: { mainPages: Record<string, unknown>[] }  // 可选
    stageTimeoutMs?: number
    [key: string]: unknown
}
const totalTasks = input.pages ? Object.keys(input.pages.mainPages).length : 0

// 3. resolve 透传 payload（strip protocol fields）
if (message.success) {
    const { success, type, completedTasks, outputCount, ...payload } = message
    resolve(payload)  // 透传，现有 caller 解构自己需要的
}
```

向后兼容：现有 compile-worker 传 `pages`，emit-worker 不传。现有 caller 解构 `{ dependencyGraph, compileRes, logicDependencies }`，多余字段无害。

### §3.4 emitEntry 拆分（D-ER-5）

```ts
// pipeline/emit.ts

// 纯函数：提取 strategy.apply
export async function produceEntry(params: EmitEntryParams): Promise<EmitEntry> {
    const strategy = strategies[params.transform.strategy as keyof typeof strategies]
    if (!strategy) throw new Error(`produceEntry: 未知 transform 策略 ${params.transform.strategy}`)
    const { entry } = await strategy.apply(params)
    return entry
}

// 兼容 wrapper：produce + sink（view/style 仍用）
export async function emitEntry(params: EmitEntryParams) {
    const entry = await produceEntry(params)
    const store = abilityContext.getStore() as { sink?: { write: (e: unknown) => void } } | undefined
    store?.sink?.write(entry)
}
```

## §4 行为 0 守卫

- `compileRes` 顺序不变：`filter` 只筛不改序，组内顺序 = 编译顺序
- `emitEntry` perModule 策略不变：modDefine + sourcemap rebase + mergeSourcemap + esbuild minify 逻辑全不动
- `produceEntry` = `strategy.apply` 提取，逻辑不变
- 唯一变化：调用位置从 worker 搬到 emit-worker（同一段代码，不同 worker）

## §4 getDependencyClosure 消费者

MC3a 交付的 `getDependencyClosure(entryId)` 在本 Action 中首次接入 production：
- 主线程分组用它遍历 page closure → 收集 module IDs → 分组 compileRes
- `deriveFromGraph` 仍不接入（code 来自 `compileRes` 不是 cache）

## 待定议题

无。D-ER-0..7 全冻结。
