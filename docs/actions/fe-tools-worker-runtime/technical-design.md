# Technical Design — fe-tools-worker-runtime

Status: **draft**

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
  ├ pipeline/emit.js     emitEntry（async Promise<void>，内部 sink.write）
  ├ pipeline/output.js   write 废弃 → sink.write 替代（或 output.js 退化为 sink 实现的薄壳）
  └ core/compatibility.js warnOnce 用 logger.warn（注入）+ warnedItems 模块级
  view/worker-entry.js   thin entry（2 行）
  logic/worker-entry.js  thin entry
  style/worker-entry.js  thin entry
```

## 接口

### defineEngine（D-WR-1）

```js
// worker-runtime/define-engine.js
export function defineEngine(overrides) {
  return {
    buildConfig: msg => ({ sourcemap: !!msg.sourcemap, minify: msg.compileConfig?.minify !== false }),
    cleanup: () => {},
    successPayload: () => ({}),
    normalizeError: e => ({ message: e.message, stack: e.stack, name: e.name }),
    ...overrides,
  }
}
```

三引擎：
- `viewEngine = defineEngine({ compile, cleanup, successPayload })`（successPayload 追加 compatibilityWarnings = logger.flush()）
- `logicEngine = defineEngine({ compile, cleanup, successPayload, buildConfig })`（buildConfig 多 sourcemapTargetPath）
- `styleEngine = defineEngine({ compile, cleanup, normalizeError })`（normalizeError 追加 file/line/column/stage）

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
class PostMessageSink {
  #count = 0
  constructor(parentPort) { this.parentPort = parentPort }
  write(entry) { this.parentPort.postMessage({ type: 'output', entry }); this.#count++ }
  get count() { return this.#count }
}
class FileSink {
  #count = 0
  constructor(writeDir) { this.writeDir = writeDir }
  write(entry) { /* mkdir + writeFileSync，行为同 output.write 直写路径 */ this.#count++ }
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

```js
// worker-runtime/executor.js
export function executeTask({ engine, input, onOutput, onProgress }) {
  // 现状：new Worker + terminate
  return new Promise((resolve, reject) => {
    // worker 创建 + 消息分发 + 对账 + 超时 + terminate
    // onOutput(message.entry) / onProgress(completed,total) / resolve(result)
  })
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

export function runWorker(engine) {
  if (isMainThread) return
  const sink = new PostMessageSink(parentPort)
  const logger = new BufferingLogger()
  parentPort.on('message', async (msg) => {
    abilityContext.run({ sink, logger }, async () => {
      try {
        const config = engine.buildConfig(msg)
        await engine.compile({ mainPages: msg.pages.mainPages, subPages: msg.pages.subPages, progress: makeProgress(parentPort), config, sink, logger })
        engine.cleanup()
        parentPort.postMessage({
          success: true,
          ...engine.successPayload(),
          compatibilityWarnings: logger.flush(),
          dependencyGraph: getDependencyGraph().toJSON(),
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
    → engine.compile({ ..., sink, logger })
      → compileML/compileSS 内部
        → emitEntry(params) → strategy.apply → sink.write(entry)  [count++]
        → checkTemplateCompatibility → warnOnce → logger.warn     [buffer push]
    → engine.cleanup()
  → success: { outputCount: sink.count, compatibilityWarnings: logger.flush() }
```

### 主线程直连（测试）

```
abilityContext.run({ sink: FileSink(writeDir), logger: ConsoleLogger() }, () => {
  compileML(pages, null, progress, { sink, logger })
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
