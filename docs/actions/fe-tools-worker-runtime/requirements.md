# Requirements — fe-tools-worker-runtime

Status: **draft**

## Problem

bundler 的线程调度与业务逻辑混合，没有收敛面：

- **调度散布 6 文件**：stage-channel（主线程侧雏形）/ view / logic / style（各 ~55-70 行 if 块）/ output（能力层混调度）/ compatibility（业务混线程判定）
- **三引擎重复样板**：~195 行 if(!isMainThread) 块（parentPort.on / collectOutput / outputCount / completedTasks / success:false），协议知识散在业务文件
- **collectOutput flag 散布 5 处**：决策点（stage-channel）与消费点（output.write if 分叉）分离，中间 3 环节搬运
- **isMainThread 判定 3 处**：compatibility.warnOnce 用它分叉日志路由（console.warn vs pendingWarnings.push）
- **output-pure 方案 C 证伪的根因**：collectOutput=false 是测试直连的活路径（40 测试 parentPort null 崩溃），不能删——必须用能力注入替代 flag 分叉

完整摸排见 [research.md](./research.md) §1-5。

## Requirements

### R-WR0 — 线程调度知识从业务文件消失

MUST 三引擎（view/logic/style）业务文件 + output + compatibility 不再持有调度知识：
- 无 `isMainThread` 判定
- 无 `parentPort.on('message')` / `parentPort.postMessage`
- 无 `collectOutput` 全局变量 / 参数 / if 分叉
- 无 `outputCount` 全局变量 / 累加
- 无 `if (!isMainThread) { ... }` 入口块

### R-WR1 — worker-runtime 收敛面建立

MUST 新增 `fe/tools/bundler/src/compiler/worker-runtime/` 目录，包含：
- `context.js` —— `abilityContext`（AsyncLocalStorage）
- `runtime.js` —— `runWorker(engine)` 调度骨架（worker 入口 + 消息分发 + 状态 + 完成/错误协议）
- `executor.js` —— `executeTask(...)` 资源层接缝
- `sinks.js` —— `PostMessageSink` / `FileSink` 实现（含 sink.count）
- `loggers.js` —— `BufferingLogger` / `ConsoleLogger` 实现（含 flush）
- `define-engine.js` —— `defineEngine(overrides)` 默认工厂

### R-WR2 — engine strategy 契约

MUST 三引擎各导出 engine（`viewEngine` / `logicEngine` / `styleEngine`），通过 `defineEngine(overrides)` 声明：
- `compile({ mainPages, subPages, progress, config, sink, logger })` → `Promise<void>`（完全自管循环，D-WR-2）
- `cleanup()` —— 缓存清理（各引擎自管）
- `buildConfig({ sourcemap, compileConfig, sourcemapTargetPath })` —— 引擎配置
- `successPayload()` —— 默认 `{}`，view/logic 追加 compatibilityWarnings
- `normalizeError(e)` —— 默认 `{message,stack,name}`，style 追加 `{file,line,column,stage}`

### R-WR3 — 能力注入（sink + logger via AsyncLocalStorage）

MUST `abilityContext.run({ sink, logger }, () => ...)` 注入；收敛点（`emitEntry` / `output.write`→`sink.write` / `warnOnce`）通过 `abilityContext.getStore()` 拿能力。`compileML` / `compileJS` / `compileSS` / `checkTemplateCompatibility` 签名不动（收敛点已有，不透传）。

### R-WR4 — per engine thin entry

MUST 每引擎一个 `worker-entry.js`（2 行：`import { runWorker }` + `import { xxxEngine }` + `runWorker(xxxEngine)`）；`stage-channel` 的 `WORKER_ENTRY` 指向 thin entry（非 index.js）。

### R-WR5 — outputCount 归 sink 实例

MUST `sink.write(entry)` 内部计数，`sink.count` 暴露；runtime success 时读 `sink.count` 发给 stage-channel 对账；`outputCount` 全局变量从三引擎消失。`emitEntry` 不再 return number（见 R-WR8）。

### R-WR6 — compatibility 状态收敛

MUST `pendingWarnings` 归 logger 实例（BufferingLogger 内部缓冲数组）；`warnedItems` 留 `compatibility.js` 模块级（业务去重状态，行为 0）；`warnOnce` 用 `logger.warn(message)`（注入）+ `warnedItems`（模块级去重）；`takeCompatibilityWarnings` 废弃 → `logger.flush()`（runtime 在 success 时调）。

### R-WR7 — executeTask 资源层接缝

MUST `executeTask({ engine, input, onOutput, onProgress })` → `Promise<result>` 作为任务层/资源层分离接缝。契约 5 点（D-WR-9）：输入 `{engine,input,onOutput,onProgress}` / 输出 `Promise<result>`（resolve=任务完成不绑 worker 生命周期）/ `onOutput(entry)` 流式 / `onProgress(completed,total)` / 资源层不在契约里。现状内部 new Worker + terminate；未来 pool/queue 换内部，外层零改动。

### R-WR8 — emitEntry fire-and-forget 契约

MUST `emitEntry` 保持 async（天然 `Promise<void>`），resolve = transform 完 + postMessage 投递完；不等主线程收到/materialize（fire-and-forget 流式）；不返回 result 对象。emit-layer **D-E-9（return number 供累加 outputCount）废弃**——architecture-notes 回流标注。

### R-WR9 — 测试直连注入

MUST 测试在主线程直接调 compileX 时，用 `abilityContext.run({ sink: new FileSink(writeDir), logger: new ConsoleLogger() }, () => compileX(...))` 注入。解决 output-pure 方案 C 证伪的"测试直连 parentPort null"根因（D-WR-4）。

### R-WR10 — 行为 0

MUST 产物字节 + sourcemap diff=0（4 组：nomap/min-nomap/sm/sm-min）；vitest 全绿（584/584，80 套件）；tsc build 产出 dist。只搬调度知识，不改编译/产物语义。

## Constraints

- **行为 0 原则**：所有重构保持字节完全相同的输出（代码 + sourcemap diff=0）并通过完整 vitest
- **emit-layer D-E-2 精神对齐**：策略用函数/对象注入，而非 flag 分叉
- **"只搬不优化"**：仅搬调度知识到 worker-runtime，不统一转换粒度 / 不改产物语义 / 不改调度模型（pool/queue 是 Non-goal）

## Non-scope

- pool/queue 调度模型（独立未来 Action，D-WR-10）
- materialize / memfs 改造（`fe-tools-bundler-emit-memfs` 范围）
- 产物 transform 优化（emit-layer 已完成）
- cluster 多进程（不引入，D-WR-10）
- 编译循环结构重构（compile 钩子完全自管，runtime 不假设平铺，D-WR-2）
