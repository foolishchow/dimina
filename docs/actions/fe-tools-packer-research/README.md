# fe-tools-packer-research

- Action: `fe-tools-packer-research`
- Status: `draft`
- Updated: 2026-09-20
- Status authority: [Action Status](../STATUS.md)

## Background

`@dimina/bundler` 把 **Packer**（通用模块打包器）与 **Scheme**（Dimina 打包方案）焊在一起。`fe-tools-bundler-boundaries`（D-BD-1..6）在目录/文件粒度标注了 4 个焊点，并明确「方法级拆分留给抽 Packer 的下一门」。

两个焊点已被后续 Action 反哺探明：

- `model/dependency-graph.ts` ← `fe-tools-incremental-target`（D-IT-1..4：affectedEntries 语义、COMPILE_STAGE_ORDER 单源）
- `compiler/pipeline/emit.ts` + `model/build-model.ts` ← `fe-tools-bundler-emit-memfs`（D-MM-1..6：getArtifact 反查索引、materialize 唯一写盘出口、dev server artifactResolver 注入）

另两个焊点（`compiler/logic/**`、`compiler/core/env.ts`）尚未被反哺。本 Action 做全量研究。

## Goal

回答一个决策问题：**Packer extraction 是否值得做？** 如果值得，给出方法级切分方案与提取序列；如果不值得，给出证据并封存。

## Non-goals

- 不改产品代码（research only）
- 不改 D-BD-1..6 落点表（焊点归属已冻）
- 不实施 Packer 提取（若结论是「值得」，另立 implementation Action）
- 不设计 Packer 插件钩子或 context 字段的最终 API（只做草案）
- 不碰 `compiler/view/**` / `compiler/style/**`（Scheme 车道，不是焊点）

## Scope

4 焊点全量研究（路径相对 `fe/tools/bundler/src`）：

| 焊点 | 行数 | 已反哺 |
| --- | --- | --- |
| `compiler/pipeline/emit.ts` | 222 | ✓ emit-memfs |
| `compiler/logic/index.ts` | 633 | ✗ |
| `compiler/core/env.ts` | 965 | ✗ |
| `model/dependency-graph.ts` | 186 | ✓ incremental-target |

## Design inputs

- [architecture-notes §Packer/Scheme](../fe-tools-sidecar/architecture-notes.md) — 术语定义
- [fe-tools-bundler-boundaries technical-design §2 落点表](../_archive/complete/fe-tools-bundler-boundaries/technical-design.md) — D-BD-1..6 + 4 焊点落点
- [fe-tools-bundler-emit-layer](../_archive/complete/fe-tools-bundler-emit-layer/README.md) — D-E-1..12 emit 契约（已归档）
- [fe-tools-incremental-target](../_archive/complete/fe-tools-incremental-target/README.md) — D-IT-1..4 图/失效语义
- [fe-tools-bundler-emit-memfs](../_archive/complete/fe-tools-bundler-emit-memfs/README.md) — D-MM-1..6 memfs/materialize
- TODO 候选 B（Emit 抽象层）+ 候选 C（三刀细化）

## Deliverables

1. **方法级焊点分析表** — 4 焊点逐方法/逐 export 标注 Packer / Scheme / 共用 / 不可分
2. **扇入扇出矩阵** — env.ts 27 exports × 15 文件扇入，标注 Packer 胚 vs Scheme 编排
3. **可抽提性评估** — 逐焊点：容易 / 需接口设计 / 极难 / 不值得
4. **提取序列建议** — 哪个先拆、哪个后拆、哪个不拆
5. **Packer API 草案** — extracted Packer 的接口形状（TypeScript interface，非实现）
6. **风险清单** — 行为 0 风险、测试覆盖风险、回归风险
7. **决策建议** — 值得做 / 不值得做，附证据

## Readiness gaps

- 2 焊点（logic/index.ts、env.ts）尚未被反哺——本 Action 即是反哺
- 研究结论需团队评审后决定是否另立 implementation Action

## Closure conditions

- 4 焊点方法级分析表完备
- 扇入扇出矩阵完备
- 可抽提性评估逐焊点有结论
- 决策建议（值得 / 不值得）有证据支撑
- 研究发现回流 architecture-notes（若结论值得做）
