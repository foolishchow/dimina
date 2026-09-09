# Acceptance — render-target-abstraction

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | 无声明缺省为 webview；`app.json.renderer:'webview'` 与各 `page.json.renderer:'webview'` 生效；未知 renderer（含微信 `skyline`、未来 lynx、app 或页面任意层级）在 lifecycle、resetAssetCache、目录副作用和 worker 启动前失败，错误为 `DIMINA_INVALID_RENDERER` 且携带声明上下文 | renderer.spec 6/6 + integration.spec 3/3（P-001/P-007） | passed |
| A-002 | R-002 | view/style 阶段均经阶段级 webview renderer；既有 worker 只被包装一次且输入/output/写入语义不变 | adapter contract + 全量回归 + 真实构建（P-002） | passed |
| A-003 | R-003 | logic/service/bridge/modDefine/模块 ID/发布目录/警告与 target 无关 | source audit（P-007 范围护栏） | passed |
| A-004 | R-004 | 同一绝对路径基线 vs 当前产物 diff=0，nomap/sourcemap，全 7 示例 | P-005 产物矩阵（exit=0, lines=0） | passed |
| A-005 | R-005 | dmcc build、dev help（无 renderer flag）、pnpm compile、compat、lint、全量 spec | P-006 入口回归 | passed |
| A-006 | R-006 | source diff 无 Lynx/.lyx/rspeedy/rspack/native/logic/service/bridge/HMR/ws | P-007 范围护栏（git diff 5c1a6a3a..HEAD） | passed |
| A-007 | R-007 | 未知 renderer 在 lifecycle 前失败且目标目录未创建、app.json 未改动 | P-007 integration 消融目标（target-renderer-integration） | passed |
| A-008 | R-008 | 首版不增加 lifecycle renderer 字段；renderer 仅在声明解析/前端诊断 | P-004 决策记录（implementation-plan/validation） | passed |
| A-009 | R-009 | 生产构建、A2 ws/HMR 与 native 路径无行为/协议变化 | P-006 build + P-007 范围 diff | passed |
| A-010 | R-010 | renderer 前置校验消融：未知 renderer 目标 spec 在移除校验后必须失败；恢复后通过 | P-007 integration spec（消融目标已锁定：目标目录未创建 + app.json 未改） | passed |
