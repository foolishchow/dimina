# Technical Design — fe-tools-build-model

> 状态：**草案（2026-09-10）**。设计基于 [source-audit](source-audit.md) 的代码事实；D-BM-1..5 为倾向，待 ready 冻结。vivid source 待探针（见 §6）。

## 1. 目标形状

```js
BuildModel（主线程持有，D-BM-1）
  groups: Map<groupId, GroupModule>    // 结构与关联权威（owner + 跨维度文件引用，见 module-cache）
  entries: Map<entryId, Entry>        // 产物与增量权威
  fingerprints: Map<filePath, { mtime, hash }>   // 文件级两层指纹
  graph: DependencyGraph               // 现有结构骨架复用
  sourceOfTruth: 'main'                // 主线程是权威；worker 只收任务快照，不反改

Entry = {
  id,                    // page/component/app-logic/app-style
  kind,
  inputFiles: string[],  // 由 graph 给出（view: 页wxml+include链+wxs集）
  inputHash: string,     // 有序聚合（排序稳定）
  outputs: null | { code, sourcemap },   // M1 起持有；null=待编译
}
```

不设 `ir` 字段（Non-goal）；三层判定升级缝：`inputHash`（本门）→ 未来 `irHash` → `outputHash`。

### 1.1 BuildModel 归属与构建（谁构建 / 计划怎么构建）

**现状谁在构建**（散落的组装者）：

| 现状对象 | 当前构建者 | 内容 |
| --- | --- | --- |
| `pathInfo/configInfo` | `env.storeInfo()` | app.json、页面 JSON、组件树、项目配置 |
| `DependencyGraph` | `storeInfo()` + 各 compiler `addFile()` | owner、文件归属、依赖边、kind |
| `buildResult` | `runBuild()` 返回 | appId/name/path/dependencyGraph |
| watch plan | `watch-plan.js` | 受影响 Entry、stages、seedPath |
| compile-cache entry | `compile-cache.js` | 落盘指纹、依赖图、manifest |

**当前缺失**：entries / inputFiles / inputHash / outputs / dirty 状态 / materialize 归属——
即不是完整 BuildModel，是 `CompilerContext + DependencyGraph + WatchState` 的散落组合。

**Action 计划怎么构建（M1 内的归拢步骤）**：

1. **现状归拢**：将 `configInfo + DependencyGraph + buildResult + watch 状态` 收敛为
   BuildModel 单点（groups / graph / fingerprints 起步）；不改编译算法
2. **输出回传**：worker 产物经阶段 1（结果边界）流式回传 → `entries[entryId].outputs` 持有
3. **组关联**：基于 DependencyGraph 的 fileOwners 构建 `groups[groupId] → viewFiles/logicFiles/...`
4. **指纹与失效**：M2 接入 scan+closure，BuildModel 成为失效决策的唯一权威

归属分层（与 worker-architecture / module-cache 对齐）：

```text
BuildModel（本门）：跨 build，主线程，结构+产物权威（Entry.outputs 是跨 build 复用的核心）
ModuleCache（module-cache）：单 stage，worker 内，FileModule 内容局部复用
GroupModule（介于两者）：结构关联索引——主线程权威，worker 只持注入引用
```

## 2. worker 协议扩展（D-BM-1 的最小实现）

```text
现：postMessage({ pages, storeInfo, sourcemap, compileConfig })
      → 编译 → 写盘 → postMessage({ success, compatibilityWarnings, dependencyGraph, ... })

改：postMessage({ ..., /* 上下文段不动 */ })
      → 编译（transform 内部不动）→ 产物回传，不写盘
      → postMessage({ success, ..., outputs: [{ entryId, code, sourcemap }] })
```

- **只加产物字段**；上下文段、进度消息（completedTasks）、错误协议不动；产物**流式回传**（每 Entry 一条，与逐页进度同节奏，无字节阈值——base 实测 1.9MB/185 文件，单 Entry ≤ ~300KB；见 [protocol.draft](protocol.draft.md)）

### 2.5 stage-channel 封装（M1 配套，协议知识的家）

现状 `runCompileInWorker`（index.js:310-400+，约 90 行）是手写半封装：Worker 构造 / promise 化 / terminate 槽位语义 / 四分支消息分发 / 六字段错误重建，全部内联在 runBuild 所在文件。

**升格为独立模块** `common/stage-channel.js`（~150 行领域封装，非通用 RPC）：

```js
runCompileStage({ script: 'view'|'logic'|'style', payload,
                  onProgress, onOutput, onWarning })
  → Promise<{ dependencyGraph }>
// 内部：现状 90 行搬家 + M1 新增的 output 消息分发与
//       outputCount 对账（有状态：实收 vs 声明，不符 = stage 失败）
```

**硬理由**：M1 使消息处理从无状态变**有状态**（对账计数）——必须有宿主，不能与 index.js 纠缠；协议知识单点（M3/TS-2 再改协议只动此一处）；channel 可 mock worker 单测（现状只能集成测）。**不做**：通用 RPC / 请求复用 / 重连 / IDL。
- logic：单 Entry（app 级 bundle 整体一条）

## 3. 指纹与失效传播（D-BM-2 / D-BM-3）

```js
// 文件级（两层）
fingerprint(file) = mtime 未变 → 沿用旧 hash；mtime 变 → 重算 hash

// 变更集（纯函数，无时序）
scan(old, current) = { changed, added, removed }

// 受影响 Entry（图闭包，单实现）
closure(changed) = graph 反查 file → owner module → entry 集合
  // 复用 getAffectedEntries 语义，粒度落 Entry

// 判定
entry 需重算 ⇔ closure(变更集) 含该 entry
```

**watch 接入**：chokidar/scheduler 壳保留；事件仅置"脏标记"（该文件待扫描），drain 时 `scan + closure`——**事件合并（count>1）歧义自然消失**（R-BM4 行为改进点）。

**include 聚合**：`inputFiles` 由 graph 的 fileOwners 反查生成；`inputHash = hash(排序后 [path:hash] 串)`——include 模板变 → 所属页 inputHash 变（与现状 affectedEntries 行为一致，判定更可靠）。

### 3.1 inputHash 聚合协议（L-M-12：讨论收敛沉淀）

```text
Entry.inputHash = H(
  schemaVersion,        // 如 'bm-v1'——算法变更时整体失效
  toolStamp,            // 编译器版本指纹（全局维度，变则全部失效）
  contextFingerprint,   // 编译维度聚合（minify/esTarget.view/fileTypes/renderer）
                          // ← 即 worker-architecture WorkerTask.contextFingerprint
  sorted(inputFiles.map(f => `${relPath}:${contentHash}`))  // 字典序排序
)
```

**四层维度**（漏维度 → 错误命中，多维度 → 保守重算，宁多勿漏）：

| 层 | 内容 | 归属 |
| --- | --- | --- |
| 内容 | 文件 contentHash | R-BM3（(mtime,size) 预筛 + hash） |
| 结构 | inputFiles 集（graph.fileOwners 反查） | R-BM1（Entry 定义） |
| 参数 | contextFingerprint（minify/esTarget.view/fileTypes/renderer） | worker-architecture 协议字段 |
| 工具 | toolStamp（编译器版本/源码指纹） | 全局维度，变则全部失效（对齐 compile-cache 的 compilerLastModified 先例） |

**排序稳定性**：inputFiles 集合来自 graph（Set），序列化前按 `relPath` 字典序排序——消除遍历顺序不确定性。

**不应进入 inputHash 的维度**（否则换目录/进程即全失效）：targetPath / 临时路径 / 进程 PID / worker ID / 时间戳 / 监听事件 count。

## 4. 物化（D-BM-4）

```js
materialize(model, { targetPath, useAppIdDir })
  // 唯一写盘出口：
  //  1. createDist(seedPath) 语义保留（staging 种子复制）
  //  2. 逐 Entry 写 outputs（替代三个 compiler 的 writeFileSync）
  //  3. publishToDist 语义保留（发布目录 rename/move 优化不动）
```

产物文件路径与命名**完全沿用现状**（logic.js/app.css/每页 render 等）——字节级 diff 验收的前提。

## 5. 现有组件归宿

| 组件 | 归宿 |
| --- | --- |
| `DependencyGraph` | 结构骨架直接复用（fileOwners/fileKinds 反查即 closure 原料） |
| `templateRenderCache` 等 worker 叶子缓存 | **保留原位**（worker 内防单点重复计算）——与模型层缓存职责不同、互不替代 |
| `watch-plan.createWatchBuildPlan` | **退役**：plan 生产段被 scan+closure 替代；scheduler 壳保留 |
| `compile-cache`（落盘指纹） | M3 迁移到 scan+closure（落盘层只存指纹与产物指针） |
| dev-reload 对 plan 形状的依赖 | 改读 closure 结果（形状显式化，消除注释级隐式契约） |
| `createDist`/`publishToDist` | 并入 materialize（语义保留） |

## 6. 待探针（ready 前）

1. 协议探针：产物字段形状 / 分批阈值 / 大产物内存预算（base 示例实测）
2. inputHash 聚合探针：排序稳定性、include 链深聚合成本
3. closure 探针：大工程（base 全示例）闭包计算性能
4. M2 行为变化验收口径：watch-plan.spec 更新清单

## 7. 风险

| 风险 | 缓解 |
| --- | --- |
| 图不完备 → 漏算（correctness） | 静态依赖可完备的假设显式化；M3 对拍模式；先行补图边测试 |
| 产物回传内存峰值 | Entry 分批 + LRU 余地；base 实测预算 |
| watch 行为变化引发回归 | 变化点白纸黑字（R-BM4）；对应用例更新 + 交付说明记录 |
| 物化顺序差异破坏字节等价 | materialize 写序与现状逐一对齐；双模式 diff 验收 |
