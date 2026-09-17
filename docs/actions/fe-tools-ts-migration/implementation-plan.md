# Implementation Plan — fe-tools-ts-migration

## 步骤表（D-TM-3 分阶段 + 类型化，R2 F9 策略）

| ID | 阶段 | 前置 | 验证点 |
| --- | --- | --- | --- |
| P-TM00 | baseline 记录 + tsconfig strict 确认 | — | digest + 584/584 + tsc 0 错误（现状）|
| P-TM01 | @typedef → TS type（9 个，4 文件，消除 TS2305 链式）| P-TM00 | grep 零 @typedef + tsc --checkJs TS2305 链式清零（该文件其他隐式 any 留 P-TM02..06）|
| P-TM02 | shared/ 8 + core/env.js 类型化（基础渗透，env 被 34 处 import）| P-TM01 | tsc --checkJs shared+env 错误清零 + 4 组 diff=0 |
| P-TM03 | core/ 其余 7 + worker-runtime/ 6 类型化 | P-TM02 | tsc --checkJs core+worker-runtime 清零 + diff=0 |
| P-TM04 | pipeline/ 6 + model/ 6 + session/ 4 + watch/ 3 类型化 | P-TM03 | tsc --checkJs pipeline+model+session+watch 清零 + diff=0 |
| P-TM05 | view/ + view/wxml/ 14 + logic/ 2 + style/ 2 类型化 | P-TM04 | tsc --checkJs view+logic+style 清零 + diff=0 |
| P-TM06 | bin/ 3 + dev/ 5 + src/根 2 类型化 | P-TM05 | tsc --checkJs 全 src 清零 + diff=0 |
| P-TM07 | __tests__/ import 后缀（D-TM-2 scope 内）| P-TM06 | vitest 584/584 |
| P-TM08 | 全量验证 | P-TM07 | grep 零 .js + 零 @typedef + 零 any + 4 组 diff=0 + 584/584 + tsc strict OK |

## 类型化步骤模板（每文件）

1. `.js` → `.ts` 改名
2. `@typedef` → `type`/`interface`（如有）
3. `@param/@returns` → 函数签名 `:type` + `:returnType`
4. 隐式 any 参数/变量 → 推断或显式类型（**不用 `any`**）
5. import 后缀修正（`.js`→`.ts` 显式，D-TM-1）
6. tsc --checkJs 该文件错误清零
7. vitest + 4 组 diff=0

## P-TM01 — @typedef → TS type（先行，消除链式报错）

4 文件 9 个 @typedef：
- `src/compiler/view/wxml/common/document.js`：Span, Document, Value, Attr
- `src/compiler/view/wxml/common/document-ops.js`：（查）
- `src/compiler/pipeline/emit.js`：（查）
- `src/compiler/view/wxml/napi/parse.js`：（查）

转换：
```ts
// 旧
/** @typedef {{ start: number, end: number }} Span */
/** @typedef {object} Value */
/** @typedef {object} Attr */

// 新
export type Span = { start: number; end: number }
export type Value = { raw: string; span: Span | null; /* ... */ }
export type Attr = { span: Span; name: string; value: Value }
```

## P-TM02 — shared/ + core/env.js（基础渗透）

- `src/shared/` 8 文件（utils, lifecycle, compile-config, platforms 等）——被 compiler/session/model import
- `src/compiler/core/env.js`——被 34 处 import（全局基础）

类型化后基础类型渗透到下游，减少 property any（TS2339）。

## P-TM03 — core/ 其余 + worker-runtime/

- core/ 7：compatibility(38 错), sourcemap, renderers, expression-parser, npm-builder, npm-resolver, compatibility-reference
- worker-runtime/ 6：context, runtime, executor, sinks, loggers, define-engine

## P-TM04 — pipeline/ + model/ + session/ + watch/

- pipeline/ 6（build-pipeline, compile-stages, config-compiler, emit, publish, stage-channel）
- model/ 6（build-model, compile-cache 等）
- session/ 4
- watch/ 3

## P-TM05 — view/ + logic/ + style/

- view/ + view/wxml/ 14（index(101 错), parse, compile, document, document-ops, load/*, renderer/vue/*, cheerio/napi）
- logic/ 2（index(59 错), worker-entry）
- style/ 2（index(86 错), worker-entry）

## P-TM06 — bin/ + dev/ + src/根

- bin/ 3, dev/ 5, src/根 2
