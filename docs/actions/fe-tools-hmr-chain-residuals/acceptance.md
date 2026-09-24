# Acceptance — fe-tools-hmr-chain-residuals

Status: **ready（2026-10-09）**

## Acceptance（实施后填实）

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-HR1 | R-HR-1 registry 管线接线 | `loaderRegistry.get/kinds` 有生产调用点（grep 非零）；view/style Loader 已注册——**单测断言 `kinds()` 含 logic/view/style + `get(kind)` 返回注册实现**；**compileRegistry/emitRegistry 非空**（阶段函数注册——单测断言各 registry 注册实现非空，独立于 LoaderRegistry） | grep + registry 单测（loader/compile/emit 三 registry 各验） | pending |
| A-HR2 | R-HR-2 L_HMR 激活通道 | `enableHmr` 有生产设值点（flag 透传 preview-adapter）；默认关时 reload payload 与 baseline 恒等；flag 开时增量（stages>0）合成 L_HMR（非限定单 kind——dev-reload.ts:62 逻辑） | 单测（flag 两态）+ payload dump | pending |
| A-HR3 | R-HR-3 selective 链路级验证 | stage-channel 边界级测试：selective 触发 + pageBundles 只含 dirty 子集 + orderList 全量 + **pageBundles（dirty 子集 + cached clean 经 orderList 组装）与全量重编 pageBundles 字节恒等** | 新 spec（触发/子集/字节三断言） | pending |
| A-HR4 | R-HR-4 R3 ctx 类型收敛 | **ctx 字段断言全部经 typed 边界**（grep `ctx as {` 在 stage-channel + orchestrator 的 ctx 字段集 = 0；result/task 局部窄化不计）；单一 typed 边界声明在档 | grep `ctx as {` + tsc | pending |
| A-HR5 | R-HR-5 COMPILE_STAGE_ORDER 下沉 | **定义点迁 model**（`compile-target.ts:21` → model）+ 全消费点 import 改 model（`invalidation.ts:69` + `compile-stages.ts:1` = 0 `pipeline` import in model）；compile-cache 分支记 tracker residual（非本项） | grep + vitest + tracker diff | pending |
| A-HR6 | R-HR-6 行为 0 | tsc 0 + vitest 全绿 + 6 项目 diff=0 | 三件套执行记录 | pending |
| A-HR7 | R-HR-7 tracker 同步 | F-HR-1..3 入档；R3 状态更新；③ 记消解 | residuals tracker diff | pending |

## Non-acceptance（显式排除）

- ① env.ts upward leak（W3 轨道）；logicLoader sourcemap；runtime HMR API；cache 三套结构统一（见 requirements Non-scope）

## Traceability

- F-HR-1（loader 零消费）↔ A-HR1；F-HR-2（L_HMR 无合成路径）↔ A-HR2；F-HR-3（selective 无链路证据）↔ A-HR3
- R3 ↔ A-HR4；③ ↔ A-HR5；行为 0 ↔ A-HR6；tracker ↔ A-HR7
