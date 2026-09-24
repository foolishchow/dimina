# Design Draft — fe-tools-hmr-chain-residuals

Status: **in_progress（2026-10-09）**

## §1 实证：三档证据分级（2026-10-09 复盘核实）

| 项 | 代码在 | 接线在 | 证据在 | 锚点 |
| --- | --- | --- | --- | --- |
| selective recompile | ✓ | ✓ | ✗（4 个 compileML 直调） | `view/index.ts:122-133`（三分支）；`stage-channel.ts:52`（invalidatedModules 下发）；`stage-channel.ts:84-92`（selective 消费） |
| L_HMR payload | ✓ | ✗ | ✗（单测显式传 true） | `dev/dev-reload.ts:40`（参数）；`session/preview-adapter.ts:43`（调用不传 → 恒 false） |
| logicLoader | ✓ | ✗ | ✗（包装等价 6 tests） | `compiler/logic/registry-impl.ts`；`packer/orchestrator.ts:83-84`（注册） |
| compile/emit registry | ✗ stub | ✗ | — | `packer/types.ts:376`（dispatch 仅文档注释）；orchestrator compile/emit 空 |

**教训（方法论）**："交付"必须区分三档——本 Action 存在的原因就是伞级 acceptance 粒度（子门 scope 交付）不区分接线/激活/实测。后续 Action 的 acceptance 应显式声明验证档位。

## §2 D-HR-1：registry 接线程度（design gate）

现状：orchestrator 编译主流走 stage-channel → worker（postMessage）；registry 侧 `loaderRegistry` 已注册 logic，compile/emit registry 空。types.ts 文档注释描述的目标形态：`loaderRegistry.kinds()` 每 kind 派发（load）→ compile → emit。

| 选项 | 内容 | 风险 |
| --- | --- | --- |
| **A 全替换** | orchestrator 编译路径整体改 registry dispatch（load→compile→emit 经 registry，替换 stage-channel/worker 主流） | M-L；行为 0 风险高（IPC 边界重排）；与 worker 并行能力冲突（registry 在主线程） |
| **B 首消费点渐进** | load 侧接线：orchestrator Logic/View/Style stage 前置经 `loaderRegistry.get(kind)` 取 Loader 执行发现（dependencies 写图），compile/emit 维持现有 worker 路径；C/E registry 注册阶段函数（供后续门消费）但生产 dispatch 仅 load | M；单路径（load 发现归 registry，编译归 worker——域不重叠）；行为 0 可守（load 结果与 storeInfo 现状等价） |
| **C 注册+单域** | 仅再注册 view/style Loader + C/E 阶段函数注册；生产消费仅一处演示性调用（如 CLI inspect） | S；但"演示性调用"近乎自欺——R-HR-1 的"非零消费"要求勉强过、价值近零 |

**locked B**：与 D-REG-1 渐进先例一致（每次接线一个域、非双路径）；load 是三段中最薄（发现+依赖写图），worker 编译主流不动。C/E 注册是"代码在"档提升，dispatch 留给下个门。

**待 formalize 详评**：① Loader 接口与 storeInfo graph reconcile 的衔接点（loader 写图 vs storeInfo 写图的唯一权威——PS2 约束）；② **view/style Loader 形状适配**——viewLoadModule 虽 per-module 可调（H2 Phase 2 基座），但 wxs 聚合/继承上下文与 Loader 接口语义的边界（logicLoader 是整段包装，view 是逐模块函数——两种形状共存于一 registry 的接口一致性）。

## §3 D-HR-2：L_HMR 激活策略（design gate）

D-PUSH-2 locked 选项②要求编译侧发 L_HMR、runtime 自降 L1。当前 preview-adapter 不传 `enableHmr`（恒 false）。**F3 风险**：runtime-side downgrade 未实现——直接置 true 时容器收到未知 level，preview reload 行为未定义（可能断更）。

| 选项 | 内容 | 风险 |
| --- | --- | --- |
| **a 直接 true** | preview-adapter 传 `enableHmr: true`（对齐 locked 决策） | preview 立即暴露 F3（容器未实现 downgrade）——dev 体验回退 |
| **b flag-gated** | env/CLI flag（如 `DMCC_HMR=1` / `--hmr`），preview-adapter 读 flag 传 `enableHmr`；默认关（行为 = 今日） | S；激活通道真实存在 + 默认安全；与 locked 决策的差距书面 re-lock 为"flag 默认关，runtime 就绪后翻默认" |
| **c 保持未接线** | 只文档化激活动作 | 零风险但 R-HR-2 不满足（无生产设值点） |

**locked b**：激活通道存在（接线档位补齐）+ 默认字节/行为恒等；D-PUSH-2 的完整兑现（默认 true）挂在 runtime 就绪条件上，tracker 记 F-HR-2 fixed（通道补齐）+ 默认 true deferred（runtime 就绪）。**回退**：flag 关即回今日行为（无状态残留——flag 只影响 synthesizeReloadLevel 入参）。

## §4 D-HR-3：selective 验证层级（design gate）

| 选项 | 内容 | 风险 |
| --- | --- | --- |
| **watch-runner 级** | 起 dev/watch 进程 + touch 文件 + 断言产物 | 最真但重（进程编排 flaky；compile-cli-cache flaky 先例） |
| **stage-channel 边界级** | 直调 compile-target/stage-channel 两次（首轮 priming state：viewCache/orderList；次轮 invalidatedModules），断言 selective flag + dirty 子集 + 字节恒等 | 中；覆盖 worker 序列化边界（msg → viewCompile → pageBundles → stage-channel 消费全链），不起进程 |
| **compileML 级（现状）** | 已有 4 tests | 不满足 R-HR-3（缺 stage-channel/worker 段） |

**locked stage-channel 边界级**：覆盖增量链 G5 已验证的 state 长驻边界（IRC R1 先例——watch-runner 实例化 cache）+ selective 触发，不起进程避免 flaky。IPC 经济实测（dirty 子集规模）以 dump 断言形式并入（非生产 instrument）。

## §5 小修设计

- **R3 类型收敛**：stage ctx 单一接口（建议 `model/` 或 `packer/types.ts` 声明 `StageChannelContext`），`stage-channel.ts:49` / `orchestrator.ts:187` 消费点删结构断言改 typed 引用。纯类型改动（erased at runtime）——行为 0 天然。
- **③ 下沉**：`COMPILE_STAGE_ORDER` 定义点迁 `model/`（消费点：invalidation.ts + compile-stages.ts + compile-target 内部；全消费点 import 更新）。

## §6 规模评估

| 块 | 规模 | 备注 |
| --- | --- | --- |
| D-HR-1 选项 B | M | load 接线 + 3 Loader 注册 + C/E 注册 |
| D-HR-2 选项 b | S | flag 透传 preview-adapter |
| D-HR-3 边界级测试 | S-M | 测试编排 + 字节恒等断言 |
| R3 + ③ | M | 类型（ctx 字段集 ~14 跨 2 文件，实证 R2 上调）+ 常量迁移 |
| **合计** | **M** | 单 Action 可承载（切法 2 用户已选）；R3 规模实证上调（S→M） |

依赖序：③（独立）∥ R3（独立）→ D-HR-2 → D-HR-3；D-HR-1 最大可并行先行。

## §7 Readiness

- D-HR-1 locked B / D-HR-2 locked b / D-HR-3 locked stage-channel 边界级（2026-10-09 formalize 锁定）
- Loader 接口与 storeInfo 图权威衔接点（§2 待评项）是 D-HR-1 唯一实质设计风险——实施期评（不阻塞 ready：选项 B 的 load 接线在 storeInfo 现有 graph 写入点内，衔接形状可在 implementation-plan 详述）
- 无外部阻塞；runtime 依赖被 D-HR-2(b) 隔离
