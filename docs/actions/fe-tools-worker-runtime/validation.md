# Validation — fe-tools-worker-runtime

Status: **draft**

## 计划命令（待执行）

### V-WR00 — baseline 记录

```bash
cd fe/tools/bundler
git rev-parse --short HEAD  # baseline commit
# 4 组产物（用临时 .mjs 脚本，避免 node -e 多行问题）
cat > /tmp/wr-gen-baseline.mjs << 'EOF'
import build from '/Users/foolishchow/Workspaces/dimina/fe/tools/bundler/src/index.js'
const base = '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base'
for (const [name, opts] of [['nomap',{sourcemap:false,minify:false}],['min-nomap',{sourcemap:false,minify:true}],['sm',{sourcemap:true,minify:false}],['sm-min',{sourcemap:true,minify:true}]]) {
  await build(`/tmp/wr-baseline-${name}/out`, base, false, opts)
}
console.log('baseline done')
EOF
node /tmp/wr-gen-baseline.mjs
node pnpm.mjs test 2>&1 | grep -E 'Test Files|Tests '  # 基线 584/584
```

### V-WR01 — worker-runtime 骨架

```bash
cd fe/tools/bundler
ls src/compiler/worker-runtime/  # context.js runtime.js executor.js sinks.js loggers.js define-engine.js
node pnpm.mjs build  # tsc 产出 dist（新模块可编译）
# 可 import 验证（走 dist，避免 src ts 解析问题 D-TD-20）
node -e "import('./dist/compiler/worker-runtime/define-engine.js')"
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

### V-WR03 — thin entry + ENTRY_PATH

```bash
cd fe/tools/bundler
ls src/compiler/view/worker-entry.js src/compiler/logic/worker-entry.js src/compiler/style/worker-entry.js
grep -n "ENTRY_PATH" src/compiler/worker-runtime/executor.js  # 指向 worker-entry.js（F40：P-WR06 从 stage-channel 搬 executor）
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
grep -n "logger.flush" src/compiler/view/index.js src/compiler/logic/index.js  # F28：successPayload 覆盖处 flush
grep -n "engine.successPayload" src/compiler/worker-runtime/runtime.js  # runtime 调 successPayload({ logger })
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
grep -rn "isMainThread\|parentPort" src/compiler/{view,logic,style}/index.js src/compiler/core/compatibility.js  # 零（output.js 已删）
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
| A-WR0 | grep 调度残留 in view/logic/style/compatibility | 1 | grep 输出 | pending |
| A-WR1 | ls worker-runtime/ + dist import | 0 | 目录 + import 成功 | pending |
| A-WR2 | grep defineEngine + 三 engine | 0 | 三行命中 | pending |
| A-WR3 | grep abilityContext.getStore in emit.js/compatibility.js | 0 | 收敛点命中 | pending |
| A-WR4 | ls 三 worker-entry.js + grep ENTRY_PATH in executor.js | 0 | 文件 + 指向 | pending |
| A-WR5 | grep sink.count + 零 outputCount in view/logic/style | 0 | 命中 + 零 | pending |
| A-WR6 | grep pendingWarnings 零 + warnedItems 保留 + logger.flush in view/logic + engine.successPayload in runtime + ctx.compatibilityWarnings | 0 | grep 结果 | pending |
| A-WR7 | grep new Worker only in executor.js | 0 | 单点 | pending |
| A-WR8 | grep return 1 零 in emit.js + architecture-notes | 0 | 零 + 标注 | pending |
| A-WR9 | grep abilityContext.run in __tests__ | 0 | 注入命中 | pending |
| A-WR10 | 4×diff + vitest + tsc | 0 / 584 | diff=0 + vitest + tsc | pending |

（详见各 V-WR00..08 命令）

## Uncovered areas and residual risks

- **fork Actions CI**（P-WX01 Uncovered）：CI green 推迟到 didi-side 回流 PR，本 Action 验证依赖本地 vitest + 产物对拍
- **AsyncLocalStorage 跨 async 边界**：P-WR08 验证 compileML/compileSS 内部 await（esbuild/less/sass）不丢 context
- **FileSink 字节一致**：P-WR08 对拍验证 FileSink 写盘与 output.write 直写路径字节相同

## Closure judgment

Decision: （待执行）
Reason: （待执行）
