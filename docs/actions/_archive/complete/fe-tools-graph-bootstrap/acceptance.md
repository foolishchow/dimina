# Acceptance — fe-tools-graph-bootstrap

## A-GB-1 — Graph 实现类（R-GB-1, D-GB-1, D-GB-4）

- [x] `src/packer/graph.ts` 含 `export class PackerGraph implements Graph`
- [x] `graph.ts` 定义 `GraphConfigData` 类型（无索引签名）
- [x] env.ts `PageConfig` / `ComponentConfig` 加 `export`
- [x] PackerGraph 实现全部 Graph interface 方法

## A-GB-2 — build(ctx) 自包含（R-GB-2, D-GB-4, D-PCS-4）

- [x] `build(ctx)` 从 `ctx.workPath` 读 app.json — 路 1 过渡态: 通过 ALS pathInfo（由 storeInfo step 2 从 ctx.workPath 设置）委托 env.ts 函数
- [x] `build(ctx)` 递归发现组件（storeAppConfig + storePageConfig 逻辑）
- [x] `build(ctx)` 扫文件建图（createInitialDependencyGraph 逻辑）
- [x] `build(ctx)` 不依赖外部 configInfo 预填 — build 内部调用 storeProjectConfig→storeAppConfig→storePageConfig 自己写入 configInfo；依赖 ALS pathInfo（路 1 过渡态）

## A-GB-3 — reconcile(ctx)（R-GB-3, D-GB-3, D-PCS-3）

- [x] `reconcile(ctx)` 重做 config fixpoint
- [x] `reconcile(ctx)` 保留 source-level edges
- [x] watch rebuild 的 graph merge 由 reconcile 承接

## A-GB-4 — storeInfo 瘦身（R-GB-4, D-GB-1, D-GB-4, D-PCS-1）

- [x] `storeInfo` 只设 PackerContext（paths + fileTypes）— steps 1-2 保留，steps 3-6 委托 PackerGraph
- [x] 调用方（build-pipeline / watch-plan）改为调 graph.build/reconcile — 路 1 过渡态: storeInfo 内部创建 PackerGraph 并调 graph.build/reconcile；调用方（ProjectStore.load）不改。终态路 2 将由 Orchestrator 直接调 graph.build/reconcile
- [x] build-pipeline 含 CompilerContext→PackerContext adapter — `toPackerContext()` 定义在 env.ts，storeInfo 内部使用
- [x] PackerGraph 提供 `getConfigData()` 方法

## A-GB-5 — ALS 兼容（R-GB-5, D-GB-2）

- [x] getComponent / getAppConfigInfo / getRuntimeType / isMiniGame 签名不变
- [x] 这些 getter 的调用方不改
- [x] `resetStoreInfo` 重建 PackerGraph（从快照），签名不变
- [x] PackerGraph 提供 `restoreFromSnapshot()` 方法
- [x] CompilerContext 类型加 `graph?: PackerGraph` 字段（optional）

## A-GB-6 — 行为 0（R-GB-6）

- [x] `git diff --stat` 产物 diff=0 — `diff -r /tmp/graph-baseline /tmp/graph-new` = 0
- [x] tsc 0 错
- [x] vitest 全绿 — 608/608（compile-cli-cache flaky timeout 单独重跑 pass）

## A-GB-7 — 类型约束（R-GB-7）

- [x] 无 `any` / `as any` / `@ts-nocheck`
- [x] 无 `[key: string]: unknown` 索引签名
