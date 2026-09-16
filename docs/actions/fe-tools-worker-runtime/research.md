# worker-runtime 收敛面设计摸排总报告

> 调研文档，非 Action 文档。供立项参考，方向未拍板。
> 产出日期：2026-09-16。摸排范围：`fe/tools/bundler/src/`。

## 1. 问题陈述

当前 bundler 的**线程调度**（thread/worker 调度：起 worker、消息收发、产物/日志回传、计数对账、完成判定）与**业务逻辑**（compileML / compileSS / compileJS 的编译 + transform）混合在一起。**没有收敛面**——调度知识散在 6 个文件里，三引擎各带一份重复的 worker 入口样板。

根源症状：业务逻辑文件被迫知道"自己在哪个线程"，并据此做分叉。这违反 emit-layer 已确立的 D-E-2 精神（策略用函数注入，而非 flag 分叉）。output.write 当年退化成了 flag，compatibility 的 warnOnce 退化成了 `isMainThread` 判定。

## 2. 调度泄漏的两个面

两个面**同构**——都是"worker 的信息怎么回主线程"的调度知识泄漏进业务层。

### 2.1 产物回传（collectOutput）

```
stage-channel 决策（typeof onOutput === 'function'）
  → 消息字段 collectOutput 传递
  → worker 全局变量 collectOutput 存储
  → emitEntry outputEnv 传递
  → output.write if 分叉（postMessage vs writeFileSync）
```

泄漏点：`output.write` 读 `collectOutput` 做 if 分叉——能力层（怎么写）混入了调度知识（该走哪条路）。

### 2.2 日志回传（isMainThread + pendingWarnings）

```
业务层 warnUnsupportedWxApi / checkTemplateCompatibility（编译深处）
  → warnOnce if (isMainThread) 分叉
    主线程：console.warn
    worker：pendingWarnings.push
  → worker 完成时 takeCompatibilityWarnings() flush
  → success:true 消息带 compatibilityWarnings
  → stage-channel 收 → ctx.compatibilityWarnings.add
```

泄漏点：`warnOnce` 读 `isMainThread` 做分叉——业务模块（检查兼容性）被迫知道线程，据此选输出方式。

### 2.3 同构对照

| | 产物 | 日志 |
| --- | --- | --- |
| 业务层泄漏点 | `output.write` 读 `collectOutput` | `warnOnce` 读 `isMainThread` |
| 调度知识 | "我在 worker 还是主线程" | "我在 worker 还是主线程" |
| worker 路径 | postMessage（逐条发） | pendingWarnings.push（攒着） |
| 主线程路径 | writeFileSync | console.warn |
| 回传时机 | 编译中逐条 | 完成时一次性 flush |
| flag 散布处 | 5 处 | 1 处（但分叉在编译深处） |

## 3. 散布地图（量化）

| 维度 | 数 | 位置 |
| --- | --- | --- |
| 散布文件 | 6 | stage-channel / view / logic / style / output / compatibility |
| 三引擎重复样板（if 块） | ~195 行 | view ~70 + logic ~70 + style ~55 |
| `collectOutput` 散布 | 5 处 | emit / output / stage-channel / view / logic / style |
| `outputCount` 散布 | 8 处 | emit / stage-channel / view / logic / style |
| `isMainThread` 判定 | 3 处 | compatibility + 三引擎 if 块 |
| `parentPort.postMessage` | 10+ 处 | 三引擎各 3-4 + output 1 |
| `worker_threads` import | 6 处 | 全部 6 文件 |
| `new Worker` | 1 处 | stage-channel（唯一集中点） |
| `worker.on` | 3 处 | stage-channel（message/error/exit，唯一集中） |

**唯一集中的调度点**：`stage-channel.js`（主线程侧 worker 生命周期 + 消息分发 + 对账 + 超时）。但它只管主线程侧，**worker 侧入口散在三引擎**。

**并发限流**（独立一层，层次正确）：`watch/worker-pool.js`（WorkerPool，activeWorkers/maxWorkers/memoryLimit），被 stage-channel 调用。

## 4. 三引擎 if 块差异分析

### 4.1 逐行对比

| 维度 | view | logic | style | 分类 |
| --- | --- | --- | --- | --- |
| 解构 `collectOutput: collectFlag` | ✓ | ✓ | ✓ | 🔁 纯重复 |
| `collectOutput = !!collectFlag; outputCount = 0` | ✓ | ✓ | ✓ | 🔁 纯重复 |
| `progress` 对象（completedTasks getter/setter + postMessage） | ✓ | ✓ | ✓ | 🔁 纯重复（三份一字不差） |
| `resetStoreInfo(storeInfo)` | ✓ | ✓ | ✓ | 🔁 骨架重复 |
| `success:true` 带 `dependencyGraph + outputCount` | ✓ | ✓ | ✓ | 🔁 骨架重复 |
| `success:false` error 带 `message/stack/name` | ✓ | ✓ | ✓ | 🔁 骨架重复 |
| try+catch 双清理缓存 | ✓ | ✓ | ✓ | 🔁 结构重复（清理对象不同） |
| `subPages` 循环 `Object.entries` | ✓ | ✓ | ✓ | 🔁 骨架重复 |
| **解构字段差异** | 基础 4 | +`sourcemapTargetPath` | 基础 4 | ❌ 特化（logic 多一个） |
| **sourcemap 标志设置** | `setEnableSourcemap()` | `enableSourcemap = ...` | 无（收 styleOptions） | ❌ 特化（三种方式） |
| **activeCompileConfig**（esTarget） | ✓ | ✓ | ✗（用 styleOptions） | ❌ 特化（view/logic 有） |
| **业务调用** | `compileML(main,null,progress)` | `compileJS(main,null,null,progress)` + independent 分包 + 延迟 `writeCompileRes` | `compileSS(main,null,progress,styleOptions)` | ❌ 完全特化 |
| **success 附加字段** | +`compatibilityWarnings` | +`compatibilityWarnings` | 无 | ❌ 特化（style 不产警告） |
| **error 附加字段** | 基础 3 | 基础 3 | +`file/line/column/stage`（CSS 错误定位） | ❌ 特化（style 多 4 个） |
| **缓存清理对象** | 6 个 | 1 个（processedModules） | 1 个（compileRes） | ❌ 特化（各引擎自管） |

### 4.2 分类汇总

```
🔁 纯重复（三份一字不差，直接收敛）
   ├ collectOutput/outputCount 调度状态
   ├ progress 对象（completedTasks getter/setter + postMessage）
   └ 解构 collectOutput:collectFlag

🔁 骨架重复（结构同，细节各引擎填）
   ├ success:true 骨架（dependencyGraph + outputCount + 可选 compatibilityWarnings）
   ├ success:false 骨架（error.message/stack/name + 可选 file/line/column/stage）
   ├ try+catch 双清理缓存（清理函数引擎注入）
   ├ subPages 循环骨架（compile 函数引擎注入）
   └ resetStoreInfo（骨架，sourcemap 标志方式不同）

❌ 完全特化（必须引擎注入，不能搬）
   ├ 业务调用 compileX（compileML/compileJS/compileSS）
   ├ activeCompileConfig vs styleOptions（配置形态不同）
   ├ 缓存清理对象（各引擎不同 clear list）
   └ sourcemap 标志设置方式（setter / 赋值 / 不用）
```

### 4.3 收敛可行性

**能完全吃掉**——但不是无脑搬移，要设计成**带钩子的 worker-runtime 框架**。纯重复直接搬，特化通过 engine strategy 注入点吃掉。

最大的特化难点：**logic 的"独立分包 + 延迟 writeCompileRes"**打破了"mainPages + subPages 平铺"骨架。要么 compile 钩子完全自管（runtime 不假设循环结构），要么给 logic 单独的 preFinish 钩子。

## 5. compatibility warnings 全链路

### 5.1 链路

```
产出端（业务层，编译全程散在深处）
  view 编译 wxml → checkTemplateCompatibility(content, filePath, components) → warnOnce(...)
  logic 编译 JS  → warnUnsupportedWxApi(apiName, filePath, line)            → warnOnce(...)

warnOnce（线程调度泄漏点）
  if (isMainThread) console.warn(message)      ← 主线程：直接
  else pendingWarnings.push(message)            ← worker：攒模块级缓冲

回传端（worker 完成，view/logic 的 success:true）
  compatibilityWarnings: takeCompatibilityWarnings()   ← 取走 pendingWarnings

消费端（主线程）
  stage-channel: for (w of message.compatibilityWarnings) ctx.compatibilityWarnings.add(w)
                 + lifecycle.emit(BUILD_WARNING, { message: w })
  build-pipeline: printCompatibilityWarnings(workPath, ctx.compatibilityWarnings)
                 + warningsBefore/After 增量对比 → lifecycle STAGE_AFTER
```

### 5.2 isMainThread 泄漏本质

`warnOnce` 用 `isMainThread` 分叉输出方式——日志路由的调度知识泄漏进业务逻辑。和 collectOutput 同构（都是"worker 信息怎么回主线程"）。

### 5.3 比产物复杂的维度

| | 产物 sink | 日志 logger |
| --- | --- | --- |
| 调用时机 | 出口一次（emitEntry/postEntry） | 编译**全程多次**散在深处 |
| 注入粒度 | 出口注入即可 | 要渗透到 warnOnce 调用链 |
| 去重 | 不需要 | `warnedItems` Set（线程内去重，跨线程靠主线程 Set 兜底） |
| flush | 不需要（直接发） | 要（攒着随 success 一次发） |

产物 sink 在出口注入就够；logger 要在**整个编译过程**可见——不是出口注入能解决的。

### 5.4 模块级状态隔离性

`pendingWarnings = []` + `warnedItems = new Set()` 是模块级：
- 每个 worker 进程独立一份（worker 是独立 V8 实例）
- 主线程也独立一份
- `warnedItems` 去重只在同一线程内有效——跨 worker 重复 warn 靠主线程 `ctx.compatibilityWarnings` Set 兜底

### 5.5 style 不产兼容警告

三引擎对比表中 style 的 success 不带 compatibilityWarnings——style 不调 checkTemplateCompatibility / warnUnsupportedWxApi。收敛后 style 的 logger flush 永远空——这是 `successPayload` 钩子的天然差异。

## 6. 收敛面设计方向

### 6.1 worker-runtime 收敛面

一个 `worker-runtime` 面，吃掉三引擎的 `if (!isMainThread)` 块 + output.js 的调度分叉 + compatibility 的线程判定：

```
worker-runtime（新收敛面）
  ├ worker 入口（parentPort.on + 消息分发 + 协议）   ← 收敛三份重复
  ├ 调度状态（collectOutput/outputCount）           ← 收敛
  ├ 完成/错误消息形状                              ← 单点定义
  ├ 能力注入（worker→PostMessageSink / 主线程→FileSink）← 调度决策
  ├ 能力注入（worker→BufferingLogger / 主线程→ConsoleLogger）← 调度决策
  └ logger flush 回收点（worker success 时）         ← 收敛 takeCompatibilityWarnings

业务层（view/logic/style 的 compileX / compatibility 的 check）
  compileX(pages, config, { sink, logger })  ← 纯业务，收能力
  check(...) → logger.warn(message)           ← 纯业务，不判断线程
```

`if (!isMainThread)` / `parentPort` / `collectOutput` / `outputCount` / `isMainThread` **全部从业务文件消失**，集中在 worker-runtime。

### 6.2 两个能力注入（同构）

| 能力 | 接口 | worker 实现 | 主线程实现 |
| --- | --- | --- | --- |
| 产物 sink | `sink.write(entry)` | PostMessageSink | FileSink |
| 日志 logger | `logger.warn(msg)` + `logger.flush()` | BufferingLogger（攒 pending） | ConsoleLogger（直接 console） |

### 6.3 engine strategy 注入契约

三引擎特化通过 engine strategy 注入（和 emit-layer D-E-2 对齐，但更复杂——不是单个 apply 函数，是一组生命周期钩子）：

```
engine = {
  // ❌ 完全特化 → 注入
  compile({ mainPages, subPages, progress, config, sink, logger }) → Promise<void>,
  cleanup(),
  buildConfig({ sourcemap, compileConfig, sourcemapTargetPath }),

  // 🔁 骨架重复 → 钩子（默认值 + 引擎覆盖）
  successPayload(),   // 默认 {}，view/logic 追加 compatibilityWarnings（实为 logger.flush()）
  normalizeError(e),  // 默认 {message,stack,name}，style 追加 file/line/column/stage

  // 🔁 纯重复 → runtime 内部，引擎不碰
  // collectOutput/outputCount/progress/消息骨架
}
```

## 7. 设计决策（已拍）

讨论轮次：2026-09-16。4 个核心决策拍定。

### 贯穿洞察

sink 和 logger 都已有收敛点——sink 在 emitEntry / output.write（2 处），logger 在 warnOnce（1 处）。不需要透传到编译最深处——只要把能力注入这 3 个收敛点。compileML / compileJS / checkTemplateCompatibility 签名不动。这把"渗透难题"降级成"收敛点怎么拿能力"。

### D-WR-1：engine 契约 = strategy 对象 + 默认工厂

- **决策**：engine 是 strategy 对象（多方法），通过 `defineEngine(overrides)` 提供默认值，引擎只写差异。
- **理由**：和 emit-layer D-E-2（transform 策略函数注入）对齐；默认值集中（normalizeError/successPayload/buildConfig 默认实现）；引擎只写差异（减重复）；不用 class（轻量，和 D-E-2 函数风格一致）。
- **形态**：
  ```js
  function defineEngine(overrides) {
    return {
      buildConfig: msg => ({ sourcemap: !!msg.sourcemap, minify: msg.compileConfig?.minify !== false }),
      cleanup: () => {},
      successPayload: () => ({}),
      normalizeError: e => ({ message: e.message, stack: e.stack, name: e.name }),
      ...overrides,
    }
  }
  ```
- **淘汰**：独立回调（散开不内聚）；class 基类（JS 项目偏重，和 D-E-2 不一致）。

### D-WR-2：compile 钩子边界 = 完全自管循环

- **决策**：compile 钩子收 `{ msg, progress, config }`，自己决定怎么循环。runtime 只管调度骨架（消息/状态/完成/错误），不假设编译循环结构。
- **签名演进**（R6 F23/F25 修正）：原 `compile({ mainPages, subPages, progress, config, sink, logger })`（D-WR-1..5 拍定时含 sink/logger）→ R1 F1 删 sink/logger（从 getStore）→ R6 F25 改 `compile({ msg, progress, config })`（收 msg 完整供业务初始化：resetStoreInfo(msg.storeInfo)/setEnableSourcemap(msg.sourcemap) 等引擎特化初始化移入 compile 内，F23；buildConfig 保持纯函数）。
- **理由**：logic 的 independent 分包 + 延迟 writeCompileRes 打破"mainPages + subPages 平铺"骨架——与其给 preFinish 额外钩子，不如让 compile 完全自管，logic 特化在 compile 内闭环。
- **影响**：runtime 不提供 forEachPage 帮手；三引擎的 compile 实现各自管循环 + 业务初始化。

### D-WR-3：能力渗透 = AsyncLocalStorage

- **决策**：用 Node 原生 `AsyncLocalStorage`（abilityContext）注入 { sink, logger }。收敛点（emitEntry / output.write / warnOnce）通过 `abilityContext.getStore()` 拿能力。
- **理由**：
  - 纯——无模块级可变状态（store 是 run-scoped，run 结束自动 GC）
  - 侵入小——只改 3 个收敛点 + runtime 入口
  - 隔离完美——run-scoped，worker 各自 run、测试直连各自 run，天然隔离（解决方案 B 的主线程测试串致命缺陷）
  - 统一——一个 context 装 { sink, logger }，sink/logger 同构处理
- **淘汰**：
  - A 参数透传：最纯但侵入大（compileML/compileJS/emitEntry/checkTemplateCompatibility/warnOnce + 所有调用点签名）
  - B 模块级 setLogger：保留模块级状态，主线程测试串（致命）
  - C 工厂：纯，但 compatibility 从无状态工具变有状态实例，侵入面和 A 相当
- **代价**：依赖不显式（"魔法"，读 emitEntry 看不到 sink 从哪来）；微小性能开销（跨 async 边界，编译器可接受）。

### D-WR-4：能力兜底 + 测试直连注入

- **决策**：warnOnce 在无 context 时走 `console.warn` 兜底；测试直连场景用 `abilityContext.run({ sink: FileSink, logger: ConsoleLogger }, () => compileX(...))` 注入。
- **理由**：
  - 兜底——compatibility 可能被外部直接调用（无 worker-runtime context），console.warn 保证不崩
  - 测试直连——AsyncLocalStorage 的 run-scoped 天然解决测试直连注入（原 output-pure 方案 C 证伪的根因：parentPort null）。测试用 FileSink + ConsoleLogger 包 run，不经 worker 也能写盘 + warn
- **影响**：output-pure 方案 C 证伪的"测试直连 parentPort null"问题由 D-WR-3/D-WR-4 解决。

### D-WR-5：worker 入口归属 = per engine thin entry

- **决策**：每 engine 一个 `worker-entry.js`（2 行：import runWorker + import engine + runWorker(engine)）；engine 在业务 `index.js` export（defineEngine）；stage-channel `WORKER_ENTRY` 指向 thin entry。
- **理由**：engine 文件纯（只 export engine + 业务函数，零调度知识）；thin entry 是胶水（2 行）；调度骨架集中在 `worker-runtime/runtime.js`；静态 import 无动态路径风险（淘汰通用 entry + workerData + 动态 import 方案）。
- **形态**：
  ```js
  // view/worker-entry.js（thin）
  import { runWorker } from '../worker-runtime/runtime.js'
  import { viewEngine } from './index.js'
  runWorker(viewEngine)
  ```

### D-WR-6：outputCount 归 sink 实例

- **决策**：`sink.write(entry)` 内部计数，`sink.count` 暴露；runtime success 时读 `sink.count` 发给 stage-channel 对账；outputCount 从业务文件消失。
- **理由**：outputCount 是调度对账状态（不是业务）——归 runtime；sink 是能力注入点（D-WR-3），计数天然在 sink；业务层只调 `sink.write(entry)`，不碰 outputCount。
- **影响**：emitEntry 不再 return number（见 D-WR-11）。

### D-WR-7：compatibility 模块级状态

- **决策**：`pendingWarnings` 归 logger 实例（BufferingLogger 内部缓冲数组）；`warnedItems` 留 `compatibility.js` 模块级（业务去重状态，行为 0）。
- **理由**：pendingWarnings 是调度缓冲（攒着回传）→ 归 logger 实例；warnedItems 是业务去重状态（避免同一次编译重复 warn）→ 不是调度状态，留模块级不违反 D-WR-3（D-WR-3 的"无模块级可变状态"指调度能力注入，不是业务状态）。
- **形态**：
  ```js
  // compatibility.js
  const warnedItems = new Set()   // 模块级（业务去重，行为 0）
  function warnOnce(...) {
    if (warnedItems.has(key)) return
    warnedItems.add(key)
    const { logger } = abilityContext.getStore() ?? { logger: consoleFallback }
    logger.warn(message)           // 缓冲归 logger 实例
  }
  // takeCompatibilityWarnings 废弃 → logger.flush()
  ```
- **行为 0**：warnedItems 留模块级保持跨 message 去重行为（现状 worker 生命周期内共享）；主线程直连跨测试共享（现状行为）——均行为 0。

### D-WR-8：跨线程去重 = 保留主线程 Set 兜底

- **决策**：warnedItems 各 worker 模块级（现状行为 0）；主线程 `ctx.compatibilityWarnings` Set 兜底去重（现状保留）。
- **理由**：D-WR-7 让 warnedItems 留模块级 → 跨 worker 各自去重 → 主线程 Set 兜底——现状行为，收敛后保持，行为 0。

### D-WR-9：资源层接缝 = executeTask

- **决策**：`executeTask({ engine, input, onOutput, onProgress })` → `Promise<result>` 作为任务层/资源层分离的接缝。任务层（engine/input/onOutput/onProgress/Promise）稳定，资源层（worker 管理）在 executeTask 内部换。
- **背景洞察**（用户提出）：现状是最简直接调度（new Worker + terminate，worker-pool 只限流不复用）；未来 pool（复用 worker）/queue（任务排队）改变 Promise 绑定语义（从 worker 实例生命周期 → 任务完成）。但现状 Promise 其实已是任务完成语义（resolve=success 不绑 terminate）——问题在实现绑死直接调度。关键是留资源层接缝，不是 Promise 形态。
- **契约 5 点**（任务层，稳定不变）：
  1. 输入：`{ engine, input, onOutput, onProgress }`
  2. 输出：`Promise<result>`（resolve = 任务完成，不绑 worker 生命周期）
  3. `onOutput(entry)` —— 流式产物回调（0..N 条）
  4. `onProgress(completed, total)` —— 进度回调
  5. 资源层（worker 怎么来怎么走）不在契约里
- **形态**：
  ```js
  // worker-runtime/executor.js（资源层接缝）
  export function executeTask({ engine, input, onOutput, onProgress }) {
    // 现状：new Worker + terminate
    return new Promise((resolve, reject) => { /* ... */ })
  }
  // 未来 pool：只换内部
  // return workerPool.submit({ engine, input, onOutput, onProgress })
  ```
- **理由**：现在 new Worker，未来 pool/queue 换 executeTask 内部，外层（build-pipeline）零改动。

### D-WR-10：调度模型演进策略

- **决策**：现状直接调度（new + terminate，worker-pool 只限流）保持；B 批量 Promise 不做；C AsyncIterator 留作 pool/queue 时候选；pool/queue 是独立未来 Action。
- **实证**：materialize 批量（所有 stage 完后 build-pipeline:181 一次写盘），BuildModel.add 只攒内存 Map——流式 postMessage 的价值有限（只省 worker 内存 + TTY page 进度，主线程内存不省）。
- **淘汰 B（批量 Promise）**：绑死"一次任务一次批量"形态 + 改行为（牺牲 page 进度 + worker 内存）+ 未来 pool/queue 流式复用要重写。
- **C（AsyncIterator）留候选**：pool/queue 时 onOutput 回调可能不够（复用 worker 要 task id 区分），AsyncIterator 的 `for await (entry of task)` 天然任务隔离——但 C 现在改行为 + 复杂，不做，留作未来候选。
- **不引入 cluster**：现状 worker_threads（单进程多线程）；cluster（多进程）复杂度高无需求，调度抽象只覆盖 worker_threads。

### D-WR-11：emitEntry = Promise<void> + fire-and-forget 契约

- **决策**：emitEntry 保持 async（天然 Promise<void>），resolve = transform 完 + postMessage 投递完；不等主线程收到/materialize（fire-and-forget 流式）；不返回 result 对象（无消费者）。
- **两层 Promise 层次**：
  - emitEntry（worker 内部）：Promise resolve = transform + 投递完（①），不等主线程
  - executeTask/runCompileStage（主线程）：Promise resolve = worker success（worker 报告"我发完了"）= 整个 stage 完成
- **契约明确**：emitEntry 的 Promise resolve = transform + postMessage 投递完（fire-and-forget）；主线程"处理完"由 executeTask Promise 覆盖（resolve = worker success）。
- **D-E-9 回流**：emit-layer D-E-9（emitEntry return number 供累加 outputCount）在 worker-runtime 收敛后整体废弃——outputCount 归 sink（D-WR-6），return 值无消费者。emitEntry 改 return void（async 天然）。architecture-notes 回流标注。
- **淘汰**：return number（a 残留）/ return result 对象（无消费者）。

## 8. 剩余待拍点

全部收敛（D-WR-1..11 拍定）。无剩余待拍点。

## 9. 与现有 Action 的关系

### 9.1 output-pure 的重新定位

`fe-tools-bundler-output-pure` 的方案 C（删 collectOutput=false 直写路径）**已证伪**——collectOutput=false 是测试直连的活路径，不是死路径。实施时 40 个测试崩溃（`parentPort` null）。

但 output-pure 立项的**真正问题**（output.write 调度与能力混合）是**本报告的主线**——它不是"删直写路径"能解决的，而是要把 collectOutput flag 整体替换成 sink 能力注入。这属于 worker-runtime 收敛面的子集。

**建议**：output-pure 作为独立 Action **废止**（superseded），其发现回流到本调研。worker-runtime 收敛面立项后，output.write 的纯化自然包含在内（sink 注入替代 collectOutput 分叉）。

### 9.2 emit-layer 的对齐

emit-layer 已确立 D-E-2（transform 策略函数注入）。worker-runtime 是同一精神的扩展——把"写盘策略"和"日志策略"也从 flag 分叉改成函数/对象注入。emit-layer 的 emitEntry 收 strategy 参数，worker-runtime 的 compileX 收 { sink, logger }。

**D-E-9 回流**：emit-layer D-E-9（emitEntry return number 供累加 outputCount）在 worker-runtime 收敛后废弃（D-WR-6 outputCount 归 sink + D-WR-11 emitEntry return void）。architecture-notes 回流标注。

### 9.3 memfs（阶段 2）的关系

memfs Action 改主线程 materialize + dev server。它**不依赖** output-pure（output-pure 证伪后，worker 侧仍走 collectOutput=true → postMessage，主线程 materialize 写盘——这条链路 emit-layer 已完成）。worker-runtime 收敛是**正交**改进（把调度知识从业务层抽出），memfs 可独立推进。

## 10. 收敛后预期形态

### 9.1 业务文件（view/index.js 示例）

```js
// 零调度知识——不 import worker_threads，不 if(!isMainThread)
export async function compileML(pages, root, progress, { sink, logger }) {
  // ... 纯编译逻辑 ...
  await emitEntry({ ... })        // async Promise<void>，内部 sink.write(entry)；return void（D-WR-11）
  // outputCount 归 sink.count（D-WR-6），不再 += await emitEntry
  // checkTemplateCompatibility 内部调 logger.warn
}

export const viewEngine = {
  compile: async ({ mainPages, subPages, progress, config, sink, logger }) => {
    await compileML(mainPages, null, progress, { sink, logger })
    for (const [root, sub] of Object.entries(subPages))
      await compileML(sub.info, root, progress, { sink, logger })
  },
  cleanup: () => { compileResCache.clear(); templateRenderCache.clear(); /* ... */ },
  // successPayload / normalizeError 用默认值（view 的 compatibilityWarnings 实为 logger.flush()）
}
```

### 9.2 worker-runtime（新文件）

```js
// 唯一持有调度知识的面
import { parentPort, isMainThread } from 'node:worker_threads'

export function runWorker(engine) {
  if (isMainThread) return  // 只在 worker 线程跑
  parentPort.on('message', async (msg) => {
    const sink = new PostMessageSink(parentPort)
    const logger = new BufferingLogger()
    // ... 调度状态 init（outputCount 等）...
    try {
      await engine.compile({ ..., sink, logger })
      parentPort.postMessage({
        success: true,
        ...engine.successPayload(),
        compatibilityWarnings: logger.flush(),
        dependencyGraph: getDependencyGraph().toJSON(),
        outputCount,
      })
    } catch (error) {
      parentPort.postMessage({ success: false, error: engine.normalizeError(error) })
    }
  })
}
```

### 9.3 主线程直连（测试场景）

```js
// 测试直接调 compileX，注入主线程能力
const sink = new FileSink(writeDir)
const logger = new ConsoleLogger()
await compileML(pages, null, progress, { sink, logger })
// 产物落盘（FileSink），warn 直接 console（ConsoleLogger）
```

`collectOutput` / `isMainThread` / `parentPort` 全部消失——调度层显式选能力，业务层不碰调度。

---

## 附录：摸排实证索引

- 三引擎 if 块全文：`view/index.js:225-300` / `logic/index.js:20-100` / `style/index.js:14-95`
- output.write 双路径：`pipeline/output.js:18-25`
- stage-channel 调度雏形：`pipeline/stage-channel.js:42-165`
- worker-pool 并发限流：`watch/worker-pool.js:77-120`
- compatibility warn 链路：`core/compatibility.js:300-320` + `view/index.js:280` + `logic/index.js:81` + `stage-channel.js:104`
- 消费端：`build-pipeline.js:156,199,234,249` + `stage-channel.js:104-107`

---

**状态**：调研完成，方向待拍。立项决策点：engine 注入契约形态 + logger 渗透方式。
