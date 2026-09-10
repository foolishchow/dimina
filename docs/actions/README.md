# Actions

本目录存放可实施、可评审、可验收、可归档的有界工作单元（Action）。一个 Action 记录一次交付切片及其证据；它不重新定义仓库当前的产品、架构、规范或政策权威。

## 权威与位置

- [Action Status](STATUS.md) 是所有正式 Action 状态与位置的唯一权威。
- [Action Candidates](TODO.md) 存放尚未正式化的候选工作。
- 仓库的产品、架构、规范与政策文档（如 `docs/` 下各专题文档）始终是持久行为的权威来源。
- 归档的 Action 保留历史与证据，不覆盖当前仓库权威。

```text
docs/actions/<action-id>/
docs/actions/_archive/complete/<action-id>/
docs/actions/_archive/superseded/<action-id>/
docs/actions/_archive/deferred/<action-id>/
```

活动 Action 直接位于 `docs/actions/` 下；`blocked` 的 Action 保持活动状态，不归档。终局位置见 [Archive Rules](_archive/README.md)。

## 生命周期

```text
candidate → draft → ready → in_progress → complete
                    ↘ blocked ↗

draft / ready / in_progress / blocked
    → superseded | deferred
```

- `draft`：范围或闭合契约尚未完整，未授权实施。
- `ready`：需求、设计、计划、验收与验证定义充分，可执行。
- `in_progress`：已明确授权的实施或验证正在进行。
- `blocked`：记录具体阻碍、影响、解除条件与恢复状态。
- `complete`：验收通过、证据已记录、持久发现已回流。
- `superseded` / `deferred`：需要明确的终局决策。

## Action 内容

按复杂度选择文件，不机械套用全套。保持 Requirements、Design、Plan、Acceptance、Validation 与 Review 为相互独立的关注点（小型 Action 可合并到更少文件）。每个正式 Action 需要一个本地入口，声明身份、状态指针、目标、非目标、设计输入、交付物、就绪缺口与闭合条件。

维护以下追溯链：

```text
问题 → 需求 → 技术设计 → 实施任务 → 验收标准 → 验证证据 → 闭合决策
```

不得仅因实现存在而标记 Action 完成；只有可观察的验收与已记录的验证证明预期结果后方可闭合。
