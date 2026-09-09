# Acceptance — platform-abstraction

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | 缺省 platform=native；显式 native 等价；未知 platform 前置失败 `DIMINA_INVALID_PLATFORM` | platform spec + CLI error | pending |
| A-002 | R-002 | `dmcc build --platform native/web` 可用；dev 固定 web | CLI integration | pending |
| A-003 | R-003 | 跨 platform 不变层产物 diff=0 | 分层 diff 矩阵 | pending |
| A-004 | R-004 | 缺省产物（无参数）与改前逐字节一致 | 同路径 controlled diff=0 | pending |
| A-005 | R-005 | sourcemap 策略按 platform 区分；native 策略与现状一致 | sourcemap spec + .map 对比 | pending |
| A-006 | R-006 | ES target 从 platform strategy 读取（行为不变）；首版不分叉决策记录 | source audit + decision record | pending |
| A-007 | R-007 | lynx×web 等无效组合给出明确错误（预留） | constraint spec | pending |
| A-008 | R-008 | compiler/render/sdk 全量、CLI/watch/dev/compile 入口全绿 | command logs | pending |
| A-009 | R-009 | platform 在内部诊断/日志可观察（不破坏 observer） | observer compat | pending |
| A-010 | 消融 | 移除 platform 前置校验后未知 platform 目标 spec 失败 | ablation log | pending |
