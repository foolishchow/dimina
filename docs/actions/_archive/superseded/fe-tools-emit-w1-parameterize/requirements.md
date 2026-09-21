# Requirements — fe-tools-emit-w1-parameterize

## 问题

`pipeline/emit.ts`（233 行）是 Packer 方向的 4 个焊点之一。packer-research 识别它为"极接近纯化"——只剩 1 处 env.ts 依赖：

```
import { getWorkPath } from '../core/env.ts'
// L142: relative(finalOutputDir, resolve(getWorkPath(), sourcePath))
```

`getWorkPath()` 从 `AsyncLocalStorage` 读取编译上下文中的工作路径。emit.ts 通过这个全局函数隐式依赖 env.ts 的上下文机制，而非通过显式参数接收。

这意味着 emit.ts 不是一个纯函数——它的输出（sourcemap 路径）依赖运行时上下文状态，而非仅依赖输入参数。Packer 抽取要求 emit.ts 是纯函数。

## MUST 需求

- R-W1-1 MUST `pipeline/emit.ts` 不 import from `../core/env.ts`（`grep -c 'from.*env.ts' emit.ts` = 0）
- R-W1-2 MUST `EmitEntryParams` interface 含 `workPath: string` 字段
- R-W1-3 MUST `bundle` 策略 sourcemap rebase（L142）用参数 `workPath` 替代 `getWorkPath()`
- R-W1-4 MUST `view/index.ts` 的 `emitEntry` 调用传入 `workPath`（值 = `getWorkPath()`）
- R-W1-5 MUST `pipeline/build-pipeline.ts` 的 emit task 调用 emit-engine 时 `EmitEntryParams` 含 `workPath`
- R-W1-6 MUST 行为 0（nomap + sourcemap diff=0；全量 vitest 608/608；tsc 0 错）
- R-W1-7 MUST 不引入 `any` / `@ts-nocheck` / `as any`

## SHOULD

- R-W1-8 SHOULD 不新增文件

## 约束

- tsconfig: `noUnusedLocals: true` / `strict: true` / `module: NodeNext`
- 行为 0 纪律：sourcemap rebase 结果必须字节相同（`workPath` 值 = 原 `getWorkPath()` 值，参数化不改变值）
- emit-engine.ts `resetStoreInfo` 保留——`perModule` 策略不调 `getWorkPath()` 但 emit-worker 仍需 `storeInfo` 搭建其他上下文（如 `getDependencyGraph`）
- W3 决策：env.ts 不拆——本 Action 只从 emit.ts 移除依赖，不改 env.ts

## 非范围

- logic/\*\* 参数化（焊点 2——L 级大重构，另门）
- env.ts 拆分（焊点 3——W3 决策：不拆）
- dependency-graph 拆分（焊点 4——已干净）
- view/style 增量接入
- HMR
- Packer 整包抽取
