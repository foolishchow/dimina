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
| `compiler-improvement` | `draft` | [README](compiler-improvement/README.md) | 编译器改造 umbrella：交付 RFC A 轨道（dev 一体化 / HMR 分级 / 统一挂载面），治理 B/C 轨道终局决策。 | 2026-09-08 |
