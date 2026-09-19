# Implementation Plan — fe-tools-bundler-emit-memfs

Status: **in_progress（2026-09-20）** — D-MM-1..6 全拍板

## I0 契约冻结（文档级）

| Step | 动作 | 状态 |
| --- | --- | --- |
| 0 | D-MM-1..6 拍板；technical-design 冻结 v1 | ✅ |

## I1 BuildModel.getArtifact（D-MM-4）

| Step | 文件 | 动作 | 行为 0 |
| --- | --- | --- | --- |
| 1 | `src/model/build-model.ts` | `BuildModel` class 加 `_artifactIndex: Map<string, { code: string }> \| null = null` private 字段 | 类型擦除 ✓ |
| 2 | 同上 | `add()` 末尾加 `this._artifactIndex = null`（失效索引） | 不改原有 entries 逻辑 ✓ |
| 3 | 同上 | 加 `getArtifact(relativePath: string): { code: string } \| undefined` 方法 — lazy 构建 `Map<filePath, { code }>`（`entries` → `files[].path` + `sourcemaps[].path`→`String(map.map)`） | 纯新增方法，compile 路径不调 ✓ |

**锚定**：`grep -n 'getArtifact' src/model/build-model.ts` 命中；`grep -n '_artifactIndex' src/model/build-model.ts` 命中。

## I2 pipeline skipMaterialize + buildModel 返回（D-MM-2 / D-MM-6）

| Step | 文件 | 动作 | 行为 0 |
| --- | --- | --- | --- |
| 1 | `src/compiler/pipeline/build-pipeline.ts` | `_runBuild` runOptions 解构加 `skipMaterialize` | compile 路径不传 → `undefined`（falsy）→ materialize 仍跑 ✓ |
| 2 | 同上 | "写入编译产物" task: `if (!skipMaterialize) { materialize(...) }`；`publishToDist` 保留不动 | dev 跳过 materialize；publishToDist move 冷路径 ✓ |
| 3 | 同上 | `result` 对象加 `buildModel: (context as { buildModel?: BuildModel }).buildModel` | 返回值增字段，不影响原有 4 字段 ✓ |
| 4 | 同上 | `import type { BuildModel }` 如需（或 inline cast） | 类型擦除 ✓ |
| 5 | `src/session/runner.ts` | `PIPELINE_OPTION_KEYS` 末尾加 `'skipMaterialize'`（`session.watch()` → `composeOptions()` → `splitBuildOverrides()` 对非白名单键 throw TypeError；不入白名单则 crash） | one-shot `build()` 不传 → `undefined` → 不跳过 ✓ |

**锚定**：`grep -n 'skipMaterialize' src/compiler/pipeline/build-pipeline.ts` 命中（解构 + 条件守卫）；`grep -n 'buildModel' src/compiler/pipeline/build-pipeline.ts` 命中（result 字段）；`grep -n 'skipMaterialize' src/session/runner.ts` 命中（PIPELINE_OPTION_KEYS 白名单）。

## I3 dev server artifactResolver 注入（D-MM-5）

| Step | 文件 | 动作 | 行为 0 |
| --- | --- | --- | --- |
| 1 | `src/dev/dev-server.ts` | `createDevServer` options 加 `artifactResolver?: (relativePath: string) => { code: string } \| null` | 可选参数，不传时行为同今天 ✓ |
| 2 | 同上 | 加 `stripAppIdPrefix(relativePath, appId)` 辅助函数 | 纯函数 ✓ |
| 3 | 同上 | `handleHttpRequest` serveRoot 分支（else L155 后）：先试 `artifactResolver?.(stripAppIdPrefix(pathname.slice(1), appId))` → hit → `writeStatic(response, artifact.code, contentType, headOnly)` → return；miss → 原有 `resolveContainedPath(serveRoot, pathname.slice(1))`（**用原始未剥前缀路径**，因 `publishToDist` 在磁盘建 `serveRoot/appId/` 子目录）+ `fs.stat` + `fs.readFile` 路径 | 有 resolver hit 时不读盘；miss 时行为同今天 ✓ |
| 4 | 同上 | `stat` 检查调整：hit 路径跳过 `fs.stat`（内存有即存在），直接取 `contentType` 按 `pathname` extname | 省一次 `fs.stat`；Content-Type 取法不变 ✓ |

**锚定**：`grep -n 'artifactResolver' src/dev/dev-server.ts` 命中；`grep -n 'stripAppIdPrefix' src/dev/dev-server.ts` 命中。

## I4 preview-adapter 透传（D-MM-5 续）

| Step | 文件 | 动作 | 行为 0 |
| --- | --- | --- | --- |
| 1 | `src/session/preview-adapter.ts` | `createServer` 参数加 `artifactResolver?: (relativePath: string) => { code: string } \| null` | 可选参数 ✓ |
| 2 | 同上 | `createDevServer({ ..., artifactResolver })` 透传 | 透传不改逻辑 ✓ |

**锚定**：`grep -n 'artifactResolver' src/session/preview-adapter.ts` 命中。

## I5 session dev() wiring（D-MM-6）

| Step | 文件 | 动作 | 行为 0 |
| --- | --- | --- | --- |
| 1 | `src/session/index.ts` | `SessionState` 加 `buildModel?: BuildModel` 字段 + import type | 类型擦除 ✓ |
| 2 | 同上 | `dev()` watch options 加 `skipMaterialize: !previewAdapter`（仅用默认 adapter 时跳过；自定义 adapter 路径下仍跑 materialize 防回归） | dev 路径跳过 materialize ✓ |
| 3 | 同上 | `dev()` 在 `watcher.start()` 后设 `state.buildModel = buildResult.buildModel` | 初始值 ✓ |
| 4 | 同上 | `adapter.createServer({ ..., artifactResolver: (path) => state.buildModel?.getArtifact(path) ?? null })` | 注入 resolver ✓ |
| 5 | 同上 | `state.lifecycle.on('build:end', ({ result }) => { state.buildModel = result.buildModel })` | rebuild 更新 ✓ |

**锚定**：`grep -n 'skipMaterialize' src/session/index.ts` 命中；`grep -n 'buildModel' src/session/index.ts` 命中（state + dev wiring）；`grep -n "build:end" src/session/index.ts` 命中。

## I6 测试

| Step | 文件 | 动作 | 行为 0 |
| --- | --- | --- | --- |
| 1 | `__tests__/dev-server.spec.js` | 新增 describe block: `artifactResolver 注入` — 4 个用例： (a) 传 `artifactResolver` 返回内存产物；GET 响应 body == resolver code； (b) GET 未命中路径 fallback 磁盘； (c) 不传 resolver 时行为同今天； (d) appId 前缀剥离：`appId: 'wx_test'` + `serveRoot/wx_test/main/logic.js` 磁盘文件 + resolver key `main/logic.js` → `GET /wx_test/main/logic.js` 返回 resolver code（验 appId strip 生效）；fallback：`GET /wx_test/app-config.json` resolver miss → 磁盘 fallback `serveRoot/wx_test/app-config.json` | 新增测例 ✓ |

## 不做

- 不改 `config-compiler.ts`（app-config.json 仍写盘）
- 不改 `publish.ts`（createDist + publishToDist 保留）
- 不改 `collectAssets`（tabBar icons 仍写盘）
- 不引入 memfs 依赖
- 不改 SDK 资产服务路径

## 消融纪律

- I1 消融：拔 `getArtifact` → dev server miss → 全走磁盘 → materialize 被 `!previewAdapter` 守卫跳过 → build artifacts 不在磁盘 → **404 回归**（须恢复后全绿）
- I2 消融（守卫）：拔 `skipMaterialize` 条件 → materialize 仍跑 → dev 路径写盘（不 404，但 R-MM1 退化）
- I2 消融（白名单）：拔 `PIPELINE_OPTION_KEYS` 中 `skipMaterialize` → `splitBuildOverrides` throw `TypeError: unknown keys skipMaterialize` → **dev 启动 crash**
- I5 消融：拔 `build:end` listener → rebuild 后 `state.buildModel` 过期 → dev server serve 旧产物（须恢复后全绿）
- 消融补丁不入最终提交
