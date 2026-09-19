# Technical Design — fe-tools-bundler-emit-memfs

Status: **冻结 v1（2026-09-20）** — 升 `ready`

## 1. 方案选择

| 方案 | 做法 | 优 | 劣 | 决策 |
| --- | --- | --- | --- | --- |
| **1（直读 BuildModel）** | dev server `getArtifact(path)` 从 BuildModel 反查索引取 code；`materialize` dev 跳过 | 零新依赖；~50 行；无双份内存 | 需 path→code 反查索引 + appId prefix strip | **D-MM-1 ✓** |
| 2（memfs Volume） | `materialize` 写 memfs Volume；dev server fs 换 memfs 后端 | dev server 逻辑不动 | memfs 依赖 + BuildModel/memfs 双份内存冗余 | 否决 |

## 2. 决策

| ID | 决策 | 依据 |
| --- | --- | --- |
| **D-MM-1** | 方案 = **1（直读 BuildModel）** — dev server 优先读 `BuildModel.getArtifact(path)`；miss → 磁盘 fallback；`materialize` dev 跳过 | 零新依赖（R-MM4）；BuildModel 已是内存 Map；冷路径保留写盘（R-MM2） |
| **D-MM-2** | 漏网点收口：**仅 `materialize` dev 跳过**；`createDist` / `compileConfig` / `collectAssets` / `publishToDist` 均保留不动 | 冷路径（app-config.json + tabBar icons）量小改动少；`publishToDist` 须 move 冷路径到 `serveRoot/appId` 供 dev server fallback |
| **D-MM-3** | cache 的家 = **不耦合** — BuildModel 已在主线程；dev server 直读 `state.buildModel`；ModuleCache（刀 3）另立 | 本门不涉及 ModuleCache；BuildModel 经 `buildResult` + `build:end` lifecycle 传递（D-MM-6） |
| **D-MM-4** | `BuildModel.getArtifact(relativePath)` API — lazy 构建 `Map<filePath, { code: string }>` 反查索引（`entries` → `files[].path` + `sourcemaps[].path`）；`add()` 失效索引 | O(1) 查询；惰性构建不浪费（compile 模式不调 `getArtifact`） |
| **D-MM-5** | dev server 注入 `artifactResolver?: (relativePath: string) => { code: string } \| null` — serveRoot 读取前先试 resolver；resolver 收到的 path **已剥 appId 前缀**；miss → 原有 `fs.readFile` fallback | dev server 改动最小；appId strip 在 dev server 内（已有 `appId` 引用） |
| **D-MM-6** | BuildModel 传递路径 = **`buildResult.buildModel` + `build:end` lifecycle listener** — pipeline 返回值加 `buildModel: ctx.buildModel`；session 初始 build 从 `watcher.start()` 返回值取；rebuild 从 `build:end` event payload `result.buildModel` 取并更新 `state.buildModel` | 初始 build 的 `build:end` 在 `watcher.start()` 内同步发，listener 尚未挂载——须从返回值取初始值；rebuild 的 `build:end` 在 watch-runner 内发，listener 已挂载 |

## 3. 当前 dev 模式写盘点全景

| # | 写盘者 | 位置 | 写什么 | 本门处理 |
| --- | --- | --- | --- | --- |
| W1 | `createDist` | publish.ts L21 → build-pipeline L136 | 建空目录 + seed 拷贝 | **保留**（冷路径目录） |
| W2 | `compileConfig` | config-compiler.ts L67-70 | `app-config.json` | **保留**（冷路径） |
| W3 | `collectAssets` | utils.ts L100 → config-compiler `processTabBarIcons` | tabBar icons (binary) | **保留**（冷路径 binary） |
| W4 | `materialize` | build-model.ts L48 → build-pipeline L195 | BuildModel.entries (view/logic/style code + sourcemaps) | **dev 跳过** |
| W5 | `publishToDist` | publish.ts L36 → build-pipeline L196 | move/copy `getTargetPath()` → `targetPath/appId` | **保留**（move 冷路径） |

dev server 读盘点：

| 路径 | 来源 | 本门处理 |
| --- | --- | --- |
| `/` `/index.html` | 内置 hostHtml | 不变 |
| `/pageFrame.html` | 内置 pageFrameHtml | 不变 |
| `/sdk/**` | `sdkRoot` 磁盘 | 不变 |
| 其他 | `serveRoot` 磁盘（`resolveContainedPath(serveRoot, pathname.slice(1))`） | **先试 `artifactResolver(strippedPath)`；miss → 磁盘 fallback** |

## 4. BuildModel.getArtifact API（D-MM-4）

```ts
// build-model.ts
export class BuildModel {
    entries: Map<string, { entryId, kind, files: { path, code }[], sourcemaps?: { path, map }[] }>
    private _artifactIndex: Map<string, { code: string }> | null = null

    add(entry) {
        // ... 原有逻辑
        this._artifactIndex = null  // 失效
    }

    /** 按相对发布根路径查产物 code。仅 dev 路径调；compile 路径不调。 */
    getArtifact(relativePath: string): { code: string } | undefined {
        if (!this._artifactIndex) {
            this._artifactIndex = new Map()
            for (const entry of this.entries.values()) {
                for (const file of entry.files ?? []) {
                    this._artifactIndex.set(file.path, { code: file.code })
                }
                for (const sm of entry.sourcemaps ?? []) {
                    this._artifactIndex.set(sm.path, { code: String(sm.map) })
                }
            }
        }
        return this._artifactIndex.get(relativePath)
    }
}
```

**字节等价前提**：`getArtifact` 返回的 `code` 与 `materialize` 写盘的 `file.code` / `String(map.map)` 完全一致（同一数据源，无转换）。

## 5. dev server artifactResolver 注入（D-MM-5）

```ts
// dev-server.ts
export function createDevServer({
    serveRoot, sdkRoot, appId,
    wsPath, hostHtml, pageFrameHtml, allowedOrigins,
    artifactResolver,  // ← 新增（可选）
}: {
    // ... 原有
    artifactResolver?: (relativePath: string) => { code: string } | null
}) {
    // ... 在 handleHttpRequest 的 serveRoot 分支:
    // 1. relativePath = pathname.slice(1)  // e.g. "wx123/main/logic.js"
    // 2. artifactPath = stripAppIdPrefix(relativePath, appId)  // "main/logic.js"
    // 3. artifact = artifactResolver?.(artifactPath)
    // 4. if (artifact) → writeStatic(response, artifact.code, contentType, headOnly)
    // 5. else → 原有 fs.promises.readFile fallback
}

function stripAppIdPrefix(relativePath: string, appId: string): string {
    const prefix = `${appId}/`
    return relativePath.startsWith(prefix) ? relativePath.slice(prefix.length) : relativePath
}
```

**appId strip 语义**：`publishToDist` 以 `useAppIdDir=true` 在 `serveRoot` 下建 `appId/` 子目录。dev server URL 路径含 appId 前缀（`/wx123/main/logic.js`）；BuildModel entries 的 `file.path` 不含 appId 前缀（`main/logic.js`，相对发布根）。strip 使两者对齐。

**fallback 语义**：miss（`app-config.json`、tabBar icons、无 `artifactResolver` 时）走原 `fs.readFile` 路径——文件在 `serveRoot/appId/` 已由 `publishToDist` move 到位。

## 6. BuildModel 传递路径（D-MM-6）

### pipeline 返回值增字段

```ts
// build-pipeline.ts _runBuild 返回值:
const result = {
    appId: ...,
    name: getAppName(),
    path: ...,
    dependencyGraph: ...,
    buildModel: (context as { buildModel?: BuildModel }).buildModel,  // ← 新增
}
await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_END, { result, ... })
return result
```

### session dev() wiring

```ts
// session/index.ts dev():
const buildResult = await watcher.start()
state.buildModel = (buildResult as { buildModel?: BuildModel }).buildModel  // 初始

await adapter.createServer({
    serveRoot: state.targetPath,
    appId: buildResult.appId,
    artifactResolver: (path: string) => state.buildModel?.getArtifact(path) ?? null,  // ← 注入
})

// lifecycle listeners（在 watcher.listen() 前挂）:
state.lifecycle.on('build:end', ({ result }) => {
    state.buildModel = (result as { buildModel?: BuildModel }).buildModel  // rebuild 更新
})
```

**时序保证**：`watcher.start()` 内初始 build 的 `build:end` 同步发，listener 尚未挂——初始值从返回值取。rebuild 的 `build:end` 在 `watcher.listen()` 后（file change 触发），listener 已挂——rebuild 值从 event 取。

### SessionState 增字段

```ts
// session/index.ts
export interface SessionState {
    // ... 原有
    buildModel?: BuildModel  // ← 新增（dev 路径专用）
}
```

### watch options 增 skipMaterialize

```ts
// session/index.ts dev():
const watcher = session.watch({
    options: {
        fileTypes: state.fileTypes,
        skipMaterialize: !previewAdapter,  // ← 新增：仅用默认 adapter 时跳过
    },
})
```

```ts
// build-pipeline.ts _runBuild:
const { ..., skipMaterialize } = runOptions
// ...
// "写入编译产物" task:
if (!skipMaterialize) {
    materialize(ctx.buildModel, getTargetPath())
}
publishToDist(targetPath, useAppIdDir)  // 保留（move 冷路径）
```

**`PIPELINE_OPTION_KEYS` 须加 `skipMaterialize`**：`session.watch()` 内调 `composeOptions()` → `splitBuildOverrides()`，后者对非白名单键 **throw TypeError**（非静默丢弃）。须在 `runner.ts` 的 `PIPELINE_OPTION_KEYS` 末尾加 `'skipMaterialize'`。one-shot `build()` 不传 `skipMaterialize`，默认 `undefined`（falsy）→ 不跳过。

**自定义 adapter 守卫**：`skipMaterialize: !previewAdapter` —— 仅当用户未提供自定义 adapter（用默认 `createWebPreviewAdapter`）时才跳过 materialize。自定义 adapter 可能不透传 `artifactResolver`（TypeScript 结构类型允许：可选参数可被忽略），此时 dev server 无 resolver → 若 `skipMaterialize` 仍为 `true` 则 build artifacts 不在磁盘也不在内存 → **404 回归**。`!previewAdapter` 守卫确保自定义 adapter 路径下 materialize 仍跑（dev server 从磁盘读，行为同今天）。

## 7. preview-adapter 透传

```ts
// preview-adapter.ts
async createServer({ serveRoot, appId, artifactResolver }: {
    serveRoot: string; appId: string
    artifactResolver?: (relativePath: string) => { code: string } | null  // ← 新增
}) {
    state.devServer = createDevServer({
        serveRoot, sdkRoot: resolveSdkRoot(), appId, wsPath: '/ws',
        artifactResolver,  // ← 透传
    })
}
```

**自定义 previewAdapter 兼容**：`skipMaterialize` 设为 `!previewAdapter`（仅用默认 adapter 时跳过）。用户提供自定义 adapter 时 `skipMaterialize = false` → materialize 仍跑 → dev server 从磁盘读 → **行为同今天**（无回归）。自定义 adapter 欲启用 memfs 须走 `session.watch()` 直调（绕过 `dev()` 便捷入口）+ 手动创建 dev server，在 `watch({ options: { skipMaterialize: true } })` 中显式传入；`DevOpts` 为封闭接口（unknown keys throw），不支持通过 `dev()` 传入 `skipMaterialize`。

## 8. 行为 0 等价性分析

| 维度 | 磁盘读（今天） | 内存读（本门） | 等价 |
| --- | --- | --- | --- |
| body 字节 | `fs.readFile` → `Buffer` → `writeStatic(response, Buffer, ...)` → `response.write(body)` + `response.end()` | `artifact.code`（`string`）→ `writeStatic(response, string, ...)` → `response.write(body)` + `response.end()` | ✓ 两条路径共用同一 `writeStatic` 函数；`response.write` 对 `Buffer`/`string` 均按 UTF-8 发字节 |
| Content-Type | `MIME_TYPES[extname]` | 同（仍按 `pathname` ext 取） | ✓ |
| Cache-Control | `no-cache` | `no-cache`（`writeStatic` 不变） | ✓ |
| 404 | `fs.stat` 抛 → `writeJson(404)` | resolver miss + `fs.stat` miss → `writeJson(404)` | ✓ |
| HEAD | `stats.isFile()` → `writeHead(200)` → `end()` | resolver hit → `writeStatic(..., headOnly=true)` → `end()` | ✓（HEAD 语义一致） |

**sourcemap**：`materialize` 写 `String(map.map)`；`getArtifact` 返回 `String(map.map)` — 同源同转换。✓

**binary（icons）**：不走 `artifactResolver`（不在 BuildModel），走 `fs.readFile` → `Buffer`。✓
