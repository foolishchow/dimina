# Source Audit — dmcc-dev-server

本次审计记录与 A2 设计相关的现有实现事实（2026-09-08 核实）。

## 现有 watch 链路（`fe/packages/compiler/src/bin/index.js` + `src/common/watch.js`）

- `dmcc build -w` 已实现：初始 `build()` → chokidar watch workPath → `createWatchBuildPlan` 分类（`count>1` / 非 change / `.json` → 全量；`!dependencyGraph.hasFile` → skip；`getCompileStagesForFiles` 未知 kind → 全量）→ `createWatchRebuildScheduler` 合并/节流 → 增量 `build(options)`。
- 增量选项已含 `affectedEntries` / `stages` / `seedPath` / `dependencyGraph` / `prepareConfig` / `prepareNpm`（A1 后 `lifecycle` 可注入）。
- 无静态服务、无 ws、无宿主页、无 reloadLevel 合成——即 A2 的新增面。

## 变更分类（`src/common/compile-stages.js`）

- `getCompileStagesForFiles(graph, filePaths) → { stages: ['view'|'logic'|'style'...], unknownKinds }`。
- `DependencyGraph.getFileKinds` / `getAffectedEntries` / `hasFile` 提供页面级影响推导——reloadLevel 合成的现成输入。

## A1 事件契约（`src/common/lifecycle.js`，已归档 A1 冻结）

- `build(targetPath, workPath, useAppIdDir, options)` 支持内部 `options.lifecycle`（`createLifecycle()` 实例）。
- 关键事件：`build:start` / `config:collected` / `dist:prepared` / `config:compiled` / `npm:built` / `stage:before` / `stage:after` / `stage:error` / `bundle:published` / `build:warning` / `build:end`（含 `isolatedListenerErrors` 计数）/ `build:error`（随后同对象 reject）。
- 监听器错误隔离（`[lifecycle]` 前缀日志），载荷浅冻结。
- dev server 通过 `options.lifecycle` 消费 `bundle:published`（快照就绪信号）与 `build:error`（失败信号）。

## 发布原子性（`src/common/publish.js`）

- `createDist(seedPath)`：临时目标下重建 dist（`getTargetPath()`）。
- `publishToDist(targetPath, useAppIdDir)`：临时目标走 `fs.renameSync`（原子），否则复制；成功后目标目录即「最后成功发布」状态。
- 语义：dev server 直接服务 `targetPath` 即可满足「最后成功发布快照」——失败不 publish → 在售不变。无需额外版本化目录（R-002 达成路径）。

## 代理现状（`fe/packages/server`）

- `createProxyApp()`（express）：CORS 白名单（`isAllowedBrowserOrigin`）、`POST /proxy`（method/responseType 校验、超时 1–30s、`assertSafeTarget` SSRF 校验、`sanitizeRequestHeaders`）、`MAX_REQUEST_BODY_BYTES` 1MB / `MAX_RESPONSE_BODY_BYTES` 10MB。
- `security.js` 提供 `assertSafeTarget` / `createSafeLookup` / `isAllowedBrowserOrigin` / `sanitizeRequestHeaders`——可源码级迁移复用（独立于 express/axios 依赖形态的纯函数）。

## container-sdk 资产（A2.0 定案）

- `@dimina/*` workspace 包均 private 不发布；container-sdk 预构建 dist 随 `@dimina/compiler` 包分发（`sdk/` 资产目录：index.js/pageFrame.js/css/service.js，~850KB）。
- `appManager.restartMiniProgram(source, path)` 存在（`src/core/appManager.ts:318`）——L1 宿主侧执行入口。
- 生产 external 仅 `mitt`；vconsole 仅 dev 动态 import（dmcc dev 是 dev 场景，需随包提供 vconsole 供宿主页按需加载）。

## 测试基础设施

- vitest（`--filter compiler test`，57 文件 / 360 用例）。既有 `watch-scheduler.spec.js` / `compile-cli-cache.spec.js` 覆盖调度/缓存，可作为 dev 契约测试的接入参照。
- 经验（Experience-Review）：相邻回归、消融实验（新回归测试先复现后修复）、禁止 `git reset --hard`、小步提交保持全量绿。
