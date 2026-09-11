# Requirements — fe-tools-worker-architecture

Status: `draft`（决策 Action：ready = 冻结，不实施；ID 前缀 R-WA）

## R-WA1（MUST）演进路径定稿

交付四阶段演进路径（结果边界 → 协变 → 模型层 → 可选常驻 service），每阶段标注：
- 是什么改变（结果边界 / 协议 / 模型 / 生命周期）
- 不改什么（如 worker 数量、领域中间表示）
- 独立验收方式（字节等价 / 行为断言）

## R-WA2（MUST）张力决策完备

D-WA-1..6 每条给出明确结论或显式 defer（含再激活条件）。**ready 前无未决张力**（defer 项不算未决——它们是被记录的后续决策）。

## R-WA3（MUST）协议草案可评审

WorkerTask / WorkerResult 协议草案（探针，vivid source）：消息形状、单向数据流（worker 只回 delta，不反改 GroupModule）、错误/进度/诊断通道、协议版本字段。作为 build-model 的 stage-channel 与 module-cache 的 FileModule 的**对齐基准**。

## R-WA4（MUST）边界映射一致

演进路径各阶段 → 归属 Action（阶段 1/2 → build-model；阶段 3 → module-cache；阶段 4 → 未来）。边界映射表与 build-model / module-cache README **交叉引用一致**（不出现阶段无主或双主）。

## R-WA5（MUST）不实施

本 Action **不写编译代码**（Decision Action 定位）；ready 即冻结、不 in_progress 实施。实施责任归属边界映射表中的对应 Action。

## R-WA6（SHOULD）决策记录可追溯

每条决策记录讨论依据（哪轮讨论收敛/哪个既有 Action 约束），后续 Action 冲突时可按记录追溯修订。

## Non-requirements

- 不合并三 worker、不统一三领域中间表示
- 不强制 worker 常驻（第 4 阶段 defer，有再激活条件）
- 不引入共享内存缓存 / 跨 worker 全局单例
- 不定义 IR（TS-2）、不定义 inputHash 算法（build-model gap③）
- 不实施 stage-channel / BuildModel / FileModule（分属 build-model / module-cache）