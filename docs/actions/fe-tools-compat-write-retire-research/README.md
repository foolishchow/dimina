# fe-tools-compat-write-retire-research

- Status: `draft`
- Type: research（无代码改动——产出 source-audit + A5 迁移规划）
- Parent: fe-tools-l2-l3-retire-research（D-LR-3 A4 细化）
- Gates: A0+A1（worker-ctx-direct complete）+ A2（view-parse-walk-migrate complete）+ A3（style-parse-walk-migrate complete）

## 目标

审计 storeInfo wrapper compat 写 6 条 load-bearing 消费方 + 112 caller 分布 + getPages 22 caller（A5 前置门控）。评估 compat 写退役可行性 + 规划 A5 singleton/Proxy 退役迁移顺序。

## 背景

L2/L3 退役第四步（A4）。research design D-LR-3 原定 A4 为实施性（storeInfo wrapper 删 + 测试 fixture 迁）。但 A1-A3 实施后发现：

- **compat 写 6 条 load-bearing**：getDependencyGraph/getComponent/getAppId 保留 ALS（A5 singleton 退役才迁）——compileSS/compileML 入口 fallback ALS 读这些 getter
- **测试 fixture 依赖 ALS singleton**：调 `storeInfo(tempDir)` 建立 ALS + 调 compileSS/compileML（内部 fallback ALS 读）——A4 无法单独删 compat 写
- **src caller=0**：orchestrate 链路已不调 wrapper（scratch-internalize 已改）——A4 主要是 __tests__ compat 迁移

**结论**：A4 无法单独实施 compat 写删——须合并入 A5（singleton 退役含 compat 写删 + 测试 fixture 迁 + getPages 22 caller 迁）。A4 转为 research（审计 + A5 规划）。

## 产出

- source-audit（compat 写 load-bearing + 112 caller + getPages 22 caller）
- design.draft（A5 迁移规划 D-CWR-1..N）

## 设计门

[design.draft.md](design.draft.md)（**D-CWR-1..N 待 readiness review lock**——A5 singleton/Proxy 退役迁移规划）

## 文档

- [source-audit.md](source-audit.md)——compat 写 load-bearing + 112 caller + getPages 22 caller
- [design.draft.md](design.draft.md)——A5 迁移规划
- [requirements.md](requirements.md)
- [acceptance.md](acceptance.md)
- [validation.md](validation.md)
