# Roadmap — fe-tools-module-convergence

```text
module-centric 伞 complete（刀 2+3 倒逼半套资产）
        │
        ▼
D-MC-0 冻结：graph = 结构权威（A），code 不上图 ✅
        │
        ▼
MC0 graph 正确性（stale edge/node 清理 + 增量 closure 一致）
        │
        ▼
MC3 BuildModel 从图派生（entry → graph 取 module 集 → cache 取 code → emit）
        │
        ▼
伞 close
```

| 门 / 子门 | 状态 |
| --- | --- |
| D-MC-0 | **已冻结**（A：graph = 结构权威，code 不上图，沿用 M2 D-MF-2 不推翻） |
| MC0 graph 正确性 | 待 formalize（**核心价值**；stale edge/node + closure 一致） |
| ~~MC1 GraphNode code~~ | **deferred**（D-MC-0 选 A；等 HMR 或另一消费者出现时再评估） |
| ~~MC2 view 入图~~ | **deferred**（同 MC1） |
| MC3 BuildModel 派生 | 待 formalize |
| fingerprint 模块级（β） | **deferred**（另门；依赖持久化决策） |
| HMR patch 产物 | **deferred**（另门） |
