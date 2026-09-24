# Acceptance — fe-tools-hmr-chain-residuals

Status: **draft（2026-10-09）**

## Acceptance（实施后填实）

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-HR1 | R-HR-1 registry 管线接线 | `loaderRegistry.get/kinds` 有生产调用点（grep 非零）；view/style Loader 已注册；compile/emit registry 非空——**单测断言 `kinds()` 含 logic/view/style + `get(kind)` 返回注册实现** | grep + registry 单测 | pending |
| A-HR2 | R-HR-2 L_HMR 激活通道 | `enableHmr` 有生产设值点（flag 透传 preview-adapter）；默认关时 reload payload 与 baseline 恒等；flag 开时单 kind 增量合成 L_HMR | 单测（flag 两态）+ payload dump | pending |
| A-HR3 | R-HR-3 selective 链路级验证 | stage-channel 边界级测试：selective 触发 + pageBundles 只含 dirty 子集 + orderList 全量 + 产物与全量重编字节恒等 | 新 spec（触发/子集/字节三断言） | pending |
| A-HR4 | R-HR-4 R3 ctx 类型收敛 | **ctx 字段**断言收敛（grep `ctx as {` 在 stage-channel + orchestrator 收敛为 typed；result/task 局部窄化不在内）；单一 typed 边界声明在档 | grep `ctx as {` + tsc | pending |
| A-HR5 | R-HR-5 COMPILE_STAGE_ORDER 下沉 | `model/invalidation.ts` 无 `compiler/pipeline` import（grep = 0）；compile-cache 分支记 tracker residual（非本项消解） | grep + vitest + tracker diff | pending |
| A-HR6 | R-HR-6 行为 0 | tsc 0 + vitest 全绿 + 6 项目 diff=0 | 三件套执行记录 | pending |
| A-HR7 | R-HR-7 tracker 同步 | F-HR-1..3 入档；R3 状态更新；③ 记消解 | residuals tracker diff | pending |

## Non-acceptance（显式排除）

- ① env.ts upward leak（W3 轨道）；logicLoader sourcemap；runtime HMR API；cache 三套结构统一（见 requirements Non-scope）

## Traceability

- F-HR-1（loader 零消费）↔ A-HR1；F-HR-2（L_HMR 无合成路径）↔ A-HR2；F-HR-3（selective 无链路证据）↔ A-HR3
- R3 ↔ A-HR4；③ ↔ A-HR5；行为 0 ↔ A-HR6；tracker ↔ A-HR7
