# fe-tools-singleton-retire-research

- Status: `draft`
- Type: research（无代码改动——产出 source-audit + A5 实施拆分规划）
- Parent: fe-tools-l2-l3-retire-research（D-LR-4 A5 细化）+ fe-tools-compat-write-retire-research（D-CWR-1..6 细化）
- Gates: A0+A1（worker-ctx-direct）+ A2（view-parse-walk-migrate）+ A3（style-parse-walk-migrate）+ A4（compat-write-retire-research）全 complete

## 目标

研究 graph 可变单例 worker 透传机制 + 形状纪律候选 a/b/c 决策 + A5 singleton/Proxy 退役实施拆分规划。

## 背景

L2/L3 退役第五步（A5）。A4 D-CWR-1..6 规划了 A5 迁移顺序，但留 3 项未决：

1. **形状纪律冲突**（D-CWR-1 候选 a/b/c）：D-PCS-1/D-PCS-6 说 graph 在 OrchestratorState——但 parse-walk 内 getDependencyGraph().addFile/addDependency **写入** graph 实例（可变单例），worker 须同一实例
2. **graph 可变单例 worker 透传**：A4 未充分研究 graph 跨线程机制
3. **A5 scope 大**（env.ts 重构 + 31 ALS 残留 + 107 测试 + 22 getPages）——须拆分规划

## 关键研究结论

- **graph 跨线程机制已实施**：define-engine.ts:28 `successPayload: () => ({ dependencyGraph: getDependencyGraph().toJSON() })` + graph.ts:114 `mergeDelta(delta)`——worker graph 变更经 successPayload 回传主线程合并
- **形状纪律决策**：**候选 a 锁定**（扩 PackerContext optional graph）——graph 可变单例 worker 透传须 ctx 携带 graph 实例（addFile/addDependency 写入）。候选 b（OrchestratorState）不可行——worker 无 OrchestratorState；候选 c（collaborator）不可行——parse-walk 非 collaborator
- **D-PCS-1/D-PCS-6 放宽**：graph 加 optional 到 PackerContext（形状纪律冲突——A5 实体化须）

## 产出

- source-audit（graph 可变单例 worker 透传 + 形状纪律候选 a/b/c 决策 + ALS 残留 31 处 + 107 测试 + 22 getPages）
- design.draft（A5 实施拆分规划 D-SR-1..N）

## 设计门

[design.draft.md](design.draft.md)（**D-SR-1..N 待 readiness review lock**——A5 singleton/Proxy 退役实施拆分）

## 文档

- [source-audit.md](source-audit.md)——graph 可变单例 + 形状纪律决策 + ALS 残留
- [design.draft.md](design.draft.md)——A5 拆分规划
- [requirements.md](requirements.md)
- [acceptance.md](acceptance.md)
- [validation.md](validation.md)
