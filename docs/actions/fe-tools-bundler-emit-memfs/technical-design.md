# Technical Design — fe-tools-bundler-emit-memfs

Status: **draft（立项 · 2026-09-16）** — 拍板链未走完；方案候选待选。

## 1. 产物面现状锚定（实证 · 刀 1 完成后）

| 出口 | 文件 | 侧 | 管什么 | 收口？ |
| --- | --- | --- | --- | --- |
| `output.write` | pipeline/output.js | worker | view/logic/style code+map | ✅ 刀 1 |
| `materialize` | model/build-model.js:52/57 | 主线程 | BuildModel.entries 刷盘 | ❌ |
| `app-config.json` 直写 | pipeline/config-compiler.js:67 | 主线程 | 配置产物 | ❌ |
| `publishToDist` | pipeline/publish.js:16 | 主线程 | 发布 copy | ❌ |

两层互补：dev（collectOutput=true）worker postMessage → BuildModel → materialize 刷盘；build（collectOutput=false）worker 直 output.write 写盘，materialize no-op。

## 2. memfs 方案候选

### 方案 1（推荐）：dev server 直读 BuildModel

- BuildModel.entries 已是内存 Map（`Map<kind:id, entry>`）——memfs 数据源已存在
- materialize dev 模式跳过（build-pipeline L181 加 collectOutput 分支）
- dev server `resolveArtifact(pathname)` 从 BuildModel 查（建 path→{code} 反查索引）
- 零新依赖；~50 行
- 改动：materialize（build-pipeline L181）+ dev server（dev-server L150-168）+ BuildModel（path 反查）

### 方案 2：memfs Volume 后端

- materialize 写 memfs Volume；dev server fs 换 memfs 后端
- dev server 逻辑不动（还是 readFile），只换后端
- 引入 memfs 依赖；BuildModel.entries + memfs 双份内存冗余

## 3. cache 的「家」候选（仅拍板）

| 候选 | 家 | cache.js 落 | 目录归置 |
| --- | --- | --- | --- |
| A | 主线程 ProjectStore 侧 | `model/` | 产物面横跨 compiler+model，不硬聚 |
| B | worker 内跨任务保留 | `compiler/` | emit+output+cache 聚 `compiler/emit/` |

## 4. 目录归置候选

- 现状：emit.js + output.js 在 `compiler/pipeline/`（与编排面混着）
- 候选 A：出 `compiler/emit/`（若 cache 落 worker，产物面文件≥3 聚合合理）
- 候选 B：保持 `compiler/pipeline/`（若 cache 落主线程，2 文件不硬聚）
- 决策依赖拍板链第 1 步（cache 家）

## 5. 拍板链

1. cache 的「家」→ 2. memfs 方案 → 3. 目录归置 → 4. 漏网点收口范围

拍板后回填 R-MM0..3 编号与方案选定。
