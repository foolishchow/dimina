# fe-tools-worker-runtime

- Action: `fe-tools-worker-runtime`
- Status: `ready`
- Updated: 2026-09-16
- Status authority: [Action Status](../STATUS.md)

## Background

bundler 的**线程调度**（thread/worker 调度：起 worker、消息收发、产物/日志回传、计数对账、完成判定）与**业务逻辑**（compileML / compileSS / compileJS）混合。**没有收敛面**——调度知识散在 6 个文件（stage-channel / view / logic / style / output / compatibility），三引擎各带一份 ~55-70 行重复的 `if (!isMainThread)` worker 入口样板。

两个调度泄漏面（同构）：
- **产物回传**：`output.write` 读 `collectOutput` flag 做 if 分叉（能力层混调度知识）
- **日志回传**：`compatibility.warnOnce` 读 `isMainThread` 分叉输出方式（业务模块混线程判定）

完整摸排见 [research.md](./research.md)（455 行，散布地图 + 三引擎差异 + compatibility 全链路 + 11 决策）。

## Goal

建立 **worker-runtime 收敛面**——把线程调度知识从业务文件抽到 `worker-runtime/`，业务层（compileX / check）只收能力注入（sink + logger），不碰调度（`isMainThread` / `parentPort` / `collectOutput` / `outputCount` 全部从业务文件消失）。

一个 outcome：**调度知识单点维护**，三引擎不再各带 worker 入口样板。

## Non-goals

- **pool/queue 调度模型**——独立未来 Action（D-WR-10）；本 Action 只留 `executeTask` 资源层接缝，不实现 pool/queue
- **materialize / memfs 改造**——`fe-tools-bundler-emit-memfs` 范围，正交
- **产物 transform 优化**——emit-layer 已完成，不动
- **行为改变**——行为 0（产物字节 + sourcemap diff=0，vitest 全绿）；只搬调度知识，不改编译/产物语义
- **cluster（多进程）**——不引入，调度抽象只覆盖 worker_threads（D-WR-10）

## Design inputs

- [research.md](./research.md) —— 摸排总报告 + 11 决策（D-WR-1..11）
- emit-layer architecture-notes —— D-E-2（策略函数注入）精神对齐
- `fe/tools/bundler/src/compiler/{view,logic,style}/index.js` —— 三引擎 if 块现状
- `fe/tools/bundler/src/compiler/pipeline/{output,emit,stage-channel}.js` —— 调度散布点
- `fe/tools/bundler/src/compiler/core/compatibility.js` —— 日志调度泄漏点

## Decisions

11 决策全拍定（详见 [research.md §7](./research.md)）：

| 编号 | 决策 | 要点 |
| --- | --- | --- |
| D-WR-1 | engine 契约 | strategy 对象 + `defineEngine(overrides)` 默认工厂 |
| D-WR-2 | compile 边界 | 完全自管循环（logic independent 特化内闭环）|
| D-WR-3 | 能力渗透 | AsyncLocalStorage（`abilityContext`，收敛点 getStore）|
| D-WR-4 | 能力兜底 | 无 context 走 console.warn + 测试直连 run-scoped 注入 |
| D-WR-5 | worker 入口 | per engine thin entry（2 行）+ engine 在 index.js export |
| D-WR-6 | outputCount | 归 sink 实例（`sink.count`），业务文件消失 |
| D-WR-7 | compatibility 状态 | pendingWarnings 归 logger；warnedItems 留模块级（行为 0）|
| D-WR-8 | 跨线程去重 | 保留主线程 Set 兜底（现状行为 0）|
| D-WR-9 | 资源层接缝 | `executeTask({engine,input,onOutput,onProgress})→Promise`，任务层/资源层分离 |
| D-WR-10 | 调度模型演进 | 现状直接调度保持；B 批量不做；C AsyncIterator 留 pool/queue 候选 |
| D-WR-11 | emitEntry 契约 | `Promise<void>` + fire-and-forget；D-E-9 return number 废弃回流 |

## Requirements

11 个需求（详见 [requirements.md](./requirements.md)）：

- **R-WR0** MUST 线程调度知识从业务文件消失（三引擎 if 块 + collectOutput + outputCount + isMainThread 判定；output.js 删除）
- **R-WR1** MUST worker-runtime 收敛面建立（runtime.js + executor.js + context.js）
- **R-WR2** MUST engine strategy 契约（defineEngine + compile/cleanup/buildConfig/successPayload/normalizeError）
- **R-WR3** MUST 能力注入（sink + logger via AsyncLocalStorage，收敛点 getStore）
- **R-WR4** MUST per engine thin entry（worker-entry.js）
- **R-WR5** MUST outputCount 归 sink 实例（sink.count）
- **R-WR6** MUST compatibility 状态收敛（pendingWarnings 归 logger，warnedItems 留模块级）
- **R-WR7** MUST executeTask 资源层接缝（任务层/资源层分离）
- **R-WR8** MUST emitEntry fire-and-forget 契约（Promise<void>，D-E-9 废弃）
- **R-WR9** MUST 测试直连注入（FileSink + ConsoleLogger，run-scoped）
- **R-WR10** MUST 行为 0（产物字节 + sourcemap diff=0，vitest 584/584）

## Implementation plan

分阶段（详见 [implementation-plan.md](./implementation-plan.md)）：

| 步骤 | 内容 | 验证点 |
| --- | --- | --- |
| P-WR00 | baseline 记录（commit + 4 组产物 digest + vitest 基线）| digest + 584/584 |
| P-WR01 | worker-runtime 骨架（6 模块：context.js + runtime.js + executor.js + sinks.js + loggers.js + define-engine.js）| tsc build + 模块可 import |
| P-WR02 | 三引擎 engine export（只加 defineEngine + export，不动调度，F47）| engine export 可读 + 4 组 diff=0 |
| P-WR03 | 调度原子切换（thin entry + emitEntry/output + compile 签名 + successPayload + 删 onMessage + getStore，F45+F47）| worker 跑通 + 零调度残留 + 4 组 diff=0 |
| P-WR04 | （合并入 P-WR03）| — |
| P-WR05 | compatibility 改（logger 注入 + warnedItems 留模块级 + takeCompatibilityWarnings→logger.flush）| compatibility 零 isMainThread |
| P-WR06 | stage-channel 改（executeTask 接缝，内部线性化）| stage-channel 调度知识集中 |
| P-WR07 | 测试直连注入改造（FileSink + ConsoleLogger 包 run）| 40 测试 parentPort null 问题解决 |
| P-WR08 | 全量验证（4 组 diff=0 + vitest + grep 锚定 + tsc）| 全绿 |

## Acceptance

11 个验收（详见 [acceptance.md](./acceptance.md)）：

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-WR0 | R-WR0 | grep 零调度残留 in view/logic/style/output/compatibility | grep 退出码 1 | pending |
| A-WR1 | R-WR1 | worker-runtime/ 目录存在 + 模块可 import | import 成功 | pending |
| A-WR2 | R-WR2 | defineEngine 契约 + 三 engine 注册 | 代码审查 | pending |
| A-WR3 | R-WR3 | abilityContext.run + 收敛点 getStore | 代码审查 | pending |
| A-WR4 | R-WR4 | 三 worker-entry.js 存在 + stage-channel 指向 | 文件存在 | pending |
| A-WR5 | R-WR5 | sink.count 暴露 + outputCount 从业务消失 | grep 零 outputCount in view/logic/style | pending |
| A-WR6 | R-WR6 | pendingWarnings 归 logger + warnedItems 留模块级 | 代码审查 | pending |
| A-WR7 | R-WR7 | executeTask 契约 6 点（含 result 形状）+ 任务层/资源层分离 | 代码审查 | pending |
| A-WR8 | R-WR8 | emitEntry return void + D-E-9 回流标注 | grep + architecture-notes | pending |
| A-WR9 | R-WR9 | 测试直连 FileSink + ConsoleLogger 注入 | 40 测试不再崩溃 | pending |
| A-WR10 | R-WR10 | 4 组 diff=0 + vitest 584/584 | diff + vitest 输出 | pending |

## Validation

验证计划（详见 [validation.md](./validation.md)）：4 组产物对拍（nomap/min-nomap/sm/sm-min）+ vitest 全量 + grep 锚定（调度残留 / fs in output·emit / type:output postMessage）+ tsc build。

## Readiness gaps

无。11 决策全拍定（D-WR-1..11），设计输入完整（research.md），范围边界清晰（Non-goals 明确 pool/queue/memfs/transform/cluster 排除）。

## Closure conditions

- 所有 MUST 验收（A-WR0..10）passed with evidence
- 行为 0：4 组产物 diff=0 + vitest 584/584
- D-E-9 废弃回流 emit-layer architecture-notes（归档文档标注 supersede 或 sidecar 新增条目）
- output-pure 评估（目标若被本 Action 包含则关闭 superseded）
- Status / path / navigation / archive 一致

## Related

- [research.md](./research.md) —— 摸排总报告 + 11 决策
- `fe-tools-bundler-output-pure` —— 暂停（draft），待本 Action complete 后评估
- `fe-tools-bundler-emit-layer` —— D-E-2 精神对齐；D-E-9 待回流
- `fe-tools-bundler-emit-memfs` —— 正交（materialize/dev server，不依赖本 Action）
