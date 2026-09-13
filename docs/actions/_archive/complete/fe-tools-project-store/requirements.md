# Requirements — fe-tools-project-store

Status: **冻结（Final Readiness · FR4 · 2026-09-12）** — 与 design v1 / acceptance 对齐；升 ready 后改契约须同步三文

## R-PS1（MUST）ProjectStore 壳

存在 `fe/tools/bundler/src/model/project-store.js`（或 design 冻结的等价路径），提供 `createProjectStore` 与 `load` / 图持有 / `snapshot`（及按需 `merge`/`getDependencyGraph`）。`load` 语义覆盖今日 `storeInfo`（PS1：内部仍可调用 `storeInfo` + ALS）。**P2**：对外 getters 语义不变。

## R-PS2（MUST）session 始终持有

`createBundler` 创建时即 `createProjectStore()` 并持有；**非进程单例**（两次 createBundler → 两实例）；不暴露 `session.store`（R3）。**R1 接线清单**：`project-store.js`；`session/index.js`；`watch/watch-runner.js`；`index.js`/`build()`（注入 + M-A）。内部字段 **`state.store`（RR5）**。

## R-PS3（MUST）编译接线 + M-A

经 session `.build` / watch，或 `build({ store })`（**RR4**：包内私有 `options.store`）时：`Object.is(ctx.dependencyGraph, store.getDependencyGraph())`（M-A）；`stage-channel.merge` 即写入 Store。**RR6**：load 后挂 Store 图到 ctx；**禁止**再 `new DependencyGraph` 挂 ctx。无 session 的 `build()` 可临时 createStore（L3）。**FR2**：`build:start` 载荷剥离 `store`（与 `dependencyGraph` / `lifecycle` 同列）。**FR7**：`resolveCompileConfig` 忽略 `store`。

## R-PS4（MUST）watch 刀 A

`createBuildWatcher` 接受可选 `store`；session.watch/dev 注入 `state.store`；缺省可临时 store（W2）。**PS1 保留**闭包 graph 镜像（W3）。**W4**：`beforeBuild` ctx 不必含 store。**FR6**：watcher 内部编译传同一 `options.store`。

## R-PS5（MUST）行为 0 变化

相对约定基线：全量 vitest 绿；nomap 产物字节等价 MUST；**L1**：每次 session `.build` 仍全量 load（对齐今日每次 `storeInfo`）；不改变 CLI build/watch/dev 可观察产品语义（preview 协议不变）。CLI 冒烟 SHOULD。

## R-PS6（MUST）范围切割

PS1 **不**抽 runBuild 阶段表（BP1）；**不**删闭包活图（PS2）；**不**改 compile-cache（R4）；**不**新增 package exports（P3）。允许仅在 `runBuild` 内挂 M-A 引用（R2，不算 BP1）。

## Non-requirements

- applyChanges / subscribe（PS3+）  
- graphDelta  
- TS-2 IR；SharedArrayBuffer  
- 公开 `session.store`  
- **L4** 强制新测（stop 后保留 Store — 实现按调度稿，PS1 不强制验收测）
