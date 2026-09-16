# Acceptance — fe-tools-bundler-output-pure

Status: **draft（C 方案拍板 · 2026-09-16）** — 实施后回填 Actual。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-OP0 | R-OP0 | collectOutput=false 死路径删除 | P-OP0 | pending |
| A-OP1 | R-OP1 | output.js `postEntry` 只 postMessage，无 fs import | P-OP1 | pending |
| A-OP2 | R-OP2 | emitEntry 无 outputEnv 第二参数 | P-OP2 | pending |
| A-OP3 | R-OP3 | 三引擎无 collectOutput 变量；stage-channel 无 collectOutput 字段 | P-OP3 | pending |
| A-OP4 | R-OP4 | materialize 不动（git diff 零触碰 build-model.js 写盘逻辑） | P-OP4 | pending |
| A-OP5 | R-OP5 | 产物 diff=0 + vitest 全量绿 | P-OP5 | pending |

## Non-acceptance

- memfs（materialize + dev server）——阶段 2 另立
- cache + 目录归置——依赖 cache 家拍板，另立
- materialize 重构——本 Action 不动
