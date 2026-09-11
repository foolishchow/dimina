# Source Audit — fe-tools-worker-architecture

Status: `draft`（2026-09-10，基于 HEAD `9fb9775c` 的代码事实）

三 worker 架构现状证据。为决策 Action 提供事实基础；实施责任不在本 Action（分给 build-model / module-cache）。

## 1. 三 worker 现状：一次性、写盘型、阶段私有

```text
runBuild
  ├─ view stage  → new Worker(view-compiler) → 写盘(targetPath) → terminate
  ├─ logic stage → new Worker(logic-compiler) → 写盘 → terminate
  └─ style stage → new Worker(style-compiler) → 写盘 → terminate

workerPool.runWorker = 并发槽位管理（cgroup 感知），非 worker 实例复用
```

- 每次 `new Worker` + resolve 前 `terminateWorker()`（index.js:313/:368）
- 产物不出现在 postMessage（worker 直接写盘；`postMessage` 只回 metadata：warnings/dependencyGraph/completedTasks）
- 入站消息 = 全量上下文 `{pages, storeInfo, sourcemap, compileConfig}`（logic 多 sourcemapTargetPath）

## 2. 三个 worker 各自的领域特征（不可统一处）

| worker | 中间表示 | 依赖域 | 产物边界 |
| --- | --- | --- | --- |
| view | cheerio DOM + Vue template 字符串（无 AST） | 模板域（include/template/import 边） | per-page render.js |
| logic | oxc AST（AST 指导的源码变换） | JS 模块域（import/require 边） | **app 级单 logic.js bundle** |
| style | postcss AST + selector-parser | CSS 域（@import 边） | per-page css + app.css |

领域内容异构（DOM vs AST vs cssAST）、依赖图异构、产物边界不同——**不可统一中间表示**（见 README Non-goals）。

## 3. 当前 worker 架构与目标的结构性落差

| 落差 | 现状 | 目标 |
| --- | --- | --- |
| 结果边界 | worker 直接写盘，主线程无产物 | 产物回传主线程（BuildModel 持有）+ materialize |
| 协变 | 全量 pages + storeInfo 下发 | 任务快照（Group 子集 + 变更 + contextFingerprint） |
| 生命周期 | 每次 new/terminate | 前 3 阶段保留；常驻 service 为可选第 4 阶段 |
| 协议 | 阶段协议（metadata） | WorkerTask / WorkerResult（outputs + graph delta + diagnostics） |
| 数据流 | 单向但只回 metadata | 单向回传 delta（worker 不反向改 GroupModule） |
| 模型 | 主线程仅结构图（DependencyGraph） | GroupModule 权威 + BuildModel 产物 |

## 4. 现状可复用资产（决策输入）

- `DependencyGraph`：owner 级结构图（fileOwners/fileKinds）——GroupModule 索引的雏形
- `templateRenderCache`：组合后 render 缓存（内容寻址雏形）
- `workerPool`：并发槽位管理（若常驻 service，其 cgroup 感知逻辑可复用）
- `runCompileInWorker`（index.js:310-400+）：90 行协议处理（Worker 构造/terminate/消息分发/错误重建）——stage-channel 封装的搬家源