# Implementation Plan — fe-tools-l2-l3-retire-research

Status authority: [Action Status](../../../STATUS.md)

## 性质

**研究性 Action**——无代码实施。产出 source-audit + 拆分方案。

## 步骤

### P-LR-1 — source-audit 完成

1. L2 ALS getters caller 分布（15 getters × 10 文件）✓ 已完成（source-audit §1）
2. L3 resetStoreInfo caller（3 worker 引擎）✓ 已完成（source-audit §2）
3. compat 写 storeInfo wrapper caller（112 处）✓ 已完成（source-audit §3）
4. 门控链条分析 ✓ 已完成（source-audit §4）

### P-LR-2 — 拆分方案 lock

1. A0-A5 scope + 门控 + 依赖 ✓ 已完成（design §1 + source-audit §5）
2. 根门控 PackerContext 序列化方案候选 ✓ 已完成（design §2 + source-audit §6）

### P-LR-3 — readiness review 收敛

1. readiness review（连续 2 轮 0-finding）
2. design lock
3. 转 ready

## 验证点

- source-audit 完整（L2/L3/compat 全 caller 分布 + 门控链条）
- design 拆分方案 lock（A0-A5 scope + 门控 + 依赖 + 序列化方案 b 锁定）
- 无代码实施（research 性质）

## 风险点

- **A0 scope 评估**：research 须确认 A0 是否须再拆子步骤
- **序列化方案**：方案 b（storeInfo → ctx data）锁定——F-R1-1 实证可行性
