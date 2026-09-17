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

### 类型化难点（R7 F25 + R8 F27）

- **TS7023 递归函数自引用 any**：`resolveModuleIdToExistingPath` / `buildCompileView` / `projectChildren`——返回类型推断不了（自引用），**需显式返回类型注解**
- **TS7031 事件回调解构**：`{ event, filePath, count }`（bin/index.js + bin/dev.js）——**需事件 interface 定义**（如 `CompileEvent`）
- **TS7034/7005 变量隐式 any**：接收函数返回，上游类型化后自动消除
- **TS2345/2322 类型不兼容**（R8 F27）：
  - `string | null` → `string`（emit.js:90, style/index.js:57）——需 null 检查或断言
  - `string` → `Platform | undefined`（emit.js:53/121）——需字面量联合或断言
  - `TransformOptions` 形状不匹配（logic/index.js:381，esbuild loader）——需适配第三方类型
  - `WxmlRenderer` 形状不匹配（view/index.js:44，meta.backend/lineOrigins）——需补全 WxmlRenderer interface 字段
  - `CompilerOptions` 形状不匹配（view/index.js:546，vue compiler）——需适配 vue 类型
  - 函数签名不兼容（build-pipeline.js:218，runOptions vs object）——需精确函数签名
- **TS2314 泛型缺失**（R8 F27）：
  - `Map<K,V>` 需 2 参数（npm-builder.js:246）——需补类型参数
  - `Array<T>`/`Set<T>` 需 1 参数（view/index.js:619/869）——需补类型参数
- **TS2554 参数数量不匹配**（R12 F37）：
  - `env.js:369` `storeComponentConfig(configInfo.appInfo, appFilePath)`——签名/调用参数数不符，需核对函数签名与调用
  - `watch-plan.js:37/42`——Expected 0 got 1/2，需修正签名或调用
  - 真实调用错误，非加 `:type` 可解，需修正调用或签名

## P-TM01 — @typedef → TS type（先行，消除链式报错）

**R14 POC 验证**：`document.js→document.ts` + `@typedef→type` → TS2305 清零，类型 resolve 成功。

4 文件 9 个 @typedef：
- `src/compiler/view/wxml/common/document.js`：Span, Document, Value, Attr
- `src/compiler/view/wxml/common/document-ops.js`：（查）
- `src/compiler/pipeline/emit.js`：（查）
- `src/compiler/view/wxml/napi/parse.js`：（查）

**R14 F45 注意**：document.ts 改 @typedef→type 后，document-ops.js（还 .js）import document 类型可能触发 TS2353（对象字面量属性检查变严）。P-TM01 要同步处理 document-ops 的 @typedef→type + 对象字面量类型修正。

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

### P-TM01 import 后缀修正文件清单（R7 F24 + R10 F31）

共 21 处 import 修正（4 个 @typedef 文件的 import 方）：

**document.js**（9 处）：
- `src/compiler/view/wxml/common/wxml-ir.types.ts`（import type { Span, Attr, Value }）
- `src/compiler/view/wxml/common/parity.ts`（import { attrValueRaw }）
- `src/compiler/view/wxml/common/document-ops.js`（import 多个）
- `src/compiler/view/wxml/renderer/vue/tools.js`（import { attrsToRecord }）
- `src/compiler/view/wxml/load/index.js`（import { attachProjection }）
- `src/compiler/view/wxml/load/include.js`（import { createElement }）
- `src/compiler/view/wxml/cheerio/parse.js`（import 多个）
- `src/compiler/view/wxml/compile.js`（import { attachProjection }）
- `src/compiler/view/wxml/parse.js`（import { parseWxml... } from './napi/parse.js'）

**document-ops.js**（9 处）：
- `src/compiler/view/wxml/renderer/vue/tools.js`
- `src/compiler/view/wxml/renderer/vue/index.js`
- `src/compiler/view/wxml/load/index.js`
- `src/compiler/view/wxml/load/include.js`
- `src/compiler/view/wxml/load/template.js`
- `src/compiler/view/wxml/cheerio/parse.js`
- `src/compiler/view/wxml/napi/parse.js`
- `src/compiler/view/index.js`
- `__tests__/include-conditional-attrs.spec.js` + `__tests__/wxml-ir.spec.js` + `__tests__/wxml-parser-switch.spec.js`（3 测试）

**emit.js**（2 处）：
- `src/compiler/logic/index.js`（import { emitEntry }）
- `src/compiler/view/index.js`（import { emitEntry }）

**napi/parse.js**（1 处）：
- `src/compiler/view/wxml/parse.js`（import { parseWxml... }）

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

## 跨阶段 import 后缀修正工作量（R11 F34）

每阶段改名后需 grep 所有 import 方改后缀 `.ts`（含跨阶段文件，仅改后缀不改名）：

| 阶段 | 文件 | 跨 import 修正处 |
| --- | --- | --- |
| P-TM01 | document/document-ops/emit/napi-parse | 21 处 |
| P-TM02 | shared/ 8 | 35 处（utils 11 + lifecycle 7 + compile-config 6 + path-utils 5 + platforms 3 + compile-progress 2 + art 1）|
| P-TM03 | core/ 其余 + worker-runtime/ 6 | 16 处 worker-runtime（context 5 + runtime 3 + loggers 3 + define-engine 3 + sinks 1 + executor 1）+ core 待统计 |
| P-TM04 | pipeline/ + model/ + session/ + watch/ | 待统计 |
| P-TM05 | view/ + logic/ + style/ | 待统计 |
| P-TM06 | bin/ + dev/ + src/根 | 待统计 |

## worker-entry 链跨阶段依赖（R11 F35）

3 个 `worker-entry.js`（view/logic/style）各 import：
- `'../worker-runtime/runtime.js'` ← P-TM03 改 runtime.ts 时跨阶段改后缀（worker-entry 还 .js）
- `'./index.js'` ← P-TM05 改 index.ts 时改后缀

**跨阶段依赖**：P-TM03 碰 worker-entry 的 runtime import（改后缀 .ts，不改名）；P-TM05 再碰 worker-entry（改名 .ts + index import 后缀）。worker `/src/` 跑时 strip-types + .ts resolve。

## 提交策略（R13 F43）

每 P-TM 一步独立 commit（先例 worker-runtime P-WR00..08）：
- `P-TM00 baseline 记录`
- `P-TM01 @typedef→type + 21 处 import`
- `P-TM02 shared/ + core/env.js 类型化 + 35 处跨 import`
- `P-TM03 core/ 其余 + worker-runtime/ 类型化`
- `P-TM04 pipeline/ + model/ + session/ + watch/ 类型化`
- `P-TM05 view/ + logic/ + style/ 类型化 + worker-entry`
- `P-TM06 bin/ + dev/ + src/根 类型化`
- `P-TM07 __tests__/ import 后缀`
- `P-TM08 全量验证`
