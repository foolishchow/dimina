# Requirements — dmcc-dev-server

## R-001（MUST）`dmcc dev <workPath>` 一条命令启动 dev 链路

`dmcc dev [workPath]`（缺省 `process.cwd()`）启动：初始全量构建 → watch 增量 → 静态服务 → 内置宿主页 → ws。使用者无需进入 `fe/` 工作区、无需预编译、无需手动启动容器。命令退出码与错误语义对齐现有 `dmcc build`（构建失败打印 `编译出错` 且以非零退出，除非处于 watch 循环）。

## R-002（MUST）静态服务仅暴露最后成功发布的快照

- HTTP 静态服务 `targetPath`（含 `main/`、分包、`app-config.json` 与 `sdk/` 资产），`Cache-Control: no-cache`（dev 语义）。
- 编译失败（`build:error`）不改变已服务内容：失败时不发布、不切换，在售版本不变。
- 内置宿主页（最小宿主：直开目标 app，可选 `path` 参数）由 dev server 提供服务，消费 container-sdk 预构建资产（`sdk/`，A2.0 定案）。

## R-003（MUST）WebSocket 推送变更分类与 reloadLevel

- 每次成功重建后推送 `{ appId, changedStages, affectedPages, reloadLevel }` 到宿主页。
- `changedStages` / `affectedPages` 来自 `DependencyGraph` + `compile-stages` 的变更分类（复用 `getCompileStagesForFiles`）。
- `reloadLevel` 由 dmcc dev 侧按合成规则计算，宿主页只负责执行（§4.2 规则）。
- 宿主页对每个推送返回 ack（或可观察的生效信号），dev server 记录但不断言。

## R-004（MUST）L1 页面 relaunch 生效

logic 变更（`.js/.ts`）→ 重建成功 → 宿主页执行 relaunch（复用 `appManager.restartMiniProgram`），App 状态重建、当前页重进。编译失败不触发 relaunch，运行中实例保持。

## R-005（MUST）L0 全量重启分类

`app.json`、`project.config.json`、tabBar/分包结构变更 → reloadLevel=L0 → 宿主页通知容器重启 app。

## R-006（MUST）编译失败不中断运行实例

构建失败（含增量）时：不发布、不推送 reloadLevel（或推送显式 `build:error` 信号），运行中实例与在售快照不变；dev server 打印结构化错误供诊断（复用 `[lifecycle]` 统一前缀约定）。

## R-007（MUST）代理能力合并且保留 SSRF 防护

dev server 合并现 `fe/packages/server` 的 `/proxy` 职责（HTTP 方法/响应类型校验、超时限制、SSRF 目标校验 `assertSafeTarget`、CORS 来源白名单），以源码级迁移复用 `security.js`，不弱化防护。代理端点路径与既有 container 消费方兼容。

## R-008（MUST）产物契约与既有 spec 全绿

A1 冻结的产品契约不变：modDefine 格式、模块 ID、输出目录（`main/`、`{root}/`、`app-config.json`）、兼容性警告语义。`pnpm --filter compiler test` 全绿（57 文件 / 360 用例 + 新增）。

## R-009（MUST）dev server 与 ws 协议有 vitest 契约测试

不依赖真实浏览器：静态服务路由/快照语义、reloadLevel 合成（各文件类型 → 级别）、ws 消息形状与 ack 时序，全部以 vitest 覆盖。

## R-010（SHOULD）fe/ 外新 clone 场景可用

`dmcc dev` 在 fe/ 工作区外（npm 安装形态）一条命令起预览：sdk 资产自 compiler 包内解析（A2.0），无 workspace 包安装依赖。

## R-011（SHOULD）变更合并与节流

watch 事件在调度器窗口内合并（现有 `createWatchRebuildScheduler` 语义），连续保存只触发一次重建与一次推送；期间到达的变更保守回退全量（对齐现有 `createWatchBuildPlan` count>1 语义）。

## R-012（MAY）多 app 并行 dev

多个 `dmcc dev` 实例并存（不同端口/不同 targetPath）互不干扰；端口冲突时给出明确错误并建议 `--port`。

## Non-scope

见 [README](README.md) Non-goals；L2/L3 的 render 侧能力属 A3，本门只负责把 L2/L3 的变更分类与级别正确上报（宿主按刷新回退），不回改 render/container-sdk 的渲染能力。
