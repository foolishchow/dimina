# Requirements — fe-tools-module-convergence

Status: **draft（2026-09-21）** — 伞级 MUST；子门细化自有 R-*。

## R-MC0（MUST）Graph 正确性

- graph 是 entry 的上级（创建 node、持有 files、追踪 dep edges）；convergence 前须确保 graph 正确且全面。
- **stale edge 清理**：`addDependency` 只增不删（M2 F15 已发现）；删了 `require` 后旧边残留——须补 `removeDependency` 或增量 rebuild 时清边。
- **stale node 清理**：删了 page/component 后 watch merge 不删 node——须补 node 清理或 merge 时 diff。
- **增量 closure 一致**：cache hit 跳过编译时，transitive dep 边不更新——须确保 cache hit 的模块仍用 cached dep list（M2 已用 `cached.logicDependencies` 解决 logic；graph 边须与之一致）。
- graph 是小程序维度的图（page/component/usingComponents），不是 fs module 维度——本伞不改变此定位，但须确保两层（声明层 + 编译发现层）一致。

## R-MC1（MUST）继承 module-centric 伞资产

- 承接 D-MF-1（方案 A；`moduleId = CompileInfo.path`；logic-only → 扩展 view）。
- 不复活旧 `fe-tools-module-cache` 的缩 scope 结论。
- `ModuleResultCache` 是 M2 交付的半步资产；本伞收敛它，不重写。

## R-MC2（MUST）GraphNode 成为 Module 宿主

- `GraphNode` 扩展字段：`code?: string`、`sourcemap?: string | null`、`deps?: Set<string>`。
- logic worker 编译结果回填 `node.code` / `node.sourcemap`（IPC snapshot 模式，沿用 M2 D-RC-3 I）。
- `ModuleResultCache` 退化为图 node 的 **session 覆盖层**（热路径 cache hit 不走 IPC；冷路径 fallback 全量重算）。
- cache hit 仍用 `cached.logicDependencies`（非 graph `getDirectDependencies`；stale edge 教训 F15 沿用）。

## R-MC3（MUST）view Module 入图

- view `scriptRes: Map<modulePath, code>` → graph node.code（view kind）。
- view `compileResCache` 退化为图 node 覆盖层。
- view Module 的 `deps`（component 依赖）入图边（`kind = 'component'`，已有）。

## R-MC4（MUST）BuildModel 从图派生

- entry → 遍历图 module → `EmitModule` → emit → BuildModel entry。
- `BuildModel.add` 散装 entries 退居兼容（或删除，视实施）。
- 派生路径产物字节与散装路径一致（行为 0）。

## R-MC5（MUST）行为 0

- 每个子门独立验证：nomap + sourcemap 产物 diff=0。
- 全量 vitest 绿。
- 仅加法 / 结构收敛；不改 emit 字符串 / transform 语义 / runtime id。

## Non-requirements

- fingerprint 下沉模块级（β；另门；依赖持久化决策）。
- Module.code 序列化持久（重启复用）；本伞 session-only α（沿用 M2 D-RC-2 α）。
- HMR patch 产物（另门）。
- 拆 `DependencyGraph` 结构表（不拆；仅扩字段）。
- 改 worker IPC 协议骨架（仅扩消息字段，不改调度/生命周期）。
