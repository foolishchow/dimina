# Requirements — fe-tools-session-unify

Status: **冻结（2026-09-13）** — 与 design v1 / acceptance 对齐；D-SU 已拍板；改契约须同步三文

## R-SU1（MUST）执行内核（S1）

存在 session 私有执行内核（落点 `fe/tools/bundler/src/session/runner.js`，design D-SU-2；冻结等价路径可），承载三入口共用逻辑：

- **options 组装**：`splitBuildOverrides` 白名单合并 + `state.compile`/`state.fileTypes` 缺省 + `store`/`lifecycle` 注入（forced-last：`overrides.lifecycle` 永不生效）——三入口共用（`.build` 直用；`.watch`/`.dev` 以组装产物传入 `createBuildWatcher`）；
- **one-shot 编译调用**：仅 `.build()` 经内核发起；watch/dev 的编译调用发生在 watch-runner 内部（不改，R-SU6），其「共用执行路径」指同一 `build()` 门面（RR4 同构），由 R-SU5 行为同构断言验证。

三入口共用内核组装的 options 执行编译（可观测，见 R-SU5）。

## R-SU2（MUST）调度收口（S2）

activeLoop 占用（含断言）、释放、错误传播路径、lifecycle 挂载点**单一化进内核**：

- R1–R4 / R7 / W4 语义不变（既有测试**不改断言**全绿）；
- 无重复生命周期挂载（dev 的 published/error 监听挂载点唯一）；
- 壳内不再各自置位 / `finally` 清环。

## R-SU3（MUST）公开 API 零变化

`.build(overrides)` / `.watch(watchOpts)` / `.dev(devOpts)` 签名、白名单校验（unknown keys throw 及消息文本）、返回值形状与 O1–O3 契约一致；`exports["./session"]` 与主入口 `exports["."]` 面零变化；**不新增公开 exports**（对齐 P3 先例）；内核不进公开面。

## R-SU4（MUST）行为 0

相对约定基线（升 in_progress 时记 SHA）：

- tools/bundler 全量 vitest 绿；
- `examples/miniprogram/base` nomap + sourcemap 产物**字节等价**（diff=0 MUST）；
- 错误消息可观察文本不变——**含 dev 运行期间 `activeLoop === 'watch'` 标签**（今日实锚，D-SU-4 保持）。

## R-SU5（MUST）同构判据（三层操作化）

1. **行为同构**：注入 spy / 内录 lifecycle，同一 fixture 下 `.build()`、`watch.start()` 首编、`.dev()` 首编的**规范化事件序列相等**（入口特有事件白名单以基线捕获为准：dev preview 已知；watch 若有，实施时登记）；
2. **结构判据（静态）**：`session/index.js` 三壳内不得各自内联 options 组装与 activeLoop 释放逻辑（review 核对 + 测试锚定）；
3. **产物等价**：nomap + sourcemap diff=0。

## R-SU6（MUST）范围切割

- 不重定 L1–L4 / W1–W4 / R1–R7 / M-A 决策；
- 不做 PS3（applyChanges/subscribe）、TS-2、compiler target 方向；
- 不改 BuildPipeline / watch-runner / `build()` 门面内部（除接线必需）；
- `.dev` 仍必须经 `session.watch` 组装（D1a，不绕过）；
- preview adapter 协议与 dev server 行为不变。

## Non-requirements

- compiler target 方向（mode/platform/renderer/publish 形态切面）
- watch-runner / build-pipeline 内部重构
- preview adapter 协议或 dev server 行为变化
- 公开 `session.store` / 公开内核
- lifecycle `off()`（A1 v1 已知限制，维持）
- activeLoop 标签 `'watch'`→`'dev'`（D-SU-4：行为 0 约束下保持；如改另立微 Action）
