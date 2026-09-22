# FE Tools Incremental Unify

- Action: `fe-tools-incremental-unify`
- Status: `deferred`
- Updated: 2026-09-22
- Status authority: [Action Status](../../../STATUS.md)
- 前置：[`fe-tools-packer-core-shape`](../../complete/fe-tools-packer-core-shape/README.md)（**complete 已归档**；Packer core 6 组件形状定义——OrchestratorState + ModuleResultCache 契约）
- 前身：[`fe-tools-module-invalidation`](../../complete/fe-tools-module-invalidation/README.md)（**complete 已归档**；M1：computeInvalidatedModules logic-only）
- 前身：[`fe-tools-module-result-cache`](../../complete/fe-tools-module-result-cache/README.md)（**complete 已归档**；M2：ModuleResultCache logic-only）
- 工作分支：`feature/fe-tools-sidecar`

## 背景

M1（computeInvalidatedModules）+ M2（ModuleResultCache）已 complete 归档，但**仅覆盖 logic 车道**。view/style 无模块级增量——只有 entry 级过滤（computeAffectedEntries）。

### 现状（F-6）

| 能力 | logic | view | style |
|---|---|---|---|
| ModuleResultCache（跨 rebuild） | ✅ | ❌ | ❌ |
| invalidatedModules（模块级失效） | ✅ | ❌ | ❌ |
| computeAffectedEntries（entry 级） | ✅ | ✅ | ✅ |
| 车内缓存（intra-build dedup） | ✅ | ✅ moduleCompileCache | ✅ compileRes |

改 .wxml/.wxss → `computeAffectedEntries` 找到受影响 entry → 该 entry 下**所有模块**全量重编 parse-walk + compile。没有模块级跳过。

### 根因

1. **computeInvalidatedModules 只走 logic 边**：`getInvalidatedModules(filePath)` 内部 `getDirectDependents(id, 'logic')` 硬编码 kind=logic，不遍历 view/style 边
2. **view/style 无 ModuleResultCache**：worker 不返回 view/style compile result，stage-channel 不写 cache
3. **view/style parse-walk 交织**：load + compile + emit 在一个函数中，compile result 没有独立提取

## 目标

**view/style 接入模块级增量**——三车道统一缓存 + 失效。

## 非目标

- 不实现 Packer 形状全量 wire（Graph / Orchestrator）
- 不实现 Loader / Compiler / Emitter 逻辑
- 不拆 parse-walk（load/compile 分离另开 Action）
- 不改 emit 逻辑
- 不改 env.ts / dependency-graph.ts 数据结构

## 设计输入

- [`fe-tools-packer-core-shape`](../../complete/fe-tools-packer-core-shape/README.md) — OrchestratorState + ModuleResultCache\<V\> 契约
- [`fe-tools-module-invalidation`](../../complete/fe-tools-module-invalidation/README.md) — M1 D-IV-1..9
- [`fe-tools-module-result-cache`](../../complete/fe-tools-module-result-cache/README.md) — M2 D-RC-1..4
- [`fe-tools-packer-lifecycle-audit`](../../complete/fe-tools-packer-lifecycle-audit/source-audit.md) — §4.3 view/style 无模块级增量 / F-6

## 交付物

1. `model/invalidation.ts` — computeInvalidatedModules 泛化全 kind
2. `model/dependency-graph.ts` — getInvalidatedModules 泛化全 kind（或加 kind 参数）
3. view/style — ModuleResultCache 接入（worker 返回 compile result + stage-channel 写 cache）
4. watch-plan / watch-runner — view/style cache 实例创建 + 传递
5. 行为 0——产物 diff=0，vitest 全绿

## Requirements

- R-IU-1 MUST `getInvalidatedModules(filePath)` 泛化——不按 kind=logic 过滤，遍历全 kind 边
- R-IU-2 MUST `computeInvalidatedModules(graph, changedFiles)` 返回全 kind module IDs（不只 logic）
- R-IU-3 MUST view/style 接入 ModuleResultCache——worker 返回 compile result，stage-channel 写 cache
- R-IU-4 MUST cache hit 时跳过 compile（view/style 模块级跳过）
- R-IU-5 MUST 行为 0（diff=0 + vitest 全绿 + tsc 0 错）
- R-IU-6 MUST 不引入 `any` / `as any` / `[key: string]: unknown`

## Readiness gaps

- 无——Q-1..5 已拍板（见 design.draft.md §3）

## 决策汇总

| 决策 | 内容 |
|---|---|
| D-IU-1 | getInvalidatedModules 泛化：删 `kind=logic` 硬编码，调无 kind 版 |
| D-IU-2 | view compile result 形状：ViewCompiledModule（from Packer 形状）|
| D-IU-3 | cache 不泛型化：view/style 各建独立 cache（不同 value 类型）|
| D-IU-4 | intra-build + cross-rebuild 两层共存 |
| D-IU-5 | 只返回 dirty result（和 logic 现有模式一致）|

## Closure conditions

- R-IU-1..6 全 passed
- behavior 0（diff=0 + vitest 全绿）
- view/style 有模块级增量能力

## Deferral

- **决策日期**：2026-09-22
- **原因**：本 Action 独立于 Packer 落地链（不改 env.ts），但 view/style 模块级增量应等 Packer 架构完善后统一规划。当前 Packer 落地仅有 als-store + graph-bootstrap 完成（路 1 过渡态），PackerContext / load-compile 分离 / Orchestrator 均未 formalize。在 Orchestrator 落地前做增量统一，可能与后续管线重构产生冲突。
- **重激活条件**：Packer Orchestrator 实现完成（build-pipeline + watch-plan 统一）后，重新评估本 Action 是否仍适用原设计，或需要新开 Action 承接。
- **替代**：暂无替代 Action。logic-only 增量（M1+M2 已 complete）满足当前 watch 需求。
