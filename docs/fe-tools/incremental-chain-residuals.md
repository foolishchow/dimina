# 增量链 Residuals 跟踪表（G1–G5）

- 性质：living doc，记录两轮 retrospect（[9-24](./2026-09-24-packer-incremental-retrospect.md) · [10-09](./2026-10-09-g5-impl-closeout-retrospect.md)）发现的缺口 + 后续回顾的新增
- 状态：`open` / `fixed` / `downgraded` / `wontfix`
- 权威参考：[architecture-notes.md](./architecture-notes.md) · [STATUS.md](../actions/STATUS.md)

## 跟踪表

| ID | 严重度 | 状态 | 来源 | 摘要 | 代码位置 | 建议动作 |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | high | fixed | 9-24 F-R1 / 10-09 F1 | watch-runner 未实例化 viewCache/styleCache → 生产 watch 永远 miss、G5 效能空转（正确性无影响） | `watch/watch-runner.ts:90` | **IRC 接线**：watch-runner :91-93 `if (!sessionState.viewCache) sessionState.viewCache = new Map()` + styleCache 同；接线回归测（注入 state + mock build，`watch-runner.spec.js` D-IRC-5）验 viewCache/styleCache 是 Map instance（不手建 Map）。tracker 原建议「真实 watcher 回归测 + 回写 G5 文档」经 review 修正为「mock build 接线测 + G5 归档不重写」（F1 immutable + F2 真实 watcher infeasible）。 |
| R2 | — | downgraded | 9-24 F-R2 / 10-09 验证 | logic cache / static-copy watch diff——**人工空 invalidated 场景假象**（非空 invalidated 真实路径 diff=0，已验） | — | 撤项或并入 R1 接线后重评 |
| R3 | low | open | 9-24 F-R3 | ctx 类型三分（`as { viewCache? }` 结构断言）+ cache 三套（ModuleResultCache / view bundle Map / style bare Map） | `orchestrator.ts:187` / `stage-channel.ts:49` | HMR 前可接受；架构笔记保持可见 |
| R4 | low | fixed | 9-24 F-R4 | 叙事/导航漂移：`docs/fe-tools/README.md` 可能标 packer-context 为 draft，STATUS 已 complete | `docs/fe-tools/README.md` | **IRC 导航修**：状态标注本已正确（false positive）；补全 G1-G5+IRC 导航链（README:15 列全 6 Action）。 |
| R5 | info | open | 9-24 F-R5 | 首次 state 路径一律 reconcile（空图 merge ≡ build）——行为正确，可读性绕 | `packer/graph.ts` / `env.ts storeInfo` | 注释约定，非缺陷 |
| R6 | medium | fixed | 10-09 F2 | style cache-hit 无集成级 `.css` 字节恒等断言（仅 unit mock + 一次性脚本） | `__tests__/view-style-cache-skip.spec.js` 集成 ① | **IRC 补**：集成 ① 加 `pages_home_index.css` build1==build2 字节恒等断言。 |
| R7 | low | fixed | 10-09 F3 | `viewCompileResults` vestigial——G5 改读 `viewPageBundles` 后，该字段返回+postMessage 但 stage-channel 不再消费（死数据） | `view/index.ts:172` / `runtime.ts:33` | **IRC 决策**：保留（不从 shape 删——防破 response 消费者 + HMR-future dirty signal）；更新 `view/index.ts:172` 既有 stale 注释标 vestigial-but-intentional。 |
| R8 | low | fixed | 10-09 F4 | 集成测 `DIMINA_COMPILER_DIFF_VERIFY` env 不 reset（afterEach 缺）→ 泄漏后续 test | `__tests__/view-style-cache-skip.spec.js:160` | **IRC 补**：integration `afterEach` 加 `delete process.env.DIMINA_COMPILER_DIFF_VERIFY`。 |
| R9 | info | fixed | 10-09 F5 | `ensureWxsScan` cache-hit 路径冗余（无条件调，hit page 不消费） | `view/index.ts compileML` 顶部 | **IRC 条件化**：`compileML` 加 `hasMiss` 预检（与 loop cache-hit 逐字同式）→ 全 cache-hit 跳过 ensureWxsScan（保守性约束 documented）。 |
| X1 | low | open | 10-09 G1-G5 广回顾 | G4 归档 acceptance A-G43 仍写“per-module viewCache.set”，G5 改 per-page-bundle 后代码已变；G4 live 测试随 G5 改，归档 doc 因“complete 不可变”未同步 | `docs/actions/_archive/complete/fe-tools-view-style-compile-res/acceptance.md` A-G43 | 归档不可重写；architecture-notes G5 条目已记反转，作为 bridge |

## 解决优先级

**已闭合（IRC `fe-tools-incremental-chain-residuals-closeout`，2026-10-09）**：R1 / R6 / R7 / R8 / R4 / R9 全 `fixed`。

**剩余 open**：
1. **R3** ctx 类型三分（HMR 前接受；架构笔记/residuals tracker 保持可见）
2. **R5** 首次 reconcile 可读性（非缺陷）
3. **X1** G4 归档 doc drift（归档不可变；architecture-notes G5 条目 bridge）

**已降级**：R2（人工空场景假象，真实路径 diff=0）
