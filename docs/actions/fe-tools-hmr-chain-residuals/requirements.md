# Requirements — fe-tools-hmr-chain-residuals

Status: **draft（2026-10-09）**

## 问题陈述

HMR-compiler 伞（H1-H4 + 全部 Phase 2）收口后，复盘核实"交付"的实际状态分三档：**代码在（函数/类型存在）/ 接线在（生产调用链可达）/ 证据在（链路级验证）**。多处交付只在第一或第二档：

- **F-HR-1（low）loader 注册零消费**——`packer/orchestrator.ts:83-84` 实体化 `LoaderRegistryImpl` + 注册 `logicLoader`，但全仓无 `loaderRegistry.get/kinds` 生产调用（仅 `packer/types.ts:376` 文档注释描述 dispatch）。registry 是"注册态"非"消费态"。
- **F-HR-2（info，by design 但接线与 locked 决策不符）L_HMR 无生产合成路径**——`dev/dev-reload.ts:40` `synthesizeReloadLevel` 有 `enableHmr` 参数（默认 false），唯一生产调用点 `session/preview-adapter.ts:43` 不传 → 恒 false → L_HMR 永不合成。D-PUSH-2 locked 选项②（runtime-side downgrade）要求**编译侧发 L_HMR payload**——当前接线与 locked 决策不符（H4 以 F3 风险 accepted 交付了参数但未接线）。
- **F-HR-3（low）selective 端到端零证据**——H3 Phase 2 selective recompile 生产接线在（`stage-channel.ts:52` `invalidatedModules` → worker `view/index.ts:202` → compileML `dirtySet`），但仅有 4 个 compileML 直调集成测试；watch 链路级（state 长驻 → invalidate → selective 触发 → dirty 子集 → bundle 字节恒等）无验证。IPC 经济收益（单组件变更只传 dirty module）为设计推算未实测。
- **R3 条件过期**——residuals tracker R3（ctx 类型三分 as-assertions：`stage-channel.ts:49` / `orchestrator.ts:187`）标注"HMR 前可接受"；HMR 已完成，条件失效。
- **③ model→pipeline leak**——`model/invalidation.ts:69` import `COMPILE_STAGE_ORDER` from `compiler/pipeline/compile-target.ts`（D-REG-3 deferred 项）。

## Goal

使 HMR 编译侧交付的三档对齐：registry 从注册态变消费态、L_HMR 从参数变激活通道、selective 从集成测试变链路级证据；顺带收敛 R3/③ 两处边界残留。

## Requirements

### R-HR-1（MUST）— registry 管线接线
`loaderRegistry` 有生产消费点（非零调用）；view/style Loader 注册（`viewLoadModule`/`styleLoad` 阶段函数经 Loader 接口接入）；compile/emit registry 实体化（阶段函数注册）。接线程度与路径由 D-HR-1 锁，但**注册态无消费不可接受**（否则 R-HR-1 不算 pass）。

### R-HR-2（MUST）— L_HMR 激活通道
`enableHmr` 有生产设值点（非默认参数孤立存在）；激活策略由 D-HR-2 锁；默认态安全（未显式激活时 reload 行为与今日一致）；与 D-PUSH-2 locked 决策的差距消除或书面 re-lock。

### R-HR-3（MUST）— selective watch 链路级验证
测试覆盖真实生产链（至少 stage-channel → worker → compileML 边界，层级由 D-HR-3 锁）：(a) selective 分支真实触发；(b) pageBundles 只含 dirty 子集 + orderList 全量；(c) selective 产物与全量重编字节恒等。

### R-HR-4（MUST）— R3 ctx 类型收敛
`stage-channel.ts:49` / `orchestrator.ts:187` 结构断言（`ctx as { viewCache? }` 等）收敛为单一 typed 边界（类型声明一处，消费点窄化）。cache 三套结构统一**不在**本项（见 Non-scope）。

### R-HR-5（MUST）— COMPILE_STAGE_ORDER 下沉
`model/invalidation.ts:69` 不再 import `compiler/pipeline/*`——常量迁 model 或 shared（消费点同步）。**③ 含两分支**：`invalidation.ts:69`（COMPILE_STAGE_ORDER——本项消解）+ `model/compile-cache.ts:5`（`getCompileStagesForFiles`——**记 residual，非本项**：stage 概念归位依赖 registry dispatch 深化，D-HR-1 后续门评）。

### R-HR-6（MUST）— 行为 0
one-shot 6 项目 diff=0 + tsc 0 errors + vitest 全绿。registry 接线 / L_HMR 通道默认态均不得改变 one-shot 产物字节。

### R-HR-7（SHOULD）— residuals tracker 同步
**入档（draft 时即做）**：F-HR-1..3 进 tracker（open）；R3 注条件过期；③ 两分支入档（invalidation 分支本 Action 消解 / compile-cache 分支 residual）。**状态更新（close 时）**：消解项置 fixed + 证据链接。

## Constraints

- **非双路径（D-REG-1 延续）**——registry 接线若引入新编译路径，须唯一化或明确单域，不得与既有 worker 路径并行双轨
- **行为 0 三件套**——所有接线默认态字节恒等；L_HMR 激活属 reload payload 语义（非 build 产物），须有独立验证
- **W3 延续**——env.ts 不整体拆（① 留既有轨道）
- **伞 close 注记不重开**——HMR-compiler 归档不可变；本 Action 是其注记残留的正统续篇，非重开

## Non-scope

- ① env.ts→packer upward leak（W3 gradual 轨道）
- logicLoader sourcemap（types.ts LoadedModule 形状变更——独立评估）
- runtime HMR API / runtime-side downgrade 的运行时实现（运行时侧）
- cache 三套结构统一（ModuleResultCache / viewCache / styleCache——记 residual）
- 重开/重写已 complete 归档 Action

## 依赖

- H2 Phase 2 阶段函数 + registry 实现（complete）
- H3/H4 Phase 2 交付物（complete）
- 无外部阻塞（runtime 依赖被 D-HR-2 策略隔离在激活侧，不阻塞接线）

## Traceability

- F-HR-1 → R-HR-1；F-HR-2 → R-HR-2；F-HR-3 → R-HR-3
- R3 → R-HR-4；③ → R-HR-5
- 行为 0 → R-HR-6；tracker → R-HR-7
