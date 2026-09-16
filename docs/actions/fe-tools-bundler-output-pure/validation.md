# Validation — fe-tools-bundler-output-pure

Status: **draft（C 方案拍板 · 2026-09-16）** — 实施后回填 Result。

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-OP0 | 死路径删除 | grep `collectOutput.*false` / 直写 writeFileSync 分支在 output.js 零命中 | A-OP0 | pending |
| P-OP1 | output 纯 postEntry | output.js 无 `import fs`/`import path`；`postEntry` 只 `parentPort.postMessage` | A-OP1 | pending |
| P-OP2 | emitEntry 无 outputEnv | emitEntry 签名单参数；调用方无第二参数 | A-OP2 | pending |
| P-OP3 | collectOutput 链路清理 | 三引擎无 `let collectOutput`；stage-channel 无 `collectOutput` 字段 | A-OP3 | pending |
| P-OP4 | materialize 不动 | `git diff` build-model.js 写盘逻辑零触碰 | A-OP4 | pending |
| P-OP5 | 行为 0 | base 工程 4 组 diff=0 + vitest 全量绿 | A-OP5 | pending |

## Actual

（实施后填写）
