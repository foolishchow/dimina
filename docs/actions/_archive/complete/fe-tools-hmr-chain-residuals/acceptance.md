# Acceptance — fe-tools-hmr-chain-residuals

Status: **complete（2026-10-09）**

## Acceptance（实施后填实）

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-HR1 | R-HR-1 registry 管线接线 | `loaderRegistry.get/kinds` 有生产调用点（grep 非零）；view/style Loader 已注册——单测断言 `kinds()` 含 logic/view/style + `get(kind)` 返回注册实现；compileRegistry/emitRegistry 非空（阶段函数注册） | grep + registry 单测（loader/compile/emit 三 registry 各验） | ✅ partial — (a) kinds/get 生产消费点 ✓（orchestrator load stage）+ 三 registry 实体化 ✓（CompileRegistryImpl/EmitRegistryImpl 替代 stub，单测断言）；(b) view/style Loader 注册 **blocked**（形状适配 Non-scope，deferred 后续门）；(c) 阶段函数注册 **blocked**（同 b）。证据档：代码+接线 ✓，全量证据 deferred |
| A-HR2 | R-HR-2 L_HMR 激活通道 | `enableHmr` 有生产设值点（flag 透传 preview-adapter）；默认关时 reload payload 与 baseline 恒等；flag 开时增量（stages>0）合成 L_HMR | 单测（flag 两态）+ payload dump | ✅ done — bin/dev.ts `--hmr`+`DMCC_HMR`；session/index.ts 透传；preview-adapter.ts `enableHmr: state.hmr`（默认 false=今日）。dev-reload.spec.js 18 tests 全 pass（默认关恒等） |
| A-HR3 | R-HR-3 selective 链路级验证 | stage-channel 边界级测试：selective 触发 + pageBundles 只含 dirty 子集 + orderList 全量 + 字节恒等 | 新 spec（触发/子集/字节三断言） | ✅ done — `view-selective-stages.spec.js` 2 tests：(a+b+d) viewCache dirty 变+clean 不变+规模=1；(c) 字节恒等。build() 全链证据档 |
| A-HR4 | R-HR-4 R3 ctx 类型收敛 | ctx 字段断言全部经 typed 边界（grep `ctx as {` = 0）；单一 typed 边界声明在档 | grep `ctx as {` + tsc | ✅ done — types.ts StageChannelContext（16 字段）；stage-channel 12 处 + orchestrator 20 处收敛；grep=0（唯一 types.ts:92 注释） |
| A-HR5 | R-HR-5 COMPILE_STAGE_ORDER 下沉 | 定义点迁 model + 全消费点 import 改 model（invalidation+compile-stages = 0 `pipeline` import in model）；compile-cache 分支记 tracker residual | grep + vitest + tracker diff | ✅ done — NEW src/model/stage-order.ts；compile-target/invalidation/compile-stages 改 import model；`grep pipeline/ src/model/invalidation.ts`=0（③a 消解） |
| A-HR6 | R-HR-6 行为 0 | tsc 0 + vitest 全绿 + 6 项目 diff=0 | 三件套执行记录 | ✅ done — tsc 0；vitest 87/646；6 项目 diff=0；V-PC-5 0 |
| A-HR7 | R-HR-7 tracker 同步 | 入档（draft 已做）+ close 时状态更新 | tracker diff review | ✅ done — F-HR-1 partial + F-HR-2 fixed（通道补齐，默认 true deferred）+ F-HR-3 fixed + R3 fixed + ③a fixed（③b/③c open） |

## Non-acceptance（显式排除）

- ① env.ts upward leak（W3 轨道）；logicLoader sourcemap；runtime HMR API；cache 三套结构统一；**view/style Loader 形状适配 + 阶段函数 fit（types.ts 接口演进）**——Non-scope（见 requirements），deferred to 后续门

## Residual（close 时显式声明）

- **A-HR1 (b)/(c)** = R-HR-1 (b)/(c)：blocked by Non-scope（接口演进）→ deferred 后续门。本 Action 交付 (a) + 三 registry 实体化（行为 0 ✓）
- **F-HR-2 默认 true** deferred（runtime 就绪后翻 flag）
- **③b/③c** open（residual，runtime 无害）
- **R-HR-6 runtime cycle** SHOULD partial（0 cycle ✓，runtime partial update 外部阻塞）

## Traceability

- F-HR-1（loader 零消费）↔ A-HR1（partial：kinds/get 消费 ✓，view/style 注册 deferred）
- F-HR-2（L_HMR 无合成路径）↔ A-HR2（fixed：通道补齐，默认 true deferred）
- F-HR-3（selective 无链路证据）↔ A-HR3（fixed：view-selective-stages.spec.js）
- R3（条件过期）↔ A-HR4（fixed：ctx typed 边界）
- ③（model→pipeline import）↔ A-HR5（③a fixed，③b/③c open）
- 行为 0 ↔ A-HR6；tracker ↔ A-HR7
