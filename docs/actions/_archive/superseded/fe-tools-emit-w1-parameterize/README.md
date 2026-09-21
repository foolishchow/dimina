# FE Tools Emit W1 Parameterize

- Action: `fe-tools-emit-w1-parameterize`
- Status: `superseded`
- Updated: 2026-09-21
- Status authority: [Action Status](../../../STATUS.md)
- 前身：[`fe-tools-packer-research`](../../complete/fe-tools-packer-research/README.md)（**complete 已归档**；4 焊点方法级审计，W1 emit.ts parameterize 可独立先行）
- 接替：[`fe-tools-packer-core-shape`](../../complete/fe-tools-packer-core-shape/README.md)（**complete 已归档**；讨论后判断 W1 单点参数化价值不足——1/16 耦合点，无用户价值。由 Packer core 6 组件形状定义取代。）
- 工作分支：`feature/fe-tools-sidecar`

## 背景

`fe-tools-packer-research`（complete 归档）识别了 4 个焊点（emit.ts / logic/\*\* / env.ts / dependency-graph.ts），结论是 Packer 整包抽取 ROI 不足，但 **W1（emit.ts parameterize）可独立先行（S 级低风险）**。

当前 emit.ts（233 行）仅剩 **1 处** env.ts 依赖：

```
import { getWorkPath } from '../core/env.ts'
// L142: relative(finalOutputDir, resolve(getWorkPath(), sourcePath))
```

这是 `bundle` 策略（view 用）的 sourcemap rebase——把 module.map.sources 的绝对路径重写为相对于 finalOutputDir 的路径。`perModule` 策略（logic 用）不直接调 `getWorkPath()`。

emit-worker（emit-engine.ts）已经先 `resetStoreInfo(storeInfo)` 搭建上下文，再调 `produceEntry`。参数化只需把 `workPath` 作为显式参数传入，替代 `getWorkPath()` 读取。

## 目标

**焊点 1 纯化**——emit.ts 0 env.ts 依赖，成为纯 Packer 函数。

1. `EmitEntryParams` 加 `workPath: string`
2. `bundle` 策略 L142 用参数 `workPath` 替代 `getWorkPath()`
3. emit.ts 删除 `import { getWorkPath } from '../core/env.ts'`
4. 调用方（view/index.ts + build-pipeline.ts emit task）传入 `getWorkPath()`
5. emit-engine.ts 保留 `resetStoreInfo`（perModule 不需要 workPath 但仍需 storeInfo 搭建上下文）

## 非目标

- logic/\*\* 参数化（焊点 2——L 级大重构，另门）
- env.ts 拆分（焊点 3——W3 决策：不拆，注入 context）
- dependency-graph 拆分（焊点 4——已干净，不拆）
- 任何输出语义变更（行为 0 diff=0）
- view/style 增量接入（另门）
- HMR（另门）

## 设计输入

- 前身归档：[`fe-tools-packer-research`](../../complete/fe-tools-packer-research/README.md)
- `PackerContext` 草案：`PackerContext { sourceRoot, outputRoot, moduleIdPrefix, runtimeType, graphWriter{...}, resolver{...}, stateRestore }`
- emit.ts 现状：233 行，1 处 env.ts import
- emit-engine.ts 现状：`resetStoreInfo` + `produceEntry`
- 行为 0 纪律：nomap + sourcemap 产物 diff=0；全量 vitest 绿
- tsconfig 约束：`noUnusedLocals: true` / `strict: true`

## 交付物

- `pipeline/emit.ts`：`EmitEntryParams` 加 `workPath`，L142 参数化，删除 env.ts import
- `pipeline/emit-engine.ts`：无改动（`resetStoreInfo` 保留）
- `view/index.ts`：`emitEntry({ ...` 调用传入 `workPath: getWorkPath()`
- `pipeline/build-pipeline.ts`：emit task 调用传入 `workPath`
- 无新文件
- 无 dist 变化（tsc 直编译，行为 0）

## Requirements

- R-W1-1 MUST `pipeline/emit.ts` 不 import from `../core/env.ts`（`grep -c 'from.*env.ts' emit.ts` = 0）
- R-W1-2 MUST `EmitEntryParams` 含 `workPath: string`
- R-W1-3 MUST `bundle` 策略 sourcemap rebase 用参数 `workPath` 替代 `getWorkPath()`
- R-W1-4 MUST `view/index.ts` 的 `emitEntry` 调用传入 `workPath`
- R-W1-5 MUST `build-pipeline.ts` 的 emit task 调用传入 `workPath`
- R-W1-6 MUST 行为 0（nomap + sourcemap diff=0；全量 vitest 绿；tsc 0 错）
- R-W1-7 MUST 不引入 `any` / `@ts-nocheck` / `as any`
- R-W1-8 SHOULD 不新增文件

## Readiness gaps

- 无设计门阻塞——1 处改动 + 2 处调用方传入
- 已确认 emit.ts 唯一 env.ts 依赖是 L142 `getWorkPath()`
- 已确认 emit-engine.ts `resetStoreInfo` 保留（perModule 不需 workPath 但需 storeInfo）

## Closure conditions

- R-W1-1..8 全 passed
- architecture-notes 回流（焊点 1 纯化定性）
- 行为 0 守卫通过
