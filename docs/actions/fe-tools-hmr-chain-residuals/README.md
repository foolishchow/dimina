# FE Tools HMR Chain Residuals

- Action: `fe-tools-hmr-chain-residuals`
- Status: `draft`
- Updated: 2026-10-09
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-hmr-compiler`](../_archive/complete/fe-tools-hmr-compiler/README.md)（伞 **complete** 2026-10-09；子门 H1-H4 + 全部 Phase 2 交付）
- 术语 / 结构真源：[docs/fe-tools/architecture-notes](../../fe-tools/architecture-notes.md)
- 文档集：[requirements](requirements.md) · [design.draft](design.draft.md) · [acceptance](acceptance.md) · [validation](validation.md)

## Background

HMR-compiler 伞收口后复盘核实发现：链上多处交付处于**"代码在、接线断、证据缺"**三档不同状态——伞级 A-HMR* 标 pass 的粒度是"子门 scope 交付"，不区分接线/激活/实测。逐项 grep 核实（[design.draft §1](design.draft.md)）：

| 交付 | 代码 | 接线 | 证据 |
| --- | --- | --- | --- |
| selective recompile（H3 Phase 2） | ✓ | ✓（stage-channel `invalidatedModules` → worker → compileML dirtySet） | ✗ 仅 4 个 compileML 直调集成测试，零 watch 链路级 |
| L_HMR payload（H4 Phase 1） | ✓ | ✗ `enableHmr` 参数存在但生产无设值点（`preview-adapter.ts:43` 不传 → 恒 false → L_HMR 永不合成） | 单测 4 个（显式传 true） |
| logicLoader（H2 Phase 2） | ✓ | ✗ `orchestrator.ts:84` 注册后**零消费**（全仓无 `loaderRegistry.get/kinds` 生产调用，仅 types.ts:376 文档注释提及） | 包装等价 6 tests |
| compile/emit registry | ✗ stub（阶段函数已就绪未注册） | ✗ | — |

另有伞 close 注记在档的小残留：R3 ctx 类型三分（"HMR 前接受"条件**已过期**——HMR 已完成）+ ③ model→pipeline leak（`invalidation.ts:69` `COMPILE_STAGE_ORDER`，D-REG-3 deferred 项）。

**问题**：编译侧 HMR 名义全交付，但 (a) registry 管线从未被生产路径消费（Packer shape 激活不完整）；(b) L_HMR 无激活通道（D-PUSH-2 locked "runtime-side downgrade" 要求编译侧发 L_HMR——当前接线与之不符）；(c) selective 的核心卖点（watch 单组件变更只重编该模块）无端到端证据。

## Goal

HMR 编译侧血缘**全量收口**：registry 管线接线（loader 真消费 + view/style 注册 + C/E 实体化）+ L_HMR 激活通道（策略见 D-HR-2）+ selective watch 链路级验证 + R3/③ 小修——使"交付"三档（代码/接线/证据）对齐。

## Non-goals

- **① env.ts→packer upward leak**——W3 gradual migration 既有轨道，不重复立项（残留见伞 close 注记）
- **logicLoader sourcemap**——pre-esbuild map 无法经 LoadedModule 流（需 types.ts 形状变更，独立评估）
- **runtime HMR API**（运行时侧——外部依赖不变）+ runtime-side downgrade 的 runtime 实现
- **cache 三套结构统一**（ModuleResultCache / viewCache / styleCache）——R3 本 Action 只收敛 ctx 类型断言；结构统一记 residual
- 重开已 complete 归档 Action / 重写归档文档

## Design inputs

- [H2 Phase 2 交付物](../../fe-tools/architecture-notes.md)：`logicLoader`（`compiler/logic/registry-impl.ts`）+ `LoaderRegistryImpl`（`packer/registry.ts`）+ view/style L/C/E 阶段函数（`viewLoadModule`/`styleLoad`/`styleCompile`/`styleEmit` 等）
- [H3 Phase 2]：compileML 三分支（cache-hit → **selective** → 全量）+ `ViewSelectContext`
- [H4 Phase 1/2]：`synthesizeReloadLevel` `enableHmr` 参数（`dev/dev-reload.ts:40`）+ `getDirtyEntries`
- [D-PUSH-2 locked 选项②]：runtime-side downgrade——编译侧发 L_HMR，runtime 收后自降 L1（当前接线恒 L1，与 locked 决策不符）
- [D-REG-1..3]：registry 渐进非双路径约束（接线策略的设计先例）
- [residuals tracker](../../fe-tools/incremental-chain-residuals.md)：R3（open，条件已过期）

## Deliverables

1. registry 管线接线：`loaderRegistry` 生产消费点 + view/style Loader 注册 + compile/emit registry 实体化（程度由 D-HR-1 锁）
2. L_HMR 激活通道：`enableHmr` 生产设值点（策略由 D-HR-2 锁；默认安全、行为 0）
3. selective watch 链路级测试（触发 + dirty 子集 + 字节恒等；层级由 D-HR-3 锁）
4. R3 ctx 类型收敛（`stage-channel.ts:49` / `orchestrator.ts:187` as-assertions → 单一 typed 边界）
5. `COMPILE_STAGE_ORDER` 下沉（`model/invalidation.ts:69` upward import 消解）
6. 行为 0 三件套验证 + residuals tracker 更新（F-HR-1..3 入档/闭合）

## Readiness gaps

- **D-HR-1** registry 接线程度（A 全替换 worker dispatch / B 首消费点渐进 / C 注册+单域消费）——design.draft §2 评
- **D-HR-2** L_HMR 激活策略（直接 true / flag-gated / 保持未接线）——design.draft §3 评；F3 风险（runtime downgrade 未实现时 preview 行为）须评估
- **D-HR-3** selective 测试层级（watch-runner 级 vs stage-channel 边界级）——design.draft §4 评

## Closure conditions

- R-HR-1..6（MUST）全 pass 且证据可复现；R-HR-7（SHOULD）pass 或在档
- 持久发现回流 architecture-notes；residuals tracker 同步
- 行为 0：one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿
- STATUS / 导航一致；validator 0 error 0 warning

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-09 | 立项 `draft`：伞 close 后复盘讨论浮出"三档证据分级"（代码/接线/证据）+ F-HR-1..3 + 伞注记残留；切法 2（血缘全量收口） |
