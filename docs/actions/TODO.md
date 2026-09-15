# Action Candidates

本文档存放尚未正式化为 Action 的候选工作。候选不授权实施，也不代表已接受的产品或架构决策。

## 正式化门

将候选移入 `docs/actions/<action-id>/` 之前，需确认：

- 可观察的问题与具体目标；
- 明确的范围与非范围；
- 当前设计输入与依赖；
- 可枚举的交付物；
- 可观察的验收标准；
- 可执行或可复现的验证方法。

任一条件不明确时，条目保留在此处或仓库 Research 区域，并记录缺失的决策或证据。

## Candidates

### FE tools sidecar（旁路工具链）——已 formalize（2026-09-10）

| Field | Value |
| --- | --- |
| 决策 | 战略伞 [`fe-tools-sidecar`](fe-tools-sidecar/README.md)（`draft`）；搬迁 / unvite / session / build-model / module-cache / worker-architecture 均已 **complete** 并归档 |
| 下一步 | [`fe-tools-wxml-refactor`](fe-tools-wxml-refactor/README.md)（**`in_progress`**，W1–W3 已交付，待 Close）；[`fe-tools-incremental-target`](fe-tools-incremental-target/README.md)（E7）仍 `draft`；病症地图 [compiler-symptom-inventory.md](fe-tools-sidecar/compiler-symptom-inventory.md)；**PS3 deferred** |
| 再激活 / 推进 | project-store PS3（增量装载 applyChanges / subscribe）**deferred**（2026-09-12；见 sidecar README「PS3 deferred」）；伞保持 draft |
| 再激活条件 | ① watch rebuild 全量 load 成为可量化性能瓶颈（需要 applyChanges 增量图更新）；② preview 出现需要 store 内部 metadata 的真实消费方（如依赖图详情展示） |
| 说明 | 长线分支 **`feature/fe-tools-sidecar`** |

### WXML 双 Parser 改造——已 formalize 为 `fe-tools-wxml-refactor`（2026-09-15）

| Field | Value |
| --- | --- |
| Action | [`fe-tools-wxml-refactor`](fe-tools-wxml-refactor/README.md)（**`in_progress`**；W1–W3 已交付，待 Close） |
| 问题 | transform/backend 泄漏 cheerio；JS Document 未对齐 Rust AST；napi 未进管线 |
| 目标 | W1：23 函数归位（逐字）；W2：标准 Document + §4.2/§4.6（含 `transTagWxs`/`transAsses` 薄适配）；W3：`WXML_PARSER` 默认 napi |
| 前置 | layering L0 / wxml-ir / wxml-bridge 均已 complete |
| 待定 | 无（D-WR-1..9 已拍板） |

### B 轨道（Rust 宿主，B0–B4）——deferred（2026-09-08）

| Field | Value |
| --- | --- |
| 决策 | umbrella `compiler-improvement` 闭合时终局决策：**deferred** |
| 依据 | A 轨道已交付全部必达目标（G1/G3）；B 轨道为解耦的长期轨道（RFC D4），无外部阻塞但无当前消费者 |
| 再激活条件 | ① 性能/统一诉求有可量化目标（B0 基线先行）；② oxc napi 面确认可覆盖现有 JS 编排；③ D7 多线程陷阱有阶段性规避方案 |
| 再激活方式 | 另立 B0 子 Action，前置为上述条件满足 |

### C1（Lynx PoC）——deferred（2026-09-08）

| Field | Value |
| --- | --- |
| 决策 | umbrella `compiler-improvement` 闭合时终局决策：**deferred** |
| 依据 | A4 renderer 抽象已预留接入点；但 Lynx 需另立 RFC（RFC D3），当前无明确需求方与资源 |
| 再激活条件 | ① 另立 Lynx RFC 并定稿；② wx 组件集子集范围确认；③ 业务侧有真实 Lynx 场景 |
| 再激活方式 | 另立 C1 子 Action，前置为 RFC 定稿与业务需求确认 |
