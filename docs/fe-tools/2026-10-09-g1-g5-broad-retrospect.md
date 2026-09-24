# G1–G5 增量链广回顾检查（2026-10-09）

- 类型：只读回顾（对照提交史 + 当前 `fe/tools/bundler/src`）
- 分支：`feature/fe-tools-sidecar`
- 范围：增量前置链 G1–G5 全门（graph-persist → fingerprints-persist → invalidation-all-kinds → view-style-compile-res → view-style-cache-skip），含 incremental-unify 闭合叙事
- 接续：[9-24 Packer/incremental retrospect](./2026-09-24-packer-incremental-retrospect.md)（§3.4 增量数据流）+ [10-09 G5 impl retrospect](./2026-10-09-g5-impl-closeout-retrospect.md)
- **不授权实施**；发现已记入 [incremental-chain-residuals.md](./incremental-chain-residuals.md)

权威参考：[architecture-notes.md](./architecture-notes.md) · [Experience-Review.md](../Experience-Review.md) · [STATUS.md](../actions/STATUS.md)

---

## 1. 回顾目的与方法

### 1.1 目的

1. 不局限 G5，把 G1–G5 **整条增量链**逐门落到当前代码，独立核实 9-24 §3.4 的增量数据流叙事。
2. 查**跨门一致性**：前序门（G4）的归档叙事是否被后继门（G5）的代码变更所超越 → doc drift。
3. 查**链路最后一公里**：invalidatedModules 是否端到端接通（G3 产 → G5 消费）。

### 1.2 方法

| 步骤 | 做法 |
| --- | --- |
| 代码面 | 逐门读关键代码：`env.storeInfo`（G1）、`watch-runner`+`watch-plan`（G2）、`dependency-graph.getInvalidatedModules`（G3）、`view/style/index`+`stage-channel`（G4/G5） |
| 链路面 | 追 `invalidatedModules` 从 watch-plan 产 → build → orch → stage-channel → worker 全路径 |
| 跨门面 | G4 归档 acceptance vs 当前 stage-channel 代码（G5 改后） |
| 纪律 | 不改 `src`；区分「算法已写」「链路已接」「生产已启用」 |

---

## 2. 逐门核实（G1–G5）

### G1 · graph-persist（storeInfo state 路径 reconcile）

| 叙事 | 代码核实 |
| --- | --- |
| `options.graph` 传入 → reconcile（保 source edges） | ✅ `env.ts:202` `if (options.graph) graph.reconcile(toPackerContext(context))` |
| 首次空图 reconcile ≡ build | ✅ `:204` 注释明示 |
| 旧路径（无 state）restore+reconcile | ✅ `:209` `graph.restoreFromSnapshot(...)` + `reconcile` |
| watch 持活 `state.graph` | ✅ `watch-runner.ts:103` `dependencyGraph: sessionState.graph` |

**状态**：算法 + 接线 ✅。R5（info，首次 reconcile 可读性绕）记观察。

### G2 · fingerprints-persist（watch-plan 内容指纹 round-trip）

| 叙事 | 代码核实 |
| --- | --- |
| `prevFingerprints` 来自 `sessionState.fingerprints` | ✅ `watch-runner.ts:106` |
| 事后写回 `plan.fingerprints`（D-FP-8：即使 skip 也持久化） | ✅ `watch-runner.ts:108` `sessionState.fingerprints = plan.fingerprints` |
| `createWatchBuildPlan` 所有 return 路径带 fingerprints | ✅ `watch-plan.ts:98` 注释 + `:102`/`:112` return 带 fingerprints |
| mtime-only 变更 → content dedup skip（D-FP-5） | ✅ `watch-plan.ts:108` `fingerprintFile(absPath, prev)` 比对 |

**状态**：算法 + 接线 ✅。无缺口。

### G3 · invalidation-all-kinds（去 `kind=logic` 硬编码）

| 叙事 | 代码核实 |
| --- | --- |
| `getInvalidatedModules` owner 全推（无 `if (kinds.has('logic'))`） | ✅ `dependency-graph.ts:113` `for (const [owner] of ownerKinds) pending.push(owner)` —— 无 kind 过滤 |
| `getDirectDependents(id)` 无 kind 过滤（D-IV-6 反转） | ✅ `:117` `getDirectDependents(id)` 调用未传 kinds |
| `getAffectedEntries` 同样全 kind | ✅ `:104` 同模式 |
| moduleId 跨 kind 共享（view/style/logic 同 namespace） | ✅ ownerKinds 按 file 归类，跨 kind 累加 |

**状态**：算法 + 接线 ✅。D-IV-6/7 反转坐实代码。无缺口。

### G4 · view-style-compile-res（worker 回传 + stage-channel 写 cache）

| 叙事 | 代码核实 |
| --- | --- |
| view worker 返 `ViewCompiledModule[]` | ✅ `view/index.ts` viewCompile 返 viewCompileResults |
| style worker 返 `StyleCompiledModule[]` | ✅ `style/index.ts` styleCompile 返 styleCompileResults |
| stage-channel 写 viewCache（**G4: per-module**） | ⚠️ **G5 已改为 per-page-bundle**（`stage-channel.ts:82` 读 `viewPageBundles` + `:85` `viewCache.set(b.pagePath, b.modules)`） |
| stage-channel 写 styleCache（per-module） | ✅ `stage-channel.ts:89` `styleCache.set(mod.moduleId, mod)` —— style 无 transitive subs，per-module≡per-page |
| G4 期 ctx 无 cache 实例 → no-op | ✅ one-shot state undefined → IIFE null → 不写 |

**状态**：算法 + 接线 ✅，**但 G4 归档 acceptance A-G43 仍写 "per-module viewCache.set"** → 被 G5 超越，归档 doc 过时（X1，见 §4）。G4 live 测试随 G5 已改 per-page-bundle shape。

### G5 · view-style-cache-skip（cache-hit skip）

| 叙事 | 代码核实 |
| --- | --- |
| D-G5-4' per-page-bundle：存 viewParseWalk 原序 bundle，hit re-emit | ✅ `view/index.ts compileML` cachedBundle + bundleInvalidated + re-emit |
| style per-page cache-hit | ✅ `style/index.ts compileSS` `styleCache?.get(page.path)` |
| orchestrator plumbing view/style cache | ✅ `orchestrator.ts:174/187` |
| stage-channel worker input `new Map(c)`（F12 非 toJSON） | ✅ `stage-channel.ts:49` |
| **生产 watch 启用 cache** | ❌ `watch-runner.ts:90` 不实例化（R1） |

**状态**：算法 + 单测 + 集成测（手建 Map）✅；**生产效能路径未闭合**（R1，接续 9-24 F-R1）。

---

## 3. 跨门链路核实

### 3.1 invalidatedModules 端到端（G3 产 → G5 消费）

```text
watch-plan.ts:162  computeInvalidatedModules(graph, actuallyChanged) → invalidatedModules
watch-plan.ts:179  options.invalidatedModules = [...]
index.ts:73        build options 透传 invalidatedModules
orchestrator.ts:189  if (invalidatedModules) ctx.invalidatedModules = invalidatedModules
stage-channel.ts:51  worker input invalidatedModules: ctx.invalidatedModules ?? null
view/index.ts compileML: invalidated?.includes(m.moduleId)  → bundleInvalidated 判定
style/index.ts compileSS: invalidated?.includes(page.path)   → cache-miss 判定
```

**核实**：链路**端到端接通** ✅。G3 产的 invalidatedModules 经 build → orch → stage-channel 到达 worker，被 G5 cache-hit 消费。

**但**：R1（watch-runner 不 init view/style cache）→ 即便 invalidatedModules 到位，`viewCache?.get()` 永远 undefined → 永远 miss → invalidatedModules 的消费路径**空转**。链路通，终点无 cache 可查。

### 3.2 G4 → G5 view cache 写 shape 演进

| 时期 | stage-channel view 写 | cache value |
| --- | --- | --- |
| G4（归档 acceptance A-G43） | `for mod of viewCompileResults: viewCache.set(mod.moduleId, mod)` | per-module `ViewCompiledModule` |
| G5（当前代码） | `for b of viewPageBundles: viewCache.set(b.pagePath, b.modules)` | per-page-bundle `ViewCompiledModule[]` |

**驱动**：D-G5-4'（F6 graph 重建不可行 → 存原序 bundle）。G4 的 per-module 写被 G5 per-page-bundle 取代。G4 live 测试（`view-style-compile-res.spec.js` ①）随 G5 已改 per-page-bundle shape；G4 归档 acceptance A-G43 因 "complete 不可变" 未同步 → doc drift（X1）。

### 3.3 viewCompileResults 跨门命运

| 时期 | 用途 |
| --- | --- |
| G4 | stage-channel 读 `viewCompileResults` 写 per-module viewCache |
| G5 | stage-channel 改读 `viewPageBundles`；`viewCompileResults` 返回+postMessage 但不再被消费 → vestigial（R7） |

**注**：未来 HMR 可能用 `viewCompileResults`（dirty modules）作热更新信号——若有意保留，应标注释（R7 决策项）。

---

## 4. 跨门发现

### X1 · low — G4 归档 acceptance A-G43 过时（per-module → per-page-bundle）

G4 归档 acceptance A-G43 仍写 "stage-channel view cache 写入块（bare value，per-module `set`）"；G5 D-G5-4' 已改 per-page-bundle。G4 live 测试随 G5 改，归档 doc 因 "complete = 终态不可变" 未同步。

**定性**：增量 Action 的固有张力——后继门超越前序门的代码，前序归档 doc 点状过时。bridge 是 `architecture-notes.md` G5 条目（已记反转）。非缺陷，记 doc drift 观察。

**处置**：归档不重写；architecture-notes 保持 bridge；residuals tracker X1 标 open（可读性提醒）。

### X2 · info — 链路最后一公里断点（R1 的上游视角）

invalidatedModules 链路（G3→G5）端到端接通，但终点 `viewCache/styleCache` 在 watch-runner 不实例化 → 链路通而终点空。R1 修复后此链路才真正生效。**非新缺口**，R1 的另一视角描述。

---

## 5. 对照表：整链叙事 vs 代码

| 链节 | 叙事 | 代码 | 状态 |
| --- | --- | --- | --- |
| G1 graph reconcile | state.graph 保 source edges | ✅ env.ts:202 | ✅ |
| G2 fingerprints round-trip | sessionState.fingerprints persist | ✅ watch-runner:106/108 | ✅ |
| G3 全 kind 失效 | 去 logic 硬编码 | ✅ dependency-graph.ts:113/117 | ✅ |
| G3→G5 invalidatedModules 链 | 端到端接通 | ✅ watch-plan→build→orch→stage-channel→worker | ✅（终点空转见 R1） |
| G4 worker 回传 + 写 | view/style 返 + stage-channel 写 | ✅（view 写 shape 被 G5 改） | ✅ + X1 doc drift |
| G5 cache-hit 算法 | per-page-bundle re-emit | ✅ compileML/compileSS | ✅ |
| G5 生产 watch 启用 | watch-runner 实例化 cache | ❌ 不实例化 | ❌ R1 |
| incremental-unify 闭合 | A-IU-1..5 全 complete | 算法/验收闭合；**效能路径未闭合** | ◑ |

---

## 6. 结论 + 与两轮前回顾的差异

### 6.1 与 9-24 / 10-09 的关系

| 回顾 | 范围 | 核心发现 |
| --- | --- | --- |
| 9-24 | Packer 脊柱 + G1–G5 概览 | F-R1（watch 不实例化 cache，high）+ F-R2..5 |
| 10-09 | G5 实施 + closeout window | F1（=F-R1 确认未闭合）+ F2..5（G5 专项） |
| **本轮** | **G1–G5 逐门 + 跨门链路** | 独立核实 9-24 §3.4 增量数据流（全 ✅）+ 新增 X1（G4 归档 doc drift）+ X2（链路终点空转视角） |

### 6.2 一句话结论

G1–G5 **逐门算法 + 接线 + invalidatedModules 端到端链路均已坐实代码**（9-24 §3.4 叙事独立验证通过）；唯一未闭合点仍是 **R1：watch-runner 未实例化 view/style cache**（= 9-24 F-R1 = 10-09 F1，三轮一致确认），导致整链"算法齐备、链路接通、终点空转"。新增跨门发现 X1（G4 归档 acceptance A-G43 被 G5 per-page-bundle 超越，归档不可变 → architecture-notes bridge）+ X2（R1 的链路视角重述）。**无新 high severity 缺口**；R1 仍是唯一 high，三轮回顾一致指向同一热修点。

---

## 7. 关键路径索引

| 主题 | 路径 |
| --- | --- |
| G1 reconcile | `compiler/core/env.ts:200-210` |
| G2 fingerprints | `watch/watch-runner.ts:100-108` · `watch/watch-plan.ts:94-112` |
| G3 全 kind 失效 | `model/dependency-graph.ts:109-124`（getInvalidatedModules） |
| G3→G5 invalidatedModules 链 | `watch-plan.ts:162` → `index.ts:73` → `orchestrator.ts:189` → `stage-channel.ts:51` |
| G4/G5 stage-channel 写 | `pipeline/stage-channel.ts:82-99` |
| G5 cache-hit | `compiler/view/index.ts compileML` · `compiler/style/index.ts compileSS` |
| R1 缺口 | `watch/watch-runner.ts:90` |
| G4 归档（X1 doc drift） | `docs/actions/_archive/complete/fe-tools-view-style-compile-res/acceptance.md` A-G43 |
| residuals tracker | `docs/fe-tools/incremental-chain-residuals.md` |

---

## 8. 回顾元数据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-10-09 |
| 性质 | 只读回顾检查记录 |
| 产出 | 本文 + residuals tracker 新增 X1；**未改** `src`；**未改** Action 生命周期 |
| 接续 | 9-24（F-R1..5）+ 10-09（F1..5）；三轮一致指向 R1 为唯一 high |
| 后续 | R1 热修须用户另授 |
