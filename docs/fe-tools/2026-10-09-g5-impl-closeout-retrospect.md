# G5 实施 + Closeout 回顾检查（2026-10-09）

- 类型：只读回顾（对照提交史 + 当前 `fe/tools/bundler/src`）
- 分支：`feature/fe-tools-sidecar`
- 范围：G5（`fe-tools-view-style-cache-skip`）实施 commit `3c721001` + 集成测试补 commit `0d131d32`，及 D-G5-4' 设计反转
- **不授权实施**；发现记入下文「发现」与「建议」，热修 / 新 Action 须另授

权威参考：[architecture-notes.md](./architecture-notes.md) · [2026-09-24-packer-incremental-retrospect.md](./2026-09-24-packer-incremental-retrospect.md) · [Experience-Review.md](../Experience-Review.md) · [docs/actions/TODO.md](../actions/TODO.md)

---

## 1. 回顾目的与方法

### 1.1 目的

1. 把 G5 实施 + closeout 的高密度改动，落到**当前代码**的真实接线与边界。
2. 核对 G5 acceptance / validation 的「已创建 / 已启用」叙事与生产路径是否一致。
3. 接续 9-24 回顾的 F-R1（watch 未实例化 cache），确认是否仍未闭合 + 是否有新缺口。

### 1.2 方法

| 步骤 | 做法 |
| --- | --- |
| 提交面 | `git log`（G5 window：`3c721001` implement + `0d131d32` test followup） |
| 代码面 | 阅读 `session-state`、`orchestrator`、`stage-channel`、`view|style/index`、`watch-runner`、`runtime`、`index.ts`(build) |
| 对照面 | G5 归档 acceptance / validation / technical-design 与测试夹具 |
| 纪律 | 不改 `src`；区分「算法已写」「测试已证」「生产接线」 |

---

## 2. 提交史摘要（G5 window）

### 2.1 节奏

| Commit | 性质 |
| --- | --- |
| `3c721001` | G5 implement + 归档：5 生产文件 + 1 测试 + 6 docs Status→complete + architecture-notes |
| `0d131d32` | G5 test followup：2 集成测试（cache-hit 字节恒等 + 真实路径 diff=0）+ validation evidence 同步 |

### 2.2 G5 实施期关键纠偏（提交已记录）

原 F6 方案用 `graph.getDirectDependencies(page,'component')` 重建 view modules[] → 实测字节不一致（direct-only 非 transitive、缺 wxs、序不稳；`base/pages_index.js` b1=10525 vs b2=3049）。
**D-G5-4'**：`viewCache` 改 **per-page-bundle**（整次 `viewParseWalk` 有序 `ViewCompiledModule[]`），hit 时原序 re-emit；invalidation = bundle 内任一 `moduleId ∈ invalidated` → miss。

---

## 3. 当前代码（G5 接线真相）

### 3.1 PackerSessionState 创建点（3 处）

| 路径 | 行 | viewCache/styleCache | 性质 |
| --- | --- | --- | --- |
| `watch-runner.ts` | `:90` `state ?? new PackerSessionState()` | **`undefined`**（不赋值） | ❌ watch 缺口（F1） |
| `index.ts`(build) | `:38` `options.state ?? new PackerSessionState()` | `undefined` | ✅ one-shot 设计（no-op→diff=0） |
| `build-pipeline.ts` | `:23` `runOptions.state ?? new PackerSessionState()` | `undefined` | ✅ 内部 one-shot 设计 |

### 3.2 cache 数据流（已核对）

```text
orchestrator.ts:172  cache/moduleCache/viewCache/styleCache = state.{...}  （透传，常 undefined）
orchestrator.ts:187  ctx.viewCache = viewCache; ctx.styleCache = styleCache  （type-erased as）
stage-channel.ts:49  worker input viewCache IIFE = c ? new Map(c) : null   （c=undefined → null）
view/index.ts compileML:
  cachedBundle = viewCache?.get(page.path)            // null/undefined → miss
  bundleInvalidated = cachedBundle?.some(m => invalidated?.includes(m.moduleId)) ?? false
  hit → re-emit cachedBundle 原序；miss → viewParseWalk + pageBundles.push
view/index.ts viewCompile → { viewCompileResults, viewPageBundles }
runtime.ts:33  Object.assign(response, compileResult)  → postMessage(viewCompileResults + viewPageBundles)
stage-channel.ts:82  result.viewPageBundles → viewCache.set(pagePath, bundle)  （guarded）
stage-channel.ts:89  result.styleCompileResults → styleCache.set(moduleId, mod)  （per-module，style 无 transitive subs）
```

### 3.3 worker 返回字段消费矩阵

| 字段 | viewCompile 返回 | runtime postMessage | stage-channel 读取 | 状态 |
| --- | --- | --- | --- | --- |
| `viewCompileResults` | ✅ | ✅ | ❌（G5 改读 viewPageBundles 后弃用） | **vestigial**（F3） |
| `viewPageBundles` | ✅ | ✅ | ✅（写 viewCache per-page-bundle） | 活跃 |
| `styleCompileResults` | ✅ | ✅ | ✅（写 styleCache per-module） | 活跃 |
| `compileRes` / `logicDependencies` | logic | ✅ | ✅（写 moduleCache） | 活跃 |

---

## 4. 发现（按严重度）

### F1 · high — 生产 watch 未实例化 view/style cache（G5 空转，接续 9-24 F-R1）

**叙事**：G5 acceptance A-G51 声「watch-runner 创建实例（session-scoped）」。

**代码事实**：`watch-runner.ts:90` 仅 `new PackerSessionState()`，**无** `state.viewCache = new Map()` / `styleCache = new Map()`。3 个创建点（§3.1）全不 init。

**后果**：

| 路径 | 实际 |
| --- | --- |
| one-shot（build/build-pipeline） | undefined → no-op → 全量 → diff=0（设计） |
| 集成测（手建 Map） | 读写 + hit skip 生效 |
| **真实 `createBuildWatcher`** | Map 永不创建 → stage-channel 永不写 → **永远 miss** → G5 算法空转 |

**定性**：算法 + 单测齐备（Action 可标 complete），但**生产效能路径未闭合**——接线遗漏，非算法错误。正确性无影响（miss=全量=正确）；效能未兑现。

**纠偏方向**（不实施）：`watch-runner` 创建 session 后赋 `new Map()`；补回归：不经手建 Map，经真实 watcher 触发 rebuild → 断言 `sessionState.viewCache` 非空 + 有写入。

### F2 · medium — style cache-hit 字节恒等无集成级断言

**事实**：集成测 ①（cache-hit 含 transitive subs，空 invalidated）断言 **view `.js`** 字节一致 + 含子组件；**未断言 style `.css`**。style cache-hit 字节恒等仅靠 unit mock（`compileSS` 直调）+ 一次性 P-G506 脚本。

**风险**：style per-page cache 较简单（无 transitive subs），但若 `emitStyle` / `buildCompileCss` re-emit 路径回归，集成级无门。

**纠偏**：集成测 ① 加 `pages_home_index.css` 字节一致断言（或新建 style 专项集成）。

### F3 · low — `viewCompileResults` 已 vestigial

**事实**：G5 改 stage-channel 读 `viewPageBundles`（per-page-bundle）后，`viewCompileResults`（flattened dirty ViewCompiledModule[]）仍由 `viewCompile` 返回 + `runtime.ts:33 Object.assign` postMessage，但 stage-channel **不再读**（stage-channel `@returns Promise<void>`，无透传）→ worker→main 消息内死数据。

**定性**：非缺陷（无行为影响），但 G4 期为 cache 写而返，G5 后失语义。未来 HMR 可能用其作 dirty 信号——若有意保留，应在注释/acceptance 标「HMR-future dirty signal」；否则可从返回 shape 删 `viewCompileResults`，瘦 worker 消息。

### F4 · low — 集成测 `DIMINA_COMPILER_DIFF_VERIFY` env 不 reset

**事实**：`view-style-cache-skip.spec.js` integration `beforeEach` 设 `process.env.DIMINA_COMPILER_DIFF_VERIFY = '1'`，**无** `afterEach` delete → 泄漏同 vitest run 后续 test。

**定性**：测试卫生。该 env 影响的是 minify gate（parse-walk diff vs emit 正本），泄漏可能改变后续 style minify 路径 → 潜在 flaky 源。

**纠偏**：`afterEach` `delete process.env.DIMINA_COMPILER_DIFF_VERIFY`（或保存/恢复原值）。

### F5 · info — `ensureWxsScan` cache-hit 路径冗余

**事实**：`compileML` 顶部无条件 `ensureWxsScan(workPath)`；cache-hit page 跳 `viewParseWalk` → 不消费 wxs 扫描结果。

**定性**：微浪费（I/O 一次/worker，非每页）。非缺陷，记观察。

### F6 · info — one-shot state 创建正确（非缺口）

`index.ts:38` / `build-pipeline.ts:23` 均 `?? new PackerSessionState()` → viewCache/styleCache `undefined` → stage-channel 写 no-op → 全量编译 → diff=0。**设计正确，非缺口**（与 F1 watch 缺口对照）。

---

## 5. 对照表：叙事 vs 代码

| 叙事 | 代码验证 |
| --- | --- |
| D-G5-4' per-page-bundle 算法 | ✅ `compileML` cachedBundle + bundleInvalidated + re-emit 原序 |
| viewPageBundles 传 stage-channel 写 cache | ✅ `viewCompile` 返 + stage-channel 读 + per-page set |
| style per-page cache-hit | ✅ `compileSS` `styleCache.get(page.path)` |
| one-shot diff=0（undefined→no-op） | ✅ P-G503 6 项目 diff=0 |
| watch cache-hit 字节恒等 | ✅ 集成测（**手建 Map**）|
| **G5 生产 watch 启用** | ❌ watch-runner 未实例化（F1 = 9-24 F-R1 未闭合） |
| style cache-hit 集成级字节恒等 | ❌ 无 .css 断言（F2） |
| `viewCompileResults` 供 stage-channel 写 | ❌ G5 后弃用，vestigial（F3） |
| incremental-unify「闭合」 | 算法/验收闭合；**生产效能路径未闭合**（同 9-24 结论） |

---

## 6. 建议优先级

1. **热修 F1**（最小 diff）：`watch-runner` session 后 `state.viewCache = new Map()` / `state.styleCache = new Map()` + 回归测（真实 watcher 路径，不手建 Map）+ 回写 G5 acceptance/validation/architecture-notes 一行。**闭合 9-24 F-R1 + 本轮 F1。**
2. **补 F2**：集成测 ① 加 `.css` 字节一致断言。
3. **清 F3**：决策 `viewCompileResults` 保留（标 HMR-future dirty signal）或删（瘦 worker 消息）。
4. **修 F4**：`afterEach` reset env。
5. **独立 Action**（接 9-24 F-R2）：logic cache / static-copy watch diff——本轮已验为**人工空 invalidated 场景假象**（非空 invalidated 真实路径 diff=0），故 priority 降；可在 9-24 F-R2 基础上降级或撤项。
6. **Packer 下一刀**（接 9-24 §6.3）：`resolveAlias`/`resolveNpm` 真接 / load 侧去 ALS；Graph 不再是阻塞点。

---

## 7. 关键路径索引

| 主题 | 路径 |
| --- | --- |
| session-state（viewCache/styleCache optional） | `fe/tools/bundler/src/packer/session-state.ts` |
| 3 创建点（watch / build / build-pipeline） | `watch/watch-runner.ts:90` · `index.ts:38` · `pipeline/build-pipeline.ts:23` |
| orch plumbing | `packer/orchestrator.ts:172-188` |
| worker input IIFE + 写回 | `pipeline/stage-channel.ts:47-99` |
| view cache-hit + 返回 shape | `compiler/view/index.ts`（`compileML`/`viewCompile`） |
| style cache-hit | `compiler/style/index.ts`（`compileSS`） |
| runtime 合并 compileResult | `compiler/worker-runtime/runtime.ts:33` |
| G5 集成测（手建 Map） | `__tests__/view-style-cache-skip.spec.js` |
| G5 归档 | `docs/actions/_archive/complete/fe-tools-view-style-cache-skip/` |
| 9-24 回顾（F-R1 出处） | `docs/fe-tools/2026-09-24-packer-incremental-retrospect.md` |

---

## 8. 回顾元数据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-10-09 |
| 性质 | 只读回顾检查记录 |
| 产出 | 本文；**未改** `src`；**未改** Action 生命周期状态 |
| 接续 | 确认 9-24 F-R1 仍未闭合（= 本轮 F1）；新增 F2/F3/F4 |
| 后续 | F1 热修 / F2-F4 小修 / 新 Action 须用户另授 |

---

## 9. 一句话结论

G5 实施（D-G5-4' per-page-bundle）**算法 + 单测 + 集成测齐备且字节恒等已证**；但 **watch-runner 仍未实例化 `viewCache`/`styleCache`**（接续 9-24 F-R1 未闭合）→ 生产 watch 永远 miss、G5 效能空转；另有 `viewCompileResults` vestigial + style `.css` 集成断言缺 + env 不 reset 三处小缺口。应优先 F1 热修接线，余者低优先或降级。
