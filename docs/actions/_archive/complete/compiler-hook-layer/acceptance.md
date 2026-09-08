# Acceptance — compiler-hook-layer

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-008 | `cd fe && pnpm --filter compiler test` 全绿（55 既有 + 新增） | 命令日志 | passed |
| A-002 | R-003 | `build()` 签名、返回值、结构化错误与改造前一致；`build-error-contract.spec.js`、`build-output.spec.js`、`build-stages.spec.js` 未修改即通过 | 命令日志 + git diff（规格文件零改动） | passed |
| A-003 | R-004 | 基线 commit 与工作区产物 diff 为空（默认与 `--sourcemap` 两模式，覆盖 `examples/miniprogram` 全部示例） | diff 输出/脚本日志 | passed |
| A-004 | R-001 | 观察者集成规格：单监听器在四个场景（全量 / stages 过滤 / 小游戏 / 失败）收到符合时序保证的事件序列 | 新增 spec 运行日志 | passed |
| A-005 | R-002 | 集成规格断言三阶段并发（总耗时显著小于串行和/或阶段完成顺序不强制）；产物与单测不受影响 | 新增 spec 运行日志 | passed |
| A-006 | R-005 | 注入抛错监听器（含 async reject）：构建成功、产物一致、`isolatedListenerErrors` 计入 `build:end` 载荷、诊断日志带统一前缀 | 新增 spec + 消融记录（移除隔离逻辑后该 spec 必须失败） | passed |
| A-007 | R-006 | 监听器修改冻结载荷后，构建产物与不修改时逐字节一致 | 新增 spec | passed |
| A-008 | R-007 | `package.json` `exports` 与 dist 无生命周期公开导出 | `check-package-exports` 脚本输出 + package.json diff | passed |
| A-009 | R-001 | watch 路径每次重建均完整触发事件序列（`dmcc build -w` 冒烟） | watch 冒烟日志 | passed |
