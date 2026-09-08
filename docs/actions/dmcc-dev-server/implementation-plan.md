# Implementation Plan — dmcc-dev-server

任务可评审、有依赖、带验证点；执行授权后按序进行。

| ID | 任务 | 依赖 | 验证点 |
| --- | --- | --- | --- |
| P-001 | 新增 `src/common/dev-reload.js`：纯函数 `synthesizeReloadLevel(plan, changedFile)` 与载荷组装（appId/changedStages/affectedPages/reloadLevel/buildId）；覆盖 §4 矩阵 | — | 新增合成 spec 绿（含边界：skip/合并/unknown/json/view/style/logic 矩阵） |
| P-002 | 新增 `src/common/dev-host.js`：宿主页 HTML 模板 + sdk 资产路由路径常量；消费 `{%targetPath%}` 等占位替换 | — | 宿主页生成单测（占位替换/静态资源引用正确） |
| P-003 | 新增 `src/common/dev-proxy.js`：迁移 `fe/packages/server/security.js` 纯函数 + `/proxy` 端点实现（Node http）；端口/超时/体积/SSRF 校验对齐 | — | 代理契约 spec（合法/非法/SSRF 三组） |
| P-004 | 新增 `src/common/dev-server.js`：静态服务（targetPath + sdk/）+ 快照语义（服务 targetPath、失败不切）+ ws（`ws` 包，订阅/reload/build:error/ack）+ 依赖注入 build/compile-stages 接口 | P-001…P-003 | dev server 契约 spec（路由/快照/失败不切换/ws 形状与 ack 时序） |
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
| P-001…P-007 | 未开始 | — | — |