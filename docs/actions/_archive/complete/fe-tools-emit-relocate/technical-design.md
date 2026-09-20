# Technical Design — fe-tools-emit-relocate

Status: **complete（2026-09-20）** — D-ER-0..7 全冻结。

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

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

其中循环里的 `root` 来自 `Object.entries(pages.subPages)` 的 **key** = `transSubDir(...)`（如 `sub_pkgA`），不是 app.json 的 `pkgA`。

返回的 `allCompileRes = [...mainCompileRes, ...allSubCompileRes]` 是 flat 的——分组信息只在 `writeCompileRes` 调用时存在。（且今日对 `mainCompileRes` 有循环前早快照问题：sub 中 `putMain` 追加进 main 的模块会进最终 `writeCompileRes(main)`，却可能不在返回的 `allCompileRes` 里——本 Action 用 `emitBuckets` + 循环后拼 `compileRes` 一并修掉。）

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

- `strategy.apply` 产出 `EmitEntry`（perModule 路径会调 `getWorkPath()`，非无上下文纯函数）
- `sink.write` 是 streaming 出口

## §1 目标架构

### §1.1 worker 只 compile（保留分桶，不 emit）

```text
worker (logicCompile):
  mainCompileRes = compileJS(mainPages, null, null)
  subs = []
  for (const [root, subPages] of Object.entries(pages.subPages)):
    // root = pages.subPages key = transSubDir 形（如 sub_pkgA），非 app.json subPackages.root
    subCompileRes = compileJS(subPages.info, root, independent ? [] : mainCompileRes)
    // ↑ putMain 仍可能向 mainCompileRes 追加（共享模块）
    subs.push({ root, modules: subCompileRes })
    // 不再 writeCompileRes
  compileRes = [...mainCompileRes, ...subs.flatMap(s => s.modules)]  // 循环后拼；勿早快照
  // compile() 返回值（runtime Object.assign 进 success message）：
  return {
    emitBuckets: { main: mainCompileRes, subs },  // 与今日 writeCompileRes 输入同形
    compileRes,                                   // M2 cache
    logicDependencies,
  }
  // dependencyGraph / compatibilityWarnings 仍只由 logicSuccessPayload 提供（不进 compile return）
```

### §1.2 主线程编排（按桶发，不重归属）

```text
main (build-pipeline, worker 返回后):
  1. update cache + merge graph（用 compileRes；须含最终 main）  ← M2 已有
  2. 读 ctx.emitBuckets（或 result.emitBuckets）
  3. 按今日 writeCompileRes 顺序发 emit-worker:
     // 先各 sub（与 pages.subPages 遍历序一致）
     for (const { root, modules } of emitBuckets.subs) {
       executeTask({ engine: emitEngine, input: {
         entryId: 'logic:' + root,
         kind: 'logic',
         modules: modules.map(m => ({
           moduleId: m.path, code: m.code, map: m.map || null, extraInfoCode: m.extraInfoCode
         })),
         transform: {
           strategy: 'perModule',
           minify: ctx.compileConfig.minify,
           target: ctx.compileConfig.esTarget.logic,
           platform: 'neutral',
         },
         sourcemap: !!ctx.sourcemap,
         sourcemapTargetPath: ctx.sourcemapTargetPath,
         filename: 'logic',
         relPrefix: root,
         storeInfo: ctx.storeInfo,
       }}) → { entry } → BuildModel.add(entry)
     }
     // 再 main（含 sub 编译中 putMain 追加的模块）
     executeTask({ engine: emitEngine, input: {
       entryId: 'logic',
       kind: 'logic',
       modules: emitBuckets.main.map(...同形...),
       transform: { ...同上... },
       sourcemap: !!ctx.sourcemap,
       sourcemapTargetPath: ctx.sourcemapTargetPath,
       filename: 'logic',
       relPrefix: 'main',
       storeInfo: ctx.storeInfo,
     }}) → { entry } → BuildModel.add(entry)
  4. materialize
```

**分组正确性论证（F-ER-21）**：今日 emit 输入是 `writeCompileRes(mainCompileRes|subCompileRes, root)` 的**编译期桶**，不是 flat `allCompileRes` 的事后归属。`putMain` 只在 DFS 内决定推进哪个数组；跨分包组件 path 属 `pkgB` 却可能落在编 `pkgA` 时的 `subCompileRes`——path-prefix 重归属会错桶。早快照 `allCompileRes = [...mainCompileRes]` 还会漏掉 sub 循环中 `putMain` 追加进 main 的模块。故 D-ER-3 = **原样返回桶**；禁止 path-prefix / closure 重归属。**`root` 必须原样保留 `pages.subPages` key**（`transSubDir` 形）；若改成 app.json `subPackages.root`，`entryId`/`relPrefix`/产物路径会与今日不一致（F-ER-24）。

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
(3.5) logic emit：按 emitBuckets 发 emit-worker → BuildModel.add   ← 新增步骤
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
| `compiler/logic/index.ts` | 删 `writeCompileRes` 函数（L45-58）+ 调用（L678,680）；删 `sourcemapTargetPath` 模块变量（L25）；删 `import { emitEntry }`（L17）；`logicBuildConfig` 可简化；返回 `emitBuckets` + 循环**后**拼的 `compileRes`（修早快照漏 `putMain`）；worker 不再 emit |
| `pipeline/emit.ts` | 拆 `produceEntry(params) → EmitEntry`（无 sink，`strategy.apply` 提取；须上下文）+ `emitEntry(params)`（produce + sink，兼容 view/style streaming） |
| `pipeline/emit-engine.ts`（新增） | `defineEngine` 定义 emit-engine：compile 调 `resetStoreInfo` + `produceEntry` 返回 `{ entry }`；`buildConfig: () => ({})`；`successPayload: () => ({})` |
| `pipeline/emit-worker-entry.ts`（新增） | `runWorker(emitEngine)` |
| `compiler/worker-runtime/executor.ts` | 泛化 `executeTask`：`pages` 变可选；`ENTRY_PATH` 加 `'emit'`；resolve 透传 payload（strip protocol fields） |
| `pipeline/stage-channel.ts` | 存 `result.emitBuckets` 到 `ctx`（供 3.5）；`compileRes` 仍供 M2 cache；logic 阶段 `onOutput` **可留可去**（打破 streaming 后 `outputCount=0`，mismatch 检查仅在有 `onOutput` 时生效） |
| `pipeline/build-pipeline.ts` | 新增 (3.5) logic emit task（按桶发 emit-worker → BuildModel.add）；compile task 存 `compileConfig`/`sourcemap`/`sourcemapTargetPath` 到 `ctx`；logic 的 `BuildModel.add` 改由 3.5 完成（不再依赖 compile 阶段 streaming `onOutput`） |
| `compiler/core/env.ts` | 不变（emit 桶自带 `root`；无需主线程再查 subPackages 做归属） |
| `model/dependency-graph.ts` | 不变（`getDependencyClosure` 已在 MC3a 交付；本门不消费） |
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

// 无 sink：提取 strategy.apply（非「纯」——perModule 调 getWorkPath）
// emit-worker 须先调 resetStoreInfo 搭建上下文（见 §3.5）。
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

- emit 桶 = 今日 `writeCompileRes` 输入数组（最终 main + 各 sub）；桶内顺序 = DFS 推进顺序
- 发射顺序 = 今日：先各 sub，再 main
- `emitEntry` perModule 策略不变：modDefine + sourcemap rebase + mergeSourcemap + esbuild minify 逻辑全不动
- `produceEntry` = `strategy.apply` 提取（须 `resetStoreInfo`——见 TD §3.5）
- **禁止** path-prefix / closure 对 flat 列表重归属（F-ER-21）
- 唯一变化：调用位置从 compile-worker 内 `writeCompileRes` 搬到主线程按桶调 emit-worker

## §5 分组方案沿革（非 getDependencyClosure）

~~曾议 MC3a `getDependencyClosure` 接入 production 分组。~~  
~~F-ER-7：改 path-prefix（误称「精确匹配 putMain」）。~~

**F-ER-21**：path-prefix / closure 均 ≠ 今日 `writeCompileRes` 分桶。定稿 **结构化 `emitBuckets`**（D-ER-3）。`getDependencyClosure` / `deriveFromGraph` 仍不接入；保留供未来 HMR / config-only rebuild。

## 待定议题

无。D-ER-0..7 全冻结。
