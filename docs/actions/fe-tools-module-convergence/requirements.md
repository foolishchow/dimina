# Requirements — fe-tools-module-convergence

Status: **draft（2026-09-21）** — 伞级 MUST；子门细化自有 R-*。

## R-MC0（MUST）继承 module-centric 伞资产

- 承接 D-MF-1（方案 A；`moduleId = CompileInfo.path`；logic-only → 扩展 view）。
- 不复活旧 `fe-tools-module-cache` 的缩 scope 结论。
- `ModuleResultCache` 是 M2 交付的半步资产；本伞收敛它，不重写。

## R-MC1（MUST）GraphNode 成为 Module 宿主

- `GraphNode` 扩展字段：`code?: string`、`sourcemap?: string | null`、`deps?: Set<string>`。
- logic worker 编译结果回填 `node.code` / `node.sourcemap`（IPC snapshot 模式，沿用 M2 D-RC-3 I）。
- `ModuleResultCache` 退化为图 node 的 **session 覆盖层**（热路径 cache hit 不走 IPC；冷路径 fallback 全量重算）。
- cache hit 仍用 `cached.logicDependencies`（非 graph `getDirectDependencies`；stale edge 教训 F15 沿用）。

## R-MC2（MUST）view Module 入图

- view `scriptRes: Map<modulePath, code>` → graph node.code（view kind）。
- view `compileResCache` 退化为图 node 覆盖层。
- view Module 的 `deps`（component 依赖）入图边（`kind = 'component'`，已有）。

## R-MC3（MUST）BuildModel 从图派生

- entry → 遍历图 module → `EmitModule` → emit → BuildModel entry。
- `BuildModel.add` 散装 entries 退居兼容（或删除，视实施）。
- 派生路径产物字节与散装路径一致（行为 0）。

## R-MC4（MUST）行为 0

- 每个子门独立验证：nomap + sourcemap 产物 diff=0。
- 全量 vitest 绿。
- 仅加法 / 结构收敛；不改 emit 字符串 / transform 语义 / runtime id。

## Non-requirements

- fingerprint 下沉模块级（β；另门；依赖持久化决策）。
- Module.code 序列化持久（重启复用）；本伞 session-only α（沿用 M2 D-RC-2 α）。
- HMR patch 产物（另门）。
- 拆 `DependencyGraph` 结构表（不拆；仅扩字段）。
- 改 worker IPC 协议骨架（仅扩消息字段，不改调度/生命周期）。
