# Requirements — fe-tools-packer-context

Status: **draft（2026-09-22）** — D-PC-0..11 已冻。

权威决策：D-PC-0..11（见 README）；形状 D-PCS-1/4/6；承接 D-GB 路 2。

## R-PC-1（MUST）PackerContext 可构造且可消费

- 存在明确的构造路径（增强 `toPackerContext` 或抽至 `packer/context.ts`，D-PC-5），产出满足 `types.ts` §2 字段的 `PackerContext`
- `workPath` / `targetPath` / `fileTypes` / `readContent` 对 Graph 路 2 **可用且非空转**
- `resolveAlias` / `resolveNpm` **本门保持 stub**（D-PC-4）；须在注释/文档标明另门真接
- **不**为本门新增 `fileExists` 等 PackerContext 字段（D-PC-7）

依据：D-PC-0；D-PC-4；D-PC-5；D-PC-7；D-PCS-1。

## R-PC-2（MUST）Graph 路 2

- `PackerGraph.build(ctx)` / `reconcile(ctx)` **使用** `ctx`（`readContent` + paths + `fileTypes`）完成 config fixpoint
- 内容读取只经 `ctx.readContent`；可选文件存在性用 Graph 侧 `fs.existsSync`（D-PC-7）
- **不得**再以「`void ctx` + 仅 ALS 委托 store*」为长期主路径（路 1 关闭，D-PC-6）
- config 内组件路径解析迁入 Graph 私有；npm 用 `NpmResolver(ctx.workPath)`（D-PC-8）；不经 PackerContext resolvers
- build 过程只用 Graph 局部 state（D-PC-9）；kind/扩展名用 `ctx.fileTypes`（D-PC-10）

依据：D-PC-0；D-PC-4；D-PC-6..10；D-PCS-4；D-GB 终态。

## R-PC-3（MUST）接线不破坏 orch

- 公开 build / watch 仍经现有 `PackerOrchestrator` 入口
- ctx 由 `storeInfo` 装配后传入 Graph；orch **不**直组 PackerContext（D-PC-5）
- 不回退双脑 pipeline；不改 D-OR-4..8 装配/返回值决策

依据：D-PC-2；D-PC-5。

## R-PC-4（MUST）行为 0

- examples 产物 diff=0（全量 7 项目：air-battle / base / mpx-demo / subpackages / taro-todo / vant / weui——Experience-Review §12 全量要求，此门改 env.ts + graph.ts 双全局路径）
- 全量 vitest 绿；tsc 0 错
- 不引入 `any` / `as any` / `@ts-nocheck`（新增/改动面）

依据：D-PC-1；行为 0 原则；Experience-Review §12。

## R-PC-5（MUST）env 兼容面

- 对外仍依赖的 getter / `storeInfo` / `resetStoreInfo` 签名与行为对消费方可用
- Scheme 专有（getComponent / getAppId / …）**不**塞进 PackerContext（D-PCS-4）
- `storeProjectConfig` 等：**薄 re-export 壳保留**（D-PC-11），主路径只走 Graph；**不**长期双轨主路径（D-PC-6）

依据：D-PCS-4；D-PC-6；D-PC-11；R-GB-5 同类纪律。

## Non-requirements

- incremental-unify；MC3c；load/compile 拆分；真 registry
- Session 持久 state；EmitEntry[] 返回收敛
- PackerContext.`resolveAlias` / `resolveNpm` 真实现（D-PC-4）
- PackerContext 存在性 API（D-PC-7）
- orch 内组装 PackerContext（D-PC-5）
- 本门改写 `__tests__/env.spec.js`（薄壳保住 import，D-PC-11）
