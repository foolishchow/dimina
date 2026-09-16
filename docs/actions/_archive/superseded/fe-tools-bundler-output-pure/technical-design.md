# Technical Design — fe-tools-bundler-output-pure

Status: **draft** — 阶段 1：worker 无 fs。

## 1. 现状锚定（实证）

| 层 | 现状 | 问题 |
| --- | --- | --- |
| output.js | `write({entry, collectOutput, writeDir})` 双路径 | 路径 B（直写）死路径；双职责 |
| stage-channel | `collectOutput: typeof onOutput === 'function'` | 恒 true（build-pipeline 总传 onOutput） |
| 三引擎 | worker 全局 `let collectOutput` + `collectOutput = !!collectFlag` | 死变量 |
| materialize | mkdir+writeFileSync 独占主线程写盘 | 本 Action 不动 |

## 2. 方案 C（拍板）：output 最纯

### output.js（改后）

```js
import { parentPort } from 'node:worker_threads'

/**
 * @typedef {{ path: string, code: string }} EmitFile
 * @typedef {{ path: string, map: string }} EmitSourcemap
 * @typedef {{ entryId: string, kind: string, files: EmitFile[], sourcemaps?: EmitSourcemap[] }} EmitEntry
 */

/**
 * worker 侧产物出口——纯 postMessage，无 fs。
 * 写盘 100% 归主线程 materialize。
 */
export function postEntry({ entry }) {
	parentPort.postMessage({ type: 'output', entry })
}
```

- 删 fs/path import；删 collectOutput/writeDir 参数；删直写分支。
- `write` → `postEntry`（名实相符）。

### emit.js（改后）

```js
import { postEntry } from './output.js'   // 原 import { write }，改名 postEntry

// emitEntry 删 outputEnv 第二参数（D-E-10 的 outputEnv 在 C 方案下全空）
export async function emitEntry(params) {
	const strategy = strategies[params.transform.strategy]
	if (!strategy) throw new Error(`emitEntry: 未知 transform 策略 ${params.transform.strategy}`)
	const { entry } = await strategy.apply(params)
	postEntry({ entry })   // 只 postEntry，不传 collectOutput/writeDir
	return 1
}
```

- import 从 `./output.js` 的 `write` → `postEntry`。

### 三引擎（改后）

- view/logic：`emitEntry({...}, { collectOutput, writeDir })` → `emitEntry({...})`（去 outputEnv）
- style：`write({entry, collectOutput, writeDir})` → `postEntry({entry})`（两处：sourcemap + 非 sourcemap）；**style 的 `outputCount++` 保留**（postEntry 后累加）
- 删 worker 全局 `let collectOutput` 变量 + onMessage 解构参数 `collectOutput: collectFlag` 字段 + 赋值行 `collectOutput = !!collectFlag`；**保留 `let outputCount` 变量**（collectOutput/outputCount 名字相似，只删前者）

### stage-channel（改后）

- 删 `collectOutput: typeof onOutput === 'function'` 字段（postMessage 给 worker 的消息少一个字段）
- onOutput 机制保留（主线程 `message.type==='output'` → `onOutput(message.entry)` → BuildModel.add）

### materialize（不动）

- mkdir+writeFileSync 独占主线程写盘。

## 3. 行为 0 证明

- collectOutput=false 路径零调用方（实证）→ 删它无影响
- collectOutput=true 路径：postMessage 行为不变（postEntry === 原 write 的路径 A）
- materialize 不动 → 主线程写盘不变
- outputCount 对账不变（D-OP-2）：emitEntry 仍 return 1，stage-channel 对账仍通过
- 产物字节不变；vitest 全绿

## 4. 职责分层（改后）

```
worker 侧：  emitEntry → postEntry → postMessage（无 fs）✅
主线程侧：   message → BuildModel.add → materialize（有 fs，独占写盘）
```

worker 侧彻底无 fs，materialize 是唯一写盘点——为阶段 2 memfs 留单一边界。

## 5. 决策

| ID | 决策 | 一句话理由 |
| --- | --- | --- |
| D-OP-1 | emitEntry 接口演进：删 outputEnv 第二参数 | D-E-10 的 outputEnv={collectOutput,writeDir} 在 C 方案（worker 无 fs）下全空——outputEnv 载体空壳化，删除。**D-E-10 决策精神保留**（纯参数、不引入 EmitContext、不绑 worker 上下文），本 Action 强化之（单参数比带 outputEnv 更纯）。architecture-notes 回流标注 D-E-10 outputEnv 形态演进。 |
| D-OP-2 | outputCount 对账机制保留 | view/logic 经 emitEntry return 1 累加 outputCount；**style 不经 emitEntry，postEntry 后 worker 全局 `outputCount++` 累加**——两条路径都保留。worker 仍发 outputCount；stage-channel 仍对账。**删 `collectOutput` 变量，保留 `outputCount` 变量**（名字相似，勿混）。 |

## 6. Non-goals

- memfs（materialize + dev server）——阶段 2 另立
- cache + 目录归置——依赖 cache 家拍板，另立
- materialize 重构——本 Action 不动
