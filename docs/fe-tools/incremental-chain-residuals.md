# 增量链 Residuals 跟踪表（G1–G5）

- 性质：living doc，记录两轮 retrospect（[9-24](./2026-09-24-packer-incremental-retrospect.md) · [10-09](./2026-10-09-g5-impl-closeout-retrospect.md)）发现的缺口 + 后续回顾的新增
- 状态：`open` / `fixed` / `downgraded` / `wontfix`
- 权威参考：[architecture-notes.md](./architecture-notes.md) · [STATUS.md](../actions/STATUS.md)

## 跟踪表

| ID | 严重度 | 状态 | 来源 | 摘要 | 代码位置 | 建议动作 |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | high | fixed | 9-24 F-R1 / 10-09 F1 | watch-runner 未实例化 viewCache/styleCache → 生产 watch 永远 miss、G5 效能空转（正确性无影响） | `watch/watch-runner.ts:90` | **IRC 接线**：watch-runner :91-93 `if (!sessionState.viewCache) sessionState.viewCache = new Map()` + styleCache 同；接线回归测（注入 state + mock build，`watch-runner.spec.js` D-IRC-5）验 viewCache/styleCache 是 Map instance（不手建 Map）。tracker 原建议「真实 watcher 回归测 + 回写 G5 文档」经 review 修正为「mock build 接线测 + G5 归档不重写」（F1 immutable + F2 真实 watcher infeasible）。 |
| R2 | — | downgraded | 9-24 F-R2 / 10-09 验证 | logic cache / static-copy watch diff——**人工空 invalidated 场景假象**（非空 invalidated 真实路径 diff=0，已验） | — | 撤项或并入 R1 接线后重评 |
| R3 | low | **fixed** | 9-24 F-R3 | ctx 类型三分（`as { viewCache? }` 结构断言）+ cache 三套（ModuleResultCache / view bundle Map / style bare Map） | `orchestrator.ts:187` / `stage-channel.ts:49` | **ctx 断言收敛 fixed**（fe-tools-hmr-chain-residuals complete 2026-10-09：StageChannelContext typed 边界，grep `ctx as {`=0）；cache 三套结构统一仍 residual（独立） |
| R4 | low | fixed | 9-24 F-R4 | 叙事/导航漂移：`docs/fe-tools/README.md` 可能标 packer-context 为 draft，STATUS 已 complete | `docs/fe-tools/README.md` | **IRC 导航修**：状态标注本已正确（false positive）；补全 G1-G5+IRC 导航链（README:15 列全 6 Action）。 |
| R5 | info | open | 9-24 F-R5 | 首次 state 路径一律 reconcile（空图 merge ≡ build）——行为正确，可读性绕 | `packer/graph.ts` / `env.ts storeInfo` | 注释约定，非缺陷 |
| R6 | medium | fixed | 10-09 F2 | style cache-hit 无集成级 `.css` 字节恒等断言（仅 unit mock + 一次性脚本） | `__tests__/view-style-cache-skip.spec.js` 集成 ① | **IRC 补**：集成 ① 加 `pages_home_index.css` build1==build2 字节恒等断言。 |
| R7 | low | fixed | 10-09 F3 | `viewCompileResults` vestigial——G5 改读 `viewPageBundles` 后，该字段返回+postMessage 但 stage-channel 不再消费（死数据） | `view/index.ts:172` / `runtime.ts:33` | **IRC 决策**：保留（不从 shape 删——防破 response 消费者 + HMR-future dirty signal）；更新 `view/index.ts:172` 既有 stale 注释标 vestigial-but-intentional。 |
| R8 | low | fixed | 10-09 F4 | 集成测 `DIMINA_COMPILER_DIFF_VERIFY` env 不 reset（afterEach 缺）→ 泄漏后续 test | `__tests__/view-style-cache-skip.spec.js:160` | **IRC 补**：integration `afterEach` 加 `delete process.env.DIMINA_COMPILER_DIFF_VERIFY`。**SMPU 后**：env var 删除（dual-path 下线），reset moot——view-style-cache-skip.spec.js env setup 整块移除。 |
| R9 | info | fixed | 10-09 F5 | `ensureWxsScan` cache-hit 路径冗余（无条件调，hit page 不消费） | `view/index.ts compileML` 顶部 | **IRC 条件化**：`compileML` 加 `hasMiss` 预检（与 loop cache-hit 逐字同式）→ 全 cache-hit 跳过 ensureWxsScan（保守性约束 documented）。 |
| X1 | low | open | 10-09 G1-G5 广回顾 | G4 归档 acceptance A-G43 仍写“per-module viewCache.set”，G5 改 per-page-bundle 后代码已变；G4 live 测试随 G5 改，归档 doc 因“complete 不可变”未同步 | `docs/actions/_archive/complete/fe-tools-view-style-compile-res/acceptance.md` A-G43 | 归档不可重写；architecture-notes G5 条目已记反转，作为 bridge |
| R10 | high | fixed | 10-09 probe | **dual-path 验证缺口**：`DIMINA_COMPILER_DIFF_VERIFY` gate 使 verify 脚本走 parse-walk per-module minify（保 `\n`），production（bin/ 不设）走 emit aggregated minify（删 `\n`）——两路径字节不同，G1-G5+IRC 6 轮 behavior-0 验的不是 production 路径 | `style/emit.ts:14` 注释自述 / `style/parse-walk.ts:377,390` guards / `style/emit.ts:63,75` minify 块 | **SMPU 闭合**（`fe-tools-style-minify-path-unify`）：删 `isDiffVerifyMode()` + env var + dual-path guards → 统一到 parse-walk per-module（方案 A locked）；emitStyle 删两 minify 块 → 仅 package。反转 D-SM-4/D-CN-4 Non-scope（字节一致现为要求）。bridge D-SM-2/D-CN-1/D-CN-3 反转（canonical 回 parse-walk）。行为 0：post-SMPU production（no env）== pre-SMPU verify（env=1）6 项目 diff=0。 |

## 解决优先级

**已闭合（IRC `fe-tools-incremental-chain-residuals-closeout`，2026-10-09）**：R1 / R6 / R7 / R8 / R4 / R9 全 `fixed`。

**已闭合（SMPU `fe-tools-style-minify-path-unify`，2026-10-09）**：R8 env moot（随 dual-path 下线）+ R10 dual-path 验证缺口 `fixed`。

**剩余 open**：
1. **R3** ctx 类型三分（HMR 前接受；架构笔记/residuals tracker 保持可见）
2. **R5** 首次 reconcile 可读性（非缺陷）
3. **X1** G4 归档 doc drift（归档不可变；architecture-notes G5 条目 bridge）

**已降级**：R2（人工空场景假象，真实路径 diff=0）
| F-HR-1 | low | **partial** | 10-09 HMR 血缘复盘 | ~~loaderRegistry 注册零消费~~ **partial fixed**：orchestrator load stage `kinds()/get()` 生产消费点 ✓ + CompileRegistryImpl/EmitRegistryImpl 实体化 ✓（complete 2026-10-09）；view/style Loader 注册 blocked（形状适配=接口演进 Non-scope，deferred 后续门） | `packer/orchestrator.ts:83` | [fe-tools-hmr-chain-residuals](../actions/fe-tools-hmr-chain-residuals/README.md) R-HR-1（(a) done；(b)/(c) deferred） |
| F-HR-2 | info | **fixed** | 10-09 HMR 血缘复盘 | ~~L_HMR 无生产合成路径~~ **fixed（通道补齐）**：`--hmr`/`DMCC_HMR` flag → preview-adapter `enableHmr: state.hmr`（complete 2026-10-09，默认 false=今日）；**默认 true deferred**（runtime HMR API 就绪后翻 flag） | `dev/dev-reload.ts:62` / `session/preview-adapter.ts:43` | [fe-tools-hmr-chain-residuals](../actions/fe-tools-hmr-chain-residuals/README.md) R-HR-2 ✓ |
| F-HR-3 | low | **fixed** | 10-09 HMR 血缘复盘 | ~~selective 端到端零证据~~ **fixed**：`view-selective-stages.spec.js` 2 tests（build() 全链 stage-channel 边界：selective 触发+dirty 子集+字节恒等，complete 2026-10-09） | `view/index.ts:122` / `stage-channel.ts:84` | [fe-tools-hmr-chain-residuals](../actions/fe-tools-hmr-chain-residuals/README.md) R-HR-3 ✓ |
| ③a | low | **fixed** | HMR 伞 A-HMR6 残留 | ~~model→pipeline leak 分支 1~~ **fixed**：`COMPILE_STAGE_ORDER` 定义迁 model（src/model/stage-order.ts），invalidation.ts:69 import model（complete 2026-10-09，`grep pipeline/ src/model/invalidation.ts`=0） | `model/stage-order.ts` | [fe-tools-hmr-chain-residuals](../actions/fe-tools-hmr-chain-residuals/README.md) R-HR-5 ✓ |
| ③b | low | fixed | F-R1-1 review 发现 / directory-convergence 消解 | model→pipeline leak 分支 2（runtime）：`getCompileStagesForFiles` from `compile-stages.ts`——directory-convergence 后 compile-cache 迁 `packer/cache/`、compile-stages 迁 `packer/pipeline/`，import 收敛 intra-packer（`../pipeline/compile-stages`） | `packer/cache/compile-cache.ts:5` | fixed 2026-10-09（fe-tools-packer-directory-convergence B4） |
| ③c | info | fixed | F-R2-2 review 发现 / directory-convergence 消解 | model→pipeline leak 分支 3（type-only，erased）：`import type { EmitModule }` from `emit.ts`——directory-convergence 后 convergence 迁 `packer/emit/`、emit 迁 `packer/emit/`，import 收敛同子目录（`./emit`） | `packer/emit/convergence.ts:3` | fixed 2026-10-09（fe-tools-packer-directory-convergence B3） |
