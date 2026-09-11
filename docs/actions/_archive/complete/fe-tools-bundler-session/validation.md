# Validation — fe-tools-bundler-session

Status: 实施完成（O1–O3 全部交付，2026-09-10）。

Result 列格式：`命令 → 关键输出摘要（日期 + commit hash）`；不得填 planned 命令或推断成功（L-N1）。

## 消融记录（2026-09-10，实施完成；Experience-Review §6 四要素）

| # | 目标用例 | 消融内容 | 预期失败点 | 实际失败点 | 恢复后验证 |
| --- | --- | --- | --- | --- | --- |
| 1 | `watch-api-bin-contract.spec`「bins route through session」 | 临时用 O1 前旧版 `bin/index.js`（直连 `build` + `createBuildWatcher`） | 测例因 bin 含 `createBuildWatcher` / 不含 `createBundler` 失败 | **1 failed**（正是该测例；`grep` 语义断言捕捉） | 恢复 HEAD 版，`watch-api-bin-contract` + `platforms` 8 测试全过 |
| 2 | `bundler-session.spec`「watch loop shares the session lifecycle (H2)」 | 临时删除 `session.watch` baseOptions 的 `lifecycle` 行 | 测例 events 应为 `['build:end']` 而为空 | **1 failed**（正是 H2 测例；其余 24 过） | 恢复，25 全过 |
| 3 | `bundler-session.spec` A-BS08 ×2（R7 回滚） | 临时删除 `dev()` catch 块的回滚清理与 `activeLoop` 清空 | 注入 failing adapter 后 session 卡死（复用 build 应因 R4 失败） | **2 failed**（正是两个 A-BS08 测例；其余 23 过） | 恢复，25 全过 |

## Validation 结果

| ID | Check | Command / method | Result |
| --- | --- | --- | --- |
| P-001 | 单元/契约 | `vitest run --no-file-parallelism`（session / bin 相关） | **pass** — 479 tests / 71 suites 全绿（2026-09-10，30a52cd9） |
| P-002 | CLI build | `node src/bin/index.js build -c examples/miniprogram/base -s <mktemp> --no-app-id-dir`；`-w` SIGINT 冒烟 | **pass** — one-shot exit 0 + 分包产物；`-w` 初始产物 2s + SIGINT 终止（与今日一致；30a52cd9） |
| P-003 | CLI dev | `node src/bin/index.js dev -c examples/miniprogram/base -p <port>` → 从 stdout `preview at` 解析 appId，HTTP GET 200 | **pass** — preview URL 正确（127.0.0.1:41879）、HTTP 200（宿主页 3457B）、SIGINT 干净退出（30a52cd9） |
| P-004 | diff 范围 | 对照 technical-design §4.5 目标文件清单 + `pnpm build`（postbuild check-package-exports 验 ./session entry） | **pass** — 新增 6（session×3 + sdk-root + 测试×2）修改 6（bin×2 / check-package-exports / package.json / **既有测试×2 实现面断言更新**：platforms + watch-api-bin-contract，行为等价）；`src/index.js` 零改动；**check-package-exports 验证 6 entries**（30a52cd9） |
| P-005 | 阶段清单 | 对照 stages.draft.md 与 src/index.js 阶段标题；允许 L-H1/L-H2 已记录近似偏差 | **pass** — 9 阶段标题逐一命中；`publishToDist` 参数名 / 标题后缀偏差已豁免 |
| P-006 | C1 边界 | 审查 `resolveBundlerConfig`：无 MODE_PRESETS/DEFAULT_ES_TARGET/合法性 throw（D-R2/C 除外）；`compile-config.spec.js` 通过 | **pass** — resolve 仅层合并 + 委托 `resolveCompileConfig`（dd6668a4；D-R2 seed 经 `input.mode/platform`） |
| P-007 | 启动失败回滚 | 注入 failing previewAdapter / 占用端口，验证 `.dev()` 失败后 session 可复用（R7 / A-BS08） | **pass** — A-BS08 ×2 测例（createServer/listen 注入失败 → 复用 build 成功）；消融 3 佐证（30a52cd9） |