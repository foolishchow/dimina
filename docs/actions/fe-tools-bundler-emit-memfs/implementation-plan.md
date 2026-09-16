# Implementation Plan — fe-tools-bundler-output-pure

Status: **draft（C 方案拍板 · 2026-09-16）** — 阶段 1：worker 无 fs。

## 基线

- 授权时记录 HEAD。
- 行为 0：产物字节不变 + vitest 全量绿。
- materialize 不动。

## 触达序

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `pipeline/output.js` | `write` → `postEntry`；删 fs/path import + 直写分支；只收 `{entry}` postMessage |
| 2 | `pipeline/emit.js` | import `write` → `postEntry`；emitEntry 删 outputEnv 第二参数；内部 `postEntry({entry})` |
| 3 | `view/index.js` | emitEntry 调用去 outputEnv；删 worker 全局 `collectOutput` 变量 + onMessage 赋值 |
| 4 | `logic/index.js` | 同 view（emitEntry 去 outputEnv + 删 collectOutput 变量） |
| 5 | `style/index.js` | `write({entry, collectOutput, writeDir})` → `postEntry({entry})`（两处）；删 collectOutput 变量 |
| 6 | `pipeline/stage-channel.js` | 删 `collectOutput` 字段（onOutput 机制保留） |
| 7 | 验证 | vitest 全量绿；grep worker 侧零 `fs` import（output.js/emit.js 无 fs）；产物 diff=0 |

## 门禁

| Gate | 条件 |
| --- | --- |
| G1 | output.js 无 fs import；postEntry 只 postMessage |
| G2 | emitEntry 无 outputEnv 第二参数 |
| G3 | 三引擎 worker 侧无 `let collectOutput` 变量 |
| G4 | stage-channel 无 collectOutput 字段 |
| G5 | vitest 全绿 + 产物 diff=0 |

## 消融

- 拔 postEntry（回 writeFileSync 直写）→ materialize 名不副实重现（worker 直写 grep 命中）→ 恢复绿
