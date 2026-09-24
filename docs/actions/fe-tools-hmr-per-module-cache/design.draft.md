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

## §4 实证待做（升 ready 前）

1. **order list 完整性**：viewParseWalk module 序能否完整捕获（含 wxs + transitive）？
2. **cache-hit 字节一致**：per-module cache-hit + order list 重建 == per-page-bundle 全量？
3. **page 结构变边界**：order list 失效条件（增删 component/wxs）？
