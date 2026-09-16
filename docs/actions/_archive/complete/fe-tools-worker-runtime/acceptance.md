# Acceptance — fe-tools-worker-runtime

Status: **draft**

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-WR0 | R-WR0 | grep 零调度残留（isMainThread/parentPort/collectOutput/outputCount/if(!isMainThread)）in view/logic/style/compatibility（output.js 已删） | `grep -rn "isMainThread\|parentPort\|collectOutput\|let outputCount\|if (!isMainThread)" src/compiler/{view,logic,style}/index.js src/compiler/core/compatibility.js` 退出码 1 | passed |
| A-WR1 | R-WR1 | worker-runtime/ 目录存在 + 6 模块（context/runtime/executor/sinks/loggers/define-engine）可 import | `ls src/compiler/worker-runtime/` + `node -e "import('./src/compiler/worker-runtime/define-engine.js')"` | passed |
| A-WR2 | R-WR2 | defineEngine 契约 + 三 engine（viewEngine/logicEngine/styleEngine）export | grep `export const .*Engine = defineEngine` in 三 index.js | passed |
| A-WR3 | R-WR3 | abilityContext（AsyncLocalStorage）+ 收敛点（emitEntry/warnOnce）getStore | grep `abilityContext.getStore()` in emit.js + compatibility.js | passed |
| A-WR4 | R-WR4 | 三 worker-entry.js 存在（2 行 thin）+ executor ENTRY_PATH 指向 thin entry | `ls src/compiler/{view,logic,style}/worker-entry.js` + grep ENTRY_PATH in worker-runtime/executor.js | passed |
| A-WR5 | R-WR5 | sink.count 暴露 + outputCount 从三引擎消失 | grep `sink.count` in runtime.js + grep 零 `outputCount` in view/logic/style/index.js | passed |
| A-WR6 | R-WR6 | pendingWarnings 归 logger（BufferingLogger）+ warnedItems 留模块级 + takeCompatibilityWarnings 废弃 + 主线程 ctx.compatibilityWarnings Set 兜底保留（D-WR-8）+ logger.flush 归 engine.successPayload（F28）| grep `pendingWarnings` 零 in compatibility.js + grep `warnedItems` 保留 + grep `logger.flush()` in view/logic/index.js（successPayload 覆盖处）+ grep `engine.successPayload({ logger })` in runtime.js + grep `ctx.compatibilityWarnings` 保留 in stage-channel | passed |
| A-WR7 | R-WR7 | executeTask 契约 6 点（含 result 形状，F35）+ new Worker only in executor.js | grep `new Worker` only in executor.js + `export function executeTask` 签名审查（6 点：输入/output/onOutput/onProgress/result 形状/资源层） | passed |
| A-WR8 | R-WR8 | emitEntry async Promise<void>（无 return number）+ D-E-9 回流标注 | grep `return 1` 零 in emit.js + architecture-notes D-E-9 废弃标注（归档文档 supersede 或 sidecar 新增） | passed |
| A-WR9 | R-WR9 | 测试直连用 abilityContext.run({ FileSink, ConsoleLogger }) 注入 | grep `abilityContext.run` in __tests__/ + 40 测试不再 parentPort null 崩溃 | passed |
| A-WR10 | R-WR10 | 4 组产物 diff=0 + vitest 584/584 + tsc build OK | diff -rq baseline current + vitest 输出 + tsc 输出 | passed |
