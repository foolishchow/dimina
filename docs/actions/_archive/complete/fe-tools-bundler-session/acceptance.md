# Acceptance — fe-tools-bundler-session

Status: 实施完成（O1–O3 交付，2026-09-10；A-BS01..08 全部 pass）。

Status 列按**终态**记录；门级部分通过记于门交付说明（O1 `dd6668a4` / O2 `45ae450f` / O3 `30a52cd9` 的 commit message），不提前回写本表（L-N2）。证据入口：validation.md（P-001..007 + 消融记录）。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-BS01 | R-BC1 | `createBundler` → `.build` / `.watch` / `.dev` 可调用；会话持有单一 lifecycle 且经 `session.lifecycle` 只读暴露（挂监听可收到事件；emit 不承诺）；`import { createBundler, resolveBundlerConfig } from '@dimina/bundler/session'` 可用（`exports["./session"]`；主入口 `exports["."]` 面零变化）；`build(overrides)` 白名单合并（C1 + pipeline keys，未知键拒绝，`overrides.lifecycle` 不生效） | 规格 + 测例（`bundler-session.spec.js`：facade / lifecycle 注入共享 / overrides 白名单与忽略 / D-R2 hard-fail；P-004 exports 验证） | **pass** |
| A-BS02 | R-BC2 | `dimina-cli build` / `build -w` / `dev` 经 session，无平行手拼编排 | bin 接线审查：`grep -rn 'createBuildWatcher\|createDevServer\|createLifecycle' src/bin/` 零命中（bin 只 import session）；消融 1 佐证 | **pass** |
| A-BS03 | R-BC3 | 既有 lifecycle / watch / build-error 测例 + CLI 错误契约（`build-error-contract` / `style-error-contract` 经 bin）通过；CLI **编排契约**（经 session、D1a 时序）为本门**新增**测例 | vitest（既有+新增）+ 冒烟；479 tests / 71 suites 全绿；P-002/P-003 冒烟 | **pass** |
| A-BS04 | R-BC4 | default `build` 与 `./watch` 导出仍可用；`exports["."]` 面零变化（M-K1/B） | `@dimina/bundler` + `@dimina/bundler/watch` 经 check-package-exports（6 entries）验证；既有 build-error-contract / build-stages 覆盖 default import 错误+成功路径 | **pass** |
| A-BS05 | R-BC5 | bundler test + CLI build/dev 冒烟 | validation 记录 P-001..007 全 pass | **pass** |
| A-BS06 | R-BC6 | stages.draft.md 每个 stage id 有对应今日函数/模块引用且相对链接有效；全文无 `use` / `apply` / `replaceStage` 等 plugin API 承诺 | 文档审查 + P-005（9 阶段标题逐一命中；L-H1/L-H2 偏差豁免）；stages 清单无 plugin 承诺 | **pass** |
| A-BS07 | R-BC7 | `resolveBundlerConfig` 仅做层合并与优先级选取，C1 语义归一由 `resolveCompileConfig` 完成；无第二套 C1 语义模型 | 源码审查（resolve 无 MODE_PRESETS/DEFAULT_ES_TARGET/合法性 throw）+ compile-config 测例 + P-006 | **pass** |
| A-BS08 | R-BC1 | `.dev()` 启动中途失败（watcher.start / createServer / listen 抛错）后：`activeLoop` 已清、已启动资源已释放、原错误 rethrow、session 可再次 build/watch（R7；activeLoop/资源层面）。已知限制：dev 注册的 lifecycle 监听不卸载（无害但累积，见 R-BC1） | 测例（`bundler-session.spec.js` A-BS08 ×2：createServer / listen 注入失败 → 复用 build 成功）+ P-007 + 消融 3佐证 | **pass** |