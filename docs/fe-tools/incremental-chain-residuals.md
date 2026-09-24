# 增量链 Residuals 跟踪表（G1–G5）

- 性质：living doc，记录两轮 retrospect（[9-24](./2026-09-24-packer-incremental-retrospect.md) · [10-09](./2026-10-09-g5-impl-closeout-retrospect.md)）发现的缺口 + 后续回顾的新增
- 状态：`open` / `fixed` / `downgraded` / `wontfix`
- 权威参考：[architecture-notes.md](./architecture-notes.md) · [STATUS.md](../actions/STATUS.md)

## 跟踪表

| ID | 严重度 | 状态 | 来源 | 摘要 | 代码位置 | 建议动作 |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | high | open | 9-24 F-R1 / 10-09 F1 | watch-runner 未实例化 viewCache/styleCache → 生产 watch 永远 miss、G5 效能空转（正确性无影响） | `watch/watch-runner.ts:90` | 热修：session 后 `state.viewCache/styleCache = new Map()` + 真实 watcher 回归测 + 回写 G5 文档 |
| R2 | — | downgraded | 9-24 F-R2 / 10-09 验证 | logic cache / static-copy watch diff——**人工空 invalidated 场景假象**（非空 invalidated 真实路径 diff=0，已验） | — | 撤项或并入 R1 接线后重评 |
| R3 | low | open | 9-24 F-R3 | ctx 类型三分（`as { viewCache? }` 结构断言）+ cache 三套（ModuleResultCache / view bundle Map / style bare Map） | `orchestrator.ts:187` / `stage-channel.ts:49` | HMR 前可接受；架构笔记保持可见 |
| R4 | low | open | 9-24 F-R4 | 叙事/导航漂移：`docs/fe-tools/README.md` 可能标 packer-context 为 draft，STATUS 已 complete | `docs/fe-tools/README.md` | 文档导航修 |
| R5 | info | open | 9-24 F-R5 | 首次 state 路径一律 reconcile（空图 merge ≡ build）——行为正确，可读性绕 | `packer/graph.ts` / `env.ts storeInfo` | 注释约定，非缺陷 |
| R6 | medium | open | 10-09 F2 | style cache-hit 无集成级 `.css` 字节恒等断言（仅 unit mock + 一次性脚本） | `__tests__/view-style-cache-skip.spec.js` 集成 ① | 补 `.css` 断言 |
| R7 | low | open | 10-09 F3 | `viewCompileResults` vestigial——G5 改读 `viewPageBundles` 后，该字段返回+postMessage 但 stage-channel 不再消费（死数据） | `view/index.ts:185` / `runtime.ts:33` | 决策：保留（标 HMR-future dirty signal）或删（瘦 worker 消息） |
| R8 | low | open | 10-09 F4 | 集成测 `DIMINA_COMPILER_DIFF_VERIFY` env 不 reset（afterEach 缺）→ 泄漏后续 test | `__tests__/view-style-cache-skip.spec.js:160` | `afterEach` reset env |
| R9 | info | open | 10-09 F5 | `ensureWxsScan` cache-hit 路径冗余（无条件调，hit page 不消费） | `view/index.ts compileML` 顶部 | 微浪费，非缺陷 |
| X1 | low | open | 10-09 G1-G5 广回顾 | G4 归档 acceptance A-G43 仍写“per-module viewCache.set”，G5 改 per-page-bundle 后代码已变；G4 live 测试随 G5 改，归档 doc 因“complete 不可变”未同步 | `docs/actions/_archive/complete/fe-tools-view-style-compile-res/acceptance.md` A-G43 | 归档不可重写；architecture-notes G5 条目已记反转，作为 bridge |

## 解决优先级

1. **R1** 热修（最小 diff + 真实 watcher 回归测 + 回写 G5 文档一行）——闭合 9-24 F-R1 + 10-09 F1
2. **R6** 补 `.css` 断言
3. **R7** 决策 `viewCompileResults` 去留
4. **R8** reset env
5. **R4** 文档导航修
6. **R3** ctx 类型三分（HMR 前接受）
7. **R2** 撤项（已降级）
