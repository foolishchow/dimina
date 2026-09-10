# Validation — fe-tools-bundler-unvite

计划命令与证据形态；实际结果在执行阶段填写。

## 计划命令

| ID | 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- | --- |
| P-001 | 构建 | `cd fe && pnpm --filter @dimina/web-container-sdk build && pnpm --filter @dimina/bundler build` | 退出码 + 日志 |
| P-002 | 导出 / CLI | `pnpm --filter @dimina/bundler exec dimina-cli --version`（或 `node …/dist/bin/index.js --version`） | 版本号 |
| P-003 | 单元测试 | `pnpm --filter @dimina/bundler test` | 退出码 + 摘要 |
| P-004 | 无 Vite 自打包 | 在 `fe/tools/bundler` 下检查 `package.json` / `scripts` / `__tests__`：无 `vite build`、无 `from 'vite'`、无对 `vite.config` 的自打包引用（`vitest` 导入允许） | rg/审查结果 |
| P-005 | 冷启动冒烟 | `cd fe && pnpm exec dimina-cli dev -c ../examples/miniprogram/base --no-app-id-dir --host 127.0.0.1`（失败则 `node tools/bundler/dist/bin/index.js …`） | 监听 + HTTP 200 |
| P-006 | diff 范围 | `git diff --stat`：允许 scripts/package/README/薄 `watch.js` 入口与 `build-output` 测例；无 core 算法大改 | diffstat |
| P-007 | watch 导出 | `node -e "import('@dimina/bundler/watch')"`（在 fe 下、build 后） | 无抛错 |

## 执行环境记录要求

日期、commit、Node/pnpm、与计划偏差。

## 实际执行记录

（实施后填写）
