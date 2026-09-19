# Implementation Plan — fe-tools-packer-research

Status: **draft（2026-09-20）**

## 研究步骤

### P-PR01 — W2 logic/index.ts 深度审计

- 读 `resolveDependencyId()` 完整逻辑（import/require/export 解析）
- 读 `buildJSByPath()` 完整逻辑（AST parse → walk → rewrite → transform → sourcemap → emit）
- 标注 11 种 env.ts 调用的精确语义（每个调用在 Packer 管线中的位置）
- 判断 hooks 能否收敛成 ≤5 个

### P-PR02 — W3 env.ts 深度审计

- 读图初始化逻辑（L814-891：addNode/addFile/addDependency 的完整 Scheme 图填充）
- 读 `storeInfo` / `getContentByPath` / `getComponent` / `getNpmResolver` 实现
- 验证 7 个共用函数的 Packer 侧用法是否可改为参数注入

### P-PR03 — W4 dependency-graph.ts 跨图遍历分析

- 验证 `getAffectedEntries` 跨 Scheme 节点（page→app）和 Packer 节点（module→module→page）的遍历路径
- 评估拆成 ProjectGraph + ModuleGraph 后跨图索引方案
- 验证 `getFileKinds` 的 kind 值是否可按 Scheme/Packer 分离

### P-PR04 — W1 emit.ts parameterize 验证

- 评估 `modDefine` 参数化为 `wrapModule(moduleId, code) => string` 的可行性
- 评估 `getWorkPath()` 参数化为 `sourceRoot` 的可行性
- 评估 `kind: 'view' | 'logic'` 泛化或移除的可行性

### P-PR05 — 可抽提性评估 + 提取序列

- 逐焊点给出评估（容易 / 需接口设计 / 极难 / 不值得）
- 给出提取序列建议（或：不提取建议）

### P-PR06 — Packer API 草案

- 完善 PackerContext / Packer / CompiledModule interface
- 验证 hooks 粒度
- 验证与 emit.ts / dependency-graph.ts 的接口对齐

### P-PR07 — 风险清单

- 行为 0 风险、测试覆盖风险、回归风险
- 逐项影响评估

### P-PR08 — 决策建议

- 值得做 / 不值得做
- 粗略工作量估算（S/M/L）
- 基于风险清单（P-PR07）综合判断

### P-PR09 — 研究发现回流

- 若值得做：回流 architecture-notes（Packer API 草案 + 提取序列）
- 若不值得做：回流 architecture-notes（评估结论 + 封存理由）
- 更新 TODO 候选 B/C 状态

## 依赖

| 步骤 | 依赖 |
| --- | --- |
| P-PR01 | 无 |
| P-PR02 | 无 |
| P-PR03 | 无 |
| P-PR04 | 无 |
| P-PR05 | P-PR01..04 |
| P-PR06 | P-PR05 |
| P-PR07 | P-PR05 |
| P-PR08 | P-PR05 + P-PR06 + P-PR07 |
| P-PR09 | P-PR08 |

## 验证点

- 每步产出写入 `source-audit.md` 或 `technical-design.md`
- P-PR05 是关键决策点——决定后续步骤是否有意义
- P-PR07 风险清单先于 P-PR08 决策建议——风险是决策的输入
- P-PR09 是 closure 前提——研究发现必须回流
