# Acceptance — dmcc-dev-server

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | `dmcc dev <workPath>` 一条命令：初始构建成功 → 端口监听 → 宿主页可 GET；命令在 watch 循环中保持运行（不立即退出） | dev 冒烟日志 + curl 200 | pending |
| A-002 | R-002 | 静态服务仅暴露成功发布快照：构建成功后 GET `/main/logic.js` 等产物 200 且 `Cache-Control: no-cache`；注入编译失败（坏文件）后服务内容不变（旧产物仍在，reload 未推） | curl 头 + 失败注入观察 | pending |
| A-003 | R-003 | ws 契约测试：订阅后每次成功重建收到 `{ type:'reload', appId, changedStages, affectedPages, reloadLevel, buildId }`，字段类型与级别符合合成规则 | vitest 契约 spec | pending |
| A-004 | R-004 | L1 生效：修改页面 `.js` → 重建成功 → ws 推 reloadLevel=L1 → 宿主执行 relaunch（测试观测宿主收到 L1 并调用 restart 路径；容器级 relaunch 以冒烟记录） | 契约 spec + 冒烟 | pending |
| A-005 | R-005 | 修改 `app.json` → 推 reloadLevel=L0 | 契约 spec | pending |
| A-006 | R-006 | 注入编译失败：`build:error` 推送、无 reload 推送、旧产物与运行中实例不变、dev server 进程不退出 | 失败注入契约 spec + 冒烟 | pending |
| A-007 | R-007 | `/proxy` 端点：合法请求转发、非法 method/超限响应类型 400、SSRF 目标（内网 IP）被拒；防护基于迁移后的 `dev-proxy.js` | 契约 spec + 手工 | pending |
| A-008 | R-008 | `pnpm --filter compiler test` 全绿（57 文件 / 360 用例 + 新增，不回落）；A1 契约 spec 未修改即通过 | 命令日志 + git diff | pending |
| A-009 | R-009 | 静态路由/快照语义、reloadLevel 合成（每文件类型 → 级别矩阵）、ws 消息形状与 ack 时序均有 vitest 覆盖 | 新增 spec 运行日志 | pending |
| A-010 | R-010 | fe/ 工作区外模拟：裸目录（compiler 包 + sdk 资产 + mitt）下 `dmcc dev` 启动并可 GET 宿主页与 sdk 资产 | 模拟目录构建日志 | pending |
| A-011 | R-011 | 连续快速保存多文件在调度窗口内合并为一次重建/一次推送；需时保守 L0 | 契约 spec（复用 scheduler） | pending |
| A-012 | R-012 | 两实例不同端口并存；端口占用给出明确错误 | 冒烟 | pending |

## SHOULD 支撑项

- A-010（R-010）SHOULD：失败需记录原因与影响再判。