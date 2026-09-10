# Acceptance — fe-tools-bootstrap-copy

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-B01 | R-B1 | 当前分支名为 `feature/fe-tools-bootstrap`；自 `origin/main` 创建；创建时 `origin/main` 与 `upstream/main` 同 tip（记入 validation） | 分支名 + P-001 | passed |
| A-B02 | R-B2 | 存在 tag `fe-tools-copy-source`；两包 `VENDOR.md` 引用一致 | P-002 | passed |
| A-B03 | R-B3 | 目录与 package name / `dimina-cli` / bundler description 符合 D-BC-4；兄弟路径/`filter` 字符串已改写 | 文件抽检 | passed |
| A-B04 | R-B4 | STATUS 含本 Action；本目录文档在树内 | STATUS + 路径 | passed |
| A-B05 | R-B5 | `pnpm-workspace.yaml` 含 `tools/*`；两包 build 成功 | P-003 | passed |
| A-B06 | R-B6 | `git diff origin/main...HEAD -- fe/packages` 为空（或白名单附件） | P-004 | passed |
| A-B07 | R-B7 | `examples/miniprogram/base` 冷启动：监听 + 宿主页 200 | P-006 | passed |
| A-B08 | R-B8 | packages 下 package.json 无对 `@dimina/bundler` / `@dimina/web-container-sdk` 的依赖 | P-005 | passed |

## Notes

- 本门以搬迁接线为主，一般不要求消融；冒烟未依赖单独「修复机制」，跳过 Experience-Review §6。
- 闭合不依赖 `fe-tools-sidecar` 状态。
- A-B03 抽检：`@dimina/bundler` + `dimina-cli` + 领域 toolchain description；`copy-sdk-assets.js` → `../web-container-sdk`；`@dimina/web-container-sdk`。
