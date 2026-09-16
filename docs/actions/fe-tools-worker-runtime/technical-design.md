# Technical Design — fe-tools-worker-runtime

Status: **draft**

## Non-goals

详见 [README.md Non-goals](./README.md#non-goals)。本 Action 不做：pool/queue、memfs、transform 优化、cluster、行为改变、build-pipeline/build-model 改造。

## 局部边界

### worker-runtime（新收敛面，调度知识集中）

```
src/compiler/worker-runtime/
  ├ context.js        abilityContext（AsyncLocalStorage）
  ├ runtime.js        runWorker(engine) 调度骨架
  ├ executor.js       executeTask(...) 资源层接缝
  ├ sinks.js          PostMessageSink / FileSink（含 sink.count）
  ├ loggers.js        BufferingLogger / ConsoleLogger（含 flush）
  └ define-engine.js defineEngine(overrides) 默认工厂
```

### 业务层（纯化，零调度知识）

```
src/compiler/
  ├ view/index.js        compileML + export viewEngine
  ├ logic/index.js       compileJS + export logicEngine
  ├ style/index.js       compileSS + export styleEngine
  ├ pipeline/emit.js     emitEntry（async Promise<void>，内部 sink.write 从 getStore）
  ├ pipeline/output.js   删除（FileSink 实现在 worker-runtime/sinks.js；emitEntry 内部 sink.write 替代原 write）
  └ core/compatibility.js warnOnce 用 logger.warn（注入）+ warnedItems 模块级
  view/worker-entry.js   thin entry（2 行）
  logic/worker-entry.js  thin entry
  style/worker-entry.js  thin entry
```

## 接口

### defineEngine（D-WR-1）

```js
// worker-runtime/define-engine.js
import { getDependencyGraph } from '../../core/env.js'  // F26：successPayload 默认读 dependencyGraph（业务状态）

export function defineEngine(overrides) {
  return {
    buildConfig: msg => ({ sourcemap: !!msg.sourcemap, minify: msg.compileConfig?.minify !== false }),
    cleanup: () => {},
    successPayload: ({ logger }) => ({ dependencyGraph: getDependencyGraph().toJSON() }),  // F24/F27：收 ctx，默认含 dependencyGraph（不用 logger）
    normalizeError: e => ({ message: e.message, stack: e.stack, name: e.name }),
    ...overrides,  // 覆盖=替换；view/logic 覆盖 successPayload 时显式含 dependencyGraph + compatibilityWarnings
  }
}
```

**compile 钩子契约**（D-WR-2 + D-WR-3 + F23/F25 修正）：`compile({ msg, progress, config })` → `Promise<void>`——**不收 sink/logger 参数**（从 `abilityContext.getStore()` 拿）；收 `msg`（= input 完整，含 storeInfo/sourcemap/pages 供业务初始化）+ `{ progress, config }`（runtime 造）。compile 完全自管循环 + **内部做引擎特化业务初始化**（resetStoreInfo(msg.storeInfo) / setEnableSourcemap(msg.sourcemap) / sourcemapTargetPath / wxsScannedWorkPath / **activeCompileConfig = config**（view/logic 全局变量，compileML 读，F34）等，各引擎自管）；buildConfig 保持纯函数（返回 config 对象，无副作用）。

三引擎：
- `viewEngine = defineEngine({ compile, cleanup, successPayload })`（successPayload 覆盖：`({ logger }) => ({ dependencyGraph: getDependencyGraph().toJSON(), compatibilityWarnings: logger.flush() })`，显式含默认 + 追加）
- `logicEngine = defineEngine({ compile, cleanup, successPayload, buildConfig })`（buildConfig 多 sourcemapTargetPath；successPayload 同 view）
- `styleEngine = defineEngine({ compile, cleanup, normalizeError })`（normalizeError 追加 file/line/column/stage；successPayload 用默认，无 compatibilityWarnings）

### 能力注入（D-WR-3）

```js
// worker-runtime/context.js
import { AsyncLocalStorage } from 'node:async_hooks'
export const abilityContext = new AsyncLocalStorage()

// 收敛点拿能力
const { sink, logger } = abilityContext.getStore() ?? { logger: consoleFallback }
```

### sink / logger（D-WR-6 + D-WR-7）

```js
// worker-runtime/sinks.js
import fs from 'node:fs'
import path from 'node:path'
import { parentPort } from 'node:worker_threads'

class PostMessageSink {
  #count = 0
  constructor(parentPort) { this.parentPort = parentPort }
  write(entry) { this.parentPort.postMessage({ type: 'output', entry }); this.#count++ }
  get count() { return this.#count }
}
// F32：FileSink 照 output.write 直写路径搬家（behavior 0：字节一致）
class FileSink {
  #count = 0
  constructor(writeDir) { this.writeDir = writeDir }
  write(entry) {
    if (!fs.existsSync(this.writeDir)) fs.mkdirSync(this.writeDir, { recursive: true })
    for (const file of entry.files) fs.writeFileSync(path.join(this.writeDir, path.basename(file.path)), file.code)
    if (entry.sourcemaps) for (const sm of entry.sourcemaps) fs.writeFileSync(path.join(this.writeDir, path.basename(sm.path)), sm.map)
    this.#count++
  }
  get count() { return this.#count }
}

// worker-runtime/loggers.js
class BufferingLogger {
  #buffer = []
  warn(msg) { this.#buffer.push(msg) }
  flush() { const out = this.#buffer.slice(); this.#buffer.length = 0; return out }
}
class ConsoleLogger {
  warn(msg) { console.warn(msg) }
  flush() { return [] }
}
```

### executeTask（D-WR-9，资源层接缝）

**input 形状**（任务层契约，稳定）：`{ pages, storeInfo, sourcemap, compileConfig, sourcemapTargetPath }`——与现状 stage-channel 发给 worker 的消息同构（worker onMessage 解构字段）。executor 从 `input.pages.mainPages` 算 `totalTasks`（`Object.keys(input.pages.mainPages).length`，同现状 stage-channel L53），供 `onProgress(completed, total)` 的 total 参数。

```js
// worker-runtime/executor.js
// F33：消息分流照 stage-channel 现状搬军（D-BM-7 协议知识单点）
export function executeTask({ engine, input, onOutput, onProgress }) {
  const totalTasks = Object.keys(input.pages.mainPages).length
  let receivedOutputCount = 0
  return new Promise((resolve, reject) => {
    const worker = new Worker(thinEntryPath, { ...workerPool.getWorkerOptions(), execArgv: ['--experimental-strip-types'] /* D-TD-20 if /src/ */ })
    worker.postMessage(input)
    worker.on('message', async (message) => {
      if (message.type === 'output' && typeof onOutput === 'function') { receivedOutputCount++; onOutput(message.entry); return }
      for (const warning of message.compatibilityWarnings || []) ctx.compatibilityWarnings.add(warning)
      if (message.completedTasks !== undefined) onProgress(message.completedTasks, totalTasks)
      if (message.success) {
        if (typeof onOutput === 'function' && message.outputCount !== receivedOutputCount) { reject(new Error(`output count mismatch: expected ${message.outputCount}, received ${receivedOutputCount}`)); return }
        ctx.dependencyGraph.merge(message.dependencyGraph)
        clearTimeout(timeoutTimer); await terminateWorker(); resolve()
      } else if (message.error) { reject(Object.assign(new Error(message.error.message), message.error)) }
    })
    worker.on('error', reject); worker.on('exit', (code) => { if (code !== 0 && !isResolved) reject(...) })
    // D-P4 超时兜底
  })
}
}
// 未来 pool/queue：只换内部 → return workerPool.submit({ engine, input, onOutput, onProgress })
```

### runWorker（D-WR-5，调度骨架）

```js
// worker-runtime/runtime.js
import { isMainThread, parentPort } from 'node:worker_threads'
import { abilityContext } from './context.js'
import { PostMessageSink } from './sinks.js'
import { BufferingLogger } from './loggers.js'

// makeProgress 由 runtime 内部定义：持 parentPort（worker 侧，不持 onProgress）
// progress.completedTasks setter → parentPort.postMessage({completedTasks})
// → executor 分流 → onProgress(completed, total)（见 "progress 消息链路"）
function makeProgress(parentPort) {
  let _n = 0
  return {
    get completedTasks() { return _n },
    set completedTasks(v) { _n = v; parentPort.postMessage({ completedTasks: _n }) },
  }
}

export function runWorker(engine) {
  if (isMainThread) return
  const sink = new PostMessageSink(parentPort)
  const logger = new BufferingLogger()
  parentPort.on('message', async (msg) => {
    abilityContext.run({ sink, logger }, async () => {
      try {
        const config = engine.buildConfig(msg)
        await engine.compile({ msg, progress: makeProgress(parentPort), config })
        engine.cleanup()
        parentPort.postMessage({
          success: true,
          ...engine.successPayload({ logger }),  // F27/F28：payload 归 successPayload（含 dependencyGraph + 可选 compatibilityWarnings）
          outputCount: sink.count,  // D-WR-6
        })
      }
      catch (error) {
        engine.cleanup()
        parentPort.postMessage({ success: false, error: engine.normalizeError(error) })
      }
    })
  })
}
```

### progress 消息链路（D-WR-9 补充）

`makeProgress(parentPort)` 由 runtime 造，持 parentPort（worker 侧）。onProgress 是主线程侧 executeTask 契约回调，不在 makeProgress 里：

```
worker 内 progress.completedTasks = N（setter）
  → parentPort.postMessage({ completedTasks: N })
  → executor worker.on('message') 分流
  → onProgress(N, totalTasks)
  → stage-channel task.output = formatCompileProgress(N, total)
```

- progress 对象归 runtime 造（持 parentPort，调度知识留 runtime）
- compileML 只用 `progress.completedTasks++` 接口，不碰 parentPort
- onProgress 是 executeTask 契约的进度回调（主线程侧）

### thin entry（D-WR-5）

```js
// view/worker-entry.js
import { runWorker } from '../worker-runtime/runtime.js'
import { viewEngine } from './index.js'
runWorker(viewEngine)
```

### emitEntry（D-WR-11，fire-and-forget）

```js
// pipeline/emit.js
import { abilityContext } from '../worker-runtime/context.js'  // F31：收敛点 getStore

export async function emitEntry(params) {        // async Promise<void>
  const { entry } = await strategy.apply(params)
  const { sink } = abilityContext.getStore()       // 收敛点 getStore
  sink.write(entry)                                // 内部计数（D-WR-6）
  // return void（D-E-9 废弃）
}
```

### warnOnce（D-WR-7 + D-WR-4）

```js
// core/compatibility.js
import { abilityContext } from '../worker-runtime/context.js'  // F31：收敛点 getStore

const warnedItems = new Set()                      // 模块级（业务去重，行为 0）
function warnOnce(type, name, location, message) {
  const key = `${type}:${name}:${location}`
  if (warnedItems.has(key)) return
  warnedItems.add(key)
  const { logger } = abilityContext.getStore() ?? { logger: consoleFallback }  // D-WR-4 兜底
  logger.warn(message)
}
// takeCompatibilityWarnings 废弃（runtime 在 success 时 logger.flush()）
```

## 数据流

### worker 线程（真 worker，stage-channel new Worker）

```
parentPort.on('message', input)
  → abilityContext.run({ sink: PostMessageSink, logger: BufferingLogger })
    → engine.compile({ msg, progress, config })   ← 收 msg 完整（含 storeInfo/sourcemap 供业务初始化）+ {progress,config}（runtime 造）
      → compileML/compileSS 内部（签名不动，从 getStore 拿 sink/logger）
        → emitEntry(params) → strategy.apply → sink.write(entry)  [count++]
        → checkTemplateCompatibility → warnOnce → logger.warn     [buffer push]
    → engine.cleanup()
  → success: { ...engine.successPayload({ logger }), outputCount: sink.count }  // F27/F28：payload 归 successPayload
```

### 主线程直连（测试）

```
abilityContext.run({ sink: FileSink(writeDir), logger: ConsoleLogger() }, () => {
  compileML(pages, null, progress)   ← 签名不动，从 getStore 拿 sink/logger
    → emitEntry → sink.write(entry) → mkdir + writeFileSync  [count++]
    → warnOnce → logger.warn → console.warn
})
// 产物落盘（FileSink），warn 直接 console（ConsoleLogger）
```

## 失败处理

- **engine.compile 抛错**：runtime catch → engine.cleanup() → `success: false, error: engine.normalizeError(e)`
- **worker exit code != 0**：内存溢出等致命错误 → reject（保留 stage-channel 现有 D-P4 超时 + exit 处理）
- **对账失败**：`sink.count !== receivedOutputCount` → reject（保留 outputCount 对账机制，状态源从 worker 全局变量变 sink.count）
- **无 context 调用 warnOnce**：`abilityContext.getStore()` 返回 undefined → `consoleFallback` → console.warn（D-WR-4 兜底，不崩）

## 行为 0 保证

| 维度 | 现状 | 收敛后 | 保证 |
| --- | --- | --- | --- |
| 产物字节 | output.write 直写 / postMessage→materialize | sink.write（FileSink 同 mkdir+writeFileSync / PostMessageSink 同 postMessage）| 同代码搬家 |
| sourcemap | entry.sourcemaps[] | 同（entry 结构不变）| 不动 |
| outputCount 对账 | worker 全局变量 + success | sink.count + success | 计数源变，值同 |
| compatibilityWarnings | pendingWarnings + takeWarnings | logger.flush() | 缓冲数组搬家 |
| warnedItems 去重 | 模块级 Set | 模块级 Set（不变）| 行为 0 |
| 进度 completedTasks | progress setter + postMessage | 同（progress 对象由 runtime 提供）| 不动 |

## 决策映射

| 决策 | 落地点 | 验收 |
| --- | --- | --- |
| D-WR-1 | define-engine.js + 三 engine | A-WR2 |
| D-WR-2 | engine.compile 完全自管 | A-WR2 |
| D-WR-3 | context.js + 收敛点 getStore | A-WR3 |
| D-WR-4 | warnOnce 兜底 + 测试直连 | A-WR9 |
| D-WR-5 | worker-entry.js × 3 + WORKER_ENTRY | A-WR4 |
| D-WR-6 | sink.count + outputCount 消失 | A-WR5 |
| D-WR-7 | BufferingLogger + warnedItems 模块级 | A-WR6 |
| D-WR-8 | 主线程 Set 兜底（不变）| A-WR6 |
| D-WR-9 | executor.js executeTask | A-WR7 |
| D-WR-10 | 直接调度保持 + 接缝留 | A-WR7 |
| D-WR-11 | emitEntry return void + D-E-9 回流 | A-WR8 |

## Alternatives（已淘汰，见 research.md）

- engine 契约：独立回调（散开）/ class 基类（偏重）→ 淘汰
- compile 边界：runtime 帮手 + preFinish 钩子 → 淘汰
- 能力渗透：A 参数透传（侵入大）/ B 模块级 setLogger（主线程测试串致命）/ C 工厂（侵入同 A）→ 淘汰
- 调度模型：B 批量 Promise（绑死+改行为）/ C AsyncIterator（留 pool/queue 候选）→ 现 D，B 淘汰
- emitEntry：return number 残留 / return result 对象 → 淘汰
