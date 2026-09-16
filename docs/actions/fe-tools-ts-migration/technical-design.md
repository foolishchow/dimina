# Technical Design — fe-tools-ts-migration

Status: **draft**

## Non-goals

详见 [README.md Non-goals](./README.md#non-goals)。本 Action 不做：类型注解、行为改变、src/compiler 外迁移、测试文件迁移（待 D-TM-2 拍板）。

## 后缀策略（D-TM-1，待拍板）

建议**方案 A（显式 .ts）**：

```ts
// .ts 文件 import .ts（统一显式 .ts 后缀）
import { abilityContext } from './context.ts'  // 非 worker
import { runWorker } from '../worker-runtime/runtime.ts'  // worker 直跑（strip-types 注入）
```

tsc `rewriteRelativeImportExtensions: true` 把 .ts import rewrite 成 .js in dist。Node native worker + vite + tsc 都解析 .ts。

## 类型完善（D-TM-4 = 选项 B，R1 POC 证伪后拍板）

**纯改名不可行**——.js→.ts 后 tsc 强制类型检查（checkJs:false 只管 .js），JSDoc `@typedef` 在 .ts 失效，隐式 any 报错 → tsc build 失败（详见 [research §6 R1 F3](research.md)）。

**类型完善方向（不用 any）**：

```ts
// JSDoc @typedef → TS type
// 旧：/** @typedef {object} Attr */
// 新：
export type Attr = { span: Span; name: string; value: Value }

// JSDoc @param/@returns → TS 签名
// 旧：
/** @param {string|null|undefined} raw
 *  @returns {Value} */
// 新：
export function makeValue(raw: string | null | undefined, span: Span | null = null): Value { ... }
```

- 9 `@typedef` → `type`/`interface`（4 文件）
- 361 `@param/@returns` → 函数签名注解
- 隐式 any → 推断或显式（不用 `any`，不用 `noImplicitAny:false`）

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
| D-TM-2 | __tests__/ scope（scope 内）| A-TM2 |
| D-TM-3 | 分阶段顺序 | A-TM3 |
| D-TM-4 | JSDoc→TS type（选项 B，不用 any）| A-TM5 |
