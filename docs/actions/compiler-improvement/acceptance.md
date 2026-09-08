# Acceptance — compiler-improvement (umbrella)

登记 umbrella 级（跨门/最终）验收项；各门的细粒度验收由子 Action 的 acceptance 文件承接，此处不重复。

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | 在 `fe/` 工作区之外、全新 clone 的示例 app 上，`dmcc dev <workPath>` 一条命令打开可交互页面 | 命令日志 + 页面截图/录屏 | pending |
| A-002 | R-002 | 修改页面 `.js` 保存后，当前页自动 relaunch 且新逻辑生效，无需手工刷新 | dev 会话日志 + ws 消息记录 | pending |
| A-003 | R-003 | 修改 `.wxss` 保存后样式变化生效，且 service/页面实例未被销毁重建（观察实例标识或日志） | dev 会话日志 + ws 消息记录 | pending |
| A-004 | R-004 | 修改 `.wxml` 保存后页面重挂且 service 数据保留；或记录降级决策与证据 | dev 会话日志；降级时为 RFC §7 更新 diff | pending |
| A-005 | R-005 | 注入编译失败用例后，运行中实例不中断、旧产物继续服务、终端出现明确错误提示 | 消融实验记录（RFC 经验第 6 条） | pending |
| A-006 | R-006 | 示例插件（自定义 transform 或 dev 事件订阅）全程不修改 compiler 核心实现即可工作 | 插件源码仓库位置 + 运行证据 | pending |
| A-007 | R-007 | 各门闭合时产物 diff 校验（除 `.map` 外零差异）+ `cd fe && pnpm test` 全绿 | CI/命令日志 | pending |
| A-008 | R-008 | roadmap 中 A 轨道各门均有已闭合子 Action，其 validation 有实际执行证据 | STATUS.md + 各子 Action validation | pending |
| A-009 | R-009 | B 轨道与 C1 各有终局决策记录（子 Action 体系或 `deferred` 条目） | STATUS.md / TODO.md / 归档记录 | pending |
