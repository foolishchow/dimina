# Layout draft — target tree & ownership

Action: `fe-tools-bundler-layout`  
Status: naming + full ownership **ACCEPTED**；Action **ready**（D-BL-1..8）— 见 README  
Inventory basis: `fe/tools/bundler/src` @ 2026-09-12（~45 JS files；`common/` ≈ 30）

## Naming（ACCEPTED 2026-09-12）

| ID | Decision |
| --- | --- |
| **N1** | 预览实现目录 = **`dev/`** |
| **N2** | 原 `core/` → **`compiler/`** |
| **N3** | **L1** 允许 `common/x.js` re-export；**L2** 删除垫片 |

## Target tree（ACCEPTED）

```text
fe/tools/bundler/src/
  bin/
  session/             # resolve / createBundler / preview-adapter
  compiler/            # 原 core/ + publish/npm/expression-parser/stage-channel/
                       #   compile-stages/renderers/compatibility*/env(project)
  model/               # build-model / fingerprint / invalidation / dependency-graph /
                       #   compile-cache
  watch/               # watch-runner / watch-plan / worker-pool
  dev/                 # dev-server / host / proxy / reload / sdk-root
  shared/              # lifecycle / compile-config / platforms / path-utils /
                       #   utils / stat / compile-progress / art
  index.js             # 公开 build（留根）
  watch.js             # 公开 watch export（留根）
  env.js               # L1 垫片 → compiler/env.js（或 compiler/project.js）；L2 可只留垫片或改调用方后删除
  common/              # L1 仅垫片 → L2 清空移除
```

## Full ownership table（ACCEPTED）

轴：`path` × `build|dev|both` × `session|compiler|shared`

### session / bin / root

| File | Path | Product | Layer |
| --- | --- | --- | --- |
| `session/index.js` | session | both | session |
| `session/resolve.js` | session | both | session |
| `session/preview-adapter.js` | session | dev | session |
| `bin/*` | bin | by command | session 调用方 |
| `index.js` | （根） | build | — |
| `watch.js` | （根） | build | — |
| `env.js` | 根垫片 → **`compiler/env.js`**（实现） | build | compiler |

### compiler/（含原 core/）

| Today | → Home | Product | Layer |
| --- | --- | --- | --- |
| `core/view-compiler.js` 等 | `compiler/` | build | compiler |
| `core/index.js` | `compiler/` | build | compiler |
| `publish.js` | `compiler/` | build | compiler |
| `npm-builder.js` | `compiler/` | build | compiler |
| `npm-resolver.js` | `compiler/` | build | compiler |
| `expression-parser.js` | `compiler/` | build | compiler |
| `stage-channel.js` | `compiler/` | build | compiler |
| `compile-stages.js` | `compiler/` | build | compiler |
| `renderers.js` | `compiler/` | build | compiler |
| `compatibility.js` | `compiler/` | build | compiler |
| `compatibility-reference.js` | `compiler/` | build | compiler |
| `env.js`（实现） | `compiler/env.js` | build | compiler |

### model/

| Today | → Home | Product | Layer |
| --- | --- | --- | --- |
| `build-model.js` | `model/` | build | compiler |
| `fingerprint.js` | `model/` | build | compiler |
| `invalidation.js` | `model/` | build | compiler |
| `dependency-graph.js` | `model/` | build | compiler |
| `compile-cache.js` | `model/` | build | compiler |

### watch/

| Today | → Home | Product | Layer |
| --- | --- | --- | --- |
| `watch-runner.js` | `watch/` | build | compiler |
| `watch-plan.js` | `watch/` | build | compiler |
| `worker-pool.js` | `watch/` | build | compiler |

### dev/

| Today | → Home | Product | Layer |
| --- | --- | --- | --- |
| `dev-server.js` | `dev/` | dev | （实现层，非 session） |
| `dev-host.js` | `dev/` | dev | — |
| `dev-proxy.js` | `dev/` | dev | — |
| `dev-reload.js` | `dev/` | dev | — |
| `sdk-root.js` | `dev/` | dev | — |

### shared/

| Today | → Home | Product | Layer |
| --- | --- | --- | --- |
| `compile-config.js` | `shared/` | both | shared |
| `lifecycle.js` | `shared/` | both | shared |
| `platforms.js` | `shared/` | both | shared |
| `path-utils.js` | `shared/` | both | shared |
| `utils.js` | `shared/` | both | shared |
| `stat.js` | `shared/` | both | shared |
| `compile-progress.js` | `shared/` | build | shared |
| `art.js` | `shared/` | build | shared |

### Batch-2 decisions log

| ID | Decision |
| --- | --- |
| O1 | `stage-channel` → **`compiler/`** |
| O2 | `worker-pool` → **`watch/`** |
| O3 | `env` 实现 → **`compiler/env.js`**；根 `env.js` L1 垫片 |
| O4 | `compile-stages` → **`compiler/`** |
| O5 | `renderers` → **`compiler/`** |
| O6 | compatibility* → **`compiler/`**；`compile-cache` → **`model/`**；`compile-progress` / `art` → **`shared/`** |

## Implementation notes（未实施）

- **L1 试点簇**：`dev/`（D-BL-5）  
- 文件名：`compiler/env.js`（根 L1 垫片）  
- 本门不抽 `runBuild` 控制流（D-BL-8）

## Relation to other work

| Topic | Relation |
| --- | --- |
| TS-2 IR | deferred |
| runBuild 阶段化 | 另 Action |
| session | 不扩大职责 |
