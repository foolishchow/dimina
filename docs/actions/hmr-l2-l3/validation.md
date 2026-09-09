# Validation — hmr-l2-l3

计划命令与证据形态；实际结果在执行阶段填写。

## 计划命令

| 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- |
| render 规格 | `cd fe && pnpm --filter render test` | 退出码 + 用例数 |
| container-sdk 规格 | `cd fe && pnpm --filter fe-container-sdk test` | 退出码 + 用例数 |
| L2/L3 契约 | 新增 render/container-sdk vitest specs | 测试日志 + 场景矩阵 |
| flag 隔离回归 | 同一生产 dist：无 bridge 注入/无 hmr 指令时行为与现状一致（运行时 flag 未开启）；对照指令注入后事务可达 | 行为对照日志 + source diff |
| L2 smoke | A2 dev + style 修改 → CSS 更新且实例不重启 | 浏览器/Web 容器日志 |
| L3 smoke | A2 dev + view 修改 → module replace/remount/replay | 浏览器/Web 容器日志 |
| fallback | 注入 module/replay/style 失败 → 旧实例保持 + L1 | 失败日志 + reload 观察 |
| stale build | 快速连续 view/style 更新 → 旧 buildId 丢弃 | 集成 spec |
| production/native guard | 生产构建、原生路径与 flag off 检查 | build/test/source diff |
| 全仓相邻回归 | `cd fe && pnpm --filter compiler test` + render/container-sdk suites | 退出码 + 用例数 |

## 执行环境记录要求

每次实际验证附：日期、commit、Node/pnpm 版本、Web 容器/浏览器环境、与计划偏差。

## 闭合判定（模板）

- A-001~A-012 全部 passed，或 L3 明确以证据降级为 L1 并更新对应 Acceptance；
- Web 容器边界、feature flag、原生/生产隔离均有证据；
- 协议与架构发现回写 RFC §4.2/§7；
- 无未记录的未覆盖区域。
