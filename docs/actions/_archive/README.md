# Action Archive

本目录将终局 Action 保留为历史记录与验证证据。归档内容不覆盖当前产品、架构、规范、政策或运营权威。

使用以下终局位置：

```text
complete/<action-id>/
superseded/<action-id>/
deferred/<action-id>/
```

- 仅在验收、验证、持久发现回流与仓库检查闭合后归档 `complete`。
- 归档 `superseded` 时链接替代它的 Action 或已接受的决策。
- 归档 `deferred` 时记录原因与可观察的重新激活条件。
- `blocked` 不归档，保留在活动 Action 目录中。
- 不重新打开已归档的 Action；创建引用归档记录的新 Action。

首个 Action 进入时创建对应终局子目录；不为保留空目录添加 `.gitkeep`。
