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
MC3a deriveFromGraph 函数（entry → graph → modules → code → [EmitModule]）
        │                                    ← Packer 核心形状
        ▼
伞 close
```

| 门 / 子门 | 状态 |
| --- | --- |
| D-MC-0 | **已冻结**（A：graph = 结构权威，code 不上图） |
| MC0 graph 正确性 | 待 formalize（**Packer 前置**；stale edge/node + closure 一致） |
| MC3a deriveFromGraph | 待 formalize（**Packer 核心形状**；只读函数，低风险） |
| ~~MC3b~~ 搬 emit 到主线程 | **deferred**（打破 streaming；行为 0 风险高） |
| ~~MC3c~~ view/style 派生 | **deferred**（Packer 多 kind；等 MC3a 成熟） |
| ~~MC1~~ GraphNode code | **deferred**（D-MC-0 选 A） |
| ~~MC2~~ view 入图 | **deferred**（同 MC1） |
| fingerprint 模块级（β） | **deferred**（另门） |
| HMR patch 产物 | **deferred**（另门） |
