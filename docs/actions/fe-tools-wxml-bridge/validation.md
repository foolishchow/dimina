# Validation — fe-tools-wxml-bridge

Status: **ready（2026-09-14）** — P-WB00..05；升 `in_progress` 时记基线 SHA（随门递进），Result 届时回填

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-WB00 | workspace + VENDOR | `cd fe/tools/crates && cargo test`（≥483 绿）；VENDOR/docs 主从/D-WIR-1 修订在档 | A-WB0 | pending |
| P-WB01 | SpanView 对拍 | napi 单测：node/attr/expr-body span + raw + sourceFile 透传 与 crate 同源用例三一致；JS 薄包 require 未构建 → `[wxml]` 指引 | A-WB1 / A-WB5 | pending |
| P-WB02 | 行为 0（code） | 基线快照 vs HEAD（base 工程），`node scripts/sync-dist-from-src.js` 前置；diff -rq（产物除 map 外）必须 0 | A-WB3 | pending |
| P-WB03 | napi 构建/加载 | `napi build` 产出 `.node`；`@dimina/wxml-parser-napi` require 成功 | A-WB1 | pending |
| P-WB04 | map 断言 | 抽查集（含 include/import 页面）inMap 行目标 = 真 {file,line}；**无 include/import 页行级 = 今日 1:1**（不变量，对比线：实施前基线 map）；列级可验 | A-WB2 / A-WB3 / A-WB5 | pending |
| P-WB05 | diff 范围 | `git diff --stat`：限 crates/ + wxml-parser-napi + view 路径 + 测例；`fe/tools/bundler/../packages` 零命中 | A-WB4 | pending |
| P-WB06 | 消融 ×2 | **W1**：拔桥（无 `.node`）→ P-WB01 失败 → 恢复；**W2**：拔 span（SpanView null）→ P-WB04 失败 → 恢复 | A-WB1 / A-WB2 Notes | pending |

## 消融纪律（Experience-Review §6）

- 只禁用 / 移除待验证的最小修复机制；**不得**同时修改测试、夹具、输入数据和断言；
- 消融后目标用例必须因**原缺陷对应断言**失败（非编译错误 / 环境损坏 / 无关异常 / 超时）；
- 恢复后用相同命令与环境下再次运行并通过；消融补丁、临时日志不得进入最终提交。

## Uncovered（闭合时声明）

- 预览冒烟 / 真机 / 视觉截图：非 MUST，声明不开
- 性能量化：仅基准记录（parse 100 页耗时），不做优化