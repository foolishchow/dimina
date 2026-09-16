# Requirements — fe-tools-bundler-output-pure

Status: **draft（R3 review 修正 · 2026-09-16）** — 阶段 1：worker 无 fs。

## R-OP0（MUST）删 collectOutput=false 死路径

- output.js 删直写分支（mkdir+writeFileSync）；删 fs/path import。
- build-pipeline 所有 runCompileStage 都传 onOutput → collectOutput 恒 true → 路径 B 零调用方（实证）。删它零风险。

## R-OP1（MUST）output 纯 postEntry

- `write` → 改名 `postEntry`；只收 `{ entry }`；只 `parentPort.postMessage({ type:'output', entry })`。
- worker 侧彻底无 fs（output.js 不 import fs/path）。

## R-OP2（MUST）emitEntry 删 outputEnv

- D-E-10 的 `outputEnv={collectOutput, writeDir}` 在 C 方案下全空（collectOutput 恒 true 删了；writeDir 不再传给 postEntry）——死参数，删。
- emitEntry 签名 `emitEntry(params)`，无第二参数。
- 内部：策略 apply → 拼 entry → `postEntry({entry})` → return 1。

## R-OP3（MUST）清理 collectOutput 全链路

- 三引擎删 worker 全局 `let collectOutput` 变量 + onMessage 的 `collectOutput = !!collectFlag`。
- stage-channel 删 `collectOutput` 字段（onOutput 机制保留——主线程接 postMessage 走 BuildModel.add）。
- **outputCount 对账保留**（D-OP-2）：view/logic 经 emitEntry return 1 累加；style 不经 emitEntry，postEntry 后 worker 全局 `outputCount++` 累加——两条路径都保留。**删 `collectOutput` 变量，保留 `outputCount` 变量**（名字相似，勿混）。
- 三引擎 emitEntry 调用去 outputEnv 第二参数；style write → postEntry。

## R-OP4（MUST）materialize 不动

- materialize（build-model.js mkdir+writeFileSync）独占写盘，本 Action 不碰。
- 职责分层：worker postEntry（无 fs）vs 主线程 materialize（有 fs）。

## R-OP5（MUST）行为 0

- 产物字节不变（死路径无测试覆盖，删了无影响；活路径 postMessage 行为不变）。
- vitest 全量绿。
