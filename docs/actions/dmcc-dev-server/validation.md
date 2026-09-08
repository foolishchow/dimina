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