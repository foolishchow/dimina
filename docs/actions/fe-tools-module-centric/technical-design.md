# Technical Design — fe-tools-module-centric

Status: **ready（2026-09-19）** — 伞级决策冻结；子门详细设计另文。**D-MF-1 已封口**。本伞 `ready` **不**授权改 src；formalize / 实施 M1 另授。

## 1. 北星

成熟 Packer 模型（对照，非照搬）：

```text
文件变更 → 脏 Module → 重 transform → 受影响 chunk/产物
```

Dimina 近端落地为：

```text
文件变更 → getInvalidatedModules(moduleId 集)   // logic Module only（M1）
        → 清 Module 结果缓存 → 只重编脏模块 → emit 重组
        ↘（可选）投影到 entryId → 现有页级计划仍可用
```

Scheme 仍负责：编哪些页、车道、何时调用上述能力。

## 2. 两层身份（已冻结）

| 层 | 标识 | 含义 | 归属 |
| --- | --- | --- | --- |
| **Entry** | `entryId` | 小程序 path（`pages/…`、`app`、组件 path 等） | Scheme：构图入口、发布哪些页 |
| **Module** | `moduleId` | 可变换单位；M1 范围 = **logic** fs 模块 | Packer / 失效 / 缓存 / emit |

- **小程序 path 只是 Entry，不是 Module。**
- 真管理的是 **fs Module**；不得用「受影响页」冒充模块级失效。
- `getAffectedEntries` = Entry 投影；刀 2 产出 **Module 集**，Entry 仅可选下游。

### 侦察结论（背景，已吸收进 D-MF-1）

| 来源 | 现状 | 备注 |
| --- | --- | --- |
| 图 node | 混用：`entry: true` 的 page path（多无前导 `/`）+ logic 的 `/…` 依赖 id | 两层焊在同一张 `nodes` 表；M1 不拆表 |
| `fileOwners` | 绝对路径 → owner id 集 | owner 可能是 Entry 或 Module；刀 2 须按 logic 过滤 |
| logic `CompileInfo.path` / emit `moduleId` | 即 `m.path`；依赖侧经 `normalizeModuleId` | logic→emit **无第二套转换** |
| **概念债** | **page.js 用无 `/` 的 path 当 moduleId**（与 `entryId` 字符串重合） | 记为债；**不进 M1 迁移** |

## 3. 决策

| ID | 决策 | 阻塞 ready？ |
| --- | --- | --- |
| **D-MF-1** | **已封口（2026-09-19）** — 见下节 | **否**（已封） |
| **D-MF-2** | **图职责**：`DependencyGraph` 继续持有节点/边/fileOwners；本阶段不强制把 code 挂进图节点。M1 只增加**模块级失效查询**；M2 另定缓存宿主 | 否 |
| **D-MF-3** | **子门 ID 预留**：M1 = `fe-tools-module-invalidation`（刀 2）；M2 = `fe-tools-module-result-cache`（刀 3）。可选 M0 = emit W1 参数化（另名另立）。旧 `fe-tools-module-cache` 不复用 | 否 |
| **D-MF-4** | **伞纪律**：子门升降级不自动改变本伞 status（对齐历史 RR12） | 否 |

### D-MF-1 封口条款

| # | 条款 | 决议 |
| --- | --- | --- |
| 1 | **两层** | `entryId` ≠ `moduleId`（概念分家；字符串今日可重合，见条款 2） |
| 2 | **M1 线上 moduleId** | **方案 A**：失效 / 缓存键 / API 返回值 = **今日 logic `CompileInfo.path`（= emit `moduleId`）**。页入口无 `/`、依赖有 `/` —— 双形保留，**不改 emit / runtime** |
| 3 | **刀 2 返回集** | **仅 logic Module**（对该变更文件存在 `kind=logic` 的 file 边之 owner，再沿 **logic** `dependents` 闭包）。**不**含 view `scriptRes` key、**不**把仅 view/style/config 挂接的 Entry 当 Module。闭包过滤、与 `getAffectedEntries` / `computeAffectedEntries` 的分工伪代码 → **M1 `technical-design`**（本伞不写实施级算法） |
| 4 | **view / style** | **第一刀排除**；仍经 Entry 多文件 + 车道 kind / `getAffectedEntries`。独立 view Module 图另议 |
| 5 | **page 入口规范形迁移** | 统一为 `normalizeModuleId`（带 `/`）属 **另立迁移门**；**不阻塞 M1**；方案 C（连 runtime 改）禁止塞进刀 2 |
| 6 | **图 API** | M1 = **文档约定 + 新查询 API**（如 `getInvalidatedModules`）；**不**拆 node 表、不强制 metadata 分型 |
| 7 | **与 Entry API** | **不**替换 / 伪装 `getAffectedEntries`；Entry 投影可另返或调用方自组 |

**明确不做（D-MF-1 范围）**：方案 B 强制内部别名表（非默认）；方案 C；view/style Module 图；拆 `DependencyGraph` 结构。

**M1 承接（非本伞阻塞）**：`getInvalidatedModules` 精确签名、空/未知文件、logic 闭包边界、单测矩阵 — 在子门 `fe-tools-module-invalidation` 的 technical-design 成文后再实施。

## 4. 与现状的接口

| 资产 | 角色 |
| --- | --- |
| `model/dependency-graph.ts` | 焊点；M1 在此（或紧邻）暴露模块级失效 API |
| `getAffectedEntries` | Scheme **Entry** 级；保留 |
| emit `{moduleId, code, map}` | 与条款 2 对齐：logic 侧 = `CompileInfo.path`；M2 守约 |
| ProjectStore | 图权威入口；M2 若缓存挂主线程，经 Store 边界讨论，本伞不预支 |

## 5. 明确不做的设计

- PackerContext 落地 / 拆 env / 拆 logic
- 统一 Module 大对象一次性替换 compileRes/scriptRes
- 把 view/style 收成 Packer 插件
- 在 M1 迁移 page `moduleId` 规范形或改 `modDefine` 字符串

## 待定

伞级无。子门 M1 见 [`fe-tools-module-invalidation`](../_archive/complete/fe-tools-module-invalidation/technical-design.md) T1–T7。
