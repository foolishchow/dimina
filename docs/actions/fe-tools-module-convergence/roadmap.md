# Roadmap — fe-tools-module-convergence

```text
module-centric 伞 complete（刀 2+3 倒逼半套资产）
        │
        ▼
MC0 graph 正确性（stale edge/node 清理 + 增量 closure 一致）
        │
        ▼
MC1 GraphNode 加 code/sourcemap/deps；logic 回填；cache 退化
        │
        ▼
MC2 view scriptRes → graph node；view Module 入图
        │
        ▼
MC3 BuildModel 从图派生
        │
        ▼
伞 close
```

| 门 / 子门 | 状态 |
| --- | --- |
| MC0 graph 正确性 | 待 formalize（**前置**；stale edge/node + closure 一致） |
| MC1 GraphNode code | 待 formalize |
| MC2 view Module 入图 | 待 formalize |
| MC3 BuildModel 派生 | 待 formalize |
| fingerprint 模块级（β） | **deferred**（另门；依赖持久化决策） |
| HMR patch 产物 | **deferred**（另门） |
