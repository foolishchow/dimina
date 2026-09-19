# FE Tools Bundler Emit Memfs

- Action: `fe-tools-bundler-emit-memfs`
- Status: `ready`
- Updated: 2026-09-20
- Status authority: [Action Status](../STATUS.md)
- 前置依赖：[`fe-tools-worker-runtime`](../_archive/complete/fe-tools-worker-runtime/README.md)（worker-runtime 后 emitEntry sink.write→PostMessageSink→主线程 materialize 写盘，materialize 成唯一写盘点；原 output-pure 已 superseded 被 worker-runtime 包含）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

阶段 1（output-pure）完成后，worker 侧彻底无 fs，写盘 100% 收敛到主线程 `materialize`（build-model.ts）。但 dev 模式产物仍落盘：

```text
dev 模式：worker → postEntry → BuildModel.add → materialize 写盘 → dev server fs.readFile(serveRoot) 读盘 serve
                                                ^^^^^^^^^^^^^^                ^^^^^^^^^^^^^^^^^^
                                                唯一写盘点                     从盘读
```

### 病症（P-MM1）：dev 模式产物落盘往返

- `materialize`（build-pipeline L195）把 BuildModel.entries 刷盘到 targetPath
- dev server（dev-server.ts L155 路径解析 → L173 `fs.readFile`）`fs.readFile(serveRoot=targetPath/...)` 从盘读产物 serve
- 真机/热更新延迟来自落盘 + 读盘往返；BuildModel.entries 本身已是内存 Map，却要先落盘再读盘

## Goal（阶段 2：dev memfs）

dev 模式产物不落盘——dev server 从内存直读产物。

### 拍板结果（D-MM-1..6 冻结 v1）

- **D-MM-1 = 方案 1（直读 BuildModel）**：dev server 优先读 `BuildModel.getArtifact(path)`；miss → 磁盘 fallback；`materialize` dev 跳过。零新依赖；~50 行。
- **D-MM-2 = 漏网点收口**：仅 `materialize` dev 跳过；`createDist` / `compileConfig` / `collectAssets` / `publishToDist` 均保留（冷路径写盘）。
- **D-MM-3 = cache 的家不耦合**：BuildModel 已在主线程；ModuleCache（刀 3）另立。
- **D-MM-4 = `BuildModel.getArtifact` API**：lazy 构建 `Map<filePath, { code }>` 反查索引；`add()` 失效。
- **D-MM-5 = dev server `artifactResolver` 注入**：可选 callback；serveRoot 读取前先试 resolver（已剥 appId 前缀）；miss → 原有 `fs.readFile` fallback。
- **D-MM-6 = BuildModel 传递路径**：pipeline 返回值加 `buildModel`；session 初始从 `watcher.start()` 取、rebuild 从 `build:end` listener 取。

详见 [technical-design](technical-design.md)。

## Non-goals

- 阶段 1 worker 无 fs（output-pure / worker-runtime 已完成）
- cache（刀 3 ModuleCache）实现 + 目录归置——依赖 cache 家拍板，另立
- 刀 2 失效查询——独立先行
