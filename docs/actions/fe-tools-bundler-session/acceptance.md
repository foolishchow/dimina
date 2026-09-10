# Acceptance — fe-tools-bundler-session

Status: `draft` — rewrite pending freeze. Old L0-plugin rows removed from MUST path.

Status 列按**终态**记录；门级部分通过（如 O1 验 A-BS03 的 build 部分）记于门交付说明（commit message / 门文档），**不提前回写本表**（L-N2）。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-BS01 | R-BC1 | `createBundler` → `.build` / `.watch` / `.dev` 可调用；会话持有单一 lifecycle 且经 `session.lifecycle` 只读暴露（挂监听可收到事件；emit 不承诺）；`import { createBundler, resolveBundlerConfig } from '@dimina/bundler/session'` 可用（`exports["./session"]`；主入口 `exports["."]` 面零变化）；`build(overrides)` 白名单合并（C1 + pipeline keys，未知键拒绝，`overrides.lifecycle` 不生效） | 规格 + 测例 | pending |
| A-BS02 | R-BC2 | `dimina-cli build` / `build -w` / `dev` 经 session，无平行手拼编排 | bin 接线审查：`grep -rn 'createBuildWatcher\|createDevServer\|createLifecycle' src/bin/` 零命中（bin 只 import session） | pending |
| A-BS03 | R-BC3 | 既有 lifecycle / watch / build-error 测例 + CLI 错误契约（`build-error-contract` / `style-error-contract` 经 bin）通过；CLI **编排契约**（经 session、D1a 时序）为本门**新增**测例 | vitest（既有+新增）+ 冒烟 | pending |
| A-BS04 | R-BC4 | default `build` 与 `./watch` 导出仍可用 | exports + 测例（既有 build-error-contract / build-stages 已覆盖 default import 错误+成功路径；check-package-exports 验 entries，L-N5） | pending |
| A-BS05 | R-BC5 | bundler test + CLI build/dev 冒烟 | validation 记录 | pending |
| A-BS06 | R-BC6 | [stages.draft.md](./stages.draft.md) 每个 stage id 有对应今日函数/模块引用且相对链接有效；全文无 `use` / `apply` / `replaceStage` 等 plugin API 承诺 | 文档审查：链接检查 + grep `use\|apply\|replaceStage`（仅否定语境允许） | pending |
| A-BS07 | R-BC7 | `resolveBundlerConfig` 仅做层合并与优先级选取，C1 语义归一（minify preset / esTarget 默认 / mode·platform 合法性）由 `resolveCompileConfig` 完成；无第二套 C1 语义模型 | 源码审查：实现内 grep 无 `MODE_PRESETS` / `DEFAULT_ES_TARGET` 常量、无 mode/platform 合法性 throw（D-R2/C drift 断言除外）+ 既有 `compile-config` 测例通过 | pending |
| A-BS08 | R-BC1 | `.dev()` 启动中途失败（watcher.start / createServer / listen 抛错）后：`activeLoop` 已清、已启动资源已释放、原错误 rethrow、session 可再次 build/watch（R7；activeLoop/资源层面）。已知限制：dev 注册的 lifecycle 监听不卸载（无害但累积，见 R-BC1） | 测例（注入 failing previewAdapter / 占用端口） | pending |
