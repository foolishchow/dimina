# Validation — fe-tools-packer-context

Status: **draft（2026-09-22）** — D-PC-0..11 已冻。

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-PC01 | PackerContext 构造可用 | 审阅 factory/`toPackerContext`；非空转 ctx；resolvers stub 注释；无新 exists 字段 | R-PC-1 / A-PC1 | pending |
| P-PC02 | Graph 路 2 | 审阅：`build` 用 `ctx.readContent` + `ctx.fileTypes`；`existsSync` 仅实现层；`NpmResolver(ctx.workPath)`；无 `void ctx`/委托 env store* 主路径；无 build 内 ALS getter 回环 | R-PC-2 / A-PC2 | pending |
| P-PC03 | orch + storeInfo 装配 | grep：公开 build/watch 经 orchestrate；ctx 仅 storeInfo→graph | R-PC-3 / A-PC3 | pending |
| P-PC04 | 行为 0 | examples **diff=0**（全量 7 项目：air-battle / base / mpx-demo / subpackages / taro-todo / vant / weui——Experience-Review §12 全量要求，此门改 env.ts + graph.ts 双全局路径）；全量 vitest；`tsc --noEmit` 0 | R-PC-4 / A-PC4 | pending |
| P-PC05 | 兼容 / 边界 | getter 契约；无 Scheme 进 PackerContext；`storeProjectConfig` 等为薄壳且 Graph 为主路径；`env.spec.js` 仍可 import | R-PC-5 / A-PC5 | pending |

## Uncovered

- incremental-unify（deferred）
- load/compile 拆分；真 registry；PackerContext resolvers 真接（D-PC-4）
- PackerContext 存在性 API（明确本门不做，D-PC-7）
- Session 持久 state；EmitEntry[] 返回收敛
- MC3c；sourcemap 对照（按仓库惯例另列）

## Actual

| When | What |
| --- | --- |
| 2026-09-22 | 立项 `draft`：D-PC-0..3 冻。 |
| 2026-09-22 | 讨论收口 → **D-PC-4..6**。 |
| 2026-09-22 | Readiness ×3 **fail**（F1 exists I/O、F2 NpmResolver 等）。修 findings → **D-PC-7..11**；设计挡点已清；升 ready 另授。 |
