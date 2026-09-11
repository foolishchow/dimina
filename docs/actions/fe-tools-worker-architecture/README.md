# FE Tools Worker Architecture

- Action: `fe-tools-worker-architecture`
- Status: `draft`
- Updated: 2026-09-10
- Status authority: [Action Status](../STATUS.md)
- 关系：**决策 Action（ready = 冻结，不实施）**。为 [`fe-tools-build-model`](../fe-tools-build-model/README.md) 与 [`fe-tools-module-cache`](../fe-tools-module-cache/README.md) 提供 worker 架构演进依据；实施责任分给它们（阶段 1/2 → build-model；阶段 3 → module-cache）。现状证据见 [source-audit](source-audit.md)。

## Background

当前三 worker 架构是"一次性、写盘型、阶段私有"（source-audit §1）：每次 `new Worker` + `terminate`，产物直接写盘，主线程无产物持有；入站全量上下文、出站仅 metadata。这与我们目标（GroupModule 跨维度精确失效 + 增量编译 + 高级 watch）存在结构性落差（§3）：结果边界、协变、生命周期、协议、数据流、模型六项全部需要演进。

**但**：不是一步大改。演进分四阶段，前 3 阶段不需要 worker 常驻；三领域中间表示不可统一。

## Goal（决策交付物）

1. **演进路径定稿**：结果边界 → 协变 → 模型层 →（可选）常驻 service 四阶段；每阶段独立可验收、字节等价
2. **四个张力结论**（D-WA 决策表）：无状态 vs 常驻 / logic 产物边界 / worker 内 vs 主线程缓存 / 单向数据流
3. **WorkerTask / WorkerResult 协议草案**（探针）：build-model 的 stage-channel 与 module-cache 的 FileModule 按它对齐
4. **边界映射表**：演进路径各阶段归谁（build-model / module-cache / TS-2 / 未来）
5. **决策冻结**（ready = 冻结，无未决张力；实施不归本 Action）

## Non-goals（决策 Action 不实施）

- **不写编译代码**（实施分给 build-model / module-cache）
- **不合并三个 worker 成一个超级 worker**（领域中间表示异构：DOM vs AST vs cssAST）
- **不统一三领域 FileModule 内容结构**（各自异构，机制共享）
- **不强制 worker 常驻**（第 4 阶段为可选，前置决策记录）
- **不引入共享内存缓存 / 跨 worker 全局单例**（物理分布决定：共享=约定非实例）
- 不定义 IR（TS-2）、不定义 inputHash 具体算法（build-model gap③）

## 交付物与验收

| 交付物 | 内容 | 验收 |
| --- | --- | --- |
| 演进路径文档 | 四阶段 + 每阶段不改什么 | 每阶段有独立验收方式（字节等价/断言） |
| D-WA 决策表 | 四个张力结论（含 defer 项显式记录） | 无未决张力（defer 项有再激活条件） |
| WorkerTask/Result 协议探针 | 消息形状 + 单向数据流 + 错误/进度通道 | 可评审；被 build-model/module-cache 引用 |
| 边界映射表 | 阶段 → 归属 Action | 与 build-model/module-cache README 一致 |

## 关键决策（D-WA-1..6，本讨论已收敛；待 ready 冻结）

| ID | 决策点 | 结论（倾向） |
| --- | --- | --- |
| D-WA-1 | worker 生命周期 | **前 3 阶段保留 new/terminate 无状态**（失败恢复易、状态零污染）；接口按 service 形状设计（`update(changed)`），常驻留作第 4 阶段可选 |
| D-WA-2 | logic 产物边界 | **app 级单 bundle 保持**——不能假装增量到页面；view/style 才能 entry 级（粒度诚实） |
| D-WA-3 | 跨 build 复用途径 | **主线程 BuildModel 持有 entry 产物**（未变 entry 不启动 worker），非缓存实例共享 |
| D-WA-4 | worker 内 vs 主线程缓存 | worker 内 = 单 stage 复用（FileModule 内容）；主线程 = 跨 build 复用（entry 产物）；两层职责不同不冲突 |
| D-WA-5 | 数据流 | **单向**：worker 回传 delta（outputs + graph delta + diagnostics），不反向修改 GroupModule；主线程合并 |
| D-WA-6 | 三领域中间表示 | **不统一**（DOM vs AST vs cssAST）；共享仅机制/协议（key 构造、失败语义、接口形状） |

## 演进路径（四阶段，见 technical-design §2）

```text
阶段 1：结果边界（output 回传 + materialize）          → build-model M1
阶段 2：协变（WorkerTask/Result 协议 + Group 子集输入）  → build-model M2
阶段 3：模型层（GroupModule + FileModule 内容缓存）      → module-cache
阶段 4：worker 常驻 service（可选，收益最高）            → 未来独立决策
```

## Readiness gates（决策 Action 的 ready 条件）

1. D-WA-1..6 全部定稿（本讨论已收敛，待逐项复核冻结）
2. WorkerTask/WorkerResult 协议草案可评审（探针落盘）
3. 边界映射表与 build-model/module-cache README 交叉引用一致
4. defer 项（如第 4 阶段常驻）有明确再激活条件

## Closure conditions（决策落地）

① D-WA 决策表冻结（ready）后，被 build-model / module-cache README 引用为设计输入
② 后续 Action 实施冲突 → 修订记录（append 或另立）
③ 演进路径中未分配的阶段（第 4 阶段）无阻塞（已记录 defer）
④ STATUS/归档/指针一致变更

## Documents

| 文档 | 作用 |
| --- | --- |
| [source-audit](source-audit.md) | 三 worker 现状证据（落差表/不可统一处/可复用资产） |
| [requirements](requirements.md) | R-WA-*（决策完备性） |
| [technical-design](technical-design.md) | 演进路径 + 张力结论 + 协议草案 |
| [acceptance](acceptance.md) / [validation](validation.md) | 决策验收与验证（draft） |
