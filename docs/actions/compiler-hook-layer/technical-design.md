# Technical Design — compiler-hook-layer

> 契约状态：**已冻结（v1，2026-09-08）**。本设计是本 Action 的实现契约，也是 A2（dmcc dev 变更分类事件）与 A4（target 载荷扩展）的依赖契约；任何变更需同步更新两处依赖声明。

设计基线：`src/index.js` 当前实现（`runBuild` + `runCompileInWorker` + Listr 任务树）。

## 1. 生命周期事件（建议稿）

| 事件 | 触发时机（现任务树节点） | 载荷（全部可序列化） |
| --- | --- | --- |
| `build:start` | `runBuild` 进入、选项校验后 | `{ workPath, targetPath, useAppIdDir, options }` |
| `config:collected` | `storeInfo()` + `new DependencyGraph()` 完成后 | `{ fileTypes, pagesCount, miniGame }` |
| `dist:prepared` | `createDist(seedPath)` 后 | `{ seedPath }` |
| `config:compiled` | `compileConfig()` 后（被跳过时不触发） | `{}` |
| `npm:built` | `NpmBuilder.buildNpmPackages()` 后（被跳过时不触发） | `{}` |
| `stage:before` | 每个启用阶段 worker 启动前 | `{ stage: 'view'\|'logic'\|'style', pages, sourcemap }` |
| `stage:after` | 阶段 worker 成功后 | `{ stage, compatibilityWarnings, durationMs }` |
| `stage:error` | 阶段失败（同错误对象字段） | `{ stage, error }` |
| `bundle:published` | `publishToDist()` 后 | `{ targetPath, useAppIdDir }` |
| `build:warning` | 每条兼容性警告产生时 | `{ message }` |
| `build:end` | 任务全部成功、返回前 | `{ result }`（即 `build()` 返回值） |
| `build:error` | 任何失败路径、reject 前 | `{ error, stage? }` |

时序保证：

```text
build:start → config:collected → dist:prepared → [config:compiled] → [npm:built]
  → stage:before/after ×N（三阶段交错，completion 顺序不保证，全完成先于 publish）
  → bundle:published → build:end
失败：任意点 → build:error → reject（同一错误对象）
```

## 2. 注册与触发语义

- `createLifecycle()` 返回 `{ on(event, listener), emit(event, payload) }`；`on` 支持同一事件多监听器，按注册顺序执行。
- 监听器可为 async；`emit` 依次 await。**阶段并发不受监听器影响**：事件触发发生在阶段边界（before/after），监听器 await 完成才继续该阶段的后续步骤，但其他阶段不受阻。
- **错误隔离（R-005）**：监听器抛错 → 捕获、记录进 `isolatedListenerErrors` 列表并打印统一前缀诊断日志（对齐 Experience-Review §7），事件流与构建结果不受影响；`build:end` 载荷附带 `isolatedListenerErrors` 计数供测试断言。
- **载荷只读（R-006）**：载荷在 emit 前冻结（浅冻结 + 文档约定深只读）；监听器改动载荷无效且不报错（SHOULD 级，测试只断言「改动不产生构建影响」）。
- 兼容性警告双通道：保留现有 `printCompatibilityWarnings` 输出语义（含 new-warning 去重与上限）**不变**，同时向 `build:warning` 逐条镜像。

## 3. 实现边界（改哪里、不改哪里）

改：

- `src/index.js`：`runBuild` 的任务节点改为依次调用生命周期阶段函数；Listr 退化为纯 UI（标题/进度条），不承载控制流。
- 新增 `src/common/lifecycle.js`：注册表 + 事件定义（含事件名常量导出，避免字符串散落）。

不改（逐一验证）：

- `runCompileInWorker` 内部（消息协议、错误重建、worker 终止时序）；
- `env.js` / `storeInfo` / `resetStoreInfo` / AsyncLocalStorage 上下文；
- worker 池与槽位管理；
- `publish.js`、`compile-cache.js`、`watch.js`、`bin/*`（作为行为不变的验证入口）；
- 三个编译器与 sourcemap 模块。

## 4. 与后续门的接口

- **A2（dmcc dev）**：订阅 `stage:after`/`bundle:published`/`build:error`，结合依赖图输出 §4.2 变更分类事件；本设计的事件载荷已含其所需字段（stage/pages/warnings）。
- **A4（target 抽象）**：`stage:before/after` 载荷预留 `target` 字段位（A1 阶段恒为 `'webview'` 且不写入产物）——是否预留以实现评审为准，不预留则 A4 扩展载荷字段。
- **D5（公开插件 API）**：本设计是内部事件，不对外；公开 API 冻结时以此为参考但不受其约束。

## 5. 备选方案与取舍

- **引入 tapable**：能力过剩（拦截/瀑布/异步流派生），且引入 webpack 生态依赖；自定义 ~100 行注册表足够 A1–A2 需求。弃。
- **把监听器做成可变更构建的可编程 hook（tapable 式）**：A1 无消费者需要；延迟到 D5 公开 API 设计时按需引入。弃。
- **事件总线全局单例**：与 AsyncLocalStorage 并发构建上下文冲突（多 build 并发时串台）；生命周期实例由每次 `build()` 创建并贯穿本次运行。采用实例化。
