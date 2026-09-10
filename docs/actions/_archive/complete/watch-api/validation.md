# Validation — watch-api

计划命令与证据形态；实际结果在执行阶段填写并支撑闭合判定。

## 计划命令

| 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- |
| watch 规格 | `vitest run __tests__/watch-*.spec.js __tests__/watch-api-bin-contract.spec.js` | 退出码 + 用例数 |
| 全量编译器回归 | `cd fe && pnpm --filter compiler test` | 退出码 + 文件/用例数 |
| 公开导出 | `vite build` + `node scripts/check-package-exports.js`（sdk 缺失时跳过完整 `pnpm build` postbuild） | `dist/watch.js` + Validated N ESM exports |
| 源码契约 A-005/A-008/D1a | bin 无 chokidar；`watch-plan.js` 存在；`bin/watch.js` 删除；dev `autoListen:false` 顺序 | 审查 / bin-contract |
| 消融 A-005 | 临时去掉 `createBuildWatcher`、加回 `chokidar` → bin-contract 必须失败 → 恢复 → 再通过 | 消融前后两次运行记录 |
| build -w 冒烟 | `node src/bin/index.js build -c examples/miniprogram/base -s <tmpdir> --no-app-id-dir -w` 后 touch 源文件 | 日志含「改动，重新编译」 |

## 执行环境记录要求

每次实际验证附：日期、commit、Node/pnpm 版本、与计划偏差。

## 实际执行记录

### P-001（2026-09-10）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-10 |
| Source commit（实现基线） | `60ed6114`（`feat(compiler): implement watch-api (CF-4) createBuildWatcher`） |
| Environment | Node v22.22.0 · pnpm 12.2.0（corepack `pnpm.mjs`）· macOS darwin 24.6.0 |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| watch 相关规格 | `vitest run __tests__/watch-api-bin-contract.spec.js __tests__/watch-runner.spec.js __tests__/watch-scheduler.spec.js` | 3 文件 / 10 用例通过 | 终端日志 | passed |
| 全量回归 | `pnpm --filter compiler test` | 66 文件 / 426 用例全绿（含 bin-contract） | 终端日志 | passed |
| 公开导出 | `npx vite build` + `node scripts/check-package-exports.js` | `dist/watch.js` 产出；Validated 5 ESM exports and the dmcc CLI | 终端日志 | passed |
| A-008 路径 | `src/common/watch-plan.js` 存在；`src/bin/watch.js` 不存在 | OK | 文件系统检查 | passed |
| D1a 源码序 | `dev.js`：`autoListen: false` → `watcher.start()` → `devServer.listen` → `watcher.listen()` | 行序确认 | `rg` 审查 | passed |

覆盖说明：

- A-001 / A-002 / A-005 / A-006 / A-007 / A-008 / A-009：由全量套件（含 `dev-server` / `dev-reload`）与导出检查覆盖。
- 与计划偏差：完整 `pnpm --filter compiler build` 的 postbuild 因本机缺 `container-sdk/dist` 失败；以 `vite build` + 单独 `check-package-exports` 替代 A-006 证据（产物 `dist/watch.js` 与 CLI `--version` 已验证）。
- 未覆盖：消融（P-002）、build -w 冒烟（P-003）。

### P-002（2026-09-10）— 消融 A-005

| Field | Actual value |
| --- | --- |
| Date | 2026-09-10 |
| Source commit | `60ed6114` + 工作区 `watch-api-bin-contract.spec.js`（未入库消融补丁） |
| Environment | 同 P-001 |

| 步骤 | 操作 | 结果 | Result |
| --- | --- | --- | --- |
| 基线 | `vitest run __tests__/watch-api-bin-contract.spec.js` | 1/1 passed | passed |
| 消融 | 仅改 `src/bin/index.js`：去掉 `createBuildWatcher` import，改为 `import chokidar from 'chokidar'`，标识符替换为 `createWatchLoop`；**不改**测试与夹具 | bin-contract **失败**：`expected ... to match /createBuildWatcher/`（index.js）；断言点对齐「去重缺失」 | passed（预期失败） |
| 恢复 | 从备份还原 `index.js` | `diff` 与备份一致 | passed |
| 恢复后 | 再跑 bin-contract | 1/1 passed | passed |

消融补丁未进入提交。证明：A-005 契约规格能识别 bin 编排去重是否缺失。

### P-003（2026-09-10）— build -w 冒烟 + A-004 证据

| Field | Actual value |
| --- | --- |
| Date | 2026-09-10 |
| Source commit | `60ed6114` |
| Environment | 同 P-001 |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| build -w 冒烟 | `node src/bin/index.js build -c examples/miniprogram/base -s /tmp/cf4-watch-smoke-* --no-app-id-dir -w`；touch `subPackageA/pages/index.js` | 初始构建成功写出 `main/` 等；日志：`.../index.js 改动，重新编译` | `/tmp/cf4-watch-smoke.log` | passed |
| A-004 D1a | P-001 源码序 + 全量套件中 `dev-server` / `dev-reload` 未回落 | 协议零改动；pendingReload 仍由 `beforeBuild` 在 `build()` 前注入 | P-001 + `bin/dev.js` | passed |

## Closure mapping

| Acceptance | Evidence |
| --- | --- |
| A-001 | P-001 watch-runner + exports |
| A-002 | P-001 watch-scheduler + watch-runner |
| A-003 | P-003 smoke |
| A-004 | P-001 D1a 审查 + P-003 / 全量 A2 specs |
| A-005 | P-001 bin-contract + P-002 消融 |
| A-006 | P-001 vite + check-package-exports |
| A-007 | P-001 全量 66/426 |
| A-008 | P-001 路径检查 |
| A-009 | P-001 全量（含 dev-server / dev-reload） |
