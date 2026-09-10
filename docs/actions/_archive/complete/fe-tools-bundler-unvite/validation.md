# Validation — fe-tools-bundler-unvite

计划命令与证据形态；实际结果在执行阶段填写。

## 计划命令

| ID | 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- | --- |
| P-001 | 构建 | `cd fe && pnpm --filter @dimina/web-container-sdk build && pnpm --filter @dimina/bundler build` | 退出码 + 日志 |
| P-002 | 导出 / CLI | `pnpm --filter @dimina/bundler exec dimina-cli --version`（或 `node …/dist/bin/index.js --version`） | 版本号 |
| P-003 | 单元测试 | `pnpm --filter @dimina/bundler test` | 退出码 + 摘要 |
| P-004 | 无 Vite 自打包 | 在 `fe/tools/bundler` 下检查 `package.json` / `scripts` / `__tests__`：无 `vite build`、无 `from 'vite'`、无对 `vite.config` 的自打包引用（`vitest` 导入允许） | rg/审查结果 |
| P-005 | 冷启动冒烟（dev） | `cd fe && pnpm exec dimina-cli dev -c ../examples/miniprogram/base --no-app-id-dir --host 127.0.0.1`（失败则 `node tools/bundler/dist/bin/index.js …`） | 监听 + HTTP 200 |
| P-006 | diff 范围 | `git diff --stat`：允许 scripts/package/README/薄 `watch.js` 入口与 `build-output` 测例；无 core 算法大改 | diffstat |
| P-007 | watch 导出 | `node -e "import('@dimina/bundler/watch')"`（在 fe 下、build 后） | 无抛错 |
| P-008 | CLI build 冒烟 | `node tools/bundler/dist/bin/index.js build -c ../examples/miniprogram/base --no-app-id-dir -s <tmpdir>` | 退出码 0 + 产物目录 |

## 执行环境记录

| 项 | 值 |
| --- | --- |
| 日期 | 2026-09-10 |
| 基线 commit（实施前 tip） | `48c3cf6f` |
| Node | v22.22.0 |
| pnpm | 12.2.0（经 `node …/pnpm.mjs`；本机 corepack `pnpm` shim 缺 `pnpm.cjs`） |
| 偏差 | CLI 冒烟用 `node tools/bundler/dist/bin/index.js …`（与 `dimina-cli` 等价） |

## 实际执行记录

| ID | 结果 | 证据摘要 |
| --- | --- | --- |
| P-001 | **pass** | sync-dist → copy-sdk → check-package-exports；`Validated 5 ESM exports and the dimina-cli CLI.` |
| P-002 | **pass** | `1.2.1` |
| P-003 | **pass** | `Test Files 69 passed (69)` / `Tests 451 passed (451)`；~19s |
| P-004 | **pass** | 无 `vite build` / `from 'vite'` / `vite.config` 自打包引用；`vite.config.mjs` 已删 |
| P-005 | **pass** | `dimina-cli` **dev**：`[dmcc-dev] preview at http://127.0.0.1:8080?appId=…`；`curl` → **HTTP 200** |
| P-006 | **pass** | 仅 README / package.json / sync 脚本 / watch.js / build-output / copy-sdk 注释 / 删 vite.config；无 `src/core` 算法改动 |
| P-007 | **pass** | `watch ok [ 'createBuildWatcher', 'default' ]` |
| P-008 | **pass** | `dimina-cli` **build**：`-c examples/miniprogram/base --no-app-id-dir -s /tmp/dimina-unvite-build-smoke`；退出码 0；写出 `main/` + 分包产物（含 `main/app-config.json`、`main/logic.js` 等） |
