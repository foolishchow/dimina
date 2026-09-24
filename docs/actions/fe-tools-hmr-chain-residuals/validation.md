# Validation — fe-tools-hmr-chain-residuals

Status: **in_progress（2026-10-09）**

## Validation Plan（实施后执行）

| ID | 验证项 | 命令/方法 | 状态 |
| --- | --- | --- | --- |
| P-HR1 | registry 生产消费 | `grep -rn "loaderRegistry\.\(get\|kinds\)" src/`（非零且非测试）+ registry 注册内容单测 | pending |
| P-HR2 | L_HMR flag 两态 | 单测：默认关 payload == baseline（**baseline = `dev-reload.spec.js` 既有 18 tests 的 L1/L2/L3 语义**，不变）；开 + 增量（stages>0，非限定单 kind——dev-reload.ts:62） → L_HMR + changedStages + affectedPages | pending |
| P-HR3 | selective 链路级 | 新 spec：两轮 build（priming + invalidate）经 stage-channel 边界；断言 selective/dirty/orderList/字节恒等 | pending |
| P-HR4 | ctx 断言收敛 | `grep -n "ctx as {" src/compiler/pipeline/stage-channel.ts src/packer/orchestrator.ts` ctx 字段全部经 typed 边界（grep ctx as { 在 ctx 字段集 = 0；result/task 局部窄化不计） | pending |
| P-HR5 | ③ import 消解 | `grep -n "pipeline/" src/model/invalidation.ts` = 0 | pending |
| P-HR6 | 行为 0 三件套 | `tsc --noEmit` 0；vitest 全绿；6 项目 one-shot `diff -r` = 0 | pending |
| P-HR7 | tracker 同步 | **入档（draft 已做）**：F-HR-1..3 + R3 条件过期 + ③a/b/c；**close 时状态更新**：F-HR-1/3 fixed + R3 fixed + ③a fixed（③b/③c open）+ F-HR-2 fixed（通道补齐）+ 默认 true deferred | pending |

## 行为 0 边界（本 Action 特别声明）

- **one-shot diff=0**：registry 接线 / flag 透传默认态不得改变 build 产物字节（P-HR6）
- **reload payload 语义**：L_HMR flag 默认关时 `synthesizeReloadLevel` 输出与 baseline 逐字段恒等（P-HR2）——reload 非 build 产物，须独立断言
- **验证档位声明**（§1 教训落实）：本表每项须注明验证档位（代码/接线/证据）——P-HR1/3/4/5 须达"证据"档（非 grep-only）

## Uncovered（预期声明）

- L_HMR 默认开启的端到端（runtime-side downgrade 是运行时侧）——flag 开态只验 payload 合成，不验容器消费
- registry dispatch 全替换（D-HR-1 选项 A）——本 Action locked B，A 留后续门
