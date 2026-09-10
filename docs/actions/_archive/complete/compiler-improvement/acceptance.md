# Acceptance — compiler-improvement (umbrella)

登记 umbrella 级（跨门/最终）验收项；各门的细粒度验收由子 Action 的 acceptance 文件承接，此处不重复。

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | 在 `fe/` 工作区之外、全新 clone 的示例 app 上，`dmcc dev <workPath>` 一条命令打开可交互页面 | A2 P-007（tarball 裸项目）+ A3 P-007（生产 dist 起 dev） | passed |
| A-002 | R-002 | 修改页面 `.js` 保存后，当前页自动 relaunch 且新逻辑生效，无需手工刷新 | A2 P-005（ws L1 relaunch）+ A3 P-007（WS smoke L1） | passed |
| A-003 | R-003 | 修改 `.wxss` 保存后样式变化生效，且 service/页面实例未被销毁重建 | A3 P-002（L2 CSS 事务）+ P-007（WS L2 smoke） | passed |
| A-004 | R-004 | 修改 `.wxml` 保存后页面重挂且 service 数据保留；或记录降级决策与证据 | A3 P-003..P-007（L3 module/adapter+remount+snapshot+烟测）；RFC §4.2 实施结论已回流 | passed |
| A-005 | R-005 | 注入编译失败用例后，运行中实例不中断、旧产物继续服务、终端出现明确错误提示 | A2 P-005/A3 P-007（build:error 无 reload、进程存活）+ A1 P-003 消融（A-006 口径） | passed |
| A-006 | R-006 | 示例插件或事件订阅全程不修改 compiler 核心实现即可工作 | A1 `options.lifecycle`（dmcc-dev-server P-005 全程未改 compiler 核心）；公开插件 API 另列 D5 | passed |
| A-007 | R-007 | 各门闭合时产物 diff 校验（除 `.map` 外零差异）+ 全量 spec 全绿 | A1 P-005（diff=0）；A4 P-005（diff=0）；compiler 64 文件/421 用例 | passed |
| A-008 | R-008 | roadmap 中 A 轨道各门均有已闭合子 Action，其 validation 有实际执行证据 | STATUS.md 5 个 complete Action 均归档，validation 全部有 P-001..P-007 记录 | passed |
| A-009 | R-009 | B 轨道与 C1 各有终局决策记录 | TODO.md B0–B4/C1 deferred 条目（含再激活条件）；roadmap 行已更新 | passed |
