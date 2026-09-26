# Acceptance — fe-tools-l2-l3-retire-research

Status authority: [Action Status](../STATUS.md)

| ID | Requirement | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-LR-1 | R-LR-1/2/3 | source-audit 完整 | L2 getters（15 × 10 文件）+ L3 resetStoreInfo（3 worker 引擎）+ compat 写（112 caller）全分布 audit 完成（source-audit §1-3） | pending |
| A-LR-2 | R-LR-4 | 门控链条分析 | L2 getters 退役 ← compiler/* 迁 PackerContext ← worker ctx 直传 ← PackerContext 序列化——链条完整（source-audit §4） | pending |
| A-LR-3 | R-LR-5 | 拆分方案 A0-A5 | A0（worker ctx 直传）/A1（logic）/A2（view）/A3（style）/A4（compat 写）/A5（singleton/Proxy）scope + 门控 + 依赖——方案 lock（design §1） | pending |
| A-LR-4 | R-LR-6 | 根门控序列化方案 | PackerContext 序列化方案候选 a/b/c + 锁定 b（source-audit §6 + design §2） | pending |
| A-LR-5 | R-LR-7 | 无代码实施 | research 性质——无代码改动（不跑 tsc/vitest/7-diff） | pending |

## backflow（research 产出）

- A0-A5 各自 formalize 独立 Action（后续）
- 根门控 A0（worker ctx 直传）是 L2/L3 退役第一步
