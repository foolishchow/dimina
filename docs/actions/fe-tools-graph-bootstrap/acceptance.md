# Acceptance — fe-tools-graph-bootstrap

## A-GB-1 — Graph 实现类（R-GB-1, D-GB-1, D-GB-4）

- [ ] `src/packer/graph.ts` 含 `export class PackerGraph implements Graph`
- [ ] PackerGraph 实现全部 Graph interface 方法

## A-GB-2 — build(ctx) 自包含（R-GB-2, D-GB-4, D-PCS-4）

- [ ] `build(ctx)` 从 `ctx.workPath` 读 app.json
- [ ] `build(ctx)` 递归发现组件（storeAppConfig + storePageConfig 逻辑）
- [ ] `build(ctx)` 扫文件建图（createInitialDependencyGraph 逻辑）
- [ ] `build(ctx)` 不依赖外部 configInfo 预填

## A-GB-3 — reconcile(ctx)（R-GB-3, D-GB-3, D-PCS-3）

- [ ] `reconcile(ctx)` 重做 config fixpoint
- [ ] `reconcile(ctx)` 保留 source-level edges
- [ ] watch rebuild 的 graph merge 由 reconcile 承接

## A-GB-4 — storeInfo 瘦身（R-GB-4, D-GB-1, D-GB-4, D-PCS-1）

- [ ] `storeInfo` 只设 PackerContext（paths + fileTypes）
- [ ] 调用方（build-pipeline / watch-plan）改为调 graph.build/reconcile
- [ ] build-pipeline 含 CompilerContext→PackerContext adapter
- [ ] PackerGraph 提供 `getConfigData()` 方法

## A-GB-5 — ALS 兼容（R-GB-5, D-GB-2）

- [ ] getComponent / getAppConfigInfo / getRuntimeType / isMiniGame 签名不变
- [ ] 这些 getter 的调用方不改
- [ ] `resetStoreInfo` 重建 PackerGraph（从快照），签名不变
- [ ] PackerGraph 提供 `restoreFromSnapshot()` 方法

## A-GB-6 — 行为 0（R-GB-6）

- [ ] `git diff --stat` 产物 diff=0
- [ ] tsc 0 错
- [ ] vitest 全绿

## A-GB-7 — 类型约束（R-GB-7）

- [ ] 无 `any` / `as any` / `@ts-nocheck`
- [ ] 无 `[key: string]: unknown` 索引签名
