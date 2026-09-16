# Technical Design — fe-tools-ts-migration

Status: **draft**

## Non-goals

详见 [README.md Non-goals](./README.md#non-goals)。本 Action 不做：类型注解、行为改变、src/compiler 外迁移、测试文件迁移（待 D-TM-2 拍板）。

## 后缀策略（D-TM-1，待拍板）

建议**方案 A（显式 .ts）**：

```js
// .ts 文件 import .ts（统一显式 .ts 后缀）
import { abilityContext } from './context.ts'  // 非 worker
import { runWorker } from '../worker-runtime/runtime.ts'  // worker 直跑（strip-types 注入）
```

tsc `rewriteRelativeImportExtensions: true` 把 .ts import rewrite 成 .js in dist。Node native worker + vite + tsc 都解析 .ts。

## 分阶段（D-TM-3，待拍板）

建议 core → worker-runtime → pipeline → view → logic/style（按依赖图被 import 次数降序）。

## worker strip-types（D-TD-20）

worker-entry × 3 + worker-runtime runtime/executor 在 `/src/` 时：
```js
...(import.meta.url.includes('/src/') ? { execArgv: [...process.execArgv, '--experimental-strip-types'] } : {})
```
现状已注入（stage-channel + executor）。改 .ts 后无需额外改动。

## 行为 0 保证

| 维度 | 保证 |
| --- | --- |
| 产物字节 | tsc 编译 .ts → .js in dist，字节不变 |
| sourcemap | 不动 |
| vitest | vite resolve .ts/.js 自动 |
| worker | strip-types 已注入 |

## 决策映射

| 决策 | 落地点 | 验收 |
| --- | --- | --- |
| D-TM-1 | import 后缀策略 | A-TM1 |
| D-TM-2 | __tests__/ scope | A-TM2 |
| D-TM-3 | 分阶段顺序 | A-TM3 |
| D-TM-4 | checkJs | A-TM4 |
