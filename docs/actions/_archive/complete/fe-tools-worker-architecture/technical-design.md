# Technical Design — fe-tools-worker-architecture

> 状态：**草案（2026-09-10）**。决策 Action：ready = 冻结，不实施；实施分给 build-model / module-cache。基于 source-audit 的现状证据与本轮讨论收敛。

## 0. 终点架构目标（本决策的"为什么"）

> **主线程是编译的"大脑"（模型权威 + 增量决策），worker 是"手"（领域编译执行器，只做事不理解状态）；一次编译/一次 watch 会话结束，产物回到大脑，大脑决定下次动哪只手、不动哪只手。**

```text
主线程（Brain）
  GroupModule（owner 权威：page/component/npm + 跨维度文件引用）
  BuildModel（entry 产物持有：每页 render/css/js + 指纹）
  scan+closure（文件 hash → 受影响 Group → 精确到维度的失效集）

  变更事件（chokidar，只做触发器）
    → scan 指纹（mtime 预筛 + hash 确认）
    → closure（哪些 Group 的哪些维度失效）
    → 未变 Group：产物直接从 BuildModel 物化，worker 不动
    → 变化 Group：只下发这几个 Group 的任务快照

  任务分发（WorkerTask）：groups 子集 + changedFiles + contextFingerprint
    ├── view worker    ← 受影响页面的 wxml
    ├── logic worker   ← 受影响页面 js（保持 app 级 bundle 语义）
    └── style worker   ← 受影响页面的 wxss

  结果回收（WorkerResult）：outputs + graphDelta + diagnostics（单向，worker 不反改模型）
    → BuildModel 更新（持有）
    → GroupModule 合并（graph delta）
    → materialize 物化（唯一写盘出口）
```

### 终点能力 vs 现状

| 能力 | 终点 | 现状（三 worker 一次性） |
| --- | --- | --- |
| **A. 精确到维度的增量** | 改页面 js → 只 logic 维度重算；改共享 wxml → 只引用它的 Group 的 view 维度重算 | 改任意文件 → 消息合并退全量，整 app 重编 |
| **B. 跨 build 结果复用** | 页面没变 → 产物从主线程 BuildModel 直接拿出，不启动 worker | 产物在磁盘、无指纹定位，启动 worker 全量重编 |
| **C. 缓存与产物分层** | worker 内 = 单 stage 中间缓存（FileModule）；主线程 = 跨 build entry 产物 | 全在 worker 进程内，每次 terminate 全丢 |

### 终点边界（也不做）

- 不合并三 worker（领域中间表示异构：DOM vs AST vs cssAST）
- 不做跨 worker 共享内存缓存（物理分布决定共享=约定非实例）
- 不强制 worker 常驻（阶段 4 可选，凭性能测量；前 3 阶段已拿到 A/B/C 全部能力）
- logic 不假装 module 级增量（app 级 bundle 是产物边界的事实）
- 不定义 IR（TS-2 的事；本架构给 IR 留好"模型层"立足点）

### 决策落地后的形态（D-WA-1..6 → 运行时）

| 决策 | 落到运行时 |
| --- | --- |
| D-WA-1 生命周期 | 前 3 阶段无状态 worker，接口 service 形状（update(changed)），常驻可选 |
| D-WA-2 logic 边界 | app 级 bundle（诚实） |
| D-WA-3 跨 build 复用 | 主线程 BuildModel 持有 entry 产物 |
| D-WA-4 缓存分层 | worker 内单 stage / 主线程跨 build |
| D-WA-5 数据流 | 单向 delta，worker 不反改模型 |
| D-WA-6 中间表示 | 不统一三域（DOM vs AST vs cssAST） |

## 1. 决策依据（为什么需要演进）

三 worker 现状与目标的结构性落差（source-audit §3）：结果边界 / 协变 / 生命周期 / 协议 / 数据流 / 模型——六项落差是本 Action 决策的对象。**不是一步大改**：分四阶段，前 3 阶段不要求 worker 常驻。

## 2. 演进路径（四阶段）

```text
阶段 1：结果边界 — build-model M1
  现状：worker 直接写盘，主线程无产物
  改：   worker 产物回传主线程（BuildModel 持有）+ materialize 统一物化
  不改： worker new/terminate 生命周期；三 worker 数量
  验收： 字节级 diff=0（nomap + sourcemap 双模式）

阶段 2：协变 — build-model M2
  现状：入站全量 {pages, storeInfo}；出站仅 metadata
  改：   入站任务快照 {groups 子集, changedFiles, contextFingerprint}
         出站 WorkerResult {outputs, graph delta, diagnostics}
  不改： worker 生命周期；单向数据流原则确立
  验收： 受影响集行为断言 + 字节等价

阶段 3：模型层 — module-cache
  现状：主线程仅结构图；worker 内缓存单 stage 即亡
  改：   GroupModule（主线程权威）+ ViewFileModule/LogicFileModule 内容缓存
  不改： 三领域中间表示（DOM/AST/cssAST 异构）
  验收： 缓存命中 / 颗粒度断言

阶段 4：worker 常驻 service（可选，收益最高）— 未来独立决策
  改：   worker 内跨 update 保留 FileModule cache；生命周期管理
  前置： 阶段 1-3 完成；有明确性能收益测量支撑（避免盲目常驻）
```

## 3. D-WA 决策表（本讨论已收敛，待 ready 复核冻结；每条含依据/来源）

| ID | 决策点 | 结论 | 依据/来源 |
| --- | --- | --- | --- |
| D-WA-1 | worker 生命周期 | 前 3 阶段保留 new/terminate 无状态；接口按 service 形状设计（`update(changed)`）；常驻 = 阶段 4 可选 | worker 生命周期审查；source-audit §2（new/terminate 事实）；commit `ba0f553f`/`928237cb` |
| D-WA-2 | logic 产物边界 | app 级单 bundle 保持；view/style 才 entry 级（粒度诚实） | source-audit §3（logic 单文件 writeFileSync）；产物粒度表 |
| D-WA-3 | 跨 build 复用途径 | 主线程 BuildModel 持有 entry 产物（未变 entry 不启动 worker）；非缓存实例共享 | build-model D-BM-1/D-BM-3；物理分布讨论（9fb9775c） |
| D-WA-4 | 缓存分层 | worker 内 = 单 stage（FileModule 内容）；主线程 = 跨 build（entry 产物）；不冲突 | module-cache Worker 生命周期边界（928237cb）；BuildModel §1.1 分层 |
| D-WA-5 | 数据流 | 单向：worker 回传 delta（outputs+graph delta+diagnostics），不反改 GroupModule；主线程合并 | §4 协议草案；单向数据流原则；build-model protocol.draft 流式设计 |
| D-WA-6 | 三领域中间表示 | 不统一（DOM vs AST vs cssAST）；共享仅机制/协议 | source-audit §2（领域异构表）；AST 矩阵（view 无 AST / logic oxc / style postcss） |

**修订机制（L-6）**：build-model / module-cache 在实施 Backflow 时若发现与 D-WA 冲突，不得静默违背——向本表 append 修订行（格式：`修订日期 + 触发方 + 原因 + 新结论`）；单条冲突由此处理，结构性冲突另立修订 Action。

## 4. WorkerTask / WorkerResult 协议草案（探针级，待细化）

### 与 build-model protocol.draft 的关系（演进声明，M-1 修订）

```text
阶段 1（build-model M1）：以 build-model/protocol.draft §3 为准
  - 消息形态：流式 { type:'output', entry:{ entryId, kind, files, sourcemaps? } }
  - 完成消息：{ success, compatibilityWarnings, dependencyGraph(全量), outputCount }
  - stage-channel 消费此阶段协议（自持，不等本草案冻结）

阶段 2（build-model M2）：演进为 WorkerTask / WorkerResult（本草案）
  - 入站：WorkerTask（groups 子集 + changedFiles + contextFingerprint + seed）
  - 出站：WorkerResult（outputs 数组 + graphDelta 增量 + diagnostics + stats + status）
  - 演进点：全量图 → graphDelta；metadata → stats/diagnostics；产出聚合为 outputs

两者是同一协议的两代形态，不是两套并行协议；
产物条目命名统一（entryId + kind，不引入 groupId 顶层字段——Group 关联在 WorkerTask.groups）。
```

```js
// 入站（阶段 2 起）
WorkerTask = {
  domain: 'view' | 'logic' | 'style',
  protocolVersion: 2,
  buildId,
  groups: [{ id, kind: 'page'|'component'|'npm',
             viewFiles?/logicFiles?/styleFiles? }],   // Group 子集（受影响）
  changedFiles: [...],
  contextFingerprint,     // 编译维度（minify/esTarget/fileTypes/renderer）
  seed: { targetPath, publishedPath },   // 种子/复用基线（若适用）
}

// 出站（单向回传，不反改模型）
WorkerResult = {
  domain, protocolVersion: 2, buildId,
  outputs: [{ entryId, kind, files: [{path, code}], sourcemaps? }],
  graphDelta,             // 阶段 2 起：worker 观测到的依赖增量（主线程合并进 GroupModule）
  diagnostics: { warnings: [...], errors, shape: 'serializable' },
  stats: { cacheHits, cacheMisses, durationMs },   // 可观测性（消费契约见 §4.1）
  status: 'success' | 'failed',
}
```

### 4.1 stats 消费契约（M-7）

stats 的消费者与暴露路径：

| 消费者 | 路径 |
| --- | --- |
| dev 开发者（reload 频率观察） | `dimina-cli dev` 经 vconsole 调试位输出（对齐 A2 既有通道）；或 `session.dev` 的 devHandle 暴露 `stats` 只读属性 |
| API 用户 | `session.lifecycle` 的 `build:end` 事件载荷携带增量统计（阶段 2 起） |
| 内部调试 | stage-channel 日志（前缀 `[stage-channel]`，含 cacheHits/Misses/durationMs） |

**约束**：stats 不得作为行为决策依据（不参与失效判定），仅用于诊断与体验监控（build-model M2 的 reload 频率回退预案以此为触发输入）。

### 4.2 消息时序防护（M-8，阶段 1 流式 + 阶段 2）

跨线程消息不能假设到达与顺序（Experience-Review §4）：

```text
① 完成消息超时：主线程发送任务后启动超时计时（如 120s 或 stage 级默认值）
   → 超时未收到完成消息 → 判定 stage 失败
   → terminateWorker（对齐现有 runCompileInWorker 语义）
   → 触发错误路径（build:error lifecycle 事件）

② 乱序/丢失：outputCount 对账（收到的 output 条数 vs 完成消息声明的条数）
   + ① 超时兜底：完成消息丢失 → ① 超时触发 → 对账从未执行
   → 两条防护共同覆盖“完成消息到达但 output 缺失”与“完成消息根本未到”两种场景

③ worker 异常退出（exit code !== 0）：已有处理（runCompileInWorker 的 exit/error 监听）
   → stage-channel 封装时保留

④ 超时阈值：不做硬编码——由 stage-channel 构造时传入（可从配置/CLI 环境变量取，
   缺省值写入文档但标记为可覆盖）
```

**单向数据流原则（D-WA-5）**：worker 永不反向修改 GroupModule / BuildModel——只回传 delta；主线程是唯一合并与失效决策点。

## 5. 边界映射表（阶段 → 归属 Action）

| 阶段 | 归属 | 现有 Action 承接点 |
| --- | --- | --- |
| 1 结果边界 | build-model | M1（产物回传 + materialize + stage-channel 封装） |
| 2 协变 | build-model | M2（fingerprint + scan/closure 失效） |
| 3 模型层 | module-cache | MC1..3（FileModule 内容缓存 + Group 关联） |
| 4 常驻 service | 未来独立决策 | 前置：阶段 1-3 完成 + 性能收益测量 |

映射一致性：摊 up 与 build-model / module-cache README 交叉引用（R-WA4）。

## 6. 待探针（ready 前）

1. WorkerTask/Result 消息字段的精确形状（与 protocol.draft.md 的 output 流式设计对齐）
2. graphDelta 的序列化形状（DependencyGraph 增量 vs 全量快照——大图下增量必要）
3. contextFingerprint 与 build-model inputHash、module-cache key 的三方对齐

## 7. 风险

| 风险 | 缓解 |
| --- | --- |
| 决策 Action 变成无限讨论 | ready 条件写死（D-WA 全定稿 + 协议可评审）；ready 即冻结 |
| 边界映射双主/无主 | R-WA4 交叉引用一致性验收 |
| 阶段 4 常驻过早做 | 明确前置（阶段 1-3 + 性能测量），defer 记录 |
| 协议冻结过早被实现推翻 | 探针 + 后续 Action 冲突时修订记录（Closure ②） |