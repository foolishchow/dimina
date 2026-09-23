# Implementation Plan — fe-tools-packer-context

Status: **draft（2026-09-22）** — 未授 `in_progress` 不改 `src`。

## 纪律

- D-PC-0..11；行为 0；不碰 IU / MC3c / load-compile 拆 / 真 registry / Session 持久 / EmitEntry[] 收敛 / resolvers 真接 / 扩 PackerContext exists。

## 步骤

| Step | 动作 | 状态 |
| --- | --- | --- |
| 0 | 立项 `draft`；冻 D-PC-0..3 | **done**（2026-09-22） |
| 1 | 收口 Q-PC → D-PC-4..6；补齐 TD | **done**（2026-09-22） |
| 1b | Readiness findings → D-PC-7..11；补齐 TD/R/A/P | **done**（2026-09-22） |
| 2 | 升 `ready`（另授） | pending |
| 3a | 增强/`packer/context.ts`：`toPackerContext`（stub 注释；D-PC-5） | pending（须 `in_progress`） |
| 3b | 迁 config fixpoint → Graph/私有模块：`readContent` + `existsSync` + 局部 state（D-PC-7/9） | pending |
| 3c | 私有 getModuleId + `NpmResolver(ctx.workPath)`；`ctx.fileTypes` 建图（D-PC-8/10） | pending |
| 3d | `graph.build`/`reconcile` 接真路径；删 `void ctx` | pending |
| 4 | env：`store*Config` 薄壳（D-PC-11）；破 `graph→env store*` 环；`storeInfo` 仍装配 ctx | pending |
| 5 | P-PC* / A-PC*；回流 architecture-notes + `packer/README.md`；close 另授 | pending |

## 依赖

```text
packer-core-shape (PackerContext interface)
        │
graph-bootstrap (PackerGraph 路 1)
        │
packer-orchestrator (orch 入口)
        │
本 Action draft → ready → in_progress → complete
        │
        ▼
resolvers 真接 / load-compile 拆 / 真 registry（另门）
```
