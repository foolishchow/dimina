# ES Target Unification（CF-3：logic 车道收敛与可选 view 抬升）

- Action: `es-target-unification`
- Status: `draft`
- Updated: 2026-09-10
- Status authority: [Action Status](../STATUS.md)
- 父 Action：[compiler-configuration](../compiler-configuration/README.md)（umbrella，gate CF-3）
- 前置：CF-1 `compiler-configurable`（`esTarget.{logic,view}` 已从 compile configuration 读取）

## Background

双线程模型下 ES target 应对齐执行车道，而非强制全局同一值：

| 车道 | 运行时 | CF-1 缺省 | 说明 |
| --- | --- | --- | --- |
| logic | QuickJS / JSC / Worker | `es2023` | 逻辑层能力 |
| view | Native WebView / Browser | `es2020` | 视图层更保守的 WebView 基线 |

历史代码里还存在 **logic 车道内部** 不一致（例如主路径 es2023、单模块 CJS 转换仍写 es2020）。那是缺陷；**logic 与 view 不同值不是缺陷**，是架构约束。

2026-09-10 决策：撤销「全阶段统一为单一 es2023」；改为：

1. **必达**：logic 车道内所有转换路径统一读 `esTarget.logic`（消除同车道硬编码漂移）
2. **可选/另议**：是否抬高 `esTarget.view`（es2020→es2023 等）——仅影响 view bundle，须 WebView 兼容性矩阵（含 Harmony）通过后方可 ready

## Goal

- 保证 `esTarget.logic` 在 logic-compiler 各路径一致生效（无残留硬编码漂移）
- **不**要求 `esTarget.view === esTarget.logic`
- 若本门包含抬高 `view` 的交付，则产物有意变化，且须独立兼容性验证；若本门仅做 logic 车道收敛且缺省不变，则缺省产物 diff=0

## Non-goals

- 不引入顶层标量 `esTarget` 替代双字段（CF-1 已冻结）
- 不改 compile configuration 框架形状（CF-1）
- 不把 platform 枚举接入（CF-2）
- 不做性能优化
- 不因「配置好看」强行统一 logic/view

## 外部依赖

- **仅当本门决定抬高 `esTarget.view` 时**：需要 **view 所在 WebView** 的 es2023（或目标级别）兼容性调研；Harmony WebView 为矩阵必测项之一，不是唯一项。调研未完成前，**抬高 view 的切片**不得进入 ready。
- **仅做 logic 车道收敛、不改 view 缺省时**：无 Harmony/WebView 外部阻塞。

## Scope

- `fe/packages/compiler/src/common/compile-config.js`（缺省值与校验；不把双字段合并成单值）
- `fe/packages/compiler/src/core/logic-compiler.js`（所有 target 读 `esTarget.logic`）
- 若抬高 view：`esTarget.view` 缺省或 profile 调整 + view 产物/运行时验证
- `fe/packages/compiler/__tests__/`、RFC 回写（D6:B 可变层示例改为双字段）

## Deliverables

- logic 车道无残留硬编码 target 漂移；一律 `esTarget.logic`
- 文档与规格明确：logic/view 允许不同值
- （可选）`esTarget.view` 抬升 + WebView 矩阵证据 + 产物变化解释
- 全量回归；若有 view 抬升则含运行时行为验证

## Readiness gaps

- 须在 Readiness 前冻结本门切片：**仅 logic 收敛** vs **含 view 抬升**
- 若含 view 抬升：WebView 兼容性矩阵（含 Harmony）未完成则不得 ready
- 前置 CF-1 须 complete

## Closure conditions

- 所有 MUST Acceptance 通过并有证据
- 若缺省/view 有意变化：兼容性验证完整（不只字节 diff）
- 若仅 logic 收敛：缺省产物 diff=0
- STATUS、导航、归档一致
