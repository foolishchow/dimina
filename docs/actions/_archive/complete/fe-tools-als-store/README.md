# FE Tools ALS Store

- Action: `fe-tools-als-store`
- Status: `complete`
- Updated: 2026-09-22
- Status authority: [Action Status](../../../STATUS.md)
- 工作分支：`feature/fe-tools-sidecar`
- 后继：[`fe-tools-graph-bootstrap`](../fe-tools-graph-bootstrap/README.md)（`complete` 归档；PackerGraph 自包含——用本工具的 ALS 作 ctx 桥接）
- 实施顺序：本 Action 先于 graph-bootstrap——两者都改 env.ts，als-store 改 ALS 机制（compilerContextStorage → packerALS），graph-bootstrap 改 storeInfo 逻辑。建议 als-store 先落地，graph-bootstrap 基于更新后的 env.ts

## 背景

项目中有两处 AsyncLocalStorage，散在不同模块，模式相同但各自实现：

| ALS 实例 | 位置 | 存什么 | 类型 | globalThis 兜底 |
|---|---|---|---|---|
| `abilityContext` | `worker-runtime/context.ts` | worker 能力（sink, logger） | `unknown`（无类型） | 有 |
| `compilerContextStorage` | `compiler/core/env.ts` | 编译上下文（paths, config, graph） | `CompilerContext` | 无 |

两者都是 AsyncLocalStorage，但：
- `abilityContext` 用 `globalThis` 兜底单例（vitest 兼容），类型 `unknown`——无类型安全
- `compilerContextStorage` 没用 `globalThis` 兜底，有类型——但 vitest 多实例时可能出问题
- 两处的 run / get / tryGet 模式重复

### 为什么放 worker-runtime

worker-runtime 已有 ALS（`context.ts`）。ALS 的核心场景是跨线程上下文传播——主线程 run，worker 从快照重建后 run。worker-runtime 是 worker 执行基础设施模块，ALS 工具归这自然。

### 为什么现在做

Packer 落地需要 PackerContext（ALS 封装）作为基础。PackerContext 需要一个通用的 ALS 工具——不是直接用 `new AsyncLocalStorage()`，而是有 run / get / tryGet + globalThis 兜底 + 类型安全的工具类。

本 Action 是 Packer 落地的**地基**。

## 目标

**封装通用 ALS 工具类 `AsyncContextStore<T>`**——统一两处现有 ALS 模式，提供类型安全的 run / get / tryGet API。

## 非目标

- 不做 snapshot / 序列化（以后有需要再考虑）
- 不改 PackerContext（PackerContext 落地另开 Action）
- 不改 env.ts 的 storeInfo / resetStoreInfo / getter 逻辑
- 不改 graph 逻辑
- 不改 worker 执行流程

## 设计输入

- `worker-runtime/context.ts` — 现有 `abilityContext`（globalThis 兜底 + `unknown` 类型）
- `compiler/core/env.ts` — 现有 `compilerContextStorage`（有类型，无 globalThis 兜底）
- `fe-tools-worker-runtime`（complete 归档）— worker-runtime 模块设计

## 交付物

1. `src/compiler/worker-runtime/async-context-store.ts` — `AsyncContextStore<T>` 通用工具类
2. `worker-runtime/context.ts` — `abilityContext` 改用 `AsyncContextStore`（`unknown` → 有类型）
3. `compiler/core/env.ts` — `compilerContextStorage` 改用 `AsyncContextStore`（加 globalThis 兜底）
4. 行为 0——产物 diff=0，vitest 全绿

## Requirements

- R-AS-1 MUST 创建 `AsyncContextStore<T>` 通用类（run / get / tryGet + globalThis 兜底）
- R-AS-2 MUST `abilityContext` 改用 `AsyncContextStore`（`unknown` → 有类型）
- R-AS-3 MUST `compilerContextStorage` 改用 `AsyncContextStore`（加 globalThis 兜底）
- R-AS-4 MUST 行为 0（diff=0 + vitest 全绿 + tsc 0 错）
- R-AS-5 MUST 不引入 `any` / `as any` / `[key: string]: unknown`

## Readiness gaps

- 无——设计已确认（run / get / tryGet，不管序列化/快照）

## Closure conditions

- R-AS-1..5 全 passed
- behavior 0（diff=0 + vitest 全绿）
- 两处现有 ALS 统一为 `AsyncContextStore`
