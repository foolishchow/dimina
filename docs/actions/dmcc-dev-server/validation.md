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