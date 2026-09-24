# Design Draft — fe-tools-hmr-per-module-cache

> 设计草稿。D-PMC-1/2/3 锁后产出 technical-design。

Status: **draft（2026-10-09）**

## §1 bundle 重建策略（D-PMC-1 = D-HMR-4）

### §1.1 G5 P-G506 先例

G5 原设计：per-module cache + `graph.getDirectDependencies(page,'component')` 重建 bundle 序。**实证不可行**：
- graph 'component' 边仅 direct 非 transitive
- 不含 wxs modules
- 序不一致
→ cache-hit bundle 缺内容（base/pages_index.js b1=10525 vs b2=3049 字节）

G5 反转 D-G5-4' per-page-bundle（存原序 bundle，cache-hit 直接 re-emit）。

### §1.2 H3 须不同策略

per-module 反转需重建 bundle 序。**不能**用 graph 重建（P-G506）。D-HMR-4 两选项：

**选项 ① stored order metadata**：
- per-module 存储 + 显式序元数据（存 order list，非 graph 派生）
- cache 存 `Map<moduleId, ViewCompiledModule>` + `Map<pageId, moduleId[]>`（order list）
- emit 时按 order list 重建 bundle
- **序来源**：首次 viewParseWalk 时的 module 序（存入 order list）
- **⚠️ F1 补：现有结构可 leverage**——`ViewCompileMLResult.pageBundles: Array<{pagePath, modules: ViewCompiledModule[]}>`（view/index.ts:68）已是 per-page 有序 module list。H3 可 split：per-module cache（`Map<moduleId, ViewCompiledModule>`）+ 保留 pageBundles 作 order list（`pagePath → moduleId[]`）。非全新建——重构现有 pageBundles。

**选项 ② compile/emit 粒度解耦**：
- per-module compile（cache 按 moduleId）
- per-page-bundle emit（emit 时聚合 per-module → bundle）
- emit 粒度保留 per-page-bundle（不走 per-module emit）
- **序来源**：emit 时按 page 的 component 依赖序（但 P-G506 不可行？）

### §1.3 D-PMC-1 推荐

**推荐选项 ①（stored order metadata）**——序显式存储（非 graph 派生），避开 P-G506。
- order list = 首次 viewParseWalk 的 module 序（确定性）
- cache-hit 时按 order list 重建（同集同序 → 字节一致）
- invalidation：单 module dirty → 单 module cache-miss，order list 不变（除非 page 结构变）

---

## §2 invalidation 粒度（D-PMC-2）

### §2.1 G5 per-page-bundle invalidation

G5：bundle 内任一 module moduleId ∈ invalidated → cache-miss 全量 viewParseWalk。

### §2.2 H3 per-module invalidation

per-module cache：单 module dirty → 单 module cache-miss（delete cache.get(moduleId)）。
- order list 不变（除非 page 结构变——增删 component）
- emit 时按 order list 聚合 per-module cache → bundle（cache-hit module 直接用，cache-miss module recompile）

### §2.3 D-PMC-2 design gate

page 结构变（增删 component）→ order list 失效 → 全量 viewParseWalk 重建 order list。
**待实证**：page 结构变频率 + order list 失效边界。

---

## §3 watch 字节恒等（D-PMC-3）

### §3.1 风险

per-module 派生须保 bundle 字节一致。G5 P-G506 证 graph 重建不可行。H3 stored order metadata 避开 graph，但须验证：
- order list 完整性（含 wxs + transitive subs）
- order list 序 == viewParseWalk 原序
- cache-hit module code == 原 bundle module code

### §3.2 验证

watch 路径：单 component dirty → 单 module cache-miss → recompile → emit 按 order list 重建。须 diff=0 vs per-page-bundle 全量 recompile。

---

## §4 实证结果（2026-10-09）

### H3.1 order list 完整性 — **PASS ✓**

`viewParseWalk` 返 `[...scriptRes.entries()].map(...)`（Map 插入序 = compileViewTree DFS 序）。`pageBundles[i].modules: ViewCompiledModule[]`（view/index.ts:68）**已是完整有序 module list**（page + transitive components + wxs，经 viewParseWalk scriptRes 捕获）。

**结论**：H3 选项① order list 已存在（pageBundles[i].modules.map(m => m.moduleId)）。H3 可 split：per-module cache（`Map<moduleId, ViewCompiledModule>`）+ 保留 pageBundles 作 order list（`pagePath → moduleId[]`）。非全新建——重构现有 pageBundles（F1 leverage 确认）。

### H3.2 cache-hit 字节一致 — **PASS ✓**（设计层）

order list 完整 + per-module cache 同源 ViewCompiledModule（非 recompile）→ 重建 bundle == 原序 bundle（同集同序同 code）。G5 P-G506 风险（graph 重建）避开——用 stored order list（非 graph 派生）。

### H3.3 page 结构变边界 — **F-H3-2 补 clarify**

order list invalidation 触发须按文件类型分：
- **.wxml 改（结构变——component 增删/wxs 增删/include 改）**→ compileViewTree 遍历序变 → order list 失效 → 全量 viewParseWalk 重建 order list
- **.js component 改（代码变——结构不变）**→ compileViewTree 遍历序不变 → order list 稳定 → 仅 per-module cache 失效（单 module cache-miss）
- **判据**：文件 kind（view vs logic/script）决定 order list vs per-module cache invalidation

### 实证总结

| # | 实证 | 结果 | 影响 |
| --- | --- | --- | --- |
| 1 | order list 完整性 | **PASS ✓** | pageBundles 已是 order list（F1 leverage 确认） |
| 2 | cache-hit 字节一致 | **PASS ✓**（设计层） | stored order list 避开 P-G506 |
| 3 | page 结构变边界 | **CLARIFY** | .wxml → order list 失效；.js → per-module cache 失效（F-H3-2） |

**D-PMC-1 gate**：选项① stored order metadata 可行（order list 已存在 + 序确定 + invalidation 按文件类型分）。待 H3 升 ready 前实施验证（probe：per-module cache-hit + order list 重建 == per-page-bundle）。

**⚠️ F5 补：实证 gap**——H3.2 "cache-hit 字节一致" 是设计层 reasoning，非 actual probe。H1 先例：升 ready 前跑 instrumented probe（dump emitBuckets + cache + graph → compare）。H3 须类似 pre-implementation probe：
1. build base（G5 per-page-bundle）→ dump pageBundles（module paths + code per page）
2. 模拟 per-module cache split（`Map<moduleId, ViewCompiledModule>`）+ order list（`pagePath → moduleId[]`）
3. 按	order list 重建 bundle → compare == 原 pageBundles 字节级
4. 若 diff=0 → H3.2 升 actual PASS（非设计层）→ D-PMC-1 锁 → 升 ready

待 H3 升 ready 前跑此 probe（非实施后验证）。
