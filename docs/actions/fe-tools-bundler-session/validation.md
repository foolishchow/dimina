# Validation — fe-tools-bundler-session

Status: `draft` — fill when implementing.

Result 列格式：`命令 → 关键输出摘要（日期 + commit hash）`；不得填 planned 命令或推断成功（L-N1）。实施完成后另设消融段记录三处消融（见 README Closure ②，含 Experience-Review §6 四要素）。

| ID | Check | Command / method | Result |
| --- | --- | --- | --- |
| P-001 | 单元/契约 | `pnpm --filter @dimina/bundler test`（session / bin 相关） | pending |
| P-002 | CLI build | `node fe/tools/bundler/src/bin/index.js build -c examples/miniprogram/base -s $(mktemp -d) --no-app-id-dir` → exit 0 且产物目录非空；`-w` 冒烟：启动后 SIGINT 进程随之终止（与今日一致——bin 无 signal handler，Ctrl+C 为默认终止；graceful shutdown 非本门交付）（unvite 镜像保证 src≡dist） | pending |
| P-003 | CLI dev | `node fe/tools/bundler/src/bin/index.js dev -c examples/miniprogram/base -p <空闲端口>` → 从 stdout `[dmcc-dev] preview at ...` 行解析 appId，HTTP GET `http://127.0.0.1:<port>/?appId=<appId>` 返回 200（宿主页）；SIGINT 进程随之终止（与今日一致；graceful shutdown 非本门交付；编程关闭走 `devHandle.close()`） | pending |
| P-004 | diff 范围 | 对照 technical-design §4.5 目标文件清单：允许新增 6 文件 + 修改 bin×2 / check-package-exports / package.json exports+"./session"；无 `core/*-compiler` / `env.storeInfo` 大改；`src/index.js` 零改动（M-K1/B）。O1 验收含 `pnpm --filter @dimina/bundler build`（postbuild 自动跑 check-package-exports，验证第 5 entry 可 import——test 链不覆盖 exports map，L-L2） | pending |
| P-005 | 阶段清单 | 对照 [stages.draft.md](./stages.draft.md) 与 `src/index.js` 阶段标题；允许 L-H1/L-H2 已记录的近似描述偏差（`publishToDist` 参数名 `dist`、标题工程名后缀） | pending |
| P-006 | C1 边界 | 审查 `resolveBundlerConfig` 实现：无 minify/esTarget 默认填充、无 mode/platform 合法性校验；`compile-config.spec.js` 通过 | pending |
| P-007 | 启动失败回滚 | 注入 failing previewAdapter / 占用端口，验证 `.dev()` 失败后 session 可复用（R7 / A-BS08；activeLoop/资源层面，监听残留为已接受限制） | pending |
