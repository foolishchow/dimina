# Implementation Plan — fe-tools-worker-runtime

Status: **draft**

## 阶段总览

| 步骤 | 内容 | 依赖 | 验证点 |
| --- | --- | --- | --- |
| P-WR00 | baseline 记录 | — | digest + 584/584 |
| P-WR01 | worker-runtime 骨架 | P-WR00 | tsc build + import 成功 |
| P-WR02 | 三引擎 engine 化 | P-WR01 | grep 零调度残留 |
| P-WR03 | thin entry + WORKER_ENTRY | P-WR02 | worker 可起 + 编译跑通 |
| P-WR04 | emitEntry/output 改 | P-WR03 | emit.js 无 return number |
| P-WR05 | compatibility 改 | P-WR04 | compatibility 零 isMainThread |
| P-WR06 | stage-channel executeTask | P-WR05 | 调度知识集中 |
| P-WR07 | 测试直连注入 | P-WR06 | 40 测试不再崩溃 |
| P-WR08 | 全量验证 | P-WR07 | 全绿 |

## P-WR00 — baseline 记录

记录重构前基线，供 P-WR08 对拍。

- 记录 baseline HEAD commit
- 生成 4 组产物（nomap/min-nomap/sm/sm-min）到 `/tmp/wr-baseline-*`，记录 digest
- 跑 vitest 确认 584/584 基线

**验证点**：4 组 digest 文件存在 + vitest 584/584

## P-WR01 — worker-runtime 骨架

新增 `src/compiler/worker-runtime/`，纯新增文件，不改现有代码。

- `context.js` —— `abilityContext = new AsyncLocalStorage()`
- `define-engine.js` —— `defineEngine(overrides)` 默认工厂
- `sinks.js` —— `PostMessageSink`（write + count）/ `FileSink`（mkdir + writeFileSync + count）
- `loggers.js` —— `BufferingLogger`（warn + flush）/ `ConsoleLogger`（warn + flush）
- `runtime.js` —— `runWorker(engine)` 调度骨架（parentPort.on + abilityContext.run + engine.compile + success/error 协议 + outputCount=sink.count）
- `executor.js` —— `executeTask({ engine, input, onOutput, onProgress })` 资源层接缝（现状：new Worker + terminate + 消息分发 + 对账 + 超时）

**验证点**：tsc build 产出 dist（新模块可编译）；`node -e "import('./src/compiler/worker-runtime/define-engine.js')"` 可 import；现有测试不受影响（纯新增，584/584 保持）

## P-WR02 — 三引擎 engine 化

把三引擎 `index.js` 的 `if (!isMainThread)` 块移除，业务函数纯化，导出 engine。

- **业务初始化归 compile 内部**（F23/F25）：resetStoreInfo(msg.storeInfo) / setEnableSourcemap(msg.sourcemap) / sourcemapTargetPath / wxsScannedWorkPath 等引擎特化初始化，移到 engine.compile({ msg, progress, config }) 内部；buildConfig 保持纯函数（返回 config 对象，无副作用）
- **compile 签名**：`compile({ msg, progress, config })`（收 msg 完整供初始化 + {progress,config} runtime 造）

- `view/index.js`：
  - 删 `let collectOutput` / `let outputCount` / `if (!isMainThread) { parentPort.on(...) }` 整块
  - `compileML` 签名不动（从 `abilityContext.getStore()` 拿 sink/logger，D-WR-3 收敛点）
- **dependencyGraph 归 engine.successPayload 默认**（F24）：defineEngine 默认 `successPayload: () => ({ dependencyGraph: getDependencyGraph().toJSON() })`；三引擎按需覆盖（view/logic 追加 compatibilityWarnings，style 用默认）；runtime 删 `import { getDependencyGraph }` + success 里的 dependencyGraph 行
  - 新增 `export const viewEngine = defineEngine({ compile, cleanup, successPayload })`
- `logic/index.js`：同上，engine 含 `buildConfig`（sourcemapTargetPath）
- `style/index.js`：同上，engine 含 `normalizeError`（file/line/column/stage）
- `compileML`/`compileJS`/`compileSS` 的缓存清理逻辑移到 engine.cleanup

**验证点**：`grep -rn "isMainThread\|parentPort\|let collectOutput\|let outputCount" src/compiler/{view,logic,style}/index.js` 退出码 1（零残留）

## P-WR03 — thin entry + WORKER_ENTRY

新增 per engine thin entry，stage-channel 指向改。

- `src/compiler/view/worker-entry.js`（2 行：import runWorker + import viewEngine + runWorker）
- `src/compiler/logic/worker-entry.js`
- `src/compiler/style/worker-entry.js`
- `stage-channel.js` 的 `WORKER_ENTRY` 从 `../view/index.js` 改 `../view/worker-entry.js`（×3）
- **strip-types 注入逻辑保留**（D-TD-20）：stage-channel 现状在 `import.meta.url.includes('/src/')` 时注入 `--experimental-strip-types` execArgv——收敛后搬 executor.js 或 stage-channel 保持；thin entry 在 `/src/` 必须走 strip-types 否则 worker 跑 .ts 失败

**验证点**：worker 可起（dev server 编译跑通）；4 组产物 diff=0（行为 0，调度骨架搬移）

## P-WR04 — emitEntry/output 改

emitEntry 收 sink（从 abilityContext getStore），return void；output.js 删除。

- `pipeline/emit.js`：
  - `emitEntry(params)` 现状是 `emitEntry(params, outputEnv)` 两参数（emit-layer D-E-10 归档形态）——删 outputEnv 第二参数
  - 内部 `const { sink } = abilityContext.getStore()` + `sink.write(entry)`
  - `return 1` 删除 → async Promise<void>
  - JSDoc 标注 fire-and-forget 契约 + D-E-9 废弃
- `pipeline/output.js`：
  - 整体删除（FileSink 实现在 worker-runtime/sinks.js；emitEntry 内部 sink.write 替代原 write）
  - 删 `import { write } from './output.js'`（emit.js + style/index.js 的 import）
- `view/index.js`/`logic/index.js`：`outputCount += await emitEntry(...)` → `await emitEntry(...)`（删 += 和 outputCount）
- `style/index.js`：`write({entry, collectOutput, writeDir})` ×2 → `sink.write(entry)` ×2 + 删 `outputCount++`（sink 自动计数）

**验证点**：`grep -n "return 1\|return number\|outputCount +=\|outputCount++" src/compiler/` 零残留；4 组 diff=0

## P-WR05 — compatibility 改

warnOnce 用注入 logger，takeWarnings 废弃。

- `core/compatibility.js`：
  - `import { abilityContext } from '../worker-runtime/context.js'`
  - `warnOnce` 删 `if (isMainThread)` 分叉 → `const { logger } = abilityContext.getStore() ?? { logger: consoleFallback }; logger.warn(message)`
  - `warnedItems` 留模块级（不变）
  - `pendingWarnings` 删（归 BufferingLogger）
  - `takeCompatibilityWarnings` 废弃（runtime 在 success 时 `logger.flush()`）
- `view/index.js`/`logic/index.js`：`compatibilityWarnings: takeCompatibilityWarnings()` 删（runtime 在 successPayload 用 logger.flush）

**验证点**：`grep -n "isMainThread\|pendingWarnings\|takeCompatibilityWarnings" src/compiler/core/compatibility.js` 零残留（warnedItems 保留）；4 组 diff=0

## P-WR06 — stage-channel executeTask

stage-channel 的 new Worker + 回调内核重构为 executeTask 接缝调用。

- `stage-channel.js`：
  - `runCompileStage` 内部 `new Promise + worker.on('message')` 回调内核 → 调 `executeTask({ engine, input, onOutput, onProgress })`
  - `executeTask` 内部封装 worker 生命周期 + 消息分发 + 对账 + 超时（从 stage-channel 搬到 executor.js）
  - `receivedOutputCount` 对账源从 `message.outputCount`（worker 全局）变 `sink.count`（runtime success 发）
- stage-channel 退化成 executeTask 的调用方 + BuildModel.add 集成

**验证点**：`grep -n "new Worker" src/compiler/pipeline/stage-channel.js` 零残留（搬到 executor.js）；4 组 diff=0；vitest 全绿

## P-WR07 — 测试直连注入

测试在主线程直接调 compileX 时，用 abilityContext.run 包 FileSink + ConsoleLogger。

- 扫描 40 个失败测试的调用点（`null-safe-member-access` / `template-semantics` / `custom-file-types` / `compiler-hotpaths` / 等）
- 测试 helper 提供 `runWithAbilities(writeDir, fn)` —— `abilityContext.run({ sink: new FileSink(writeDir), logger: new ConsoleLogger() }, fn)`
- 测试用 `runWithAbilities(outputDir, async () => { await compileML(...) })` 包裹
- 或：compileX 在无 context 时 fallback 到 console + 抛错（要求显式注入）——倾向前者（helper 包裹）

**验证点**：40 测试不再 `Cannot read properties of null (reading 'postMessage')`；vitest 584/584

## P-WR08 — 全量验证

- 4 组产物对拍（baseline vs current，diff=0）
- vitest 全量（584/584，80 套件）
- grep 锚定：
  - 调度残留 in view/logic/style/output/compatibility（零）
  - `new Worker` only in executor.js（单点）
  - `parentPort.postMessage` only in runtime.js + sinks.js（收敛）
  - `isMainThread` only in runtime.js + compatibility.js 兜底（收敛）
  - `collectOutput` 全仓零残留
  - `outputCount` only in executor.js（对账消费点）
- tsc build 产出 dist
- D-E-9 废弃回流 emit-layer architecture-notes

**验证点**：4 组 diff=0 + vitest 584/584 + grep 锚定全过 + tsc build OK

## 边界声明

- `build-pipeline.js` 不改（`ctx.compatibilityWarnings` 消费链路保留：stage-channel/executor 收 message.compatibilityWarnings → ctx.add → build-pipeline printCompatibilityWarnings + warningsBefore/After 增量）
- `build-model.js` 不改（materialize 唯一写盘出口保留）

## 风险

- **P-WR07 测试改造面大**：40 个测试，但都是"包 abilityContext.run"的机械改造，风险低
- **AsyncLocalStorage 跨 async 边界**：compileML/compileSS 内部有 await（esbuild/less/sass），AsyncLocalStorage 天然跨 async——但要在 P-WR08 验证不丢 context
- **FileSink vs output.write 直写路径字节一致**：FileSink 的 mkdir+writeFileSync 要和 output.write 直写路径字节相同（行为 0）——P-WR08 对拍验证
- **worker strip-types**（D-TD-20）：thin entry 在 `/src/`，strip-types 注入逻辑必须保留（搬 executor.js 或 stage-channel 保持），否则 worker 跑 .ts 模块失败
- **D-E-9 回流归档可编辑性**：emit-layer 已归档（`_archive/complete/`），D-E-9 废弃回流到 architecture-notes——确认归档文档可标注 supersede（或 sidecar architecture-notes 新增 D-E-9 条目）
