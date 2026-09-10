# Acceptance — fe-tools-bundler-unvite

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-UV01 | R-UV1 | `package.json` `scripts.build` 无 `vite`；无活跃自打包用 `vite.config.mjs`（已删或注明废弃且不被 build 引用） | 文件抽检 | pending |
| A-UV02 | R-UV2 | build 实现为镜像/拷贝/再导出，无 esbuild\|rollup\|vite\|swc **bundle** 调用 | 脚本审查 | pending |
| A-UV03 | R-UV3 | `exports` / `bin` 指向文件存在；`check-package-exports`（或等价）通过；`dimina-cli --version` 成功 | 命令日志 | pending |
| A-UV04 | R-UV4 | 至少一次完整 `build` 或既有 worker 相关测试覆盖三阶段加载 | 测试/冒烟日志 | pending |
| A-UV05 | R-UV5 | `dist/sdk`（或成文新路径）含约定运行时资产；dev 宿主可解析 | 目录列表 + 冒烟 | pending |
| A-UV06 | R-UV6 | vitest 全绿（或豁免表）；冷启动冒烟 HTTP 200 或成文等价 | validation | pending |
| A-UV07 | R-UV3 / D-UV-3 | `src/watch.js` 存在且再导出 `common/watch-runner`；`build` 后 `dist/watch.js` 可被 `exports["./watch"]` 解析（P-007） | 文件 + P-007 | pending |
| A-UV08 | R-UV8 / D-UV-6 | `__tests__/build-output.spec.js` 不再调用 `vite.build` / 不再依赖 `vite.config.mjs`；默认断言 `dist/core/view-compiler.js` 无 Babel `require`（或成文删除） | 测试文件 + P-003 | pending |
| A-UV09 | R-UV5 / D-UV-2 | `build` 脚本顺序为 sync → copy-sdk → check-exports（或等价且保证 `dist/sdk` 不被 sync 最终清空） | package.json / 脚本 | pending |