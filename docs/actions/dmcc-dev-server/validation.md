# Validation — dmcc-dev-server

计划命令与证据形态；实际结果在执行阶段填写并支撑闭合判定。

## 计划命令

| 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- |
| 编译规格 | `cd fe && pnpm --filter compiler test` | 退出码 + 用例数 |
| Lint | `corepack pnpm lint` | 退出码 |
| 合成规格 | `vitest run __tests__/dev-reload.spec.js` | spec 日志 |
| 宿主页规格 | `vitest run __tests__/dev-host.spec.js` | spec 日志 |
| 代理规格 | `vitest run __tests__/dev-proxy.spec.js` | spec 日志 |
| dev server 契约 | `vitest run __tests__/dev-server.spec.js`（含 ws：起真实 dev server，用 `ws` 客户端 mock 宿主订阅；断言 reload 载荷形状、ack 时序、pendingReload 清空） | spec 日志 |
| L1 载荷可观测（A-004） | 同一契约 spec 内：mock 宿主改页 js → 断言收到 `{ type:'reload', reloadLevel:'L1' , buildId }`；宿主页 `relaunch` 执行路径以代码路径审查（dev-host.js 中 `restartMiniProgram` 调用点）+ 浏览器冒烟记录 | spec 日志 + 冒烟记录 |
| CLI 冒烟 | `node src/bin/index.js dev <tmpApp>` | 命令日志 + curl |
| 失败注入 | 临时坏文件 → 观察 build:error 推送、旧产物保留、进程存活 | 冒烟日志 |
| L1/L0 冒烟 | 改 js → 推 L1；改 app.json → 推 L0 | ws 观察日志 |
| fe/ 外模拟 | 裸目录 `dmcc dev`（compiler + sdk 资产 + mitt） | 目录日志 + curl 200 |
| 端口 | 两实例并存 / `--port` 冲突 | 冒烟日志 |
| 一致性 | `pnpm --filter compiler sync:compat` 后 `git diff --exit-code` | exit code |

## 执行环境记录要求

每次实际验证附：日期、commit、Node/pnpm 版本、与计划偏差。

## 闭合判定（模板）

- A-001~A-012 全部 passed（A-010 为 SHOULD 支撑项，失败需记录原因与影响）；
- ws 协议与 reloadLevel 合成契约定稿结论回写 RFC（§4.1/§4.2 若需补充）；
- 无未记录的未覆盖区域。

## 实际执行记录

### P-001（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `d831ee8b`（promote 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| 新增规格 | `corepack pnpm --filter compiler exec vitest run __tests__/dev-reload.spec.js` | 14/14 通过 | `fe/packages/compiler/__tests__/dev-reload.spec.js` | passed |
| 全量回归 | `corepack pnpm --filter compiler test` | 58 文件 / 374 用例全绿（含新增 14；既有 360 无回落） | 终端日志 | passed |
| Lint | `corepack pnpm lint` | oxlint 无告警（首轮 jsdoc @returns warning 已修复） | 终端日志 | passed |
| 契约实现 | `src/common/dev-reload.js`：`synthesizeReloadLevel({ event, filePath, count, plan, appId, buildId })`；矩阵 skip→null / 非增量→L0 / logic→L1 / view→L3 / style→L2 / 防御→L1；affectedPages 由 plan.options.affectedEntries 映射；reloadLevel 字符串化（'L0'..'L3'）；未触碰 watch.js 接口 | — | 源码 diff 仅 2 个新文件 | passed |

覆盖说明：

- 矩阵全分支已锁定（14 用例）：skip/合并/配置json/未知kind/add-unlink/非增量兜底/logic/logic+style/style/view/view+style/防御空affectedPages/空stages/载荷字段映射。
- 未覆盖：与 watch.js / ws / dev-server 集成后的 pendingReload 关联（P-004）；宿主页生成（P-002）；代理（P-003）。

### P-002（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `1c428631`（P-001 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| 新增规格 | `corepack pnpm --filter compiler exec vitest run __tests__/dev-host.spec.js` | 10/10 通过 | `fe/packages/compiler/__tests__/dev-host.spec.js` | passed |
| 全量回归 | `corepack pnpm --filter compiler test` | 59 文件 / 384 用例全绿（含新增 10；既有 374 无回落） | 终端日志 | passed |
| Lint | `corepack pnpm lint` | oxlint 无告警 | 终端日志 | passed |
| 契约实现 | `src/common/dev-host.js`：`SDK_ASSET_PATHS` 冻结常量（index/pageFrame/css/service 路由）；`createHostPageHtml({ appId, wsPath })` 生成最小宿主页——createContainer + openApp({ destroy:true }) 直开目标 app、`?path=` 入口、resourceBaseUrl='/‘、getAppInfo 最小形态、ws 订阅订阅 + reload 分发（L0→reload / 其余→relaunch / build:error→日志）、title HTML 转义 + 脚本 JSON 字符串字面量安全注入 | — | 源码 diff 仅 2 个新文件 | passed |

覆盖说明：

- L1「当前页 relaunch」为语义近似（最小宿主不追踪导航栈，重进入口页 `?path=`）；已作注释明确，容器级精确当前页重进留待 A3/宿主页增强。
- 安全注入验证：title（HTML 上下文）转义防标签注入；脚本内 appId 经 JSON.stringify 成字符串字面量（JS 上下文不参与 HTML 解析），两种上下文行为分开断言。
- 未覆盖：与 dev-server 集成后的路由/ws 联调（P-004）；sdk 资产复制（P-002.5）；代理（P-003）。

### P-002.5（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `d3152ab8`（P-002 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| 构建 + 复制 | `corepack pnpm build`（compiler） | `[copy-sdk-assets] copied 5 assets`；`dist/sdk/` 含 index.js/css、pageFrame.js/css、service.js；check-package-exports 4 exports + CLI 正常 | `dist/sdk/` 目录 | passed |
| 全量回归 | `corepack pnpm --filter compiler test` | 59 文件 / 384 用例全绿 | 终端日志 | passed |
| Lint | `corepack pnpm lint` | oxlint 无告警 | 终端日志 | passed |
| compat | `corepack pnpm --filter compiler sync:compat` | Already in sync；`git diff --exit-code` 干净 | 终端日志 | passed |
| 缺失边界 | 临时移除 container-sdk/dist 后执行复制脚本 | 明确报错 + exit=1（未静默忽略） | 终端观察（已恢复） | passed |
| 发布形态 | `files:['dist']` 且 `dist/` 被 git 忽略；新脚本 `scripts/copy-sdk-assets.js` 被跟踪 | git status 仅期望变更 | 终端 | passed |

覆盖说明：

- 脚本只复制 5 个运行时资产（js/css/service），d.ts 等开发期类型不随包——与 dev-host.js `SDK_ASSET_PATHS` 对齐。
- 未覆盖：与 dev-server 路由（`/sdk/*` → dist/sdk/）的联调（P-004）；fe/ 外模拟靠 dist/sdk 的完整链路（P-007）。

### P-003（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `e0f0f2d8`（P-002.5 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| 新增代理规格 | `corepack pnpm --filter compiler exec vitest run __tests__/dev-proxy.spec.js` | 13/13 通过 | `fe/packages/compiler/__tests__/dev-proxy.spec.js` | passed |
| 安全迁移 | 与既有 `fe/packages/server/security.test.js` 对齐：私网/回环/IPv4-mapped IPv6 拒绝、逐 DNS answer 校验、CORS 白名单、敏感请求头剥离 | 全部通过 | dev-proxy.spec.js | passed |
| 合法转发 | DI 注入已通过安全校验的本地目标，Node http 实际转发 POST/GET/arraybuffer | method/body/query/二进制均通过 | dev-proxy.spec.js | passed |
| 非法/SSRF | 非法 method/responseType、无效 JSON → 400；私网目标 → 403 且 forward 未调用；超时错误 → 504 | 全部通过 | dev-proxy.spec.js | passed |
| 全量回归 | `corepack pnpm --filter compiler test` | 60 文件 / 397 用例全绿（既有 384 无回落） | 终端日志 | passed |
| Lint | `corepack pnpm lint` | oxlint 无告警 | 终端日志 | passed |

实现说明：`handleProxyRequest(req, res, deps?)` 默认使用生产 `assertSafeTarget` / `forwardRequest`；仅契约测试注入依赖，生产路径仍强制 SSRF 校验。GET data 复刻既有 axios params 语义，序列化为 query string。

### P-004（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `c0d65d3b`（P-003 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS |

新增依赖：`ws@8.21.3`（compiler `dependencies`；Node 无内置 ws server，见 technical-design §6）。

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| 新增 server 规格 | `corepack pnpm --filter compiler exec vitest run __tests__/dev-server.spec.js` | 12/12 通过（真实 http/ws 客户端 + 真实 tmpdir 服务根） | `fe/packages/compiler/__tests__/dev-server.spec.js` | passed |
| 静态服务 | GET `/` → 宿主页（含 sdk 引用 + appId 注入）；`/sdk/index.js` → sdk 资产；`/main/logic.js`、`/app-config.json` → serveRoot 产物；全部 `Cache-Control: no-cache` | 全部通过 | dev-server.spec.js | passed |
| 安全 | 未知资源 404；路径穿越 `..%2F` 400；非白名单浏览器来源 403、localhost 来源放行 | 全部通过 | dev-server.spec.js | passed |
| 快照语义 | 更新 serveRoot 后 GET 立即返回新内容（最后成功发布） | 通过 | dev-server.spec.js | passed |
| pendingReload 关联（F-002） | setPendingReload + notifyBuildPublished → 推完整 reload 载荷并清空；无 pending → 不推；build:error → 清空 + 推 build:error；订阅校验 appId；ack 记录 | 全部通过 | dev-server.spec.js | passed |
| 连续 reload | buildId 3/4 依次推送，宿主可去重 | 通过 | dev-server.spec.js | passed |
| 全量回归 | `corepack pnpm --filter compiler test` | 61 文件 / 409 用例全绿（既有 397 无回落） | 终端日志 | passed |
| Lint | `corepack pnpm lint` | oxlint 无告警（首轮 JSDoc @returns warning 已修复） | 终端日志 | passed |

覆盖说明：

- `createDevServer` 不依赖 lifecycle 具体实现——编排层（P-005）负责订阅 `bundle:published`/`build:error` 并调用 `notifyBuildPublished`/`notifyBuildError`，server 层只管理推送状态；pendingReload 由 set 注入（合成结果源自 dev-reload.js，P-001）。
- 未覆盖：与真实 build/watch/lifecycle 的端到端联动（P-005 冒烟）；宿主页在真实浏览器中运行（A-004 冒烟记录）。

### P-005（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `432f1d4b`（P-004 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS |
| SDK source | `DIMINA_DEV_SDK_DIR=fe/packages/container-sdk/dist`（源码开发形态；发布形态由 `dist/sdk` 解析） |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| CLI 帮助 | `corepack pnpm --filter compiler exec node src/bin/index.js dev --help` | dev 子命令、work-path/target-path/port/no-app-id-dir/sourcemap 选项可见 | 终端日志 | passed |
| 初始服务 | `node src/bin/index.js dev -c /tmp/dmcc-dev-app -p 18765 --no-app-id-dir` + `curl /` | preview URL 监听成功；GET `/` status=200，宿主页含 appId/createContainer | `/tmp/dmcc-dev.log` + `/tmp/host.html` | passed |
| L1 | ws observer：修改 `pages/index/index.js` | reload `{ reloadLevel:'L1', changedStages:['logic'], buildId:1 }` | `/tmp/dev-observer.log` | passed |
| L0 | ws observer：修改 `app.json` | reload `{ reloadLevel:'L0', changedStages:[], buildId:2 }` | 同上 | passed |
| 失败保护 | ws observer：注入 JS 语法错误 | 收到 build:error；无失败 reload；dev 进程继续存活 | 同上 + dev log | passed |
| 恢复 | ws observer：修复 JS | reload L1（buildId=4）；失败尝试消耗 buildId=3 但不推送，符合 pendingReload 清空语义 | 同上 | passed |
| build 入口契约 | 既有 `dmcc build` 代码路径未改，dev 独立注册子命令 | 无既有 build 入口改动 | `src/bin/index.js` diff | passed |

覆盖说明：

- 观察者使用严格一次状态机，避免把收到 reload 再写回源文件造成正反馈；此前错误观察者导致 361 次重建，已作为测试方法修正，不是产品缺陷。
- 未覆盖：真实浏览器执行宿主页的 container/relaunch 视觉结果（A-004 以 ws 载荷 + host 代码路径 + 后续浏览器冒烟覆盖）；入口全量/fe 外模拟（P-006/P-007）。