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
| 下一步 | [`fe-tools-wxml-layout`](fe-tools-wxml-layout/README.md)（**`in_progress`**）；[`fe-tools-incremental-target`](fe-tools-incremental-target/README.md)（E7）仍 `draft`；[`fe-tools-wxml-refactor`](_archive/complete/fe-tools-wxml-refactor/README.md) **complete 已归档**；病症地图 [compiler-symptom-inventory.md](fe-tools-sidecar/compiler-symptom-inventory.md)；**PS3 deferred** |
| 再激活 / 推进 | project-store PS3（增量装载 applyChanges / subscribe）**deferred**（2026-09-12；见 sidecar README「PS3 deferred」）；伞保持 draft |
| 再激活条件 | ① watch rebuild 全量 load 成为可量化性能瓶颈（需要 applyChanges 增量图更新）；② preview 出现需要 store 内部 metadata 的真实消费方（如依赖图详情展示） |
| 说明 | 长线分支 **`feature/fe-tools-sidecar`** |

### WXML 双 Parser 改造——`fe-tools-wxml-refactor` complete（2026-09-15）

| Field | Value |
| --- | --- |
| Action | [`fe-tools-wxml-refactor`](_archive/complete/fe-tools-wxml-refactor/README.md)（**`complete` 已归档**；交付 `13c9c902`） |
| 结果 | W1 23 函数归位；W2 标准 Document + 零 cheerio 泄漏；W3 默认 napi；580/580 + P-WR06 diff=0 |
| 后续候选 | 已 formalize → [`fe-tools-wxml-layout`](../fe-tools-wxml-layout/README.md)（**`in_progress`**） |

### WXML 目录轴整理——已 formalize 为 `fe-tools-wxml-layout`（2026-09-15）

| Field | Value |
| --- | --- |
| Action | [`fe-tools-wxml-layout`](fe-tools-wxml-layout/README.md)（**`in_progress`**；L0–L2 已交付，待 Close） |
| 问题 | parse 引擎藏文件名；`transform/` 名实不符；`backends/` 撞平台 renderer 且塞 vue-tools |
| 目标 | napi/cheerio + `common/` + `load/` + `compile.js` + `renderer/vue/`；行为 0；旧 Backend API 同门删净 |
| 待定 | 无（D-WL-1..9 已拍板） |

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
