# Validation — fe-tools-worker-runtime

Status: **draft**

## 计划命令（待执行）

### V-WR00 — baseline 记录

```bash
cd fe/tools/bundler
git rev-parse --short HEAD  # baseline commit
# 4 组产物
node -e "
import build from './src/index.js'
for (const [name, opts] of [['nomap',{sourcemap:false,minify:false}],['min-nomap',{sourcemap:false,minify:true}],['sm',{sourcemap:true,minify:false}],['sm-min',{sourcemap:true,minify:true}]]) {
  await build('/tmp/wr-baseline-'+name+'/out', '<base>', false, opts)
}" 
node pnpm.mjs test 2>&1 | grep -E 'Test Files|Tests '  # 基线 584/584
```

### V-WR01 — worker-runtime 骨架

```bash
cd fe/tools/bundler
ls src/compiler/worker-runtime/  # context.js runtime.js executor.js sinks.js loggers.js define-engine.js
node pnpm.mjs build  # tsc 产出 dist
node -e "import('./src/compiler/worker-runtime/define-engine.js')"  # 可 import
node pnpm.mjs test 2>&1 | grep -E 'Test Files|Tests '  # 仍 584/584（纯新增）
```

### V-WR02 — 三引擎 engine 化

```bash
cd fe/tools/bundler
grep -rn "isMainThread\|parentPort\|let collectOutput\|let outputCount\|if (!isMainThread)" \
  src/compiler/view/index.js src/compiler/logic/index.js src/compiler/style/index.js
# 退出码 1（零残留）
grep -n "export const .*Engine = defineEngine" \
  src/compiler/view/index.js src/compiler/logic/index.js src/compiler/style/index.js
# 三行命中
```

### V-WR03 — thin entry + WORKER_ENTRY

```bash
cd fe/tools/bundler
ls src/compiler/view/worker-entry.js src/compiler/logic/worker-entry.js src/compiler/style/worker-entry.js
grep -n "WORKER_ENTRY" src/compiler/pipeline/stage-channel.js  # 指向 worker-entry.js
# dev server 编译跑通（4 组 diff=0 见 V-WR08）
```

### V-WR04 — emitEntry/output 改

```bash
cd fe/tools/bundler
grep -n "return 1\|return number\|outputCount +=\|outputCount++" src/compiler/  # 零残留
grep -n "async function emitEntry\|async emitEntry" src/compiler/pipeline/emit.js  # Promise<void>
grep -n "abilityContext.getStore" src/compiler/pipeline/emit.js  # sink 注入
```

### V-WR05 — compatibility 改

```bash
cd fe/tools/bundler
grep -n "isMainThread\|pendingWarnings\|takeCompatibilityWarnings" src/compiler/core/compatibility.js
# isMainThread 零（warnedItems 保留）
grep -n "abilityContext.getStore\|logger.warn" src/compiler/core/compatibility.js  # logger 注入
grep -n "logger.flush" src/compiler/worker-runtime/runtime.js  # success 时 flush
```

### V-WR06 — stage-channel executeTask

```bash
cd fe/tools/bundler
grep -n "new Worker" src/compiler/  # only in worker-runtime/executor.js
grep -n "executeTask" src/compiler/pipeline/stage-channel.js  # 调用接缝
grep -n "receivedOutputCount\|sink.count\|outputCount" src/compiler/worker-runtime/executor.js  # 对账源
```

### V-WR07 — 测试直连注入

```bash
cd fe/tools/bundler
grep -rn "abilityContext.run\|runWithAbilities" __tests__/  # 测试注入
node pnpm.mjs test 2>&1 | grep -E 'Test Files|Tests '  # 584/584（无 parentPort null 崩溃）
```

### V-WR08 — 全量验证

```bash
cd fe/tools/bundler
# 4 组对拍
for c in nomap min-nomap sm sm-min; do
  diff -rq /tmp/wr-baseline-$c/out /tmp/wr-current-$c/out  # 0
done
# vitest
node pnpm.mjs test 2>&1 | grep -E 'Test Files|Tests '  # 584/584
# grep 锚定
grep -rn "collectOutput" src/compiler/  # 全仓零
grep -rn "isMainThread\|parentPort" src/compiler/{view,logic,style}/index.js src/compiler/pipeline/output.js src/compiler/core/compatibility.js  # 零
grep -rn "new Worker" src/compiler/  # only executor.js
grep -rn "parentPort.postMessage" src/compiler/  # only runtime.js + sinks.js
# tsc
node pnpm.mjs build  # OK
```

## 实际环境（待执行）

| Field | Actual value |
| --- | --- |
| Date | （待执行）|
| Commit | （待执行）|
| Environment | node v22 + worker_threads + AsyncLocalStorage |

## 证据形态

| Acceptance | Command or observation | Exit/result | Evidence | Result |
| --- | --- | --- | --- | --- |
| A-WR0 | grep 调度残留 | 1 | grep 输出 | pending |
| A-WR1 | ls + import | 0 | 目录 + import 成功 | pending |
| A-WR10 | 4×diff + vitest + tsc | 0 / 584 | diff=0 + vitest + tsc | pending |

## Uncovered areas and residual risks

- **fork Actions CI**（P-WX01 Uncovered）：CI green 推迟到 didi-side 回流 PR，本 Action 验证依赖本地 vitest + 产物对拍
- **AsyncLocalStorage 跨 async 边界**：P-WR08 验证 compileML/compileSS 内部 await（esbuild/less/sass）不丢 context
- **FileSink 字节一致**：P-WR08 对拍验证 FileSink 写盘与 output.write 直写路径字节相同

## Closure judgment

Decision: （待执行）
Reason: （待执行）
