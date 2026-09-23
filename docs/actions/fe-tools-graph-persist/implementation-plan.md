# Implementation Plan — fe-tools-graph-persist

Status: **draft（2026-10-07）** — 未授 `in_progress` 不改 `src`。

## 纪律

- D-GP-1..4；行为 0；不改 graph.build/reconcile；不改 watch-runner 传参；不加 any。

## 步骤

| Step | 动作 | 状态 |
| --- | --- | --- |
| 0 | 立项 `draft` | **done**（2026-10-07） |
| 1 | 升 `ready`（另授） | pending |
| 2 | `env.ts`：`storeInfo` 分支条件修正（D-GP-1） | pending |
| 3 | P-GP* / A-GP*；回流 architecture-notes；close 另授 | pending |

## 依赖

```text
fe-tools-orchestrator-state (complete — PackerSessionState)
fe-tools-packer-context (complete — config fixpoint + reconcile)
        │
本 Action draft → ready → in_progress → complete
        │
        ▼
incremental-unify 重激活（graph 持久后，增量基础成立）
```
