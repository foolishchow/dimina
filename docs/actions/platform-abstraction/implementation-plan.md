# Implementation Plan — platform-abstraction

| ID | 任务 | 依赖 | 验证点 |
| --- | --- | --- | --- |
| P-001 | `src/common/platforms.js`：platform 枚举、resolvePlatform、InvalidPlatformError、sourcemap/esTarget 策略对象；runBuild 前置校验 | — | platform spec + 前置失败 |
| P-002 | CLI `--platform`（build）；dev 固定 web；watch 继承 | P-001 | CLI integration spec |
| P-003 | sourcemap 策略接线：logic-compiler 按 platform 取 sourcemapTargetPath 语义 | P-001 | sourcemap spec + .map 对比 |
| P-004 | ES target 接线点：硬编码 es2023/es2020 改为从 platform strategy 读取（行为不变） | P-001 | compiler stage specs |
| P-005 | renderer×platform 约束校验（预留，当前仅 webview） | P-001/P-002 | constraint spec |
| P-006 | 缺省产物矩阵：改前 vs 改后（无 platform 参数），nomap/sourcemap，全示例 diff=0 | P-001..P-004 | 同路径 controlled diff=0 |
| P-007 | `--platform web` 产物矩阵：与 native 对比（不变层 diff=0；可变层差异允许） | P-003 | 分层 diff |
| P-008 | 相邻回归 + 消融 + 范围护栏 | P-006/P-007 | 全量 + ablation + source diff |

执行约束：

- 每步保持全量 spec 绿；
- 缺省产物逐字节一致是 MUST——任何阶段缺省 diff≠0 立即停止修复；
- ES target 首版不分叉（统一 es2023），仅接线点 + 决策记录；
- 消融补丁与临时产物不入库。

## 执行记录

| 任务 | 状态 | 日期 | 备注 |
| --- | --- | --- | --- |
| P-001…P-008 | 未开始 | — | — |
