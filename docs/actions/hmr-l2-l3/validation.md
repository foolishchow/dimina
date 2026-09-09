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

## 实际执行记录

### P-001（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `ecdf3576`（promote 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS · jsdom（sdk 测试） |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| render 新增规格 | `pnpm --filter render exec vitest run __tests__/hmr.spec.js` | 11/11（flag 关闭拒绝/开启接受/envelope 四类校验/stale 单调水位/乱序去重/enable 幂等） | `fe/packages/render/__tests__/hmr.spec.js` | passed |
| sdk 新增规格 | `pnpm --filter fe-container-sdk exec vitest run __tests__/dev-command.spec.ts` | 4/4（target:render 转发/默认体/无 webview false/destroyed false） | `fe/packages/container-sdk/__tests__/dev-command.spec.ts` | passed |
| render 全量 | `pnpm --filter render test` | 17 文件 / 194 用例全绿（既有无回落） | 终端日志 | passed |
| sdk 全量 + 类型 | `pnpm --filter fe-container-sdk test` / `typecheck` | 83 文件 / 311 用例全绿；TS 0 错误（首轮两处类型缺口已修：ContainerInstance 接口声明 + spec 构造） | 终端日志 | passed |
| Lint | `pnpm lint` | oxlint 无告警（首轮 JSDoc @returns 警告已修） | 终端日志 | passed |
| 契约实现 | render：`src/core/hmr.js`（createHmrState/enableDevHmr/handleHmrCommand）+ `index.js` 接线（message.on enableDevHmr/hmr，accepted 后调 `runtime.handleHmr?.` 预留接入点）；sdk：`Bridge.sendDevCommand`（默认体 {}、destroyed/无 webview 返回 false）+ `ContainerInstance.sendDevCommand`（views 栈顶 → navigator.top）+ types 接口 | — | 源码 diff 5 文件 | passed |

覆盖说明：

- flag 关闭拒绝 + 无消息类型注入即隔离 = A-001 的守卫层证据（宿主页接入在 P-006）。
- 未覆盖：L2/L3 事务本体（P-002..P-005）；ContainerInstance.sendDevCommand 的端到端（jsdom 无真实 iframe，逻辑为薄封装，P-006 宿主接入冒烟覆盖）。

### P-002（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `966fe3c3`（P-001 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS · jsdom |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| 新增规格 | `pnpm --filter render exec vitest run __tests__/hmr-style.spec.js` | 8/8（key 语义/登记/未知资源拒绝/成功替换/cache-bust 两种拼接/失败回滚/超时/批量单项失败不阻断） | `fe/packages/render/__tests__/hmr-style.spec.js` | passed |
| render 全量 | `pnpm --filter render test` | 18 文件 / 202 用例全绿（既有 194 无回落） | 终端日志 | passed |
| sdk 全量 | `pnpm --filter fe-container-sdk test` | 83 文件 / 311 用例绿 | 终端日志 | passed |
| Lint | `pnpm lint` | oxlint 无告警（两处 JSDoc 警告已修） | 终端日志 | passed |
| 契约实现 | `src/core/hmr-style.js`（createStyleRegistry/styleKey/registerStyle/applyStyleReload/applyStyleReloadBatch + 单例 registry；load-or-keep 事务 + 10s 超时）；`loader.js` loadStyleFile(meta) 登记 app/page 两类资源；`index.js` hmr 分发 L2 → applyStyleReloadBatch | — | 源码 diff 4 文件 | passed |

实现决策（代码注释记录）：registry key 不含 appId（pageFrame 单 app 帧，scope+pagePath 唯一）；L2 对 app + affectedPages 做最终一致重载，重载未变更资源无害。

覆盖说明：

- 未覆盖：真实浏览器 CSS 加载（jsdom 手动驱动 load/error；P-006 冒烟覆盖）；L3 事务（P-003+）。
