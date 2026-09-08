# Technical Design — dmcc-dev-server

## 1. 边界与职责

`dmcc dev` = 现有 watch（复用）+ 新增 dev server 编排层。分层：

```text
bin/index.js（dev 子命令）
  └─ dev-server.js（进程编排：初始 build → watch → 静态服务 → ws → 代理）
       ├─ 复用 src/common/watch.js（createWatchBuildPlan / createWatchRebuildScheduler / createIgnoredPathMatcher / getPublishedOutputPath）
       ├─ 复用 src/common/compile-stages.js（getCompileStagesForFiles）
       ├─ 复用 A1 lifecycle（options.lifecycle 注入；bundle:published / build:error 驱动）
       ├─ dev-reload.js（变更分类 → reloadLevel 合成，纯函数）
       ├─ dev-host.js（内置宿主页 HTML 生成 + sdk 资产路由）
       └─ dev-proxy.js（迁移自 fe/packages/server/security.js 的 SSRF 防护纯函数）
```

不在本门修改：`src/core/*`、`src/env.js`、`src/common/publish.js`、watch 调度器语义、`src/bin/compile.js`、container-sdk / render。

## 2. 快照语义（R-002）

服务目标 = **`targetPath`（build 的 target 参数）**，即「最后一次成功 publish」的目录。证明：

- 构建写 `getTargetPath()`（无 `TARGET_PATH` env 时为 mkdtemp 临时目录）。
- `publishToDist(targetPath, useAppIdDir)`：临时目录走 `fs.renameSync`（原子）；publish 成功 = rename 那一刻 targetPath 原子切换为最新产物。
- 失败（`build:error`）：无 publish 调用 → targetPath 保持旧版本。
- 因此 dev server 静态服务 `targetPath` 即满足 R-002，无需额外版本化目录。

**已知窗口**：publish 内部 `rmSync(absolutePath)` → rename 之间存在瞬时空窗（服务中请求可能 404）。dev 场景（no-cache + 浏览器自动重试）可容忍；记录为残余限制，A3 或后续以「符号链接切换」优化。**新增文件型变更（add）时**：首次出现的新页面在 publish 前请求会 404——由 ws 推送后宿主重试/刷新兜底。

HTTP 语义：

- 静态：`targetPath/**` 与 `sdk/**`（compiler 包内资产），`Cache-Control: no-cache`。
- 路由：`/` → 宿主页；`/sdk/*` → container-sdk dist；其余 → targetPath 产物（`/main/...`、`/app-config.json`、分包路径）；`/proxy` → 代理。

## 3. 内置宿主页（最小宿主，D2）

`dev-host.js` 生成单页 HTML（模板字符串，无运行时构建），直开目标 app：

```html
<script type="module">
  import { createContainer } from '/sdk/index.js'
  // 读取 ?path= 参数直开指定页面，缺省首页
  const container = createContainer({ ... })
  // ws 连接 <dmcc-dev>:port，接收 { appId, changedStages, affectedPages, reloadLevel }
  // 按 reloadLevel 执行：L0/L1 → 宿主容器重启/relaunch；L2/L3 → 本门以刷新回退（见 §5）
</script>
```

- 不含应用列表壳（保留在 container demo）。
- 消费 `/sdk/` 资产（A2.0 定案）；vconsole 由宿主页在 dev 模式按需动态 import（container-sdk 生产已 tree-shake，dev 场景由宿主页显式加载）。
- `createContainer` 的宿主页与 container 参考宿主同 API；本门最小化参数集（workPath 产物根 = 服务根，免配置）。

## 4. reloadLevel 合成（R-003，dev-reload.js 纯函数）

输入 = 变更上下文 + watch 计划结果。**接口定案（评审 F-001 修复）**：现有 `createWatchBuildPlan`（`src/bin/watch.js`）返回 `{ skip, incremental, options }`，`stages` / `affectedEntries` 位于 `options` 内而非顶层。因此 `dev-reload.js` 的纯函数签名与实参来源为：

```js
// 返回 { reloadLevel, payload } | null（null = 不推送）
synthesizeReloadLevel({ event, filePath, count, plan })
// plan = createWatchBuildPlan 结果；内部取 plan.options.stages / plan.options.affectedEntries
// 载荷字段名对外统一为 affectedPages（对齐 RFC §4.1 推送载荷），
// 内部从 plan.options.affectedEntries 映射（同义、不新增字段名）
```

合成规则（对齐 §4.2，最破坏性优先）：

| 输入特征 | reloadLevel | 说明 |
| --- | --- | --- |
| `plan.skip` | 不推送 | 输出目录/依赖图未收录文件 |
| `count > 1`（合并）或 `unknownKinds.length > 0` | L0 | 无法安全推导，保守全量 |
| 变更含 `.json`（app/project config、tabBar、分包结构） | L0 | §4.2 L0 |
| `event !== 'change'`（add/unlink）且未能增量 | L0 | 结构性变更，保守全量（评审补充：矩阵补默认行） |
| `plan.incremental` 为 false 的其他情况 | L0 | 非增量全量重建的兜底默认 |
| `stages` 含 `logic` | **L1** | 本门交付的生效级别 |
| `stages` 含 `view`（含 view+style） | L3 | 上报级别；本门宿主按刷新回退 |
| 仅 `style` | L2 | 同上 |
| `affectedPages` 为空但 `stages` 非空 | L1 | 保守页面级 relaunch |

载荷：`{ appId, changedStages: stages, affectedPages, reloadLevel, buildId }`。`buildId` 每次重建自增，供宿主去重/乱序防护。

## 5. L2/L3 边界（本门 readiness gap 冻结方案）

**合成规则完整实现**（级别如实上报），但本门宿主页对 L2/L3 **执行回退为页面刷新**（与 L1 同路径 relaunch）。理由：

- §4.2 说「宿主页只负责执行」，级别由 dmcc dev 合成——协议层级别必须与 RFC 一致，A3 升级 render 侧能力时**不改 dev server 合成与 ws 协议**，只升级宿主执行端。
- G2：L2/L3「力争，时序不成立则降级」，降级不阻塞交付。
- 诚实的降级：style 变更会让页面整体刷新（代价高于热替换但正确），不产生半热状态。

A3 依赖声明：dmcc-dev-server 的 ws 协议与 reloadLevel 合成是本 Action 冻结的持久契约；A3 只需在宿主页执行端按级别接入 render 热替换能力。

## 6. WebSocket 协议（R-003 / R-009）

依赖：`ws` npm 包（Node 无内置 ws server；新增 compiler 依赖）。

```
client -> server: { type: 'subscribe', appId }
server -> client: { type: 'build:start' } | { type: 'reload', appId, changedStages, affectedPages, reloadLevel, buildId }
server -> client: { type: 'build:error', message }（失败信号，不触发 relaunch）
client -> server: { type: 'ack', buildId }
```

**载荷关联（评审 F-002 修复）**：`bundle:published` 事件载荷仅 `{ targetPath, useAppIdDir }`，不含 stages/affectedPages。因此 dev 侧维护**待推送上下文** `pendingReload`：

- 调度 rebuild 时（`createWatchRebuildScheduler` 的 rebuild 回调内、调用 `build()` 之前），先用 `synthesizeReloadLevel` 计算结果存入 `pendingReload`，并自增 `buildId` 与该结果绑定。
- `bundle:published` 事件触发时：若 `pendingReload` 非空，取出组装 `{ type:'reload', ...payload, buildId }` 推送，然后清空；若为空（如非 watch 触发的构建），不推送。
- `build:error` 事件触发时：清空 `pendingReload`（丢弃本次失败对应的待推载荷），推送 `{ type:'build:error', message }`。
- 调度器串行化（一次只跑一个 rebuild）保证「一个 rebuild 对应一个 pendingReload + 一个 bundle:published/build:error」关联安全，无并发竞态。

- 编译失败：推送 `build:error`（不推 reload），运行实例不变（R-006）。
- 连接断开：宿主页重连并请求当前 `buildId`，幂等（不重放旧 reload）。
- 时序：`bundle:published`（lifecycle 事件）→ 推 reload；`build:error`（lifecycle）→ 推 build:error。

## 7. 代理合并（R-007）

迁移 `fe/packages/server/security.js` 的纯函数（`assertSafeTarget` / `createSafeLookup` / `isAllowedBrowserOrigin` / `sanitizeRequestHeaders`）到 `src/common/dev-proxy.js`（源码级复制，保留原作者署名注释与单元测试口径）。`/proxy` 端点行为对齐现有 `createProxyApp`（method/responseType 校验、1–30s 超时、1MB/10MB 体积限制）。不依赖 express：dev server 用 Node `http` 原生实现路由（减少依赖面）。

**已评估替代方案（2026-09-08 决策记录）**：[http-proxy](https://www.npmjs.com/package/http-proxy)（及 http-proxy-middleware）**不采用**。理由：

- 语义不匹配：`/proxy` 是「SSRF 防护的 HTTP 客户端转发端点」（对齐既有 axios 式 server：请求体指定目标、responseType 变换 json/text/arraybuffer、结构化错误），http-proxy 是「流式连接反向代理」（浏览器直连目标），两者响应/错误/CORS 语义完全不同；强用反而增加复杂度且偏离 R-007 的对齐口径。
- SSRF 防护代价：`assertSafeTarget` 的 DNS 逐 answer 校验是安全核心，http-proxy 不提供，仍需自写；而其内部连接/代理管理引入「校验后再次解析」的不透明风险面，违背不弱化防护。
- 依赖面：existing 实现零新增依赖（node:http/https/dns/net + 已评估需自写），符合「减依赖面」约束；14 个契约 spec（dev-proxy.spec.js + dev-server.spec.js）已锁定当前实现的行为。
- 若未来需要真正透明反代或 ws 连接升级代理（如 `/api/*` → 本地后端），作为独立需求评估，不替换本端点。

**实现说明（P-003 定案）**：`handleProxyRequest(req, res, deps?)` 默认使用生产 `assertSafeTarget` / `forwardRequest`；契约测试经 DI 注入「已通过安全校验的本地目标」。GET `data` 复刻 axios `params` 语义序列化为 query string。

## 8. 端口与多实例（R-012）

- `--port <n>` 默认 8080；占用冲突 → 明确错误 `端口 8080 已被占用，请用 --port`。
- 多实例并存：各自独立端口与 targetPath；`TARGET_PATH` env 与临时目录互不干扰（storePathInfo 已按进程隔离）。

## 9. 错误处理与日志

- 初始构建失败：`dmcc dev` 退出码非零，打印 `编译出错`（对齐 build 语义），不启动服务（无快照可服务）。
- watch 循环中失败：打印 `[lifecycle]` 前缀结构化错误 + `build:error` 推送；服务继续（R-006）。
- 日志分级：info（启动/端口/重建摘要）/ error（失败）→ `console.log` / `console.error`，对齐现有 CLI 风格。

## 10. 验收映射

| Requirement | Design point |
| --- | --- |
| R-001 | §1 编排；bin/dev.js |
| R-002 | §2 快照语义 + no-cache |
| R-003 | §4 合成 + §6 ws 协议 |
| R-004 | §5 L1 生效（宿主 relaunch） |
| R-005 | §4 L0 分类 |
| R-006 | §9 失败不中断 + §6 build:error |
| R-007 | §7 代理合并 |
| R-008 | A1 契约冻结 + 全量 spec |
| R-009 | §6 协议契约测试 |
| R-010 | A2.0 资产 + §3 宿主页 |
| R-011 | 复用 watch 调度器 |
| R-012 | §8 端口 |
