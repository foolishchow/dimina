# Worker Protocol Probe — DRAFT

Action: `fe-tools-build-model`（Readiness gap ② 的探针产物）
Status: 设计草案 · 未冻 · 未进 runtime。基于 HEAD `43e6953b` 的协议现状与 base 实测数据。

## 1. 现状协议（Audit）

### 主 → worker（入站，形状基本一致，微差保留）

| worker | 消息 | 备注 |
| --- | --- | --- |
| view | `{pages, storeInfo, sourcemap, compileConfig}` | view-compiler.js:225 |
| logic | `{pages, storeInfo, sourcemap, sourcemapTargetPath, compileConfig}` | logic-compiler.js:28（多一个字段） |
| style | `{pages, storeInfo, sourcemap, compileConfig}` | style-compiler.js:37 |

### worker → 主（出站，三种既有消息）

| 消息 | 时机 | 位置 |
| --- | --- | --- |
| `{completedTasks}` | 编译循环内**逐页**进度 | view:247（progress reporter 内） |
| `{success:true, compatibilityWarnings, dependencyGraph}` | 全部完成 | view:265 |
| `{success:false, ...}` | catch（清 worker 内缓存后） | view:280 |

**关键观察**：产物现在**不出现在任何消息里**（直接写盘）；进度消息已按页粒度流式。

## 2. base 实测（2026-09-10，sourcemap 全开）

| 指标 | 值 |
| --- | --- |
| 总产物 | **1.9MB / 185 文件**（nomap 估 ~1MB） |
| 最大单文件 | logic.js.map 260KB / logic.js 160KB / 单页 .js.map 52KB / 单页 .css 44KB |
| .map 总量 | 900KB（≈一半） |
| 外推大工程（×10） | ~20MB 字符串持有——无 postMessage 压力，无需 LRU |

**结论：分批阈值决策消解——按 Entry 粒度天然分批**（单 Entry ≤ ~300KB，structured clone 轻松）。

## 3. 协议扩展设计（D-P1: 流式回传，倾向已记录）

### 新增一种消息类型；既有三种不动、完成消息瘦身

```js
// 主 → worker：完全不变（logic 的 sourcemapTargetPath 微差保留）

// worker → 主（阶段 1，protocolVersion: 1）：
// (1) 进度（不变）:        { completedTasks }
// (2) 产物（新增，流式）:
{
  protocolVersion: 1,
  type: 'output',
  entry: {
    entryId,                       // page/component/app-logic/app-style 的 entryId（v1统一命名）
    kind: 'view' | 'style' | 'logic',
    files: [{ path, code }],       // path = 相对发布根（物化时直接写）
    sourcemaps?: [{ path, map }],  // sourcemap 模式
  },
}
// (3) 完成（瘦身）: { success:true, protocolVersion: 1, compatibilityWarnings,
//                     dependencyGraph, outputCount }   ← 完整性校验：主线程比对收到的 output 条数
// (4) 错误（不变）: { success:false, ... }
```

（阶段 2 的 WorkerTask/WorkerResult 用 `protocolVersion: 2`，见 worker-architecture §4——v1 → v2 即演进声明中的两代。）

### 三 worker 的回传节奏

| worker | 节奏 | 条数 |
| --- | --- | --- |
| view | 每页/组件编译完一条（与 completedTasks 同循环） | = entry 数 |
| style | 每页一条 + app.css 一条 | = 页数 + 1 |
| logic | **单条**（app 级 bundle 整体） | 1 |

### 为什么流式而非批量（A/B 对比）

| | A 批量（完成消息带全部产物） | **B 流式（推荐）** |
| --- | --- | --- |
| 主线程卡顿 | 一次性反序列化 1.9MB+ | 逐条（≤300KB） |
| 与进度对齐 | 无 | 天然同节奏（复用逐页编译循环） |
| 失败路径 | 全丢 | 已回传留模型；build 失败不物化（语义同现状：失败即不 publish） |
| 完整性校验 | 无从校验 | outputCount 对账 |

## 4. 错误与中断路径

- **worker 编译失败**（现有 catch）：清 worker 内缓存 + 错误消息；**已流式回传的产物保留在 BuildModel**——build error → materialize 不执行 → 与现状"失败不 publish"等价
- **watcher 中断**（stop 中途）：部分 Entry 已回传 → BuildModel 标 `stale`；下次 build 由指纹判定重算（不需特殊协议）
- **主线程收满校验失败**（outputCount ≠ 实收）：视为该 stage 失败（防御性，理论上不发生）

## 5. 待冻决策

| ID | 决策点 | 倾向 |
| --- | --- | --- |
| D-P1 | 回传时机 | 流式（本文件 §3） |
| D-P2 | entry.files 的 path 语义 | 相对发布根的**最终物化路径**（materialize 零转换直写） |
| D-P3 | sourcemap 载荷 | 与产物同条消息（`sourcemaps` 字段），不分开发——单 Entry 总量 ≤ ~600KB 无压力 |
| D-P4（新增，M-8） | 完成消息超时 | 主线程发任务后启动超时计时（阈值由 stage-channel 构造时传入，缺省值文档化但可覆盖——不做硬编码）；超时未收到完成消息 → stage 失败 → terminateWorker → build:error 路径。与 outputCount 对账共同覆盖“完成消息到达但 output 缺失”与“完成消息未到”两种场景。详见 worker-architecture §4.2 |

## 6. 对 requirements/design 的回写点（探针结论）

- Readiness gap ② 关闭：分批阈值 → **不需要**（Entry 粒度天然）；内存预算 → 1.9MB 实测 + ×10 外推可接受，无需 LRU
- technical-design §2 的"大产物分批：探针定阈值"更新为"Entry 粒度天然分批，无字节阈值"
- technical-design §6 探针清单第 1 项完成；R-BM1 补充"流式回传与 outputCount 对账"语义
