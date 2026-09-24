# FE Tools Incremental Chain Residuals Closeout

- Action: `fe-tools-incremental-chain-residuals-closeout`
- Status: `ready`
- Updated: 2026-10-09
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-view-style-cache-skip`](../_archive/complete/fe-tools-view-style-cache-skip/README.md)（**complete**；G5——view/style cache-hit skip 算法）
- 参照：[2026-09-24 Packer/incremental retrospect](../../fe-tools/2026-09-24-packer-incremental-retrospect.md) · [2026-10-09 G5 impl retrospect](../../fe-tools/2026-10-09-g5-impl-closeout-retrospect.md) · [2026-10-09 G1-G5 broad retrospect](../../fe-tools/2026-10-09-g1-g5-broad-retrospect.md) · [residuals tracker](../../fe-tools/incremental-chain-residuals.md)

## Background

三轮回顾（9-24 / 10-09 G5 / 10-09 G1-G5）consolidate 出 10 条 residual（[tracker](../../fe-tools/incremental-chain-residuals.md)）。其中：

- **R1（high）**：G5 算法 + 单测 + 集成测齐备，但 **watch-runner 从未实例化 `viewCache`/`styleCache`**（`watch-runner.ts:90` 仅 `new PackerSessionState()`，不赋值）→ 生产 watch 永远 miss、G5 效能空转（正确性无影响——miss=全量=正确输出；效能未兑现）。三轮一致确认，是唯一 high。one-shot 路径（`index.ts:38` / `build-pipeline.ts:23`）正确保持 `undefined` → no-op → diff=0（非缺口）。
- R6（medium）：style cache-hit 无集成级 `.css` 字节恒等断言。
- R7（low）：`viewCompileResults` vestigial——G5 改读 `viewPageBundles` 后该字段返回+postMessage 但不再被消费。
- R8（low）：集成测 `DIMINA_COMPILER_DIFF_VERIFY` env 不 reset。
- R4（low）：`docs/fe-tools/README.md` 导航漂移（packer-context 标 draft，STATUS 已 complete）。
- R9（info，可选）：`ensureWxsScan` cache-hit 路径冗余。

G1–G5 逐门算法 + 接线 + invalidatedModules 端到端链路均已坐实代码（广回顾 §2）；唯一未闭合点 = R1。

## Goal

闭合 G5 生产效能路径（R1 watch cache 实例化）+ 清理回顾浮出的低风险 residual（R6/R7/R8/R4/R9），使"incremental-unify 闭合"在**效能路径**上真正落地（算法齐备 + 链路接通 + 终点有 cache）。

## Non-goals

- R3（ctx 类型三分 + cache 三套）——HMR 前接受，[residuals tracker](../../fe-tools/incremental-chain-residuals.md) 保持可见。
- R5（首次 state 路径一律 reconcile）——非缺陷（行为正确，可读性绕）。
- X1（G4 归档 acceptance A-G43 per-module→per-page-bundle drift）——归档不可变（"complete=终态"），architecture-notes G5 条目已 bridge。
- R2（logic cache / static-copy watch diff）——已降级（人工空 invalidated 场景假象，真实路径 diff=0，广回顾 §3 验证）。
- HMR / load-compile 分离 / worker-runtime 独立包 / 删 `DIMINA_COMPILER_DIFF_VERIFY`——后续门。
- 重写 G4 归档文档 / 重开已 complete Action。

## Design inputs

- [G5 归档](../_archive/complete/fe-tools-view-style-cache-skip/)（D-G5-1..6 + D-G5-4' per-page-bundle）
- [residuals tracker](../../fe-tools/incremental-chain-residuals.md)（R1..R9 + X1 状态/位置/建议）
- 3 PackerSessionState 创建点：`watch-runner.ts:90`（watch，缺口）/ `index.ts:38` + `build-pipeline.ts:23`（one-shot，正确 undefined）
- `view/index.ts viewCompile` 返回 `{ viewCompileResults, viewPageBundles }`（G5）
- `runtime.ts:33` `Object.assign(response, compileResult)` postMessage（viewCompileResults 当前 vestigial）

## Deliverables

- R1：watch-runner 实例化 `viewCache`/`styleCache` + 接线回归测（注入 state + mock build，不手建 Map）
- R6：集成测 ① 加 `.css` 字节恒等断言
- R7：`viewCompileResults` 保留决策 + 注释标注 HMR-future dirty signal
- R8：集成测 `afterEach` reset env
- R4：`docs/fe-tools/README.md` 导航漂移修
- R9（SHOULD）：`ensureWxsScan` 移入 cache-miss 条件分支
- R-IRC-8：architecture-notes + IRC docs 记录 R1 接线修正 G5 A-G51 叙事超前（**G5 归档不重写**，immutable）

## Readiness gaps

- 设计已明确（R1 接线点 + R7 保留决策 + R9 条件化）——**无 readiness blocker**，draft 后可直接 review 升 ready。

## Closure conditions

- R1 生产 watch cache 接线生效（回归测：注入 state + mock build → `state.viewCache` 是 `Map` instance，由 watch-runner R1 接线赋值非手建）
- 行为 0 三件套（one-shot diff=0 不变；watch 字节恒等集成测 pass）
- residual tracker R1/R6/R7/R8/R4/R9 标 `fixed`；R3/R5/X1/R2 标 `wontfix`/`downgraded`（Non-acceptance）
