# Implementation Plan — hmr-l2-l3

任务按 Web 容器 dev-only 边界拆分；执行授权后按序进行。

| ID | 任务 | 依赖 | 验证点 |
| --- | --- | --- | --- |
| P-001 | 冻结 feature flag、HMR command envelope、buildId stale 规则和 L1 fallback 事务边界 | — | 设计/能力探测 spec；flag off 无行为变化 |
| P-002 | L2 CSS prototype：style registry、cache-busted link、load/commit/rollback | P-001 | CSS hot swap spec；成功不 remount，失败保留旧 CSS |
| P-003 | L3 module replacement prototype：loader dev-only replace API、组件递归解析、stale buildId、rollback | P-001 | module replace spec；flag off/失败路径绿 |
| P-004 | L3 page remount prototype：目标页面定位、局部 unmount/mount、service/其他页面保留 | P-003 | 页面生命周期/多页面隔离 spec |
| P-005 | L3 snapshot replay：setupData deep snapshot、remount 后回放、交易期间 update queue、有序提交 | P-004 | setData replay spec；首次/返回/快速更新/展开收起循环 |
| P-006 | 接入 A2 Web 宿主执行端：消费现有 L2/L3 ws reload，不改 ws/reloadLevel；失败回退 L1 | P-002…P-005 | host integration spec + dev smoke |
| P-007 | 相邻回归与范围护栏：render/container-sdk 全量、feature flag off、生产构建、原生端 untouched 检查 | P-006 | 全量 spec/lint/build + diff/audit |

执行约束：

- 每步提交保持全量相关 spec 绿；临时调试代码不入库；
- 所有新增代码必须在 Web dev-only feature flag 下；禁止修改 compiler 产物和 A2 ws 协议；
- P-003/P-004/P-005 任一原型失败，记录证据并走 L3→L1 fallback，不扩大范围；
- 生命周期与 snapshot 测试必须包含消融：移除 cleanup/旧模块保护后规格应失败；
- 不以性能指标作为验收目标。

## 执行记录

| 任务 | 状态 | 日期 | 备注 |
| --- | --- | --- | --- |
| P-001 | 完成 | 2026-09-08 | 运行时 flag + HMR 指令通道落地；render 11 用例 + sdk 4 用例绿；证据见 [validation](validation.md) |
| P-002…P-007 | 未开始 | — | — |
