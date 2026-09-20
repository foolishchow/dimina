# Requirements — fe-tools-module-convergence

Status: **draft（2026-09-21）** — 伞级 MUST；子门细化自有 R-*。

## R-MC0（MUST）Graph 正确性

- graph 是 entry 的上级（创建 node、持有 files、追踪 dep edges）；Packer 前须确保 graph 正确且全面。
- **stale edge 清理**：`addDependency` 只增不删（M2 F15 已发现）；须补 `removeDependency` 或增量 rebuild 时清边。
- **stale node 清理**：watch merge 不删 node（storeInfo 全量重建才清）；须补 node 清理或 merge 时 diff。
- **增量 closure 一致**：cache hit 跳过编译时，transitive dep 边不更新；须确保 cache hit 的模块仍用 cached dep list（M2 已用 `cached.logicDependencies` 解决 logic；graph 边须与之一致）。
- graph 是小程序维度的图（page/component/usingComponents），不是 fs module 维度——GraphNode 管结构，ModuleResult 管内容。

## R-MC1（MUST）继承 module-centric 伞资产

- 承接 D-MF-1（方案 A；`moduleId = CompileInfo.path`）。
- 不复活旧 `fe-tools-module-cache` 的缩 scope 结论。
- `ModuleResultCache` 是 M2 交付的半步资产；本伞不动它（D-MC-0 选 A：code 不上图）。

## R-MC2（MUST）deriveFromGraph 函数

- 创建 `deriveFromGraph(graph, cache, entryId)` 函数：entry → 遍历 GraphNode 依赖闭包 → 取 module 集 → 从 ModuleResult 取 code → 返回 `[EmitModule]`。
- **只读**：不改 graph、不改 cache、不碰 emit/transform/bundle。
- Packer 核心形状：`entry → graph → modules → code → [EmitModule]`。
- 不替代 streaming emit（MC3b deferred）；MC3a 是独立新增函数。

## R-MC3（MUST）行为 0

- 每个子门独立验证：nomap + sourcemap 产物 diff=0。
- 全量 vitest 绿。
- 仅加法 / 结构修正；不改 emit 字符串 / transform 语义 / runtime id。

## Non-requirements

- code 上图（D-MC-0 选 A；D-MF-2 不推翻）。
- 搬 emit/transform/bundle 到主线程（MC3b；deferred）。
- view/style 在派生路径中的处理（MC3c；deferred）。
- fingerprint 下沉模块级（β；另门）。
- Module.code 序列化持久（session-only α 沿用 M2）。
- HMR patch 产物（另门）。
- 整包 Packer 抽取（packer-research 已否决）。
