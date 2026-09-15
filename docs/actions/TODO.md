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
| 下一步 | 近端结构多已归档；[`fe-tools-wxml-ir`](fe-tools-wxml-ir/README.md)（TS-2）**`ready`**（未授权实施）；[`fe-tools-incremental-target`](fe-tools-incremental-target/README.md)（E7）仍 `draft`；病症地图 [compiler-symptom-inventory.md](fe-tools-sidecar/compiler-symptom-inventory.md)；**PS3 deferred** |
| 再激活 / 推进 | project-store PS3（增量装载 applyChanges / subscribe）**deferred**（2026-09-12；见 sidecar README「PS3 deferred」）；伞保持 draft |
| 再激活条件 | ① watch rebuild 全量 load 成为可量化性能瓶颈（需要 applyChanges 增量图更新）；② preview 出现需要 store 内部 metadata 的真实消费方（如依赖图详情展示） |
| 说明 | 长线分支 **`feature/fe-tools-sidecar`** |

### WXML 双 Parser 改造——已 formalize 为 `fe-tools-wxml-refactor`（2026-09-15）

| Field | Value |
| --- | --- |
| 问题 | `wxml/transform`（load.js）与 `backends/vue.js` 直接操作 cheerio DOM——双 parser "可切换"是假的（切 napi 后 transform 崩溃） |
| 目标 | ① transform 层定义 `ctx.dom` IR 操作接口（findInclude / replaceWith / removeNodes / serialize…），cheerio 实现之，transform 零 cheerio import；② `wxml/parser/napi.js`（SpanView → Document IR 适配）；③ `WXML_PARSER=napi` 切换开关 |
| 前置 | [`fe-tools-compiler-layering`](fe-tools-compiler-layering/README.md) L0 目录归位先合入（建 `view/wxml/` 结构上开发） |
| 待定 | ctx.dom 最小/完整操作集；两版 Document 对拍口径（deep-equal vs 抽样） |
| 正式化时机 | layering L0 合入后 |

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
