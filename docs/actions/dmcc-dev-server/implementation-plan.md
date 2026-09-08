# Implementation Plan — dmcc-dev-server

任务可评审、有依赖、带验证点；执行授权后按序进行。

| ID | 任务 | 依赖 | 验证点 |
| --- | --- | --- | --- |
| P-001 | 新增 `src/common/dev-reload.js`：纯函数 `synthesizeReloadLevel({ event, filePath, count, plan })`（plan.options.stages / plan.options.affectedEntries 映射为 affectedPages）；覆盖 §4 矩阵（含非增量兑底默认行） | — | 新增合成 spec 绿（含边界：skip/合并/unknown/json/add-unlink/非增量兑底/view/style/logic 矩阵） |
| P-002 | 新增 `src/common/dev-host.js`：宿主页 HTML 模板 + sdk 资产路由路径常量；消费 `{%targetPath%}` 等占位替换 | — | 宿主页生成单测（占位替换/静态资源引用正确） |
| P-002.5 | compiler 包构建时把 container-sdk 预构建 dist 复制到 `dist/sdk/`（构建脚本或 vite 插件）；发布形态 `files:['dist']` 下 sdk 资产随包 | — | `pnpm --filter compiler build` 后 `dist/sdk/{index,pageFrame}.js` 存在 |
| P-003 | 新增 `src/common/dev-proxy.js`：迁移 `fe/packages/server/security.js` 纯函数 + `/proxy` 端点实现（Node http）；端口/超时/体积/SSRF 校验对齐 | — | 代理契约 spec（合法/非法/SSRF 三组） |
| P-004 | 新增 `src/common/dev-server.js`：静态服务（targetPath + sdk/）+ 快照语义（服务 targetPath、失败不切）+ ws（`ws` 包，订阅/reload/build:error/ack）+ pendingReload 上下文（F-002 定案） | P-001…P-003、P-002.5 | dev server 契约 spec（路由/快照/失败不切换/pendingReload 关联/ws 形状与 ack 时序） |
| P-005 | 新增 `src/bin/dev.js` 并挂载到 `src/bin/index.js`：初始 build（注入 lifecycle 订阅 bundle:published/build:error）→ watch（复用 createWatchBuildPlan/Scheduler）→ 启动 dev-server；`--port`；初始构建失败退出非零 | P-004 | `dmcc dev` 冒烟：起服务/GET 宿主页/改 js → 推 L1/改 app.json → 推 L0/注入失败 → build:error 且服务不退出 |
| P-006 | 入口回归与全量：既有 `pnpm --filter compiler test` 全绿（57/360 + 新增不回落）；`dmcc build` / `build -w` / `pnpm compile` 行为不变；`sync:compat` 干净 | P-005 | 全量 spec 绿 + 入口冒烟记录 |
| P-007 | fe/ 外新 clone 模拟：裸目录（compiler src + 构建后 sdk 资产 + mitt）下起 `dmcc dev`，GET 宿主页与 sdk 资产 200 | P-005 | 模拟目录构建日志（A-010 证据） |

执行约束（对齐 Experience-Review）：

- 每步提交保持全量 spec 绿（小步提交，禁止长寿命半绿分支）；
- P-004 的 ws 库新增依赖需在编译器 package.json 登记并在首步提交说明；
- 诊断日志沿用 `[lifecycle]` 统一前缀约定；临时日志不进入提交；
- P-007 模拟在独立临时目录完成，不污染工作区。

## 执行记录

| 任务 | 状态 | 日期 | 备注 |
| --- | --- | --- | --- |
| P-001 | 完成 | 2026-09-08 | dev-reload.js 纯函数 + 14 用例矩阵绿；证据见 [validation](validation.md) |
| P-002 | 完成 | 2026-09-08 | dev-host.js 宿主页模板 + sdk 路径常量 + 10 用例绿；证据见 [validation](validation.md) |
| P-002.5 | 完成 | 2026-09-08 | copy-sdk-assets 脚本 + postbuild 接入：`pnpm build` 后 dist/sdk/ 5 资产齐备；证据见 [validation](validation.md) |
| P-003 | 完成 | 2026-09-08 | dev-proxy security 迁移 + Node http `/proxy` 端点；13 用例绿；证据见 [validation](validation.md) |
| P-004 | 完成 | 2026-09-08 | dev-server.js（静态服务 + sdk 路由 + ws + pendingReload）；12 用例绿 + 新增 ws 依赖；证据见 [validation](validation.md) |
| P-005 | 完成 | 2026-09-08 | dev.js 编排 + CLI 挂载；端到端 L1/L0/build:error/recovery 冒烟通过；证据见 [validation](validation.md) |
| P-006 | 完成 | 2026-09-08 | 入口回归：全量 61/409 绿 + dmcc build/-w + pnpm compile 缓存路径不变；证据见 [validation](validation.md) |
| P-007 | 未开始 | — | — |