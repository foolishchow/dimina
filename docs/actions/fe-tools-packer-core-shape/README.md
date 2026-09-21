# FE Tools Packer Core Shape

- Action: `fe-tools-packer-core-shape`
- Status: `draft`
- Updated: 2026-09-21
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-packer-lifecycle-audit`](../fe-tools-packer-lifecycle-audit/README.md)（`draft`；Packer 全流程生命周期审计——本形状定义的事实基础）
- 前身：[`fe-tools-packer-research`](../_archive/complete/fe-tools-packer-research/README.md)（**complete 已归档**；4 焊点方法级审计，结论"不值得立即抽取"，PackerContext 草案已回流）
- 接替：[`fe-tools-emit-w1-parameterize`](../_archive/superseded/fe-tools-emit-w1-parameterize/README.md)（`superseded`；讨论后判断 W1 单点参数化价值不足，由本 Action 的形状定义取代）
- 工作分支：`feature/fe-tools-sidecar`

## 背景

`fe-tools-packer-research`（complete 归档）回答了"Parker 抽取是否值得做"——结论：不值得立即做（ROI 不足，16 个 env.ts 耦合点散在 12 文件）。但它留下了 PackerContext 草案并建议"刀 2+3 落地后重评估边界"。

刀 2（M1 module-invalidation）+ 刀 3（M2 module-result-cache）已 complete 归档。但进一步分析 env.ts 后发现：**Packer 形状没定，后续方向（watch 增量 / HMR / deriveFromGraph）都在猜形状**——缓存形状猜错要返工，API 形状猜错要返工，编排逻辑猜错要返工。

本 Action 不做 Packer 抽取（物理迁移），做 **Packer core 形状定义**——回答"Packer 长什么样"，让后续方向有参照契约。

## 核心概念：graph build → load → compile → emit

Packer 管线是 **graph build + 3 个环节**：

| 环节 | 做什么 | 输入 | 输出 | 反馈循环 |
|---|---|---|---|---|
| **graph build** | config fixpoint（读 app.json → 递归发现组件 → 扫文件） | PackerContext | graph 项目结构 | ✅ 递归发现组件 |
| **load** | parse + walk = 发现 | LoadInput + ctx | LoadedModule（源码 + dependencies + metadata） | ✅ dependencies 驱动下一轮 |
| **compile** | transform = 变换 | LoadedModule | CompiledModule（code + map） | ❌ 依赖已确定 |
| **emit** | bundle = 装配 | CompiledModule[] | EmitEntry | ❌ 纯组装 |

Graph 有两层 fixpoint（D-PCS-2）：config fixpoint（graph.build 内部，读 JSON 递归发现组件）+ source fixpoint（load 阶段，parse 源码发现依赖）。load 在 graph build 完成后启动——需要从 graph 拿 entries + file ownership + 快照。

## 目标

**定义 Packer core 形状契约**——产出 TypeScript interface 声明文件，作为所有后续 Packer 方向工作的北星。

### 5+ 组件

| # | 组件 | 性质 | 职责 | 决策 |
|---|---|---|---|---|
| 1 | **PackerContext** | 被动数据 | I/O 环境（paths + fileTypes + resolvers）。不含 graph/cache | D-PCS-1, D-PCS-6 |
| 2 | **Graph** | 主动组件 | 自己 bootstrap（config fixpoint）+ mergeDelta（source fixpoint）+ 查询 | D-PCS-2, D-PCS-3, D-PCS-4 |
| 3 | **LoadedModule + CompiledModule** | 被动数据 | 两阶段模块类型。CompiledModule = discriminated union | D-PCS-10 |
| 4 | **Loader / Compiler / Emitter + 3 registry** | 被动接口 | per-kind 契约 + kind→实现映射。Emitter 封装 emit 策略 | D-PCS-5, D-PCS-7 |
| 5 | **OrchestratorState** | 被动状态 | graph + cache + invalidated。session-scoped | D-PCS-6, D-PCS-9 |
| 6 | **PackerOrchestrator** | **主动** | 拥有 3 registry，触发 graph，驱动 load→compile→emit | D-PCS-5, D-PCS-8, D-PCS-9 |

**Orchestrator 是唯一主动组件**——它触发 Graph bootstrap、从 graph 查 entries、通过 registry 派发到通用 worker、合并 delta、驱动 compile → emit。

### 决策汇总

| 决策 | 内容 |
|---|---|
| D-PCS-1 | storeInfo 只剩 paths+fileTypes = PackerContext |
| D-PCS-2 | graph 推导逻辑自包含（config fixpoint + source fixpoint） |
| D-PCS-3 | graph 由 Orchestrator 触发，长期持有 |
| D-PCS-4 | Graph 自己 bootstrap 自己 |
| D-PCS-5 | 三个 registry 取代 Packer 单体接口 |
| D-PCS-6 | PackerContext(I/O) + OrchestratorState(graph+cache) 拆区 |
| D-PCS-7 | Emitter 封装 emit 策略 |
| D-PCS-8 | 通用 worker |
| D-PCS-9 | OrchestratorState session-scoped，ALS pipeline-scoped |
| D-PCS-10 | CompiledModule discriminated union |

详见 [draft.md](./draft.md)（伪代码草稿，D-PCS-1..10 决策 + §1-8 讨论）。

## 非目标

- 不做 Packer 物理抽取（不搬代码、不删 env.ts import）
- 不改任何现有行为（行为 0，diff=0）
- 不实现 Orchestrator / Graph / Loader / Compiler / Emitter 逻辑（只定义接口形状）
- 不实现 watch 增量 / HMR / deriveFromGraph
- 不改 env.ts / dependency-graph.ts / 三车道 parse-walk
- 不把新类型接入现有代码（只定义形状，不 wire）

## 设计输入

- [`fe-tools-packer-lifecycle-audit`](../fe-tools-packer-lifecycle-audit/README.md) — Packer 全流程生命周期审计（F-1..F-6 关键发现）
- [`fe-tools-packer-research`](../_archive/complete/fe-tools-packer-research/README.md) — 4 焊点审计 + PackerContext 草案 + W1-W4 决策
- [`fe-tools-module-centric`](../_archive/complete/fe-tools-module-centric/README.md) — D-MF-1（方案 A；刀 2 仅 logic）
- [`fe-tools-module-invalidation`](../_archive/complete/fe-tools-module-invalidation/README.md) — M1：`computeInvalidatedModules`（logic-only）
- [`fe-tools-module-result-cache`](../_archive/complete/fe-tools-module-result-cache/README.md) — M2：`ModuleResultCache`（logic-only）
- [`fe-tools-emit-relocate`](../_archive/complete/fe-tools-emit-relocate/README.md) — D-ER-5：`produceEntry` API
- env.ts 扇入扇出分析：27 exports 分类
- tsconfig 约束：`noUnusedLocals: true` / `strict: true` / `module: NodeNext`

## 交付物

1. `src/packer/types.ts` — Packer core 全部形状 interface 声明
2. `src/packer/README.md` — Packer/Scheme 边界文档 + 现有代码映射表 + D-PCS-1..10 决策摘要
3. 不改任何现有文件
4. 无行为变化（diff=0，vitest 全绿）
5. architecture-notes 回流

## Requirements

- R-PCS-1 MUST 定义 `PackerContext` interface（I/O only，不含 graph/cache）
- R-PCS-2 MUST 定义 `LoadedModule` + `CompiledModule`（discriminated union）
- R-PCS-3 MUST 定义 3 per-kind 契约 + 3 registry（Loader/Compiler/Emitter + registries）
- R-PCS-4 MUST 定义 `Graph` + `OrchestratorState`（graph 自包含 + session-scoped state）
- R-PCS-5 MUST 定义 `PackerOrchestrator`（拥有 3 registry + orchestrate）
- R-PCS-6 MUST 文档化 Packer/Scheme 边界
- R-PCS-7 MUST 文档化现有代码映射
- R-PCS-8 MUST 行为 0（diff=0；vitest 全绿；tsc 0 错）
- R-PCS-9 MUST 不引入 `any` / `@ts-nocheck` / `as any` / `[key: string]: unknown`

## Readiness

所有讨论问题已拍板（draft.md §8 Q-1..14）。唯一 deferred：NpmResolver 是否进 PackerContext（讨论调度器时定）。

TODO 清单：
- 泛型 CompiledModule（`CompiledModule<M>`）——当前 discriminated union 够用
- 模块级增量（M1 泛化全 kind + view/style 接入 moduleCache）——另开 Action
- NpmResolver / resolveAlias 是否进 PackerContext——讨论调度器时定

## Closure conditions

- R-PCS-1..11 全 passed（含 SHOULD）
- A-PCS-11 architecture-notes 回流
- `src/packer/types.ts` tsc 0 错
- 行为 0 守卫通过（diff=0 + vitest 全绿）
