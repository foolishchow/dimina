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
    const store = abilityContext.getStore() as { sink?: { write: (e: unknown) => void } } | undefined
    const { sink } = store ?? {}
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
  2. 从 getAppConfigInfo().subPackages 取 subpackage roots
  3. path-prefix 分组（精确匹配 putMain 语义）:
     const subPkgs = getAppConfigInfo().subPackages ?? []   // [{ root: 'pkgA' }, ...]
     const mainCompileRes = []
     const subCompileRes = {}   // { 'sub_pkgA': [...], ... }
     for (const m of allCompileRes) {                        // 遍历保序
       let owner = null                                      // 默认 main
       for (const sub of subPkgs) {
         if (m.path.startsWith(sub.root + '/')) {
           // transSubDir 是 env.ts 私有函数，内联：sub_${root.replace(/\/$/, '')}
           owner = `sub_${sub.root.replace(/\/$/, '')}`
           break
         }
       }
       if (owner === null) mainCompileRes.push(m)
       else (subCompileRes[owner] ??= []).push(m)
     }
  4. 逐组发 emit-worker:
     // main 组
     executeTask({ engine: emitEngine, input: {
       entryId: 'logic',
       kind: 'logic',
       modules: mainCompileRes.map(m => ({
         moduleId: m.path, code: m.code, map: m.map || null, extraInfoCode: m.extraInfoCode
       })),
       transform: {
         strategy: 'perModule',
         minify: compileConfig.minify,               // 从 options.compileConfig 取
         target: compileConfig.esTarget.logic,
         platform: 'neutral',
       },
       sourcemap: !!options.sourcemap,               // 从 options.sourcemap 取
       sourcemapTargetPath: options.sourcemapTargetPath,
       filename: 'logic',
       relPrefix: 'main',
       storeInfo: ctx.storeInfo,                      // 上下文（供 resetStoreInfo）
     }}) → { entry } → BuildModel.add(entry)
     // sub 组（同结构，entryId: 'logic:'+root, relPrefix: root）
  5. materialize
```

**分组正确性论证**：`putMain` 逻辑（`logic/index.ts:221-261`）的判定标准是 module path 是否属于某个 subpackage root（`normalizedPath.startsWith(subPackage.root + '/')`）。path-prefix 分组用完全相同的判定，因此分组结果与 `putMain` 一致。closure 分组不可用——闭包是可达性分组，会把共享模块放入多个组（`putMain` 只放 main）。

### §1.3 emit 步骤在 build-pipeline 的位置

当前 build-pipeline 流程：
```text
(1) 收集配置信息 → storeInfo + BuildModel
(2) 准备产物目录 → createDist
(3) 并发编译（view + logic + style，streaming emit 在此）
(4) 写入编译产物 → materialize + publish
```

打破 streaming 后，logic emit 须在 (3) 之后、(4) 之前：
```text
(1) 收集配置信息
(2) 准备产物目录
(3) 并发编译（view + style 仍 streaming；logic 不 streaming）
(3.5) logic emit：分组 → emit-worker → BuildModel.add   ← 新增步骤
(4) 写入编译产物 → materialize + publish
```

(3.5) 可以是 (3) 的子任务（编译完成后自动接 emit），也可以是独立 task。实施时选独立 task 更清晰（与 (4) 分离）。

### §1.4 emit-worker

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
| `pipeline/emit-engine.ts`（新增） | `defineEngine` 定义 emit-engine：compile 调 `resetStoreInfo` + `produceEntry` 返回 `{ entry }`；`buildConfig: () => ({})`（compile 不用 config）；`successPayload: () => ({})`（无 graph） |
| `pipeline/emit-worker-entry.ts`（新增） | `runWorker(emitEngine)` |
| `compiler/worker-runtime/executor.ts` | 泛化 `executeTask`：`pages` 变可选；`ENTRY_PATH` 加 `'emit'`；resolve 透传 payload（strip protocol fields `success`/`type`/`completedTasks`/`outputCount`） |
| `pipeline/stage-channel.ts` | `runCompileStage` 存 `result.compileRes` 到 `ctx.logicCompileRes`（供 3.5 task 分组） |
| `pipeline/build-pipeline.ts` | 新增 (3.5) logic emit task（分组 → emit-worker → BuildModel.add）；compile task 存 `compileConfig`/`sourcemap`/`sourcemapTargetPath` 到 `ctx`（供 3.5 task 取用）；worker 返回后编排 |
| `compiler/core/env.ts` | `getPages()` 等 API 供主线程取 page 列表 + packageRoot |
| `model/dependency-graph.ts` | 不变（`getDependencyClosure` 已在 MC3a 交付） |
| `model/convergence.ts` | 不变（`deriveFromGraph` 不接入——deferred） |

## §3 emit-engine 设计（D-ER-4/5/6 冻结）

### §3.1 emit-engine

见 §3.5（含 `resetStoreInfo` 上下文搭建）。

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
// 注：script cast 类型也须扩 'emit'
const script = engine.name as 'view' | 'logic' | 'style' | 'emit'

// 2. input.pages 变可选
interface ExecuteTaskInput {
    pages?: { mainPages: Record<string, unknown>[] }  // 可选
    stageTimeoutMs?: number
    [key: string]: unknown
}
const totalTasks = input.pages ? Object.keys(input.pages.mainPages).length : 0

// 3. resolve 透传 payload（strip protocol fields）
//    guards 保留：isResolved + onOutput mismatch check 不变
if (message.success) {
    if (isResolved) return                                    // ← 保留
    if (onOutput && message.outputCount !== receivedOutputCount) {  // ← 保留
        await terminateWorker(); reject(new Error(`...`)); return
    }
    isResolved = true; await terminateWorker()
    const { success, type, completedTasks, outputCount, ...payload } = message
    resolve(payload)  // 透传，现有 caller 解构自己需要的
}
```

向后兼容：现有 compile-worker 传 `pages`，emit-worker 不传。现有 caller 解构 `{ dependencyGraph, compileRes, logicDependencies }`，多余字段无害。

### §3.4 emitEntry 拆分（D-ER-5）

```ts
// pipeline/emit.ts

// 纯函数：提取 strategy.apply
// 注：perModule 策略的 sourcemap rebase 路径调 getWorkPath()（L142），
// 需编译器上下文。emit-worker 须先调 resetStoreInfo 搭建上下文（见 §3.5）。
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

### §3.5 emit-worker 上下文搭建（D-ER-6 补充）

`produceEntry` 的 perModule 策略 sourcemap rebase 路径调 `getWorkPath()`（`emit.ts:142`），
需编译器上下文（`pathInfo.workPath`）。

compile-worker（logic/view/style）的 `compile` 函数先调 `resetStoreInfo(msg.storeInfo)` 搭建上下文。
emit-worker 同理：emit params 须带 `storeInfo`，emit-engine 的 `compile` 先调 `resetStoreInfo`。

```ts
// pipeline/emit-engine.ts（新增）
import { defineEngine } from '../worker-runtime/define-engine.ts'
import { resetStoreInfo } from '../core/env.ts'
import { produceEntry } from './emit.ts'
import type { EmitEntryParams } from './emit.ts'

export const emitEngine = defineEngine({
    name: 'emit',
    buildConfig: () => ({}),  // compile 不用 config
    compile: async ({ msg }) => {
        const params = msg as EmitEntryParams & { storeInfo: Parameters<typeof resetStoreInfo>[0] }
        resetStoreInfo(params.storeInfo)  // 搭建上下文（getWorkPath 等可用）
        const { storeInfo: _, ...emitParams } = params
        const entry = await produceEntry(emitParams as EmitEntryParams)
        return { entry }
    },
    successPayload: () => ({}),
    cleanup: () => {},
})
```

主线程发 emit-worker 时，msg 须含 `storeInfo`（从 `ctx.storeInfo` 取）+ emit params（`entryId`/`modules`/`transform`/`sourcemap`/...）。

## §4 行为 0 守卫

- `compileRes` 顺序不变：path-prefix 分组遍历 `allCompileRes` 逐模块归类，不改变模块间顺序；组内顺序 = 编译顺序
- `emitEntry` perModule 策略不变：modDefine + sourcemap rebase + mergeSourcemap + esbuild minify 逻辑全不动
- `produceEntry` = `strategy.apply` 提取，逻辑不变（注：perModule 策略 sourcemap rebase 调 `getWorkPath()`，emit-worker 须 `resetStoreInfo` 搭建上下文——见 TD §3.5）
- 分组精确匹配 `putMain`：path-prefix 归属（非 closure 可达性），共享模块只入 main，跨分包模块只入所属分包
- 唯一变化：调用位置从 worker 搬到 emit-worker（同一段代码，不同 worker）

## §5 getDependencyClosure 消费者

~~MC3a 交付的 `getDependencyClosure(entryId)` 在本 Action 中首次接入 production。~~

**修订（F-ER-7）**：本 Action 不再消费 `getDependencyClosure`——分组改用 path-prefix（精确匹配 `putMain` 语义，closure 是可达性分组会导致共享/跨分包模块重复入组 → 行为 0 破坏）。`getDependencyClosure` 仍由 MC3a 交付，保留供未来 HMR / config-only rebuild 场景使用。

`deriveFromGraph` 仍不接入（code 来自 `compileRes` 不是 cache）。

## 待定议题

无。D-ER-0..7 全冻结。
