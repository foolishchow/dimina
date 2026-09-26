# fe-tools-l2-l3-retire-research

- Status: `draft`
- Status authority: [Action Status](../STATUS.md)
- source-audit：[source-audit.md](source-audit.md)（L2+L3 退役门控分析 + 拆分方案）
- 设计门：[design.draft.md](design.draft.md)（A0-A5 拆分方案 + 根门控）
- 需求门：[requirements.md](requirements.md)
- 实施门：[implementation-plan.md](implementation-plan.md)
- 验收门：[acceptance.md](acceptance.md)
- 验证门：[validation.md](validation.md)

## Background

env.ts L2 ALS 门面（15 getters + singleton + Proxy）+ L3 worker 桥接（resetStoreInfo）+ compat 写（storeInfo wrapper）是 packer 重构剩余的三个 backflow。scratch-internalize + packer-context-dedup 完成后，概念链收敛——这三个 backflow 都门控于 L2+L3 退役（大倡议）。

## Goal

**研究性 Action**——audit L2+L3 退役的全部门控 + 路径 + 拆分方案，产出 A0-A5 渐进子 Action 的 formalize 基础。**不实施代码**。

## Non-goals

- 实施任何代码改动（纯 research）
- formalize 子 Action（A0-A5 各自独立 Action formalize）
- 退役任何 getter/singleton/Proxy/resetStoreInfo/compat 写
- worker 模型改造
- PackerContext 序列化实施

## Design inputs

- **背景**：[`fe-tools-scratch-internalize`](../_archive/complete/fe-tools-scratch-internalize/README.md) + [`fe-tools-packer-context-dedup`](../_archive/complete/fe-tools-packer-context-dedup/README.md)（backflow 记录 L2/L3 退役）
- **前置 audit**：compiler/* 10 文件 import env.ts 15 getters + resetStoreInfo 3 worker 引擎 + storeInfo wrapper 112 caller
- **门控链条**：L2 getters 退役 ← compiler/* 迁 PackerContext ← worker ctx 直传 ← PackerContext 序列化（readContent function 不可序列化）

## Proposed design

详见 [source-audit.md](source-audit.md) + [design.draft.md](design.draft.md)。核心：

- A0：worker 引擎 ctx 直传（根门控——PackerContext 序列化）
- A1/A2/A3：logic/view/style parse-walk 迁移（并行，门控 A0）
- A4：compat 写退役（门控 A1/A2/A3）
- A5：singleton/Proxy 退役（门控 A1-A4）

## Closure conditions

- source-audit 完整（L2/L3/compat 全 caller 分布 + 门控链条 + 拆分方案）
- design 拆分方案 lock（A0-A5 scope + 门控 + 依赖）
- 无代码实施（research 性质）
