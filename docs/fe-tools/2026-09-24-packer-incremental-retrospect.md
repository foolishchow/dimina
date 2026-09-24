# Packer / 增量链回顾检查（2026-09-24）

- 类型：只读回顾（对照提交史 + 当前 `fe/tools/bundler/src`）
- 分支：`feature/fe-tools-sidecar`（回顾时相对 `origin` ahead ≈ 9）
- 范围：Packer 脊柱收口（orch-state → orch → packer-context）与增量前置 G1–G5 / incremental-unify 闭合叙事
- **不授权实施**；发现的缺口记入下文「发现」与「建议」，另开 Action 或热修须另授

权威参考：[architecture-notes.md](./architecture-notes.md) · [Experience-Review.md](../Experience-Review.md) · [docs/actions/TODO.md](../actions/TODO.md) · [docs/actions/STATUS.md](../actions/STATUS.md)

---

## 1. 回顾目的与方法

### 1.1 目的

1. 把近几日高密度 Action 提交，落到**当前代码**的真实数据流与边界。
2. 核对「文档 / STATUS complete」与「生产路径是否真启用」是否一致。
3. 列出 residual 与下一刀候选，避免在错误层级继续加债。

### 1.2 方法

| 步骤 | 做法 |
| --- | --- |
| 提交面 | `git log`（约 9/22–9/24）按 Action 生命周期与 `implement`/`feat` 分类 |
| 代码面 | 阅读 `packer/*`、`env.storeInfo`、`watch-*`、`stage-channel`、`view|style/index`、`invalidation`、`dependency-graph` |
| 对照面 | 归档 Action README / acceptance / validation（尤其 G5）与测试夹具 |
| 纪律 | 不改 `src`；结论区分「算法已写」「测试已证」「生产接线」 |

---

## 2. 提交史摘要（回顾窗口）

### 2.1 节奏

| 区间 | 特征 |
| --- | --- |
| 9/15–9/21 | 日提交极密（文档 / review 为主） |
| 9/22 | Packer：orchestrator-state → packer-orchestrator → **packer-context** |
| 9/23 | style gate → graph/fingerprint persist → invalidation G3 → view-style-compile-res G4 |
| 9/24 | **view-style-cache-skip G5** + watch 字节恒等集成测 |

提交形态高度模式化：`draft` → `review-fix` → `ready` → `implement`/`feat` → `complete`。文档 commit 远多于大块 `src` 改动；实现 commit 少而集中。

### 2.2 主线 A — Packer 脊柱

| Commit（代表） | Action | 代码落点 |
| --- | --- | --- |
| `ec7f8353` | orchestrator-state | `PackerSessionState`；watch 持活 graph |
| `656266a5` | packer-orchestrator | 过程体入 `packer/orchestrator.ts`；pipeline 死 shim |
| `708f81eb` | packer-context | 新增 `packer/config-fixpoint.ts`；`graph.build(ctx)` 路 2；env `store*` 薄壳 |

### 2.3 主线 B — 增量 G1–G5（原 incremental-unify 拆门）

```text
G1 graph-persist          storeInfo + state.graph → reconcile（保 source edges）
G2 fingerprints-persist   fingerprints 进 PackerSessionState
G3 invalidation-all-kinds getInvalidatedModules 全 kind 闭包（= D-IU-1）
G4 view-style-compile-res worker 回传 + stage-channel 写 cache（guarded）
G5 view-style-cache-skip  cache-hit skip；文档宣称闭合 incremental-unify
```

旁路：`style-minify-gate` / `style-cssnano-gate`（`DIMINA_COMPILER_DIFF_VERIFY`）服务 diff 验证路径，非增量主路径。

### 2.4 G5 实施期关键纠偏（提交已记录）

原方案用 graph `getDirectDependencies(page,'component')` 重建 view modules[] → 实测字节不一致（缺传递/wxs、顺序不稳）。  
**D-G5-4'**：`viewCache` 改为 **per-page-bundle**（整次 `viewParseWalk` 有序 `ViewCompiledModule[]`），hit 时原序 re-emit。

---

## 3. 当前代码架构（对照后的真源）

### 3.1 运行时总图

```text
watch-runner / index
  └─ PackerOrchestrator.orchestrate(state: PackerSessionState)
        ├─ store.load(..., { graph: state.graph })     → env.storeInfo
        │     steps 1–2: paths + fileTypes → ALS
        │     steps 3–6: graph.reconcile|build(toPackerContext)
        │           └─ config-fixpoint (FixpointCtx)   ← Graph 路 2
        ├─ stage-channel → worker (view | logic | style)
        │     入: moduleCache / viewCache / styleCache 快照 + invalidatedModules
        │     出: compileRes / viewPageBundles / styleResults → 写回 state
        └─ materialize / buildResult
```

### 3.2 PackerSessionState 字段

| 字段 | 默认 | 含义 |
| --- | --- | --- |
| `graph` | `new PackerGraph()` | session 活图 |
| `moduleCache` | `new ModuleResultCache()` | logic 模块缓存 |
| `viewCache?` | **`undefined`** | view per-page-bundle（optional） |
| `styleCache?` | **`undefined`** | style per-page（optional） |
| `fingerprints` | `new Map()` | watch 内容指纹 |
| `invalidatedModules` | `new Set()` | （字段存在；计划路径主要经 options 传数组） |

设计意图（G5）：one-shot 不 init view/style Map → stage-channel 写 no-op → 全量编译保 diff=0；**watch-runner 应创建 Map 实例**以启用 cross-rebuild cache。

### 3.3 Graph 路 2（已核对）

`PackerGraph.build(ctx)`：

- 构造 `FixpointCtx { ctx, configData, npm: new NpmResolver(ctx.workPath) }`
- `readProjectConfig` / `readAppConfig` / `readPageConfig` / `buildInitialGraph`
- 内容：`ctx.readContent`；存在性：`fs.existsSync`；无 ALS getter 回环

`env.storeInfo`：

- `options.graph` 存在 → **一律 `reconcile`**（G1；首次空图 merge ≡ build）
- 仅有 `dependencyGraph` 快照 → restore + reconcile
- 否则 → `build` fresh

### 3.4 增量数据流（已核对）

| 门 | 代码行为 |
| --- | --- |
| G2 | `watch-runner`：`prevFingerprints: sessionState.fingerprints`，事后写回 `plan.fingerprints` |
| G3 | `DependencyGraph.getInvalidatedModules`：owner 全推 + `getDirectDependents`（无 kind 过滤） |
| G4 | view 返 dirty + `viewPageBundles`；style 返 dirty；stage-channel `if (cache && …) set` |
| G5 算法 | view：bundle 内任一 `moduleId ∈ invalidated` → miss，否则原序 re-emit；style：`page.path` hit 跳 `buildCompileCss`，仍 emit |

### 3.5 仍在的「双世界」

| 层 | 状态 |
| --- | --- |
| Config fixpoint | 路 2：显式 `PackerContext`，不经 ALS |
| 车道 parse-walk | 仍大量 ALS（`getWorkPath` / `resolveAppAlias` / `getNpmResolver`…） |
| `PackerContext.resolveAlias` / `resolveNpm` | **仍 stub**（D-PC-4 未还） |
| Worker | `resetStoreInfo` 从主线程快照恢复 ALS |

结论：Packer 形状在 Graph / orch / session 已立住；**load 路径仍是 Scheme/ALS 世界**。下一 Packer 债不宜再拆 Graph，而应指向 resolvers 真接或 load/compile 边界。

---

## 4. 发现（按严重度）

### F-R1 · high — 生产 watch 未实例化 view/style cache（G5 空转）

**文档 / acceptance 声称**：watch-runner 创建 `viewCache` / `styleCache` 实例；one-shot 保持 `undefined`。

**代码事实**：

- `watch-runner.ts` 仅 `new PackerSessionState()`，**无** `state.viewCache = new Map()` / `styleCache = new Map()`。
- `src/` 内 orch 只做透传：`ctx.viewCache = state.viewCache`（常为 `undefined`）。
- 集成测**手工**赋值后才验证字节恒等（`view-style-cache-skip.spec.js` integration 段）。

**后果**：

| 路径 | 实际行为 |
| --- | --- |
| one-shot | `undefined` → 写 no-op → 全量 → diff=0（符合设计） |
| 测试（手建 Map） | 读写 + hit skip 生效 |
| **真实 `createBuildWatcher`** | Map 从未创建 → stage-channel 永不写入 → **永远 miss** → G5 算法空转 |

**定性**：Action 可标 complete（算法 + 测齐备），但 **生产效能路径未闭合**。属于接线遗漏，不是算法错误。

**最小纠偏方向**（不在本文实施）：

- 在 `watch-runner` 创建 session 后（或 `PackerSessionState` 提供 `ensureViewStyleCaches()` / 构造选项）对 watch 路径赋 `new Map()`；
- 补回归：**不**在测试里手写 Map 时，经真实 watcher/build 路径也应写入 cache；
- 回写 G5 acceptance / validation 与 `packer/session-state` 注释，消除「已创建」与代码不一致。

### F-R2 · medium — G5 文档 residual（logic / static-copy）

G5 validation 已声明：watch 上 view/style 可字节恒等后，仍见 **logic cache** 与 **static-copy** 相关 diff（标为 out-of-scope / pre-existing）。需独立 Action，勿并入「再开一刀 G5」。

### F-R3 · low — ctx 类型与 cache 三分

- orch / stage-channel 大量 `(ctx as { viewCache?: … })`；view/style 未与 logic `moduleCache` 同级进入正规类型。
- 三套 cache：`ModuleResultCache` / view bundle Map / style bare Map（D-IU-3 有意为之）。长期三套失效与序列化语义，HMR 前可接受，但要在架构笔记中保持可见。

### F-R4 · low — 叙事与导航滞后

回顾时 `docs/fe-tools/README.md` 仍可能写 packer-context 为 `draft`，而 STATUS 已为 `complete`。属文档导航漂移，不挡运行。

### F-R5 · info — 首次 state 路径一律 reconcile

`options.graph` 存在时首次也 `reconcile`（空图 merge ≡ build）。行为正确，依赖注释约定；可读性略绕，非缺陷。

---

## 5. 对照表：叙事 vs 代码

| 叙事 | 代码验证 |
| --- | --- |
| PackerContext + Graph 路 2 | ✅ `config-fixpoint` + `build(ctx)` 真消费 ctx |
| orch 单脑 | ✅ 过程在 orch；pipeline 薄适配 |
| G1 保 source edges | ✅ `options.graph` → `reconcile` |
| G2 指纹持久 | ✅ session fingerprints round-trip |
| G3 全 kind 失效 | ✅ 无 logic-only 过滤 |
| G4 回传 + 写 | ✅ worker 字段 + guarded write |
| G5 hit skip **算法** | ✅ view bundle / style per-page |
| G5 **生产 watch 启用** | ❌ 缺 Map 实例化（F-R1） |
| incremental-unify「闭合」 | 文档/验收闭合；**生产效能路径未闭合** |

---

## 6. 建议优先级

1. **热修 F-R1**（最小 diff）：watch session 初始化 `viewCache`/`styleCache` + 回归测；回写 G5 文档与 architecture-notes 一行。
2. **独立 Action**：logic cache / static-copy watch diff（F-R2）。
3. **Packer 下一刀（不挡增量）**：`resolveAlias`/`resolveNpm` 真接，或 load 侧去 ALS；Graph 已不再是阻塞点。
4. **候选池保持**：load/compile 拆（等 HMR 驱动）；worker-runtime 独立包（有外部消费者再触发）；Session 跨 `.build()` 持久；`orchestrate` → `EmitEntry[]`；HMR。

---

## 7. 关键路径索引（便于复查）

| 主题 | 路径 |
| --- | --- |
| Session 状态 | `fe/tools/bundler/src/packer/session-state.ts` |
| 路 2 / reconcile | `fe/tools/bundler/src/packer/graph.ts` |
| Config fixpoint | `fe/tools/bundler/src/packer/config-fixpoint.ts` |
| storeInfo 分支 | `fe/tools/bundler/src/compiler/core/env.ts`（`storeInfo`） |
| orch plumbing | `fe/tools/bundler/src/packer/orchestrator.ts` |
| worker 快照 / 写回 | `fe/tools/bundler/src/compiler/pipeline/stage-channel.ts` |
| view hit | `fe/tools/bundler/src/compiler/view/index.ts`（`compileML`） |
| style hit | `fe/tools/bundler/src/compiler/style/index.ts`（`compileSS`） |
| watch + 指纹 | `fe/tools/bundler/src/watch/watch-runner.ts`、`watch-plan.ts` |
| 全 kind 失效 | `fe/tools/bundler/src/model/dependency-graph.ts`（`getInvalidatedModules`） |
| G5 手建 Map 测 | `fe/tools/bundler/__tests__/view-style-cache-skip.spec.js` |
| G5 归档 | `docs/actions/_archive/complete/fe-tools-view-style-cache-skip/` |

---

## 8. 回顾元数据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-09-24 |
| 性质 | 只读回顾检查记录 |
| 产出 | 本文；**未改** `src`；**未改** Action 生命周期状态 |
| 后续 | F-R1 热修 / 新 Action 须用户另授 |

---

## 9. 一句话结论

Packer 脊柱（含 Graph 路 2）与增量 G1–G5 **算法与测试已在树内对齐提交叙事**；但 **G5 生产 watch 因未创建 `viewCache`/`styleCache` 实例而空转**，导致「incremental-unify 闭合」在效能路径上尚未真正落地——应优先热修接线，再处理 logic/static-copy residual 与 Packer resolvers 债。
