# Design Draft — fe-tools-hmr-compiler

> 本文件是设计草稿，非正式文档。用于规模评估后产出正式子门 design。

Status: **ready（2026-10-09）**

## §1 现状分析（4 缺口代码实证）

### §1.1 compile-target 已两段化（H1 预判修正）

`compile-target.ts` 已是两段式（fe-tools-compiler-target D-CT-3）：
```
createCompileTarget(runOptions)           // 静态段（mode/platform/sourcemap，fail-fast）
→ readLoadBindings()                     // 动态段：读 ALS（storeInfo 已 populate）
→ deriveStagePlan(target, bindings, opts) // 纯派生：stages / workerOptions / filteredPages
```

**LOAD（storeInfo + graph.build/reconcile）与 COMPILE（stage-channel workers）已是不同函数**——增量链 G1-G5+IRC 已接线：
- watch-runner → build(state, invalidatedModules) → orchestrator → storeInfo（graph reconcile）→ workers（cache-hit skip invalidated）→ emitBuckets → emit-engine

**所以 H1「load/compile 分离」预判有误**——load/compile 已分离。真缺口在下游 3 处（emit/materialize/push）+ 1 处粒度（per-module vs per-page）。

### §1.2 真缺口 1：EMIT 全量（emitBuckets，非增量）

`orchestrator.ts:268` Logic emit task：
```typescript
const emitBuckets = ctx.emitBuckets  // worker 全量输出（main + subs buckets）
for (const { root, modules } of emitBuckets.subs) { emitEngine(...) }  // 全量 re-emit
emitEngine({ entryId: 'logic', modules: emitBuckets.main.map(toEmitModule) })  // 全量
```

**问题**：emitBuckets = 全量（worker 输出所有 page 的 compile 结果），emit-engine 全量 re-emit。HMR 需要只 emit 受影响 modules。

**解法**：`deriveFromGraph`（`convergence.ts:6`）——graph→cache→EmitModule 派生，只派生受影响 entry 的 module 集。

**⚠️ H1 scope（logic-only）**：`deriveFromGraph` 仅派生 **logic** EmitModule[]（convergence.ts:12 自述"非 logic 模块不在 ModuleResultCache，cache.get(id) 自然过滤"）。view/style emit 走 domain `emitEntry`/`emitStyle`（已 per-page in-domain，orchestrator:65-68 onOutput→buildModel.add），**不经 emitBuckets，H1 不动**。H1 只替换 orchestrator Logic emit task（emitBuckets→deriveFromGraph）。

### §1.3 真缺口 2：view/style cache 是 per-page-bundle（非 per-module）

G5 D-G5-4'：viewCache = `Map<string, ViewCompiledModule[]>`（per-page-bundle，存 viewParseWalk 完整有序 bundle）。

**问题**：HMR 需 per-module view/style 结果（单组件 recompile → 单 module emit），但当前 cache 粒度是 per-page-bundle（整页 bundle）。

**影响**：view/style HMR 粒度停在 page 级（非 module 级）。logic 已是 per-module（ModuleResultCache）。

**⚠️ G5 P-G506 先例**（H3 须认）：G5 实施期发现 per-module view cache 经 **graph 重建不可行**——graph 'component' 边仅 direct（非 transitive）+ 不含 wxs modules（wxs 走 'view' kind）+ 序不一致（graph 序 vs viewParseWalk DFS）→ cache-hit bundle 缺 transitive subs + wxs → 字节差异（实测 base/pages_index.js b1=10525 vs b2=3049）。G5 反转 F6→D-G5-4' per-page-bundle（存原序 bundle，cache-hit re-emit 保字节一致）。

**H3 ≠ G5 F6**（不可走 graph 重建路径）：H3 须用**不同策略**——per-module 存储 + **显式序元数据**（存 bundle order list，非 graph 派生），cache-hit 时按 stored order reassemble。或：per-module compile 结果 + per-page-bundle emit（解耦 compile 粒度与 emit 粒度）。**design gate 待 H3 formalize 详评**。

### §1.4 真缺口 3：materialize 全量 + dev server 全量 reload

`orchestrator.ts:316` materialize task：
```typescript
materialize(ctx.buildModel, getTargetPath())  // 全量写盘
publishToDist(targetPath, useAppIdDir)        // 全量发布
```

`dev-reload.ts` RELOAD_LEVELS：L0（全量重启）/ L1（页面 relaunch）/ L2（style）/ L3（view 上报）。**无 per-module HMR level**——当前最高粒度是 page-level reload（L1），非 module-level hot-swap。

`dev-server.ts:195` notifyBuildPublished → `broadcast({ type: 'reload', ...pendingReload })`——全量 reload payload。

### §1.5 真缺口 4：registry 3 空壳（Packer shape 未激活）

`orchestrator.ts:54` `emptyRegistry`（loader/compile/emit 全 stub，**D-OR-2 硬编码三车道 stub**）。production 走 legacy compile-target → stage-channel → domain engines。Packer shape（types.ts Loader/Compiler/Emitter）定义未消费。**H2 registry 实体化反转 D-OR-2**。

---

## §2 子门重新拆分（基于 §1 实证）

### §2.1 H1 修正：不是「load/compile 分离」→ 是「emit 增量化」

H1 预判"load/compile 分离"有误（已分离）。重新拆分：

| 子门 | 目标 | 规模 | 依赖 |
| --- | --- | --- | --- |
| **H1** deriveFromGraph 接线 | emit 从 emitBuckets（全量）改 graph→cache→EmitModule 派生（增量）；orchestrator Logic emit task 改调 deriveFromGraph | **M**（deriveFromGraph 已定义，接线 + 移 emitBuckets + 行为 0） | 增量链（done） |
| **H2** registry 实体化 | emptyRegistry → real Loader/Compiler/Emitter；compile-target → registry 路径；Packer shape 激活 | **L**（替代 legacy compile-target，改 orchestrator + stage-channel） | H1（emit 路径已 graph 派生后，registry compile 侧才能接） |
| **H3** per-module view/style cache | view/style cache 从 per-page-bundle → per-module（使单组件 recompile 可行）；**⚠️ G5 P-G506 先例**：graph 重建不可行，须不同策略（stored order metadata 或 compile/emit 粒度解耦） | **M-L**（G5 D-G5-4' 反转 + 新策略设计） | H2（registry 实体化后 per-module compile 路径就绪） |
| **H4** per-module HMR push | dev-reload 加 HMR level（per-module hot-swap）；dev-server 增量 payload；materialize 增量化 | **S-M**（runtime 协议依赖——fallback 全量 reload） | H1-H3（编译侧 per-module 就绪） |

### §2.2 依赖序

```
H1 deriveFromGraph 接线（emit 增量，logic-only）
   │   使 emit 集 = graph 派生（非手动 bucket）
   ├─ H1/H2/H3 可并行（见下注）
   ▼
H2 registry 实体化（compile 替代 legacy）
   │   Packer shape 激活；compile-target → registry
   ▼
H3 per-module view/style cache（粒度反转）
   │   G5 per-page-bundle → per-module（单组件 HMR 可行）
   ▼
H4 per-module HMR push（dev server 增量）
   │   runtime HMR API 依赖（fallback 全量 reload）
   ▼
伞 close
```

**⚠️ 依赖序非严格线性**（F2 修正）：
- H1（Emitter 侧，deriveFromGraph）+ H2（3 registry 实体化）+ H3（cache 粒度反转）三者**主题独立**——H1 是 emit 路径、H2 是 compile 路径、H3 是 cache 粒度，可并行 formalize。
- **H1/H2 共享 `orchestrator.ts`**（H1 触及 :266-288 Logic emit task；H2 触及 :54,81-92 registry）——不同 section，非硬阻塞，但是协调点（并行实施时须 sync orchestrator.ts 改动）。
- **H4 真依赖 H1+H3**（per-module push 需 per-module emit（H1）+ per-module cache（H3）就绪）。
- 线性序 H1→H2→H3→H4 是默认跟踪序（简化伞管），子门可并行 formalize。

### §2.3 规模总评

| 子门 | 规模 | 风险 | 行为 0 边界 |
| --- | --- | --- | --- |
| H1 | M | 中（emit 路径重构） | one-shot diff=0（emitBuckets→deriveFromGraph 输出字节须一致） |
| H2 | L | 中高（compile-target 是核心入口，替代需渐进） | one-shot diff=0（registry 路径输出 == legacy 路径） |
| H3 | M-L | 高（G5 per-page-bundle 设计反转，cache 粒度变；**G5 P-G506 先例 graph 重建不可行**，须不同策略） | watch 字节恒等（per-module 派生须保 bundle 字节一致） |
| H4 | S-M | 低（编译侧 payload，runtime fallback） | one-shot 不变（HMR 仅 watch 路径） |

**总规模**：L（4 子门，H2 是最大刀；类比增量链 G1-G5 单门规模）。

---

## §3 行为 0 边界

### §3.1 one-shot 路径不变（H1-H2）

one-shot build 不传 state（D-OS-1）→ 无 invalidatedModules → 无 cache-hit skip → 全量编译。H1-H2 重构 emit/compile 路径，但 one-shot 输出须 diff=0 对 baseline。

**关键验证**：H1 emitBuckets→deriveFromGraph——deriveFromGraph(graph, cache, entryId) 派生的 EmitModule[] 须与 emitBuckets 的 modules 字节一致（同集同序同 code）。convergence.ts 注释自述"只读不改 graph/cache"——派生逻辑是 cache.get(id) → EmitModule，与 emitBuckets 的 CompileInfo→EmitModule 映射一致（待 H1 实证）。

### §3.2 watch 字节恒等（H3）

H3（per-module view/style cache）改 cache 粒度（per-page-bundle → per-module）。one-shot 无 cache（undefined → no-op）→ **H3 one-shot diff=0 平凡成立**。**H3 风险在 watch**：per-module 派生须保 bundle 字节一致（序重建——G5 D-G5-4' per-page-bundle 存原序 bundle 保字节一致，per-module 反转须在派生时重建同序）。

### §3.3 watch 路径渐进启用（H4）

H4 per-module HMR push 仅 watch 路径。one-shot 不受影响（不传 state → no HMR）。行为 0 边界延续。

---

## §4 目录 cycle 自然消解路径

load/compile/emit 分离（H1-H2）subsume 目录缺口：

| 缺口 | 消解路径 | 子门 |
| --- | --- | --- |
| ① core⇄packer（env.ts god module） | storeInfo/load 迁 model/packer → env.ts 反向 import 消解 | H2（registry 实体化，load 归 Loader registry） |
| ② pipeline⇄domain（emit.ts 归位） | EmitModule 类型 + emitEntry 下沉 → domain 不再向上 | H1（emit 路径重构，emit.ts 归位） |
| ③ model→pipeline（stage/emit 概念） | stage 常量 + EmitModule 下沉 model/shared | H2（registry 替代 compile-target，stage 概念归 model） |
| ④ build-pipeline.ts dead | 直接删（零风险） | H0（随手，非子门） |

**④ 可零风险先行**（不阻塞 H1-H4）。

**① W3 一致性**：env.ts 迁移是 **gradual migration**（packer-context 已迁 14 config-fixpoint 函数、graph-bootstrap 已迁 storeInfo steps 3-6），非 big-bang split——与 packer-research W3「env.ts 不拆（注入 context）」一致。H2 registry 实体化继续 gradual 路径（load 归 Loader registry，env.ts 薄壳继续瘦身至消解）。

**血缘**：HMR-compiler IS packer-research 的「重评估 Packer 边界」——packer-research 闭环"先 TODO 刀 2+3 → 落地后重评估"，增量链 G1-G5+IRC 完成 刀 2+3（module invalidation + module result cache），重评估条件已 met。HMR-compiler 激活 Packer shape（registry + deriveFromGraph）= 该重评估。

---

## §5 runtime HMR API 依赖（H4）

H4 per-module push 需 runtime 协议（mini-program 运行时 partial update）。**运行时侧，非本伞实施**。

**fallback 策略**：
- H4 编译侧增量 payload 可先交付（dev server 暂 fallback L1 page-level reload）
- runtime 就绪后激活 per-module hot-swap（L_HMR level）
- architecture-notes 记 runtime 依赖状态

**⚠️ fallback 机制待 H4 formalize 指定**：dev server 如何知 runtime 未就绪 → downgrade L_HMR→L1？选项：① runtime capability probe（feature flag）② 编译侧始终发 L_HMR payload，runtime 侧忽略 → 自降 L1（runtime-side downgrade）。H4 formalize 时锁。

**H4 不阻塞伞 close**——编译侧 HMR 完成交付（增量 payload），runtime 激活是外部时序。

---

## §6 D-HMR Design Gates

### D-HMR-1: 子门顺序（H1→H2→H3→H4）
线性依赖（H1 emit 增量 → H2 registry 替代 → H3 per-module 粒度 → H4 push）。无并行门。

### D-HMR-2: H1 emitBuckets→deriveFromGraph 字节一致策略
**design gate 待定**：
- **方案 A（渐进）**：deriveFromGraph 接线 + emitBuckets 保留作 fallback（dual-path），验证字节一致后删 emitBuckets
- **方案 B（一次性）**：直接删 emitBuckets 改 deriveFromGraph，行为 0 验证

推荐 A（渐进，降风险，类比 SMPU dual-path 过渡）。

**⋰ H1 子门 formalize 锁（2026-10-09）**：D-ED-2 **反转推荐 A → locked B（一次性）**——SMPU 经验启示 dual-path 验证缺口风险 > 一次性风险。locked B 条件化（F4）：须 §4 实证 pass（cache 序 == emitBuckets 序）。见 [`fe-tools-hmr-emit-derive`](../_archive/complete/fe-tools-hmr-emit-derive/design.draft.md) §2。

### D-HMR-3: H2 registry 替代 compile-target 策略
**design gate 待定**：
- **方案 A（渐进）**：registry 实体化 + compile-target 保留 fallback，逐步切流量
- **方案 B（一次性）**：直接替代

推荐 A（compile-target 是核心入口，渐进降风险）。

**⋰ H2 子门 formalize 锁（2026-10-09）**：D-REG-1 **反转推荐 A → locked 非双路径**——compile-target compile 段直接替换（无 fallback flag），与 H1 locked B 精神一致。D-REG-2/3 locked（load 在 domain + stage 保留）。F-H2-1 viewParseWalk 拆分规模升级 L+。见 [`fe-tools-hmr-registry-materialize`](../fe-tools-hmr-registry-materialize/design.draft.md) §1/§5。

### D-HMR-4: H3 per-module view/style cache 粒度反转
G5 D-G5-4' per-page-bundle 是为 cache-hit 字节一致。per-module 反转需重建 bundle 序。**⚠️ G5 P-G506 实证 graph 重建不可行**（direct-only + 无 wxs + 序不一致）。H3 须用**不同策略**：① per-module 存储 + 显式序元数据（存 order list，非 graph 派生）或 ② per-module compile + per-page-bundle emit（粒度解耦）。**design gate 待 H3 formalize 时详评策略 A/B**。

**⋰ H3 子门 formalize 锁（2026-10-09）**：D-PMC-1 **locked 选项① stored order metadata**——actual probe PASS（3 项目 base+subpackages+vant，per-module split + order list reassembly == per-page-bundle 字节级恒等；vant 4.86x dedup 实证）。避开 P-G506。见 [`fe-tools-hmr-per-module-cache`](../fe-tools-hmr-per-module-cache/design.draft.md) §1/§4。

### D-HMR-5: H4 runtime fallback
编译侧增量 payload 先交付，dev server fallback L1 reload，runtime 就绪后激活 L_HMR。**非阻塞**。

---

## §7 Readiness 评估

| 项 | 状态 |
| --- | --- |
| 问题可观察 | ✅ dev server 全量 reload（实证） |
| 目标具体 | ✅ 编译侧 HMR 4 子门 |
| scope/non-scope | ✅ 编译侧 / runtime 侧分离 |
| 依赖可识 | ✅ 增量链 complete + Packer shape 定义 + runtime HMR API（H4 外部） |
| deliverables 可枚举 | ✅ H1-H4 + A-HMR1..6 |
| acceptance/validation 可执行 | ✅ 行为 0 三件套 + 目录 cycle 矩阵 |
| design gate | ⚠️ D-HMR-2 H1 子门已锁 locked B（反转 A）；D-HMR-3 H2 子门已锁 locked 非双路径（反转 A）；D-HMR-4 H3 子门已锁选项①（actual probe PASS） |

**readiness gap**：D-HMR-2（H1 策略 A/B）+ D-HMR-3（H2 策略 A/B）需 design gate review 锁。子门 formalize 时各自详评。

**升 ready 条件**：本 design.draft 评完 + D-HMR-1 子门顺序冻 + D-HMR-2/3 推荐 A 文档化（子门 formalize 时锁）。D-HMR-2 已由 H1 子门反转 locked B。

---

## §8 与原 README/roadmap 的偏差修正

§1.1 实证发现 H1「load/compile 分离」预判有误（已分离）。README/roadmap 的 H1-H4 需同步修正：

| 原 | 修正后 |
| --- | --- |
| H1 load/compile 分离 | H1 deriveFromGraph 接线（emit 增量化） |
| H2 deriveFromGraph 接线 | H2 registry 实体化（compile 替代 legacy） |
| H3 registry 实体化 | H3 per-module view/style cache（粒度反转） |
| H4 per-module HMR push | H4 per-module HMR push（不变） |

**README/roadmap/requirements/acceptance/validation 须同步此修正**（升 ready 前）。
