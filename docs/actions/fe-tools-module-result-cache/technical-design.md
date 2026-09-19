# Technical Design — fe-tools-module-result-cache

Status: **草案（2026-09-20）** — 设计待定项未冻；升 `ready` / 改 `src` 另授。

## 1. 继承

来自 [`fe-tools-module-centric` technical-design](../fe-tools-module-centric/technical-design.md) D-MF-1 / D-MF-2：

| # | 条款 |
| --- | --- |
| 2 | 方案 A：`moduleId` = logic `CompileInfo.path` |
| 3 | 仅 logic（M1 范围）；view/style 排除 |
| 5 | page 规范形迁移另门 |
| 6 | 新 API；不拆 node 表 |
| 7 | 不替换 `getAffectedEntries` |

D-MF-2：`DependencyGraph` 不挂 code；**M2 另定缓存宿主**。

## 2. 现状

| 资产 | 现状 |
| --- | --- |
| `buildJSByPath`（logic/index.ts） | 递归收集 `compileRes: CompileInfo[]`；无跨 rebuild 缓存 |
| `CompileInfo` | `{path, code, map, extraInfoCode}`；path = moduleId（方案 A） |
| `hasCompileInfo` | build 内去重（同次 build 不重编同模块）；跨 build 不保留 |
| M1 `computeInvalidatedModules` | 返回脏 moduleId 集；**无消费方** |
| 旧 [`fe-tools-module-cache`](../_archive/complete/fe-tools-module-cache/README.md) | 已归档；显式不做 logic `compileResCache` 内容寻址（D-MC-3 选项 B） |
| `ProjectStore` | 唯一活图权威；图序列化/恢复已有 |
| `compileResCache`（view） | view-compiler 失败缓存 + minify key（旧 module-cache 交付） |

## 3. 设计方向（待定）

### 3.1 缓存宿主（D-RC-1 待定）

| 选项 | 宿主 | 优势 | 劣势 |
| --- | --- | --- | --- |
| A | `ProjectStore` 内存 Map | 与图同生命周期；Store 已有序列化 | Store 膨胀；混图与编译结果 |
| B | 独立 `ModuleResultCache` 对象 | 职责清晰；可独立序列化 | 新对象；需接线 Store / worker |
| C | `compileRes` 直接挂图 node | D-MF-2 禁止 | — |

### 3.2 持久策略（D-RC-2 待定）

| 选项 | 范围 | 触发 |
| --- | --- | --- |
| α | session-only（watch 长驻） | 进程内跨 rebuild |
| β | 序列化持久（重启复用） | 跨进程；需 fingerprint 串 |

### 3.3 worker 回填（D-RC-3 待定）

| 选项 | 方式 | 代价 |
| --- | --- | --- |
| I | worker 编译结果 IPC 回填主线程 → 写缓存 | IPC 放大 |
| II | 主线程本地再算（单构建） | 无 IPC；但失去并行 |

### 3.4 失效触发（D-RC-4 待定）

- 谁调 `computeInvalidatedModules`？watch runner？build pipeline？
- 何时调？文件变更 → watch → 调失效 → 清缓存 → 增量 build？

## 4. 与现状的接口

| 资产 | 角色 |
| --- | --- |
| `model/dependency-graph.ts` | M1 `getInvalidatedModules` 已交付（M2 只消费） |
| `model/invalidation.ts` | M1 `computeInvalidatedModules` 已交付（M2 只消费） |
| `compiler/logic/index.ts` | `buildJSByPath` / `compileRes` — M2 接入点 |
| `ProjectStore` | 图权威；缓存宿主候选（选项 A） |
| `watch/watch-runner.ts` | 增量触发点 |

## 5. 明确不做

- view / style 结果缓存
- fingerprint 下沉模块级
- HMR patch 产物
- 改 `modDefine` / emit 字符串
- 拆图、PackerContext
- 复活旧 `fe-tools-module-cache` 的缩 scope（D-MF-3）

## 待定

- D-RC-1：缓存宿主（A/B/C）
- D-RC-2：持久策略（α/β）
- D-RC-3：worker 回填（I/II）
- D-RC-4：失效触发接线点

升 `ready` 前须全冻。
