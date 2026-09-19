# Requirements — fe-tools-bundler-emit-memfs

Status: **ready（2026-09-20）** — D-MM-1..6 全拍板，冻结 v1

## R-MM1（MUST）dev 模式产物不落盘

dev 模式下，BuildModel.entries 持有的编译产物（view/logic/style code + sourcemaps）不得落盘。dev server 须从内存直读产物。

**当前病症（P-MM1）**：`materialize`（build-pipeline L195）把 BuildModel.entries 刷盘到 `getTargetPath()`；dev server（dev-server L155 路径解析 → L173 `fs.readFile`）从盘读产物 serve——BuildModel.entries 本身已是内存 Map，却先落盘再读盘。

## R-MM2（MUST）冷路径保留写盘

以下产物**不在** BuildModel 中，dev 模式仍须写盘（dev server 磁盘 fallback）：

- `app-config.json`（config-compiler L70 `fs.writeFileSync`）
- tabBar icons（`collectAssets` → `fs.copyFileSync`，binary 资源）
- `createDist` + `publishToDist` 须保留（为冷路径建目录 + move）

SDK 资产（`/sdk/` 路径）不受本门影响（sdkRoot 磁盘读不变）。

## R-MM3（MUST）行为 0

- dev 模式 HTTP 响应字节不变：dev server 从内存读与从磁盘读产出完全一致的字节流（含 Content-Type、body）；
- compile 模式（`build()` one-shot）不受影响：`skipMaterialize` 仅 dev watch 路径生效；
- tools/bundler 全量 vitest 绿。

## R-MM4（MUST）零新依赖

不引入 memfs 或其他新 npm 包；方案 1 直读 BuildModel 的 `Map<string, {code}>` 反查索引。

## R-MM5（MUST）rebuild 后 dev server 用最新 BuildModel

watch rebuild 后，dev server 须从最新 BuildModel 读取产物（不是旧快照）。

## Non-goals

- 阶段 1 worker 无 fs（output-pure / worker-runtime 已完成）
- cache（刀 3 ModuleCache）实现 + 目录归置——依赖 cache 家拍板，另立（D-MM-3 声明不耦合）
- 刀 2 失效查询——独立先行
- `publishToDist` 改造——保留原样（dev 仍 move 冷路径产物）
- `config-compiler` 改造——保留原样（仍写盘 app-config.json）
