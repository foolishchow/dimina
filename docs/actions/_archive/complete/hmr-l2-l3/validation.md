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
| P-006a 内部通道 | `dev-host.spec.js` 断言 L2/L3 调用 `sendDevCommand` 与 fallback；`dev-command.spec.ts` 模拟 render `hmr:result` 回传并断言宿主回调收到；git diff 确认 A2 `/ws` envelope 未变 | 三态/发送失败路径日志 + 协议 diff |

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

### P-006a（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `474fb10a`（P-005 后；宿主分发改动工作区起点） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS · jsdom |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| 宿主模板接入 | `vitest run __tests__/dev-host.spec.js` | 10/10；L0/L1 保持原路径，L2/L3 调用 `sendDevCommand('enableDevHmr')` + `sendDevCommand('hmr')`；`status:'fallback'` 或发送失败走 L1 | `fe/packages/compiler/__tests__/dev-host.spec.js` | passed |
| render 回传 | `src/index.js` hmr 分支 | rejected → `hmr:result/fallback`；L2 style batch 全部 applied → applied，任一失败 → fallback；当前 L3 明确返回 `l3-runtime-integration-pending` fallback，不伪称 L3 完成 | `fe/packages/render/src/index.js` | passed |
| container bridge 回传 | `vitest run __tests__/dev-command.spec.ts` | 5/5；Bridge `sendDevCommand` 支持 onResult，`target:'container'` 的 `hmr:result` 触发 callback；types/index 同步 | `fe/packages/container-sdk/__tests__/dev-command.spec.ts` | passed |
| render 全量 | `pnpm --filter render test` | 20 文件 / 214 用例全绿 | 终端日志 | passed |
| sdk 全量 + 类型 | `pnpm --filter fe-container-sdk test` + `typecheck` | 83 文件 / 312 用例全绿，TS 0 错误 | 终端日志 | passed |
| compiler 相关 | `pnpm --filter compiler test` | 61 文件 / 409 用例全绿，A2 dev-host spec 10/10 | 终端日志 | passed |
| Lint | `pnpm lint` | oxlint 无告警 | 终端日志 | passed |

设计边界：P-006a 只完成内部 envelope、回传路径、宿主分发和失败回退闭环；L2 事务可执行，L3 需要 P-006 补“资源加载新 view → replaceModule → remountWithSnapshot”完整联动。A2 ws/reloadLevel 形状、dev-server/dev-reload/dev-proxy 未改。

### P-006（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `46b91d6e`（P-006a 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS · jsdom |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| L3 集成规格 | `vitest run __tests__/hmr-l3-integration.spec.js` + `message-hmr.spec.js` | 4/4 资源联动 + 3/3 remount initial-data resolve：cache-bust 重载+新 Module 捕获+replaceModule；applied 成功链；remount 失败 rollback→fallback；未受影响页 no-op；已等待/未等待/多 waiter 均可 resolve snapshot | `hmr-l3-integration.spec.js` + `message-hmr.spec.js` | passed |
| render 全量 | `pnpm --filter render test` | 22 文件 / 221 用例全绿（既有 218 无回落，含 P-006 时序修复） | 终端日志 | passed |
| sdk / compiler | `pnpm --filter fe-container-sdk test` / `--filter compiler test` | 83/312、61/409 全绿 | 终端日志 | passed |
| Lint / 类型 | `pnpm lint` / sdk typecheck | oxlint 干净；TS 0 错误 | 终端日志 | passed |
| 契约实现 | `loader.reloadViewModule`（resourceContext URL + `__dmcc_hmr` cache-bust + hmrCapture 捕获 window.Module 注册）；`createModule` 在 hmrCapture 命中时捕获新 moduleInfo 而非静默丢弃；`runtime.handleHmr`（L3：未受影响 no-op applied / reload→replace→remount→applied / 失败 rollback→fallback）；页面与组件 render 动态读 loader 当前模块（replacement 后新 render 生效）；render index L3 分支接 handleHmr 并回传三态；`message.resolveWait` 在 remount 后向新 setup 注入 snapshot，避免 service 不重发 firstRender 导致 wait 永久挂起 | — | 源码 diff + 2 integration specs | passed |

覆盖说明：

- 真实浏览器端 L3 视觉验证（快照回放后页面状态）仍属 A-004/A-007 冒烟口径，jsdom 集成测试锁定事务链路与回滚语义。
- 测试方法修正：用例间 `vi.restoreAllMocks()` + 手动挂 `window.Module`（jsdom 无 env 初始化）——首轮 2 失败均为测试 harness 问题，非产品缺陷。

### P-007（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `c26f0a1d`（P-006 时序修复后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS；真实 HTTP/WS；无 Playwright/Puppeteer |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| render 回归 | `pnpm --filter render test` | 22 文件 / 221 用例全绿 | 终端日志 | passed |
| container-sdk 回归 | `pnpm --filter fe-container-sdk test` + `typecheck` | 83 文件 / 312 用例全绿；TS 0 errors | 终端日志 | passed |
| compiler 回归 | `pnpm --filter compiler test` | 61 文件 / 409 用例全绿 | 终端日志 | passed |
| Lint/compat | `pnpm lint` + `pnpm --filter compiler sync:compat` + diff | oxlint clean；compat 已同步 | 终端日志 | passed |
| 生产构建 | render + container-sdk + compiler build | 全部成功；compiler `dist/sdk` 5 资产齐全 | `/tmp/p007-*-build.log` | passed |
| Web dev 冒烟 | `node dist/bin/index.js dev -c <tmpApp> -p 18767 --no-app-id-dir`（不设 `DIMINA_DEV_SDK_DIR`）+ curl + ws observer | HTTP `/` 200（2737B），`/sdk/pageFrame.js` 200（449821B）；WS 顺序：L2(buildId=1) → L3(buildId=2) → build:error（无失败 reload，进程存活） | `/tmp/p007-dev.log` + WS 输出 | passed |
| flag off | render `createHmrState()` + hmr.spec | 初始 `enabled=false`；无 `enableDevHmr` 注入时 hmr 被拒；生产 dist 不依赖 `import.meta.env.DEV` 开启 HMR | hmr.spec 11/11 + source audit | passed |
| native scope | `git diff --name-only 8d705e76..HEAD` | 无 native/Harmony/android/ios/lynx 路径改动；A3 改动仅 render/container-sdk/compiler Web dev host | changed-path audit | passed |

覆盖说明：

- 真实 HTTP/WS 冒烟验证 dev server 与 A2 协议、L2/L3 dispatch 和失败保护；当前环境无 Playwright/Puppeteer，未进行真实浏览器 DOM/视觉与 container iframe relaunch 观察。P-006 集成 spec 已锁定 render 事务链，A-004 该边界作为残余风险保留。
- 首轮 watcher 使用错误反馈回路导致重建循环，已改为一次性状态机后通过；不属于产品行为。
- P-005 时序修复（`message.wait(pageId)` 由 render 侧 `resolveWait` 注入 snapshot）已纳入 P-006 回归。

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

### P-003（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `3c2a04c4`（P-002 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS · jsdom |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| 新增模块替换规格 | `pnpm --filter render exec vitest run __tests__/hmr-module.spec.js` | 6/6：替换提交、stale buildId、rollback、依赖失败保护、placeholder fallback、参数校验 | `fe/packages/render/__tests__/hmr-module.spec.js` | passed |
| render 全量 | `pnpm --filter render test` | 19 文件 / 208 用例全绿（既有 202 无回落） | 终端日志 | passed |
| Lint | `pnpm lint` | oxlint 无告警 | 终端日志 | passed |
| 契约实现 | `loader.replaceModule(path, nextModuleInfo, buildId)`：依赖验证成功后切换缓存，返回一次性 rollback；stale buildId 拒绝；失败不污染旧模块；保留既有 createModule path 已存在时直接 return 语义 | — | `render/src/core/loader.js` + `hmr-module.spec.js` | passed |

覆盖说明：

- P-003 只交付 loader module replacement 事务；页面级 remount、快照回放、service 保留仍分别属于 P-004/P-005，未提前宣称 L3 完成。
- `ContainerInstance.sendDevCommand` 已由 P-001 接通，但 A3 宿主页实际调用与 render `runtime.handleHmr` 接入留待 P-006。

### P-005（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `85aa8835`（P-004 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS · jsdom |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| remount 事务规格 | `pnpm --filter render exec vitest run __tests__/hmr-remount.spec.js` | 6/6：deep snapshot、dataFunction/function identity、循环引用、快照回放不触碰 firstRender、remount 期间 updateModule queue 有序回放、未挂载/非当前页安全拒绝 | `fe/packages/render/__tests__/hmr-remount.spec.js` | passed |
| render 全量 | `pnpm --filter render test` | 20 文件 / 214 用例全绿（既有 210 无回落） | 终端日志 | passed |
| Lint | `pnpm lint` | oxlint 无告警 | 终端日志 | passed |
| 契约实现 | `runtime.capturePageSnapshot` 使用 `deepToRaw` + `cloneSnapshot`（保函数/dataFunction 引用、处理循环）；`replayPageSnapshot` 写入新 data；`beginHmrRemount` 先建队列再递增 root key；`endHmrRemount` 按序重放；事务异常清理 queue | — | `render/src/core/runtime.js` + `hmr-remount.spec.js` | passed |

覆盖说明：

- P-005 完成数据层与队列时序，但真实 Vue remount 后 setupData 新实例的自动回放、渲染层 update queue 与 module replacement 联动仍需浏览器/运行时集成验证；这些交付在 P-006/A-003~A-007 中不能以单元测试替代。
- 由于 `dataFunction` 是函数引用而非可 JSON 序列化值，快照明确采用 raw deep-copy，不使用 JSON/structuredClone。

### P-004（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `c995f2ca`（P-003 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS · jsdom |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| 新增 remount 规格 | `pnpm --filter render exec vitest run __tests__/hmr-remount.spec.js` | 2/2：当前页面 root key 递增提交；未挂载/非当前页面安全拒绝 | `fe/packages/render/__tests__/hmr-remount.spec.js` | passed |
| render 全量 | `pnpm --filter render test` | 20 文件 / 210 用例全绿（既有 208 无回落） | 终端日志 | passed |
| Lint | `pnpm lint` | oxlint 无告警 | 终端日志 | passed |
| 契约实现 | `runtime.pageRenderVersion` + root vnode key；`runtime.remountPage(pageId)` 仅递增当前 page root key，不调用 `firstRender()`/`app.unmount()`；保留 Vue app、bridge/service，snapshot replay 留给 P-005 | — | `render/src/core/runtime.js` + `hmr-remount.spec.js` | passed |

覆盖说明：

- 本原型验证的是当前 render 架构下的页面 root remount 边界；当前 pageFrame 的 Vue app 只承载当前 page root，故 key 事务可避免整 app firstRender。
- 未覆盖：setupData snapshot capture/replay、remount 期间 update queue、module replacement 与 remount 联动（P-005）；宿主 hmr 指令接入（P-006）。

## 闭合判定（2026-09-08）

- A-001~A-013 全部 passed；A-013 通过 dev-host/Bridge callback 规格与 P-007 协议冒烟。
- Web 容器 dev-only 边界、运行时 flag、native/production guard 均有证据；A2 ws/reloadLevel/dev server 未修改。
- L3 module replace/remount/snapshot/replay 事务与 fallback 有单元/集成证据；真实浏览器 DOM/视觉工具缺失已记录为残余风险，不以实现存在替代测试。
- P-007 生产构建、真实 Web HTTP/WS 冒烟、flag off 与 native path audit 已通过；无未记录的未覆盖区域。

Decision: **closable**（待 Close workflow 归档）。
