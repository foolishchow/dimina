# Action Status

本文档是所有正式 Action 当前状态与位置的唯一权威。

## 状态模型

| 状态 | 含义 |
| --- | --- |
| `draft` | 范围或闭合定义尚不完整；未授权实施。 |
| `ready` | 需求、设计、计划、验收与验证足以执行。 |
| `in_progress` | 明确授权的实施或验证正在进行。 |
| `blocked` | 具体条件阻碍有效推进；Action 保持活动。 |
| `complete` | 必要验收通过、证据已记录、持久发现已回流。 |
| `superseded` | 另一 Action 或已接受的决策替代了本工作。 |
| `deferred` | 明确的决策推迟了本工作。 |

## 维护规则

- 创建正式 Action 时恰好新增一行，初始为 `draft`。
- Action README 的状态与本表保持一致。
- 状态、摘要、日期、路径、导航与归档位置作为一次一致变更更新。
- `draft` / `ready` / `in_progress` / `blocked` 的 Action 保持在 `docs/actions/<action-id>/`。
- 终局 Action 移入对应的 `_archive/` 位置。
- 变更状态前需要明确授权且满足目标门条件。
- `complete` 前必须通过验收、记录实际验证证据并完成持久发现回流。

## Actions

| Action | Status | Path | Summary | Updated |
| --- | --- | --- | --- | --- |
| `compiler-improvement` | `ready` | [README](compiler-improvement/README.md) | 编译器改造 umbrella（RFC v1.3 已定稿）：交付 A 轨道（A1/A2.0/A2 已闭合），治理 B/C 终局决策。 | 2026-09-08 |
| `compiler-hook-layer` | `complete` | [README](_archive/complete/compiler-hook-layer/README.md) | Umbrella gate A1（事件契约已冻结 v1）：runBuild 生命周期驱动化交付，行为/产物零变化；A-001~A-009 全 passed，已归档。 | 2026-09-08 |
| `dmcc-dev-server` | `complete` | [README](_archive/complete/dmcc-dev-server/README.md) | Umbrella gate A2：`dmcc dev` 交付 dev 链路（静态服务 + 宿主页 + ws + 代理 + L1 relaunch）；A-001~A-012 全 passed，已归档。 | 2026-09-08 |
| `hmr-l2-l3` | `complete` | [README](_archive/complete/hmr-l2-l3/README.md) | Umbrella gate A3：Web 容器 dev-only L2 CSS 热替换 + L3 模板热重挂；A-001~A-013 全 passed，已归档。 | 2026-09-08 |
