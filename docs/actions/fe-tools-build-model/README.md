# FE Tools Build Model

- Action: `fe-tools-build-model`
- Status: `draft`
- Updated: 2026-09-10
- Status authority: [Action Status](../STATUS.md)
- 关系：独立架构 Action（非 umbrella 子门）。是 [`fe-tools-bundler-session`](../_archive/complete/fe-tools-bundler-session/README.md)（complete，外部调用统一）之后的**内部统一第一步**；worker 演进与协议基准依据 [`fe-tools-worker-architecture`](../fe-tools-worker-architecture/README.md)（**并行实施**，本门只引用其协议）；**不依赖 module-cache**（FileModule 颗粒化为独立并行层，见 Non-goals）。为 TS-2（模板 IR）与后续调度 facade 化立地基层。背景讨论沉淀于 [source-audit](source-audit.md)。

## Background

session 门统一了外部调用（build/watch/dev 三入口共享编译核心），但内部仍是**直通式流水线**：

1. **产物即写盘**：三个 worker 直接写构建目录，`postMessage` 只回元数据——内存无 module/page/app 级持有；
2. **增量两套实现**：`watch-plan`（事件推导）与 `compile-cache`（指纹对比）形状不同、保守策略重复维护；
3. **增量粒度受限**：stage/entry 级（`affectedEntries` 页列表），无输入指纹体系；
4. **load/transform/output 三步耦合**在阶段函数调用栈内——IR 化（TS-2）没有宿主，pass 无处安放。

## Goal

1. **Entry 级产物回传与持有**（BuildModel）：worker 产物从"直接写盘"改为回传主线程模型；logic 保持 app 级特例
2. **输入指纹体系**：`(mtime, size)` 预筛 + content hash 确认（git 风格轻量版）；Entry `inputHash` = 输入文件 hash 聚合。**漏算兜底**：预筛仅在 `(mtime, size)` 均未变时跳 hash；`--verify-incremental` 对拍为 M2 MUST 子项（不静默错误；不挂可选门）
3. **指纹失效传播**（单实现）：变更集 = `scan(fingerprints)`，受影响集 = `graph.closure(变更集)`——**状态对比替代事件推导**；watch 与 cache 共用此机制
4. **materialize() 统一物化**：收敛三个 compiler 的 `writeFileSync` 与 publish/rename 语义，产物字节不变

## Non-goals（四不动）

- **IR**：不设字段、不定义形状（三层判定的第 1 层；第 2/3 层留缝）
- **transform 内部**：view/logic/style 编译逻辑一行不动（源变即重跑现有直通编译）
- **env.js 隐式上下文**（ALS/Proxy）与 worker 编译协议的上下文段
- **调度 facade 化**（处理器接口）、TS-2、logic 的 module 级增量（保持 app 级）、rebuild 全量 storeInfo（L0 热点，属后续）
- **不含 FileModule 颗粒化**（worker 内单文件→中间结果缓存，属 [`fe-tools-module-cache`](../fe-tools-module-cache/README.md) 并行层）——本门专注于主线程 BuildModel / 结果边界 / 失效传播

## 粒度诚实表

| compiler | 本 Action 增量粒度 |
| --- | --- |
| view / style | entry(page) 级 |
| logic | app 级（单文件 bundle，保持现状） |

## 门与交付（实施计划，待 ready 冻结）

| 门 | 交付 | 性质 | 验收核心 |
| --- | --- | --- | --- |
| **M1 持有与物化**（= 演进阶段 1） | worker postMessage 扩产物回传字段；BuildModel（entries 持有）；materialize() 收敛写盘+发布；**stage-channel 封装**（runCompileInWorker 升格独立模块，含 outputCount 对账，见 technical-design §2.5） | **等价重构** | 产物字节级 diff=0；完整回归套件通过（当时数量记入实施证据） |
| **M2 指纹与失效**（= 演进阶段 2） | 指纹体系（(mtime,size) 预筛+hash）；scan+closure 单实现；watch 接入（事件降级为触发器）；**`--verify-incremental` 对拍（MUST 子项：增量 vs 全量 diff=0）** | **含行为改进点**：合并事件不再保守退全量（watch-plan.spec 对应用例更新并记录）；**体验监控（stats 消费契约见 worker-architecture §4.1）**：dev 经 vconsole/调试位观察 reload 频率，若实测退化回退保守策略（D-WA-1 精神） | 增量对拍：受影响 Entry 重算、其余命中持有 + verify diff=0；测试更新 |
| **M3（可选）** | cache 路径（`pnpm compile`）迁移到同一机制（对拍已拆入 M2，不在 M3） | 消费者收编 | compile-cache 行为等价或改进记录 |

## 关键决策（D-BM-1..7，倾向已记录、待 ready 冻结）

| ID | 决策点 | 倾向 |
| --- | --- | --- |
| D-BM-1 | 模型位置 | 主线程持有；worker 变"transform 服务"（传源进、传产物回）——协议仅**加产物字段**，上下文段不动 |
| D-BM-2 | 指纹方案 | `(mtime, size)` 预筛 + content hash 确认（git 风格轻量版，非纯 mtime——避免 mtime 未变但内容变的漏算窗口）；M3 对拍兜底 |
| D-BM-3 | 变更检测 | 状态对比（scan+closure）；事件只触发扫描。**已知行为变化**：watch 合并事件不再退全量 |
| D-BM-4 | 物化 | materialize 保持产物字节与目录结构不变；临时目录 rename 优化保留 |
| D-BM-5 | 正确性地基 | 依赖图完备性 = correctness 基石（小程序依赖静态可完备）；**`--verify-incremental` 对拍为 M2 MUST 子项（不挂可选门）** |
| D-BM-6 | **不引入 native 缓存模块**（2026-09-10 讨论拍板） | 有意不引入（xxhash/blake3/SQLite/LMDB 等）。理由：① hash 非瓶颈（base 实测 202 文件全量 sha256 含 IO 6.2ms，吞吐 ~1.1GB/s，crypto 本就 native OpenSSL）；② NAPI 边界负优化（产物为 JS 字符串，入 native 结构需双次拷贝，20MB 级 V8 堆无压力）；③ 持久化场景由文件系统承担（targetPath staging/seedPath 即磁盘缓存）。**revisit 触发**：实测超大工程（万级文件）指纹扫描成 watch 延迟主因 → @node-rs/xxhash；跨进程产物级持久缓存（CI 复用）→ SQLite 索引。仓库不排斥 native（已依赖 oxc/esbuild），拒绝理由是必要性非洁癖 |
| D-BM-7 | **stage-channel 封装并入 M1**（2026-09-10 讨论拍板） | `runCompileInWorker`（index.js 内联 90 行）升格为 `common/stage-channel.js`（~150 行领域封装，含 M1 的 outputCount 对账）。硬理由：流式协议使消息处理从无状态变**有状态**，必须有宿主；协议知识单点（M3/TS-2 改协议只动一处）；可 mock worker 单测。**不做**：通用 RPC/请求复用/重连/IDL。见 technical-design §2.5 |

## Readiness gaps

1. D-BM-1..7 待逐项评审冻结（尤其 M2 行为变化的验收口径）；D-BM-6/7 已随讨论拍板成文，待随 ready 一并确认
2. ~~worker 协议扩展的精确形状~~ — **探针已落盘**（[protocol.draft](protocol.draft.md)：流式回传/Entry 粒度天然分批/无需字节阈值与 LRU；D-P1..3 待随 ready 冻结）
3. inputHash 聚合算法（输入集排序稳定性、include 链聚合）待设计——**协议基准由 [`fe-tools-worker-architecture`](../fe-tools-worker-architecture/README.md) 提供；FileModule 粒度属 module-cache 并行层，不阻塞本门**
4. M3 是否纳入本 Action 或另立（defer 决策）——**对拍已拆入 M2（MUST），M3 仅剩 cache 迁移，defer 不影响正确性兜底**

## Closure conditions

① M1/M2（及纳入时的 M3）交付；R-BM 全 pass 且 P-BM 填入实际证据
② 消融（原则 6：每项独立机制分别消融）：
- M1 物化收敛：去 materialize → 字节验收失败
- M1 产物回传：去产物回传（worker 直接写盘）→ A-BM01 失败
- M1 stage-channel 封装：去封装（消息分发退回 runCompileInWorker 内联）→ stage-channel 单测失败（若有）或 A-BM01 失败
- M1 outputCount 对账：去对账（无完整性校验）→ 对账测例失败
- M2 失效传播：去 closure → 增量对拍失败
- M2 verify 对拍：去 verify 子项 → R-BM6/A-BM06 失败（营造漏算场景）
③ Backflow：`docs/actions/fe-tools-sidecar` roadmap 增补本 Action 与 TS-2 的地基关系；Action-Review-Playbook 若有新经验回流
④ STATUS/归档/指针一致变更

## Documents

| 文档 | 作用 |
| --- | --- |
| [source-audit](source-audit.md) | 现状证据（直通式/缓存清单/双 plan/粒度/TS-2 素材） |
| [protocol.draft](protocol.draft.md) | worker 协议探针：流式回传设计（D-P1..3）+ base 实测；gap ② 已关闭 |
| [requirements](requirements.md) | R-BM-*（MUST/SHOULD） |
| [technical-design](technical-design.md) | 模型/协议/指纹/失效传播设计 |
| [acceptance](acceptance.md) / [validation](validation.md) | 验收与验证（draft） |
