# FE Tools Packer Core Shape

- Action: `fe-tools-packer-core-shape`
- Status: `draft`
- Updated: 2026-09-21
- Status authority: [Action Status](../STATUS.md)
- 前身：[`fe-tools-packer-research`](../_archive/complete/fe-tools-packer-research/README.md)（**complete 已归档**；4 焊点方法级审计，结论"不值得立即抽取"，PackerContext 草案已回流）
- 接替：[`fe-tools-emit-w1-parameterize`](../fe-tools-emit-w1-parameterize/README.md)（`draft`；讨论后判断 W1 单点参数化价值不足，由本 Action 的形状定义取代）
- 工作分支：`feature/fe-tools-sidecar`

## 背景

`fe-tools-packer-research`（complete 归档）回答了"Packer 抽取是否值得做"——结论：不值得立即做（ROI 不足，16 个 env.ts 耦合点散在 12 文件）。但它留下了 PackerContext 草案并建议"刀 2+3 落地后重评估边界"。

刀 2（M1 module-invalidation）+ 刀 3（M2 module-result-cache）已 complete 归档。但进一步分析 env.ts 后发现：**Parker 形状没定，后续方向（watch 增量 / HMR / deriveFromGraph）都在猜形状**——缓存形状猜错要返工，API 形状猜错要返工，编排逻辑猜错要返工。

本 Action 不做 Packer 抽取（物理迁移），做 **Packer core 形状定义**——回答"Packer 长什么样"，让后续方向有参照契约。

## 目标

**定义 Packer core 的 5 组件形状契约**——产出 TypeScript interface 声明文件，作为所有后续 Packer 方向工作的北星。

5 组件：

| # | 组件 | 性质 | 职责 |
|---|---|---|---|
| 1 | **PackerContext** | 被动数据 | Packer 的环境（通用 I/O + 文件类型 + graph + cache） |
| 2 | **PackerModule** | 被动数据 | 统一模块类型（moduleId + kind + code + map + dependencies + metadata） |
| 3 | **Packer API** | 被动接口 | 编译 + 发射接口（compileModule / emitEntry） |
| 4 | **模块生命周期** | 被动数据+逻辑 | 缓存 + 失效（ModuleResultCache + invalidatedModules） |
| 5 | **Orchestrator** | **主动** | 编排器——驱动 graph → module → emit 数据流，协调跨车道依赖 |

**Orchestrator 是唯一主动组件**——它消费其他 4 个：读 context 发现模块、查 lifecycle 决定跳过、调 API 编译、产出 PackerModule 供 emit、跨车道协调依赖。

## 非目标

- 不做 Packer 物理抽取（不搬代码、不删 env.ts import）
- 不改任何现有行为（行为 0，diff=0）
- 不实现 Orchestrator 逻辑（只定义接口形状）
- 不实现 watch 增量 / HMR / deriveFromGraph
- 不改 env.ts（W3 决策：不拆）
- 不改 dependency-graph.ts（W4 决策：不拆）
- 不改现有三车道 parse-walk / index.ts 逻辑
- 不把新类型接入现有代码（只定义形状，不 wire）

## 设计输入

- [`fe-tools-packer-research`](../_archive/complete/fe-tools-packer-research/README.md) — 4 焊点方法级审计 + PackerContext 草案 + W1-W4 决策
- [`fe-tools-module-centric`](../_archive/complete/fe-tools-module-centric/README.md) — D-MF-1（方案 A；刀 2 仅 logic；view/style 排除；规范形迁移另门）
- [`fe-tools-module-invalidation`](../_archive/complete/fe-tools-module-invalidation/README.md) — M1：`computeInvalidatedModules`（logic-only）
- [`fe-tools-module-result-cache`](../_archive/complete/fe-tools-module-result-cache/README.md) — M2：`ModuleResultCache`（logic-only）
- [`fe-tools-emit-relocate`](../_archive/complete/fe-tools-emit-relocate/README.md) — D-ER-5：`produceEntry` API
- [`fe-tools-module-convergence`](../_archive/complete/fe-tools-module-convergence/README.md) — MC3a：`deriveFromGraph`（已有形状雏形）
- env.ts 扇入扇出分析（本讨论产出）：27 exports = 5 通用 I/O + 5 Dimina 专有 + 5 文件类型 + 6 纯 scheme + 3 死 export + 3 生命周期
- tsconfig 约束：`noUnusedLocals: true` / `strict: true` / `module: NodeNext`

## 交付物

1. `src/packer/types.ts` — Packer core 5 组件的 TypeScript interface 声明
2. `src/packer/README.md` — Packer/Scheme 边界文档 + 现有代码映射表
3. 不改任何现有文件
4. 无行为变化（diff=0，vitest 全绿）
5. architecture-notes 回流（Packer core 5 组件形状定性）

## Requirements

- R-PCS-1 MUST 定义 `PackerContext` interface（通用 I/O + 文件类型 + graph + cache，不含 Dimina 专有）
- R-PCS-2 MUST 定义 `PackerModule` interface（moduleId + kind + code + map + dependencies + metadata）
- R-PCS-3 MUST 定义 `Packer` API interface（compileModule + emitEntry）
- R-PCS-4 MUST 定义模块生命周期形状（ModuleResultCache 泛型化 + invalidatedModules 全 kind）
- R-PCS-5 MUST 定义 `PackerOrchestrator` interface（orchestrate 方法 + 编排职责）
- R-PCS-6 MUST 文档化 Packer/Scheme 边界（哪些是通用的，哪些是 Dimina 专有的）
- R-PCS-7 MUST 文档化现有代码映射（env.ts exports → PackerContext 字段；现有 module 类型 → PackerModule）
- R-PCS-8 MUST 行为 0（diff=0；vitest 608/608；tsc 0 错）
- R-PCS-9 MUST 不引入 `any` / `@ts-nocheck` / `as any`
- R-PCS-10 SHOULD 新类型文件可独立 tsc 编译通过（`tsc --noEmit` 0 错）

## Readiness gaps

- **PackerContext 是否含 Dimina 专有字段**：packer-research 草案含 `runtimeType` + `resolver{component/appConfig}`；本讨论倾向不含（Dimina 专有预计算到 metadata 或由 Orchestrator 桥接 SchemeContext）。需 review 拍板。
- **PackerModule.metadata 形状**：是 `Record<string, unknown>` 还是 kind 判别联合？需 review 拍板。
- **Packer API 粒度**：是 `pack(entries) → EmitEntry[]` 黑盒，还是 `compileModule + emitEntry` 细粒度？需 review 拍板。
- **Orchestrator 是函数还是 class**：函数更轻量，class 可持有状态。需 review 拍板。

## Closure conditions

- R-PCS-1..10 全 passed
- architecture-notes 回流（Packer core 5 组件形状定性 + 边界）
- `src/packer/types.ts` tsc 0 错
- 行为 0 守卫通过（diff=0 + vitest 全绿）
